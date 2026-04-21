import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é o assistente de suporte da Velo, plataforma brasileira de dropshipping com IA. Responda SEMPRE em português brasileiro de forma clara, direta e amigável. Você conhece todos os recursos da Velo:
- Catálogo de produtos do CJ Dropshipping com curadoria por categorias
- Publicação automática no Mercado Livre e Shopee
- Planos: Free (3 produtos), Plus (R$99,90/mês, ilimitado), Pro (R$149,90/mês, múltiplas contas)
- Dashboard com métricas de vendas
- Integração OAuth com Mercado Livre
- IA que gera títulos e descrições otimizadas para SEO

POLÍTICA DE REEMBOLSO:
- O usuário pode solicitar reembolso integral em até 7 dias após o pagamento.
- Após o reembolso, a assinatura é cancelada automaticamente e a conta volta ao plano Free.
- O valor é creditado em até 7 dias úteis no mesmo método de pagamento.

REGRA CRÍTICA — DETECÇÃO DE INTENÇÃO DE REEMBOLSO:
Sempre que o usuário expressar QUALQUER intenção de pedir reembolso, estorno, devolução do dinheiro, cancelar e ser ressarcido, ou frases como "quero meu dinheiro de volta", "pedir reembolso", "estornar", você DEVE:
1. Responder de forma curta e empática explicando que vai abrir o fluxo de reembolso agora.
2. Mencionar a regra dos 7 dias e que a assinatura será cancelada.
3. Terminar a resposta EXATAMENTE com o marcador (em linha separada): [ACTION:OPEN_REFUND]
Não use esse marcador em nenhuma outra situação. Não explique o marcador ao usuário.

Quando não souber a resposta exata para outras questões, oriente o usuário a entrar em contato pelo email contato@velo.com.br. Nunca invente informações sobre preços ou funcionalidades que não foram mencionadas.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    if (!Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "messages deve ser um array" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...messages.map((m: { role: string; content: string }) => ({
              role: m.role === "ai" ? "assistant" : m.role,
              content: m.content,
            })),
          ],
          temperature: 0.5,
          max_tokens: 1024,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Muitas requisições. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos esgotados. Adicione fundos no Lovable AI." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const text = await response.text();
      console.error("support-chat AI gateway error:", response.status, text);
      return new Response(
        JSON.stringify({ error: "Erro no serviço de IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const aiMessage: string =
      data.choices?.[0]?.message?.content ||
      "Desculpe, não consegui processar sua mensagem.";

    return new Response(
      JSON.stringify({ response: aiMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("support-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
