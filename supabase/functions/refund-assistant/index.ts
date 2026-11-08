// Atendimento de reembolso da Velo (página /ajuda/reembolso).
//
// Ações (sempre com o token do cliente):
//   { action: "start" }                 → situação da conta + saudação (sem IA)
//   { action: "send", messages: [...] } → resposta da IA e, quando cabível, a
//                                         proposta de pedido para o cartão
//
// A situação (prazo, pedido em análise, reembolso anterior) é calculada aqui,
// com service role, e nunca vem do navegador. A IA não envia pedido: quem
// envia é o cliente, no cartão, pela função request-refund, que confere tudo
// de novo. Regras do atendimento em _shared/refundAssistant.ts.
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getRefundMode, REFUNDABLE_SUBSCRIPTION_STATUSES, REFUND_WINDOW_DAYS } from "../_shared/refundPolicy.ts";
import {
  buildRefundAssistantPrompt,
  parseRefundProposal,
  REFUND_PROPOSAL_TOOL,
  refundChatGreeting,
  sanitizeRefundChat,
  type RefundChatFacts,
  type RefundProposal,
} from "../_shared/refundAssistant.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const MODEL = "gemini-3.8-flash";
const DAY = 86_400_000;
const PLAN_LABEL: Record<string, string> = { go: "Go", base: "Base", plus: "Pro", pro: "Pro", business: "Business" };

const fmtData = (ms: number) => new Date(ms).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
const fmtValor = (n: unknown) =>
  n == null || !Number.isFinite(Number(n)) ? null : Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Sub = {
  id: string;
  plan: string | null;
  amount: number | null;
  provider: string | null;
  payment_method: string | null;
  purchase_kind: string | null;
  created_at: string;
  cancel_at_period_end: boolean | null;
};

async function carregarSituacao(
  admin: SupabaseClient,
  userId: string,
  nome: string | null,
  sandbox: boolean,
): Promise<RefundChatFacts> {
  const { data: subs, error } = await admin
    .from("subscriptions")
    .select("id, plan, amount, provider, payment_method, purchase_kind, created_at, cancel_at_period_end")
    .eq("user_id", userId)
    .in("status", REFUNDABLE_SUBSCRIPTION_STATUSES)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw new Error(`subscriptions:${error.message}`);
  // Assinaturas de teste (sandbox) só aparecem para o admin que ligou o sandbox.
  const sub = ((subs ?? []) as Sub[]).find(
    (s) => (String(s.provider ?? s.payment_method ?? "").toLowerCase() === "sandbox") === sandbox,
  ) ?? null;

  const { data: pedidos, error: erroPedidos } = await admin
    .from("refund_requests")
    .select("subscription_id, status")
    .eq("user_id", userId);
  if (erroPedidos) throw new Error(`refund_requests:${erroPedidos.message}`);

  let mode = getRefundMode(sub, pedidos ?? []);
  // No sandbox o admin testa fora dos 7 dias (o request-refund também libera).
  if (sandbox && sub && (mode === "cancelamento" || mode === "cancelado")) mode = "reembolso";
  const inicio = sub ? new Date(sub.created_at).getTime() : NaN;
  const fim = inicio + REFUND_WINDOW_DAYS * DAY;
  return {
    mode,
    plano: sub?.plan ? PLAN_LABEL[sub.plan.toLowerCase()] ?? sub.plan : null,
    vitalicio: sub?.purchase_kind === "lifetime",
    dataCobranca: Number.isFinite(inicio) ? fmtData(inicio) : null,
    valor: fmtValor(sub?.amount),
    prazoFinal: Number.isFinite(fim) ? fmtData(fim) : null,
    diasRestantes: Number.isFinite(fim) ? Math.max(0, Math.ceil((fim - Date.now()) / DAY)) : null,
    primeiroNome: nome,
  };
}

type Part = { text?: string; functionCall?: { name: string; args?: Record<string, unknown> }; thought?: boolean };

async function chamarGemini(key: string, system: string, contents: unknown[], comFerramenta: boolean) {
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    if (tentativa) await new Promise((ok) => setTimeout(ok, 1500 + Math.random() * 500));
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents,
        ...(comFerramenta ? { tools: [REFUND_PROPOSAL_TOOL] } : {}),
        generationConfig: { temperature: 0.3, maxOutputTokens: 1200, thinkingConfig: { thinkingLevel: "low" } },
      }),
    });
    if (r.ok) return (await r.json()) as { candidates?: Array<{ content?: { parts?: Part[] } }> };
    if (r.status !== 429 && r.status < 500) throw new Error(`gemini:${r.status}:${(await r.text()).slice(0, 300)}`);
  }
  throw new Error("gemini:indisponivel");
}

const primeiroNome = (meta: Record<string, unknown> | undefined) => {
  const bruto = String(meta?.full_name ?? meta?.name ?? meta?.display_name ?? "").trim();
  const nome = bruto.split(/\s+/)[0] ?? "";
  return nome && nome.length <= 30 ? nome : null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: u } = token ? await admin.auth.getUser(token) : { data: { user: null } };
    if (!u?.user) return json({ error: "Entre na sua conta para continuar." }, 401);
    const userId = u.user.id;

    const body = await req.json().catch(() => ({}));
    let sandbox = false;
    if (body?.sandbox === true) {
      const { data: ehAdmin } = await admin.rpc("is_admin", { _user_id: userId });
      if (ehAdmin !== true) return json({ error: "Sandbox disponível apenas para administradores." }, 403);
      sandbox = true;
    }
    const facts = await carregarSituacao(admin, userId, primeiroNome(u.user.user_metadata), sandbox);

    if (body?.action === "start") {
      return json({ mode: facts.mode, facts, greeting: refundChatGreeting(facts) });
    }

    if (body?.action !== "send") return json({ error: "Ação inválida" }, 400);
    const mensagens = sanitizeRefundChat(body?.messages);
    if (!mensagens) return json({ error: "Escreva uma mensagem." }, 400);

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) return json({ error: "Atendimento indisponível no momento." }, 503);

    const contents = mensagens.map((m) => ({ role: m.role === "user" ? "user" : "model", parts: [{ text: m.content }] }));
    // A saudação é da IA; o Gemini exige que a conversa comece pelo usuário.
    if (contents[0].role === "model") contents.unshift({ role: "user", parts: [{ text: "Olá" }] });

    const podePedir = facts.mode === "reembolso";
    const resposta = await chamarGemini(GEMINI_API_KEY, buildRefundAssistantPrompt(facts), contents, podePedir);
    const parts = resposta.candidates?.[0]?.content?.parts ?? [];

    const texto = parts
      .filter((p) => !p.thought && typeof p.text === "string")
      .map((p) => p.text)
      .join("")
      .trim();
    const chamada = parts.find((p) => p.functionCall?.name === "preparar_pedido")?.functionCall;
    // Mesmo que o modelo chame a ferramenta fora de hora, a proposta só vale dentro das regras.
    const proposta: RefundProposal | null = podePedir && chamada ? parseRefundProposal(chamada.args) : null;

    const reply = texto ||
      (proposta
        ? "Pronto! O resumo do seu pedido apareceu logo abaixo. Confira, marque a confirmação e toque em \"Enviar pedido\"."
        : "Desculpe, não consegui responder agora. Pode repetir sua mensagem?");

    return json({ mode: facts.mode, reply, proposal: proposta });
  } catch (err) {
    console.error("refund-assistant error:", err);
    return json({ error: "Não foi possível responder agora. Tente de novo em instantes." }, 500);
  }
});
