import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é a IA da Velo, plataforma de dropshipping para iniciantes brasileiros.
Guie o usuário neste fluxo:
1) Pergunte qual nicho de produtos ele quer vender (ex: eletrônicos, moda, beleza, casa).
2) Quando o usuário informar o nicho, retorne SOMENTE este JSON (sem texto extra, sem markdown):
   {"tipo":"buscar_produtos","nicho":"nicho informado pelo usuário"}
3) Após os produtos reais serem exibidos e o usuário escolher um, crie o anúncio retornando SOMENTE:
   {"tipo":"anuncio","titulo":"","descricao":"","preco":"","plataforma":"Mercado Livre"}
4) Confirme a publicação de forma amigável.
Seja direto e use linguagem simples.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, mode } = await req.json();

    // Preferimos o Gemini direto (GEMINI_API_KEY) — não depende dos créditos do
    // gateway da Lovable. Se só houver LOVABLE_API_KEY, usamos o gateway como fallback.
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!GEMINI_API_KEY && !LOVABLE_API_KEY) {
      throw new Error("Nenhuma chave de IA configurada (defina GEMINI_API_KEY)");
    }

    const normalizedMessages = (messages || []).map((m: { role: string; content: string }) => ({
      role: m.role === "ai" ? "assistant" : m.role,
      content: m.content,
    }));
    const isProductDescriptionMode =
      mode === "product_description" ||
      normalizedMessages.some((m: { content: string }) =>
        typeof m.content === "string" &&
        m.content.includes("Gere uma descrição de produto persuasiva e completa para o Mercado Livre")
      );

    const chatMessages = isProductDescriptionMode
      ? normalizedMessages
      : [{ role: "system", content: SYSTEM_PROMPT }, ...normalizedMessages];

    const useGemini = !!GEMINI_API_KEY;
    // Ambos endpoints são compatíveis com o formato OpenAI (mesmo body/resposta).
    const endpoint = useGemini
      ? "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
      : "https://ai.gateway.lovable.dev/v1/chat/completions";
    const apiKey = useGemini ? GEMINI_API_KEY : LOVABLE_API_KEY;
    const model = useGemini ? "gemini-2.5-flash" : "google/gemini-2.5-flash";

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: chatMessages,
        temperature: isProductDescriptionMode ? 0.7 : 0.8,
        max_tokens: isProductDescriptionMode ? 1800 : 1024,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Muitas requisições. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        // Mensagem genérica: não expor detalhe de billing/créditos ao cliente.
        return new Response(
          JSON.stringify({ error: "Serviço de IA temporariamente indisponível. Tente novamente em instantes." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const text = await response.text();
      console.error("AI gateway error:", useGemini ? "gemini" : "lovable", response.status, text);
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
    console.error("chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
