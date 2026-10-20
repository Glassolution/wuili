// Assistente de suporte da Velo (Gemini direto, com function calling).
// Ações:
//   - { action: "send", message }            → usuário conversa com o assistente
//   - { action: "admin_reply", escalationId, message, status? } → admin assume
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getSellerAccessToken } from "../_shared/mlSellerToken.ts";
import { isSelfServiceCancellation, isCancellationConfirmation } from "../_shared/supportCancellation.ts";
import { classifyRefundContext } from "../_shared/supportRefundContext.ts";

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

// Mesmo texto do FAQ e da saudação automática da Caixa de entrada (src/lib/support.ts).
// Vale para qualquer aviso de que uma pessoa da equipe vai responder.
const HORARIOS_ATENDIMENTO =
  "Nosso horário de atendimento é de segunda a sexta das 13h às 21h, e aos sábados e domingos das 13h às 19h.";

const SYSTEM = `Você é o assistente de suporte da Velo, plataforma brasileira que ajuda iniciantes a vender no Mercado Livre com produtos de fornecedores nacionais. Fale SEMPRE em português brasileiro simples, frases curtas, tom acolhedor. Sem jargão técnico.

Como a Velo funciona (fatos confirmados, pode responder direto):
- Pós-venda (primeira venda e seguintes), explique SEMPRE este fluxo completo, em passos curtos e numerados:
  1) Quando alguém compra, a venda aparece na aba Pedidos da Velo.
  2) O usuário baixa a etiqueta de envio dessa venda no Mercado Livre (em Vendas, no pedido em aberto).
  3) Na Velo, clica no botão "Comprar" no pedido para ir direto ao produto no site da fornecedora.
  4) Faz o pedido preenchendo nome, endereço e telefone do cliente e anexa a etiqueta.
  5) No frete, escolhe a opção "Embalagem", porque o frete já foi pago pelo cliente através da etiqueta.
  6) Paga o pedido com o próprio dinheiro — esse valor volta depois, junto com o lucro.
  7) A fornecedora despacha o produto direto para o cliente, com a etiqueta colada.
  8) O status no Mercado Livre muda sozinho para "enviado" quando a etiqueta é escaneada na postagem.
  9) Depois do prazo de liberação do Mercado Livre (que varia conforme a reputação da conta), o valor da venda cai no Mercado Pago do usuário.
  10) O lucro é o valor da venda menos o que foi pago à fornecedora e as taxas do Mercado Livre.
- Se o cliente quiser trocar, devolver ou cancelar: a devolução/cancelamento é tratada pelo Mercado Livre (o cliente abre a reclamação/devolução no próprio Mercado Livre) e o reembolso do custo à fornecedora é alinhado com a Velo. Oriente a não prometer nada ao cliente antes de verificar o pedido.
- Os anúncios são publicados na conta do Mercado Livre que o usuário conectou em Integrações.

Perguntas frequentes sobre envio e funcionamento (responda direto, sem acionar humano):
- "Vocês enviam direto para o cliente final?" → Sim. Quem despacha é a fornecedora, direto para o endereço do cliente. O usuário nunca recebe o produto em casa.
- "Dá para enviar usando a etiqueta do Mercado Livre?" → Sim, é exatamente assim que funciona: o usuário baixa a etiqueta no Mercado Livre e anexa no pedido feito à fornecedora (passos 2 a 5 do fluxo de pós-venda acima).
- "Qual o prazo de postagem após a venda?" → O ideal é fazer o pedido à fornecedora no mesmo dia da venda, para a postagem acontecer dentro do prazo que o Mercado Livre mostra no anúncio. Atrasos na postagem prejudicam a reputação da conta.
- "A embalagem vai com identificação ou nota da Velo?" → Não. O pacote vai com a etiqueta do Mercado Livre, sem marca da Velo — para o cliente, a venda é do usuário.
- "Esse modelo é compatível com as regras do Mercado Livre?" → Sim. O usuário é o vendedor oficial no Mercado Livre, responde pela venda e usa a etiqueta oficial da plataforma. A Velo só conecta o catálogo de fornecedoras e facilita a publicação.
- "Como os pedidos do Mercado Livre chegam na Velo?" → Automaticamente: quando alguém compra no anúncio do usuário, a venda aparece na aba Pedidos da Velo, já com o botão "Comprar" para o produto na fornecedora.

Regras:
- Dúvida sobre publicar, conta de vendedor, anúncio que não sobe, conexão com o Mercado Livre: chame "verificar_conta_mercado_livre" ANTES de responder e explique exatamente o que falta, com passo a passo curto (ex.: entrar em mercadolivre.com.br > Meu perfil > Dados pessoais/Endereços e cadastrar CEP e endereço; ou cadastrar/confirmar celular).
- "Localização/endereço do produto" para o Mercado Livre: responda direto, sem ferramentas. O vendedor usa o PRÓPRIO endereço cadastrado na conta do ML (não precisa do endereço da fornecedora). A etiqueta é gerada pelo ML na venda e anexada no pedido à fornecedora, que despacha direto ao comprador.
- Outras dúvidas: chame "buscar_central_de_ajuda" e responda com base nos artigos, incluindo o link do artigo em markdown.
- Nunca invente preços, prazos, regras ou funcionalidades. Planos: Base R$39,90/mês, Pro R$79,80/mês, Business R$189,90/mês. Não existe plano gratuito.
- Chame "acionar_suporte_humano" quando: (a) aparecer um erro/situação que você não reconhece (bloqueios do Mercado Livre já traduzidos pela verificação de conta NÃO contam como desconhecidos: oriente primeiro o passo a passo), (b) a dúvida não for coberta pela central nem pela verificação de conta, (c) o usuário pedir para falar com uma pessoa, ou (d) envolver reembolso, cobrança ou dinheiro. Cancelar a renovação após 7 dias é feito pelo próprio usuário, sem atendimento humano e sem reembolso; o acesso continua até o fim do período pago.
- Ao acionar o suporte humano, NUNCA mencione "escalar", "ticket", "fila" ou ferramentas. Apenas diga de forma natural algo como: "Vou pedir para alguém da equipe olhar isso com você. A resposta vai aparecer aqui mesmo." e continue ajudando no que puder.
- SEMPRE que avisar que uma pessoa da equipe vai responder, informe logo depois os horários reais: "${HORARIOS_ATENDIMENTO}". Nunca invente outro horário nem diga que o atendimento é 24 horas.
- Nunca peça senha, código de verificação ou dados de cartão.`;

const REGRA_CONTEXTO_REEMBOLSO = `Antes de tratar reembolso ou cancelamento, identifique O QUE foi pago usando as mensagens do cliente (não trate uma resposta anterior da IA como prova):
- ASSINATURA VELO: plano, mensalidade ou renovação da Velo. Só neste caso use motivo "reembolso" ou "cancelamento". Dentro de 7 dias do pagamento, ofereça pedir reembolso para análise humana, mesmo se a renovação já estiver cancelada; fora dos 7 dias ofereça apenas cancelar renovação, mantendo acesso até o fim do período pago.
- PEDIDO/FORNECEDORA: pagamento na C7/C7Drop, compra de produto, comprador do Mercado Livre que cancelou, devolução ou frete. Use motivo "reembolso_fornecedora", nunca "reembolso". Peça o número do pedido e explique que a equipe verificará o pagamento à fornecedora e a situação do envio. Não prometa devolução, prazo ou aprovação antes da análise. Não ofereça cancelar a assinatura nem aplique a janela de 7 dias da Velo a essa compra.
- Se não estiver claro, pergunte: "Você quer o reembolso da assinatura da Velo ou de uma compra feita na fornecedora?" Aguarde a resposta antes de mostrar cartão ou encaminhar como reembolso da assinatura.
- Se o usuário mudar explicitamente de assunto, siga o novo assunto. Se corrigir "o problema é com a C7", reconheça a correção e não repita o formulário da assinatura.`;

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
          motivo: { type: "string", description: "erro_desconhecido | fora_da_base | pediu_humano | reembolso (somente assinatura Velo) | cancelamento (somente assinatura Velo) | reembolso_fornecedora (compra de produto/C7/ML) | financeiro" },
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
  restrictions_coliving: "o Mercado Livre bloqueou a conta porque encontrou outra conta vinculada a ela (mesmo CPF, endereço, telefone ou aparelho). A Velo não consegue liberar isso: a pessoa precisa abrir o Mercado Livre em Ajuda → Minha conta → Restrições e pedir a revisão, informando se tem ou teve outra conta no ML. Só depois que o ML liberar a publicação volta a funcionar",
  seller_restricted: "a conta está com restrição de vendas pelo próprio Mercado Livre",
  rejected_by_regulations: "o Mercado Livre ainda não liberou a conta para vender: costuma faltar confirmar dados pessoais (endereço completo, CPF/CNPJ, celular), validar a identidade ou aceitar os termos de vendedor. Depois de corrigir, a liberação pode levar algumas horas",
  user_unable_to_list: "o Mercado Livre ainda não liberou a conta para publicar anúncios (normalmente dados pessoais ou validação de identidade pendentes)",
  unable_to_list: "o Mercado Livre ainda não liberou a conta para publicar anúncios (normalmente dados pessoais ou validação de identidade pendentes)",
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
    observacao: "Explique os bloqueios e o passo a passo para resolver. Peça para a pessoa conferir no Mercado Livre e testar publicando um anúncio manual lá. Só acione o suporte humano se o código não for reconhecido ou se ela já fez tudo isso, esperou algumas horas e continua bloqueada.",
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

async function chamarGemini(key: string, contents: Content[], system = SYSTEM, soTexto = false) {
  // Até 2 tentativas, só para 429/5xx (sobrecarga passageira).
  let r: Response | null = null;
  for (let t = 0; t < 2; t++) {
    if (t) await new Promise((ok) => setTimeout(ok, 2000 + Math.random() * 500));
    r = await chamarGeminiUmaVez(key, contents, system, soTexto);
    if (r.ok || (r.status !== 429 && r.status < 500)) return r;
  }
  return r!;
}

async function chamarGeminiUmaVez(key: string, contents: Content[], system = SYSTEM, soTexto = false) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents, tools: TOOLS,
      // Na última rodada o modelo é obrigado a escrever a resposta; antes ele podia
      // gastar todas as rodadas consultando ferramentas e terminar sem texto.
      ...(soTexto ? { toolConfig: { functionCallingConfig: { mode: "NONE" } } } : {}),
      // O "pensamento" do modelo conta no mesmo teto de saída; sem limitar o
      // raciocínio, perguntas longas gastavam tudo pensando e voltavam sem texto.
      generationConfig: { temperature: 0.4, maxOutputTokens: 1500, thinkingConfig: { thinkingLevel: "low" } },
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
      return json({ reply: `Você já conversou bastante comigo hoje. Pedi para alguém da equipe continuar com você por aqui. ${HORARIOS_ATENDIMENTO}` });
    }

    await admin.from("support_ai_messages").insert({ user_id: userId, role: "user", content: message });

    const { data: hist } = await admin.from("support_ai_messages").select("role,content")
      .eq("user_id", userId).eq("archived", false).order("created_at", { ascending: false }).limit(20);
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

    for (let i = 0; i < 4; i++) {
      const r = await chamarGemini(GEMINI_API_KEY, contents, `${SYSTEM}\n\n${REGRA_CONTEXTO_REEMBOLSO}`, i === 3);
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
    // Garantia de que o horário humano nunca depende só da boa vontade do modelo.
    if (escalou && !reply.includes("13h")) reply = `${reply}\n\n${HORARIOS_ATENDIMENTO}`;

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
const AVISO_ESPERA = `Já solicitei o atendimento humano. ${HORARIOS_ATENDIMENTO} Aguarde, que em breve alguém da equipe Velo vai te responder por aqui.`;

const MARCADOR_CARTAO_REEMBOLSO = "__VELO_REFUND_PROMPT__";

const PRAZO_REEMBOLSO = "O reembolso é feito em até 5 dias. No cartão, o valor pode aparecer só na próxima fatura, conforme o seu banco.";

const PESAR_REEMBOLSO_DENTRO_DO_PRAZO =
  `Sentimos muito que a sua experiência com a Velo não tenha sido boa. Para pedir o reembolso, toque no botão abaixo e responda algumas perguntas rápidas. ${PRAZO_REEMBOLSO}`;

const PESAR_REEMBOLSO_FORA_DO_PRAZO =
  "Sentimos muito que a sua experiência com a Velo não tenha sido boa. O reembolso só é possível em até 7 dias após o pagamento, e esse prazo já passou na sua conta. Você pode cancelar o plano tocando no botão abaixo: não haverá novas cobranças e tudo continua funcionando até o fim do período já pago.";

const REEMBOLSO_EM_ANALISE =
  `Seu pedido de reembolso já foi recebido e está em análise pela nossa equipe. ${PRAZO_REEMBOLSO}`;

const REEMBOLSO_JA_APROVADO =
  `Seu reembolso já foi aprovado pela nossa equipe. ${PRAZO_REEMBOLSO}`;

const SEM_ASSINATURA_PARA_REEMBOLSO =
  `Não encontramos uma assinatura ativa na sua conta. Nossa equipe vai verificar e te responde aqui mesmo nesta conversa. ${HORARIOS_ATENDIMENTO}`;

const SYSTEM_TICKET = `${SYSTEM}
${REGRA_CONTEXTO_REEMBOLSO}

Jeito de escrever nos tickets (muito importante):
- Escreva como uma pessoa real do atendimento conversando pelo chat: cordial, educada, formal na medida certa, leve e didática. Imagine que a pessoa nunca mexeu com tecnologia.
- NUNCA use termos técnicos, códigos ou palavras em inglês (ex.: rejected_by_regulations, address_pending, status, API, OAuth, token, integração). Traduza sempre para o que a pessoa entende: "o Mercado Livre ainda não liberou sua conta para vender", "falta cadastrar seu celular".
- NÃO use markdown para ênfase: sem asteriscos, sem negrito, sem títulos. A ÚNICA exceção é o link de artigo da Central de Ajuda: sempre que indicar um artigo, escreva-o como link markdown com o título do artigo, ex.: [Onde vejo o dinheiro das vendas](https://www.velods.com.br/ajuda/mercado-livre/dinheiro-das-vendas). Nunca cole o endereço solto nem entre parênteses. Outros endereços de site (ex.: mercadolivre.com.br) vão como texto simples.
- Responda em UMA mensagem curta (até 3 parágrafos curtos, separados por linha em branco). Não repita o que já foi dito antes na conversa nem cumprimente de novo. Passo a passo pode ficar numa mensagem só, uma etapa por linha.

Reembolso e cancelamento DA ASSINATURA VELO: quando a pessoa PEDIR, chame "acionar_suporte_humano" com motivo "reembolso" para o sistema selecionar o formulário conforme a assinatura. FORA dos 7 dias, essa chamada somente exibe o cartão de cancelar a renovação: NÃO encaminha para a equipe. Não diga que solicitou atendimento humano nesse caso. Dentro dos 7 dias, o pedido de reembolso vai para análise humana. Nunca confirme cancelamento antes de a pessoa confirmar no formulário. Se ela só PERGUNTAR como funciona, explique as regras sem mostrar cartão. Pedido de reembolso à fornecedora não segue este fluxo. Não tente convencer a pessoa a desistir.

Regra extra para tickets: quando o resultado confirmar atendimento_humano, explique brevemente o que entendeu e termine EXATAMENTE com: "${AVISO_ESPERA}". Isso inclui reembolso da fornecedora. Não diga que encaminhou se o sistema pediu esclarecimento ou indicou cancelamento autônomo. Não tente resolver sozinho o que depende da equipe. Não mencione ferramentas.`;

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
  if (partes.length <= 3) return partes;
  return [...partes.slice(0, 2), partes.slice(2).join("\n\n")];
}

async function responderTicket(admin: SupabaseClient, req: Request, token: string) {
  const { data: tk } = await admin.from("cron_tokens").select("token").eq("name", "support-assistant").maybeSingle();
  if (!tk?.token || tk.token !== token) return json({ error: "não autorizado" }, 401);
  const body = await req.json().catch(() => ({}));
  const ticketId = String(body?.ticket_id ?? "");
  const messageId = String(body?.message_id ?? "");
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  if (!ticketId || !messageId || !GEMINI_API_KEY) return json({ skip: "dados" });

  // Espera o cliente terminar de digitar: quem manda 3 mensagens seguidas recebe
  // UMA resposta (as chamadas das mensagens anteriores param em "nao_e_a_ultima").
  await new Promise((ok) => setTimeout(ok, 8000));

  const { data: ticket } = await admin.from("support_tickets")
    .select("id,user_id,status,ai_paused,needs_human").eq("id", ticketId).maybeSingle();
  if (!ticket || ticket.ai_paused || ticket.status === "closed") return json({ skip: "pausado_ou_fechado" });
  // Já foi para a equipe: a IA não responde mais (evita repetir "aguarde" e gastar à toa).
  if (ticket.needs_human) return json({ skip: "aguardando_humano" });

  const { data: msgs } = await admin.from("support_messages")
    .select("id,message,sender,internal,attachment_url,created_at")
    .eq("ticket_id", ticketId).order("created_at", { ascending: true }).limit(200);
  const publicas = (msgs ?? []).filter((m) => !m.internal);
  // Depois que alguém da equipe responde, a IA sai da conversa.
  if (publicas.some((m) => m.sender === "admin")) return json({ skip: "humano_assumiu" });
  const ultimaUser = [...publicas].reverse().find((m) => m.sender === "user");
  if (!ultimaUser || ultimaUser.id !== messageId) return json({ skip: "nao_e_a_ultima" });
  if (isCancellationConfirmation(String(ultimaUser.message ?? ""))) return json({ skip: "cancelamento_ja_confirmado" });

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

  if (respostasIA >= 10) {
    if (!ticket.needs_human) {
      await marcarHumano("limite_ia", "A conversa ficou longa demais para a IA.");
      await enviar(AVISO_ESPERA);
    }
    return json({ skip: "limite" });
  }

  const contents: Content[] = [];
  // Mensagens automáticas (ex.: horário de atendimento) podem chegar depois da
  // pergunta; o Gemini exige que a conversa termine com a vez do usuário.
  // Só as últimas 20 mensagens vão para a IA: conversa inteira a cada resposta encarece.
  const ateUltimaUser = publicas.slice(0, publicas.findIndex((m) => m.id === ultimaUser.id) + 1).slice(-20);
  for (const m of ateUltimaUser) {
    if (String(m.message ?? "") === MARCADOR_CARTAO_REEMBOLSO) continue;
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
    .select("id,created_at,status,cancel_at_period_end")
    .eq("user_id", ticket.user_id)
    .in("status", ["active", "paid", "approved", "authorized"])
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  const dentroDoPrazoReembolso = !!assinatura?.created_at &&
    (Date.now() - new Date(assinatura.created_at).getTime()) <= 7 * 86400_000;
  const userTexts = ateUltimaUser.filter((m) => m.sender === "user").map((m) => String(m.message ?? ""));
  const contextoReembolso = classifyRefundContext(String(ultimaUser.message ?? ""), userTexts.slice(0, -1));

  let escalou = false;
  let reembolso = false;
  let cancelamentoAutonomo = false;
  let reembolsoFornecedora = false;
  let esclarecerReembolso = false;
  let reply = "";
  const systemTicket = `${SYSTEM_TICKET}\n\nContexto da assinatura deste usuário: ${assinatura?.created_at ? `assinatura paga em ${new Date(assinatura.created_at).toLocaleDateString("pt-BR")} — ${dentroDoPrazoReembolso ? "DENTRO" : "FORA"} do prazo de 7 dias para reembolso.` : "nenhuma assinatura paga encontrada — FORA do prazo de reembolso."}`;

  for (let i = 0; i < 4; i++) {
    const r = await chamarGemini(GEMINI_API_KEY, contents, systemTicket, i === 3);
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
      if (!c.functionCall) continue;
      const { name, args = {} } = c.functionCall;
      let result: unknown;
      try {
        if (name === "verificar_conta_mercado_livre") result = await verificarContaML(admin, ticket.user_id);
        else if (name === "buscar_central_de_ajuda") result = await buscarAjuda(admin, String(args.consulta ?? ultimaUser.message));
        else if (name === "acionar_suporte_humano") {
          let motivo = String(args.motivo ?? "outro");
          const assuntoReembolso = ["reembolso", "cancelamento", "cancelar", "cancelamento_renovacao", "reembolso_fornecedora"].includes(motivo);
          if (assuntoReembolso && contextoReembolso === "pedido") {
            motivo = "reembolso_fornecedora";
            reembolsoFornecedora = true;
          } else if (assuntoReembolso && contextoReembolso === "ambiguo") {
            esclarecerReembolso = true;
            result = { ok: true, atendimento_humano: false, acao: "perguntar_se_e_assinatura_ou_compra_na_fornecedora" };
            respostas.push({ functionResponse: { name, response: { result } } });
            continue;
          } else if (assuntoReembolso) motivo = "reembolso";
          if (isSelfServiceCancellation(motivo, assinatura?.created_at ?? null)) {
            reembolso = true;
            cancelamentoAutonomo = true;
            result = { ok: true, atendimento_humano: false, acao: "cancelar_renovacao_pelo_formulario" };
            respostas.push({ functionResponse: { name, response: { result } } });
            continue;
          }
          if (motivo === "reembolso") reembolso = true;
          if (!escalou) {
            const resumo = String(args.resumo ?? "");
            await marcarHumano(motivo, motivo === "reembolso"
              ? (dentroDoPrazoReembolso
                ? `SOLICITAÇÃO DE REEMBOLSO — dentro do prazo de 7 dias. O cliente recebeu o botão para fazer o pedido pelo formulário (o pedido aparece em /admin/reembolsos). Prazo informado ao cliente: até 5 dias. ${resumo}`
                : `PEDIDO DE REEMBOLSO/CANCELAMENTO FORA DO PRAZO (assinatura com mais de 7 dias) — reembolso não se aplica; o cliente recebeu a opção de cancelar o plano. ${resumo}`)
              : resumo);
          }
          escalou = true; result = { ok: true, atendimento_humano: true };
        } else result = { erro: "ferramenta desconhecida" };
      } catch (e) {
        console.error("tool", name, e);
        result = { erro: "falha ao executar, acione o suporte humano" };
      }
      respostas.push({ functionResponse: { name, response: { result } } });
    }
    contents.push({ role: "user", parts: respostas });
    if (cancelamentoAutonomo || reembolsoFornecedora || esclarecerReembolso) break;
  }

  if (esclarecerReembolso) reply = "Você quer o reembolso da assinatura da Velo ou de uma compra feita na fornecedora?";
  else if (reembolsoFornecedora) reply = `Entendi: você quer verificar o reembolso de uma compra na fornecedora, não da assinatura da Velo. Envie o número do pedido na fornecedora e informe se ele já foi enviado. A equipe vai conferir o pagamento e a situação do pedido, sem confirmar o reembolso antes dessa análise.\n\n${AVISO_ESPERA}`;
  if (!reply && !cancelamentoAutonomo) {
    if (!escalou && !ticket.needs_human) await marcarHumano("erro_desconhecido", "A IA não conseguiu responder esta mensagem.");
    escalou = true;
    reply = AVISO_ESPERA;
  }
  if (reembolso) {
    // Reembolso: mensagem curta de pesar + cartão com o botão do formulário.
    // O marcador nunca passa por limparTexto/dividirMensagens.
    const { data: pedido } = await admin.from("refund_requests")
      .select("status").eq("user_id", ticket.user_id)
      .eq("subscription_id", assinatura?.id ?? "00000000-0000-0000-0000-000000000000")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    const statusPedido = String(pedido?.status ?? "").toLowerCase();
    let texto = "";
    let comCartao = false;
    if (cancelamentoAutonomo && assinatura?.cancel_at_period_end) texto = "Sua renovação já está cancelada. Você mantém o acesso até o fim do período pago.";
    else if (cancelamentoAutonomo) {
      texto = PESAR_REEMBOLSO_FORA_DO_PRAZO;
      comCartao = true;
    }
    else if (statusPedido === "pending") texto = REEMBOLSO_EM_ANALISE;
    else if (statusPedido === "processed" || statusPedido === "approved") texto = REEMBOLSO_JA_APROVADO;
    else if (!assinatura) texto = SEM_ASSINATURA_PARA_REEMBOLSO;
    else {
      const { data: cartao } = await admin.from("support_messages").select("id")
        .eq("ticket_id", ticketId).eq("message", MARCADOR_CARTAO_REEMBOLSO)
        .gt("created_at", ultimaUser.created_at).limit(1);
      if (cartao?.length) return json({ ok: true, escalou: true, skip: "cartao_ja_exibido" });
      texto = dentroDoPrazoReembolso ? PESAR_REEMBOLSO_DENTRO_DO_PRAZO : PESAR_REEMBOLSO_FORA_DO_PRAZO;
      comCartao = true;
    }
    const { data: novaMsg } = await admin.from("support_messages").select("id")
      .eq("ticket_id", ticketId).eq("sender", "user").eq("internal", false)
      .gt("created_at", ultimaUser.created_at).limit(1);
    if (novaMsg?.length) return json({ skip: "chegou_mensagem_nova" });
    if (comCartao) {
      const { data: existente } = await admin.from("support_messages").select("id")
        .eq("ticket_id", ticketId).eq("message", MARCADOR_CARTAO_REEMBOLSO)
        .gt("created_at", ultimaUser.created_at).limit(1);
      if (existente?.length) return json({ ok: true, escalou, skip: "cartao_ja_exibido" });
    }
    if (escalou && !texto.includes("13h")) texto += `\n\n${HORARIOS_ATENDIMENTO}`;
    await enviar(texto);
    if (comCartao) {
      await new Promise((r) => setTimeout(r, 900));
      await enviar(MARCADOR_CARTAO_REEMBOLSO);
    }
    return json({ ok: true, escalou });
  } else if (escalou && !reply.includes("13h")) reply = `${reply}\n\n${AVISO_ESPERA}`;
  // Se o cliente mandou outra mensagem enquanto a IA pensava, a chamada dessa
  // mensagem nova responde tudo junto; esta desiste para não duplicar.
  const { data: maisNova } = await admin.from("support_messages").select("id")
    .eq("ticket_id", ticketId).eq("sender", "user").eq("internal", false)
    .gt("created_at", ultimaUser.created_at).limit(1);
  if (maisNova?.length) return json({ skip: "chegou_mensagem_nova" });
  const mensagens = dividirMensagens(reply);
  for (let i = 0; i < mensagens.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, Math.min(3500, 900 + mensagens[i].length * 18)));
    await enviar(mensagens[i]);
  }
  return json({ ok: true, escalou });
}
