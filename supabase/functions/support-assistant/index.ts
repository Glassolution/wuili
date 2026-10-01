// Assistente de suporte da Velo (Gemini direto, com function calling).
// Ações:
//   - { action: "send", message }            → usuário conversa com o assistente
//   - { action: "admin_reply", escalationId, message, status? } → admin assume
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getSellerAccessToken } from "../_shared/mlSellerToken.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const MODEL = "gemini-3.8-flash";
const LIMITE_DIARIO = 40;
const APP_URL = Deno.env.get("APP_URL") ?? "https://velods.com.br";

const SYSTEM = `Você é o assistente de suporte da Velo, plataforma brasileira que ajuda iniciantes a vender no Mercado Livre com produtos de fornecedores nacionais. Fale SEMPRE em português brasileiro simples, frases curtas, tom acolhedor. Sem jargão técnico.

Como a Velo funciona (fatos confirmados, pode responder direto):
- Quando o usuário vende no Mercado Livre, ele NÃO compra, embala nem envia nada por conta própria. Ele entra em Pedidos no painel da Velo e paga o custo do produto ao fornecedor. Depois do pagamento, o fornecedor envia o produto direto para o cliente dele.
- Os anúncios são publicados na conta do Mercado Livre que o usuário conectou em Integrações.

Regras:
- Dúvida sobre publicar, conta de vendedor, anúncio que não sobe, conexão com o Mercado Livre: chame "verificar_conta_mercado_livre" ANTES de responder e explique exatamente o que falta, com passo a passo curto (ex.: entrar em mercadolivre.com.br > Meu perfil > Dados pessoais/Endereços e cadastrar CEP e endereço; ou cadastrar/confirmar celular).
- Outras dúvidas: chame "buscar_central_de_ajuda" e responda com base nos artigos, incluindo o link do artigo em markdown.
- Nunca invente preços, prazos, regras ou funcionalidades. Planos: Base R$39,90/mês, Pro R$79,80/mês, Business R$189,90/mês. Não existe plano gratuito.
- Chame "acionar_suporte_humano" quando: (a) aparecer um erro/situação que você não reconhece, (b) a dúvida não for coberta pela central nem pela verificação de conta, (c) o usuário pedir para falar com uma pessoa, ou (d) envolver reembolso, cobrança, cancelamento ou dinheiro.
- Ao acionar o suporte humano, NUNCA mencione "escalar", "ticket", "fila" ou ferramentas. Apenas diga de forma natural algo como: "Vou pedir para alguém da equipe olhar isso com você. A resposta vai aparecer aqui mesmo." e continue ajudando no que puder.
- Nunca peça senha, código de verificação ou dados de cartão.`;

const TOOLS = [{
  functionDeclarations: [
    {
      name: "verificar_conta_mercado_livre",
      description: "Verifica, em tempo real, se a conta do Mercado Livre conectada deste usuário pode publicar anúncios e o que está impedindo.",
      parameters: { type: "object", properties: {} },
    },
    {
      name: "buscar_central_de_ajuda",
      description: "Busca artigos na Central de Ajuda da Velo.",
      parameters: { type: "object", properties: { consulta: { type: "string", description: "Palavras-chave da dúvida" } }, required: ["consulta"] },
    },
    {
      name: "acionar_suporte_humano",
      description: "Pede, de forma discreta, que a equipe humana assuma o atendimento.",
      parameters: {
        type: "object",
        properties: {
          motivo: { type: "string", description: "erro_desconhecido | fora_da_base | pediu_humano | reembolso | financeiro" },
          resumo: { type: "string", description: "Resumo curto do problema para a equipe" },
        },
        required: ["motivo", "resumo"],
      },
    },
  ],
}];

// Traduz os códigos de bloqueio de /users/me para linguagem de gente.
const TRADUCAO: Record<string, string> = {
  address_pending: "falta cadastrar o endereço (CEP, rua, número, cidade) na conta do Mercado Livre",
  address_empty: "falta cadastrar o endereço na conta do Mercado Livre",
  zip_code_pending: "falta cadastrar o CEP na conta do Mercado Livre",
  phone_pending: "falta cadastrar ou confirmar o número de celular na conta do Mercado Livre",
  phone_not_verified: "o celular da conta do Mercado Livre ainda não foi confirmado",
  identification_pending: "falta cadastrar o CPF/CNPJ na conta do Mercado Livre",
  user_documentation_pending: "o Mercado Livre está pedindo documentos para validar a identidade",
  kyc_pending: "o Mercado Livre está pedindo validação de identidade (envio de documento/selfie)",
  email_not_validated: "o e-mail da conta do Mercado Livre ainda não foi confirmado",
  restrictions_coliving: "a conta tem restrição por outra conta vinculada",
  seller_restricted: "a conta está com restrição de vendas pelo próprio Mercado Livre",
};

async function verificarContaML(admin: SupabaseClient, userId: string) {
  const tok = await getSellerAccessToken(admin, userId);
  if (!tok.ok) {
    const semIntegracao = tok.error.includes("sem integração");
    const r = {
      pode_publicar: false,
      problema: semIntegracao
        ? "a conta do Mercado Livre não está conectada à Velo"
        : "a conexão com o Mercado Livre expirou e precisa ser refeita",
      como_resolver: "Ir em Integrações no painel da Velo e conectar (ou desconectar e conectar de novo) o Mercado Livre.",
      link: `${APP_URL}/dashboard/integracoes`,
    };
    await admin.from("ml_seller_readiness").upsert({
      user_id: userId, can_list: null, codes: [], source: "assistente",
      last_error: semIntegracao ? "sem_integracao" : "conexao_expirada", checked_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    return r;
  }
  const res = await fetch("https://api.mercadolibre.com/users/me", { headers: { Authorization: `Bearer ${tok.accessToken}` } });
  const me = await res.json().catch(() => ({}));
  if (!res.ok) return { pode_publicar: null, problema: `não foi possível consultar o Mercado Livre agora (erro ${res.status})` };
  const st = me?.status ?? {};
  const listAllow = st?.list?.allow === true;
  const sellAllow = st?.sell?.allow === true;
  const codes: string[] = [...new Set([
    ...(Array.isArray(st?.list?.codes) ? st.list.codes : []),
    ...(Array.isArray(st?.sell?.codes) ? st.sell.codes : []),
  ].map(String))];
  const faltando: string[] = [];
  const addr = me?.address ?? {};
  if (!addr?.zip_code) faltando.push("CEP");
  if (!addr?.address) faltando.push("endereço (rua e número)");
  if (!addr?.city) faltando.push("cidade");
  if (!me?.phone?.number) faltando.push("número de celular");
  if (!me?.identification?.number) faltando.push("CPF/CNPJ");

  await admin.from("ml_seller_readiness").upsert({
    user_id: userId, can_list: listAllow && sellAllow, codes, source: "assistente",
    ml_user_id: tok.mlUserId, last_error: null, checked_at: new Date().toISOString(),
  }, { onConflict: "user_id" });

  return {
    pode_publicar: listAllow && sellAllow,
    apelido_conta: me?.nickname ?? null,
    tipo_conta: me?.user_type ?? null,
    bloqueios: codes.map((c) => TRADUCAO[c] ?? `código do Mercado Livre não reconhecido: ${c}`),
    dados_faltando_no_cadastro: faltando,
    onde_corrigir: "mercadolivre.com.br > Meu perfil > Meus dados (endereço, telefone e documento)",
    observacao: "Se houver código não reconhecido, acione o suporte humano.",
  };
}

async function buscarAjuda(admin: SupabaseClient, consulta: string) {
  const { data } = await admin.rpc("search_help_articles", { p_query: consulta.slice(0, 200), p_limit: 4 });
  const itens = (data ?? []) as Array<{ title: string; summary: string; content: string; path: string }>;
  if (!itens.length) return { artigos: [], observacao: "Nada encontrado na central." };
  return {
    artigos: itens.map((a) => ({
      titulo: a.title, resumo: a.summary, conteudo: (a.content ?? "").slice(0, 1500),
      link: a.path?.startsWith("http") ? a.path : `${APP_URL}${a.path ?? "/ajuda"}`,
    })),
  };
}

async function escalar(admin: SupabaseClient, userId: string, motivo: string, resumo: string, diag: unknown) {
  const { data: aberto } = await admin.from("support_escalations").select("id")
    .eq("user_id", userId).neq("status", "resolvido").maybeSingle();
  if (aberto) {
    await admin.from("support_escalations").update({
      reason: motivo, summary: resumo, updated_at: new Date().toISOString(),
      ...(diag ? { ml_diagnostic: diag } : {}),
    }).eq("id", aberto.id);
  } else {
    await admin.from("support_escalations").insert({ user_id: userId, reason: motivo, summary: resumo, ml_diagnostic: diag ?? null });
  }
  return { ok: true };
}

type Part = { text?: string; functionCall?: { name: string; args?: Record<string, unknown> }; functionResponse?: unknown; thoughtSignature?: string };
type Content = { role: "user" | "model"; parts: Part[] };

async function chamarGemini(key: string, contents: Content[]) {
  // Até 3 tentativas com espera crescente, só para 429/5xx (sobrecarga passageira).
  let r: Response | null = null;
  for (let t = 0; t < 3; t++) {
    if (t) await new Promise((ok) => setTimeout(ok, 1500 * t + Math.random() * 500));
    r = await chamarGeminiUmaVez(key, contents);
    if (r.ok || (r.status !== 429 && r.status < 500)) return r;
  }
  return r!;
}

async function chamarGeminiUmaVez(key: string, contents: Content[]) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents, tools: TOOLS,
      generationConfig: { temperature: 0.4 },
    }),
  });
  return r;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const supportToken = req.headers.get("x-support-token");
    if (supportToken) return await responderTicket(admin, req, supportToken);
    const authHeader = req.headers.get("Authorization") ?? "";
    const { data: u } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!u?.user) return json({ error: "Faça login novamente." }, 401);
    const userId = u.user.id;

    const body = await req.json().catch(() => ({}));
    const message = typeof body?.message === "string" ? body.message.trim().slice(0, 2000) : "";

    if (body?.action === "admin_reply") {
      const { data: ehAdmin } = await admin.rpc("is_admin", { _user_id: userId });
      if (ehAdmin !== true) return json({ error: "Somente administradores" }, 403);
      const { data: esc } = await admin.from("support_escalations").select("id,user_id").eq("id", String(body.escalationId ?? "")).maybeSingle();
      if (!esc) return json({ error: "Pedido não encontrado" }, 404);
      if (message) await admin.from("support_ai_messages").insert({ user_id: esc.user_id, role: "admin", content: message });
      const status = ["aberto", "em_atendimento", "resolvido"].includes(body.status) ? body.status : (message ? "em_atendimento" : undefined);
      if (status) {
        await admin.from("support_escalations").update({
          status, assigned_admin: userId, updated_at: new Date().toISOString(),
          resolved_at: status === "resolvido" ? new Date().toISOString() : null,
        }).eq("id", esc.id);
      }
      return json({ ok: true });
    }

    if (!message) return json({ error: "Escreva sua dúvida." }, 400);
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) return json({ error: "Assistente ainda não configurado." }, 503);

    const desde = new Date(Date.now() - 86400_000).toISOString();
    const { count } = await admin.from("support_ai_messages").select("id", { count: "exact", head: true })
      .eq("user_id", userId).eq("role", "user").gte("created_at", desde);
    if ((count ?? 0) >= LIMITE_DIARIO) {
      await escalar(admin, userId, "limite_diario", "Usuário atingiu o limite diário de mensagens do assistente.", null);
      return json({ reply: "Você já conversou bastante comigo hoje. Pedi para alguém da equipe continuar com você por aqui." });
    }

    await admin.from("support_ai_messages").insert({ user_id: userId, role: "user", content: message });

    const { data: hist } = await admin.from("support_ai_messages").select("role,content")
      .eq("user_id", userId).eq("archived", false).order("created_at", { ascending: false }).limit(30);
    const contents: Content[] = [];
    for (const m of (hist ?? []).reverse()) {
      const role = m.role === "user" ? "user" : "model";
      const text = m.role === "admin" ? `[Mensagem da equipe Velo] ${m.content}` : m.content;
      const last = contents[contents.length - 1];
      if (last && last.role === role) last.parts.push({ text });
      else contents.push({ role, parts: [{ text }] });
    }
    if (contents[0]?.role === "model") contents.unshift({ role: "user", parts: [{ text: "Olá" }] });

    const usadas: Array<{ name: string; result: unknown }> = [];
    let diag: unknown = null;
    let escalou = false;
    let reply = "";

    for (let i = 0; i < 6; i++) {
      const r = await chamarGemini(GEMINI_API_KEY, contents);
      if (!r.ok) {
        const t = await r.text();
        console.error("gemini", r.status, t.slice(0, 500));
        await escalar(admin, userId, "erro_assistente", `Falha do assistente (HTTP ${r.status}). Última mensagem: ${message.slice(0, 300)}`, diag);
        reply = "Tive um problema para responder agora. Já pedi para alguém da equipe olhar sua mensagem — a resposta aparece aqui.";
        escalou = true;
        break;
      }
      const d = await r.json();
      const parts: Part[] = d?.candidates?.[0]?.content?.parts ?? [];
      const calls = parts.filter((p) => p.functionCall);
      if (!calls.length) {
        reply = parts.map((p) => p.text ?? "").join("").trim();
        break;
      }
      contents.push({ role: "model", parts });
      const respostas: Part[] = [];
      for (const c of calls) {
        const { name, args = {} } = c.functionCall!;
        let result: unknown;
        try {
          if (name === "verificar_conta_mercado_livre") { result = await verificarContaML(admin, userId); diag = result; }
          else if (name === "buscar_central_de_ajuda") result = await buscarAjuda(admin, String(args.consulta ?? message));
          else if (name === "acionar_suporte_humano") {
            result = await escalar(admin, userId, String(args.motivo ?? "outro"), String(args.resumo ?? message), diag);
            escalou = true;
          } else result = { erro: "ferramenta desconhecida" };
        } catch (e) {
          console.error("tool", name, e);
          result = { erro: "falha ao executar, considere acionar suporte humano" };
        }
        usadas.push({ name, result });
        respostas.push({ functionResponse: { name, response: { result } } });
      }
      contents.push({ role: "user", parts: respostas });
    }

    if (!reply) {
      reply = "Não consegui resolver isso sozinho. Pedi para alguém da equipe olhar com você — a resposta aparece aqui.";
      if (!escalou) await escalar(admin, userId, "erro_desconhecido", message.slice(0, 300), diag);
    }

    await admin.from("support_ai_messages").insert({
      user_id: userId, role: "assistant", content: reply, tool_calls: usadas.length ? usadas : null,
    });
    return json({ reply });
  } catch (e) {
    console.error("support-assistant", e);
    return json({ error: "Erro inesperado. Tente de novo em instantes." }, 500);
  }
});

// ───────── Respostas automáticas nos tickets da Caixa de entrada ─────────
const AVISO_ESPERA = "Já solicitei o atendimento humano. Aguarde, que em breve alguém da equipe Velo vai te responder por aqui.";

const AVISO_REEMBOLSO = "Pode ficar tranquilo(a): vou solicitar o seu reembolso à nossa equipe agora mesmo. O prazo para ele ser feito é de até 5 dias.";

const AVISO_REEMBOLSO_FORA_DO_PRAZO = "Sinto muito pelo transtorno. O reembolso da assinatura só é possível dentro de 7 dias após o pagamento, e esse prazo já passou na sua conta.\n\nO que posso fazer por você agora é cancelar a renovação automática, para você não ser cobrado de novo. Tudo continua funcionando normalmente até o fim do período já pago.\n\nVou passar o seu pedido para a nossa equipe, que te responde aqui mesmo nesta conversa.";

const SYSTEM_TICKET = `${SYSTEM}

Jeito de escrever nos tickets (muito importante):
- Escreva como uma pessoa real do atendimento conversando pelo chat: cordial, educada, formal na medida certa, leve e didática. Imagine que a pessoa nunca mexeu com tecnologia.
- NUNCA use termos técnicos, códigos ou palavras em inglês (ex.: rejected_by_regulations, address_pending, status, API, OAuth, token, integração). Traduza sempre para o que a pessoa entende: "o Mercado Livre ainda não liberou sua conta para vender", "falta cadastrar seu celular".
- NÃO use markdown para ênfase: sem asteriscos, sem negrito, sem títulos. A ÚNICA exceção é o link de artigo da Central de Ajuda: sempre que indicar um artigo, escreva-o como link markdown com o título do artigo, ex.: [Onde vejo o dinheiro das vendas](https://www.velods.com.br/ajuda/mercado-livre/dinheiro-das-vendas). Nunca cole o endereço solto nem entre parênteses. Outros endereços de site (ex.: mercadolivre.com.br) vão como texto simples.
- Divida a resposta em mensagens curtas, como alguém digitando no chat: cada mensagem separada por uma linha em branco, no máximo 4 mensagens, 1 a 3 frases cada. Passo a passo pode ficar numa mensagem só, uma etapa por linha.

Reembolso: reembolso da assinatura SÓ é possível dentro de 7 dias após o pagamento. Antes de prometer qualquer reembolso, considere a informação de prazo da assinatura informada no contexto. Se estiver dentro do prazo, chame "acionar_suporte_humano" com motivo "reembolso" e um resumo claro, e diga com gentileza que você vai solicitar o reembolso e que o prazo é de até 5 dias. Se o prazo de 7 dias já passou, NÃO prometa reembolso: explique com empatia que o prazo já passou, ofereça o cancelamento da renovação automática (o acesso continua até o fim do período pago) e chame "acionar_suporte_humano" com motivo "reembolso" mesmo assim, para a equipe avaliar. Não diga que o reembolso já foi feito nem tente convencer a pessoa a desistir.

Regra extra para tickets: sempre que chamar "acionar_suporte_humano" (erro de produto/pedido, erro que você não tem permissão ou meios para resolver, reembolso/cobrança/cancelamento, algo que você não reconhece, ou pedido de falar com uma pessoa), explique brevemente o que entendeu e termine EXATAMENTE com: "${AVISO_ESPERA}". Não tente resolver sozinho o que depende da equipe. Não mencione ferramentas.`;

// Remove marcações que o cliente veria como símbolos soltos.
function limparTexto(t: string): string {
  // Mantém links markdown [título](url): o chat os renderiza como link azul clicável.
  return t
    .replace(/\*\*|__|`/g, "")
    .replace(/(^|\s)\*([^*\n]+)\*(?=\s|[.,!?)]|$)/g, "$1$2")
    .replace(/^#+\s*/gm, "")
    .trim();
}

function dividirMensagens(t: string): string[] {
  const partes = limparTexto(t).split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (partes.length <= 5) return partes;
  return [...partes.slice(0, 4), partes.slice(4).join("\n\n")];
}

async function responderTicket(admin: SupabaseClient, req: Request, token: string) {
  const { data: tk } = await admin.from("cron_tokens").select("token").eq("name", "support-assistant").maybeSingle();
  if (!tk?.token || tk.token !== token) return json({ error: "não autorizado" }, 401);
  const body = await req.json().catch(() => ({}));
  const ticketId = String(body?.ticket_id ?? "");
  const messageId = String(body?.message_id ?? "");
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  if (!ticketId || !messageId || !GEMINI_API_KEY) return json({ skip: "dados" });

  // Pequeno debounce para agrupar mensagens seguidas sem deixar o cliente esperando.
  await new Promise((ok) => setTimeout(ok, 1000));

  const { data: ticket } = await admin.from("support_tickets")
    .select("id,user_id,status,ai_paused,needs_human").eq("id", ticketId).maybeSingle();
  if (!ticket || ticket.ai_paused || ticket.status === "closed") return json({ skip: "pausado_ou_fechado" });

  const { data: msgs } = await admin.from("support_messages")
    .select("id,message,sender,internal,attachment_url,created_at")
    .eq("ticket_id", ticketId).order("created_at", { ascending: true }).limit(200);
  const publicas = (msgs ?? []).filter((m) => !m.internal);
  // Depois que alguém da equipe responde, a IA sai da conversa.
  if (publicas.some((m) => m.sender === "admin")) return json({ skip: "humano_assumiu" });
  const ultimaUser = [...publicas].reverse().find((m) => m.sender === "user");
  if (!ultimaUser || ultimaUser.id !== messageId) return json({ skip: "nao_e_a_ultima" });

  const desde = Date.now() - 86400_000;
  const respostasIA = publicas.filter((m) => m.sender === "ai" && new Date(m.created_at).getTime() > desde).length;

  const marcarHumano = async (motivo: string, resumo: string) => {
    await admin.from("support_tickets").update({
      needs_human: true, needs_human_reason: motivo, needs_human_at: new Date().toISOString(),
    }).eq("id", ticketId);
    await admin.from("support_messages").insert({
      ticket_id: ticketId, user_id: ticket.user_id, sender: "ai", internal: true,
      message: `IA acionou atendimento humano — motivo: ${motivo}. ${resumo}`.slice(0, 1500),
    });
  };

  const enviar = async (texto: string) => {
    await admin.from("support_messages").insert({ ticket_id: ticketId, user_id: ticket.user_id, sender: "ai", message: texto });
    await admin.from("support_tickets").update({ updated_at: new Date().toISOString() }).eq("id", ticketId);
  };

  if (respostasIA >= 15) {
    if (!ticket.needs_human) {
      await marcarHumano("limite_ia", "A conversa ficou longa demais para a IA.");
      await enviar(AVISO_ESPERA);
    }
    return json({ skip: "limite" });
  }

  const contents: Content[] = [];
  // Mensagens automáticas (ex.: horário de atendimento) podem chegar depois da
  // pergunta; o Gemini exige que a conversa termine com a vez do usuário.
  const ateUltimaUser = publicas.slice(0, publicas.findIndex((m) => m.id === ultimaUser.id) + 1);
  for (const m of ateUltimaUser) {
    const role = m.sender === "user" ? "user" : "model";
    let text = String(m.message ?? "");
    if (m.attachment_url) text += "\n[o usuário enviou uma imagem]";
    const last = contents[contents.length - 1];
    if (last && last.role === role) last.parts.push({ text });
    else contents.push({ role, parts: [{ text }] });
  }
  if (contents[0]?.role === "model") contents.unshift({ role: "user", parts: [{ text: "Olá" }] });

  // Verifica se a assinatura mais recente do usuário ainda está no prazo de
  // reembolso (7 dias após o pagamento), para a IA não prometer o que não pode.
  const { data: assinatura } = await admin.from("subscriptions")
    .select("created_at,status")
    .eq("user_id", ticket.user_id)
    .in("status", ["active", "trialing", "paid", "approved"])
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  const dentroDoPrazoReembolso = !!assinatura?.created_at &&
    (Date.now() - new Date(assinatura.created_at).getTime()) <= 7 * 86400_000;

  let escalou = false;
  let reembolso = false;
  let reply = "";
  for (let i = 0; i < 6; i++) {
    const r = await chamarGemini(GEMINI_API_KEY, contents, SYSTEM_TICKET);
    if (!r.ok) {
      console.error("gemini ticket", r.status, (await r.text()).slice(0, 300));
      break;
    }
    const d = await r.json();
    const parts: Part[] = d?.candidates?.[0]?.content?.parts ?? [];
    const calls = parts.filter((p) => p.functionCall);
    if (!calls.length) { reply = parts.map((p) => p.text ?? "").join("").trim(); break; }
    contents.push({ role: "model", parts });
    const respostas: Part[] = [];
    for (const c of calls) {
      const { name, args = {} } = c.functionCall!;
      let result: unknown;
      try {
        if (name === "verificar_conta_mercado_livre") result = await verificarContaML(admin, ticket.user_id);
        else if (name === "buscar_central_de_ajuda") result = await buscarAjuda(admin, String(args.consulta ?? ultimaUser.message));
        else if (name === "acionar_suporte_humano") {
          const motivo = String(args.motivo ?? "outro");
          if (motivo === "reembolso") reembolso = true;
          if (!escalou) {
            const resumo = String(args.resumo ?? "");
            await marcarHumano(motivo, motivo === "reembolso" ? `SOLICITAÇÃO DE REEMBOLSO — prazo prometido ao cliente: até 5 dias. ${resumo}` : resumo);
          }
          escalou = true; result = { ok: true };
        } else result = { erro: "ferramenta desconhecida" };
      } catch (e) {
        console.error("tool", name, e);
        result = { erro: "falha ao executar, acione o suporte humano" };
      }
      respostas.push({ functionResponse: { name, response: { result } } });
    }
    contents.push({ role: "user", parts: respostas });
  }

  if (!reply) {
    if (!escalou && !ticket.needs_human) await marcarHumano("erro_desconhecido", "A IA não conseguiu responder esta mensagem.");
    escalou = true;
    reply = AVISO_ESPERA;
  }
  if (reembolso) {
    // Resposta única e fixa para reembolso: evita a IA repetir o mesmo aviso várias vezes.
    reply = `Entendi a sua situação e sinto muito pelo transtorno.\n\n${AVISO_REEMBOLSO}\n\nAssim que alguém da equipe Velo analisar, você recebe a resposta aqui mesmo nesta conversa.`;
  } else if (escalou && !reply.includes("atendimento humano")) reply = `${reply}\n\n${AVISO_ESPERA}`;
  const mensagens = dividirMensagens(reply);
  for (let i = 0; i < mensagens.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, Math.min(3500, 900 + mensagens[i].length * 18)));
    await enviar(mensagens[i]);
  }
  return json({ ok: true, escalou });
}
