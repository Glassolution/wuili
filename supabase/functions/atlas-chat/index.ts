// Atlas Chat — assistente conversacional da Velo via Lovable AI Gateway (Gemini)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é o Atlas, o assistente de IA da Velo — plataforma brasileira de dropshipping com IA. Responda SEMPRE em português brasileiro, de forma clara, direta, calorosa e curta (use parágrafos curtos e listas quando útil).

Sua missão: ajudar o usuário a usar a Velo corretamente, tirar dúvidas e orientar fluxos. Você conhece a fundo:
- Catálogo Velo (produtos curados de fornecedores nacionais: C7 Drop), filtros, busca por categoria.
- Importar produto: pelo Catálogo, clicar no produto, clicar em "Importar". Isso publica direto no Mercado Livre.
- Conectar Mercado Livre: aba "Conectar conta" no dashboard ou em /dashboard/configuracoes. Sem ML conectado, não há publicação.
- Publicações: aba "Anúncios" mostra status sincronizado com ML.
- Saldos/Transações: aba Saldos mostra faturamento real (pedidos reais do ML).
- Planos: Grátis (modo teste, sem publicar), Pro R$79,80/mês (30 produtos, 2 marketplaces, 3 agentes IA), Business R$159,60/mês (ilimitado).
- Fluxo recomendado para iniciantes: 1) conectar ML 2) escolher produto no catálogo 3) importar/publicar 4) aguardar primeiros pedidos.

Quando o usuário pedir uma ação que envolva a interface, descreva o caminho exato (ex: "Vá em /dashboard/catalogo → escolha o produto → clique em Importar"). Nunca invente funcionalidades, preços ou integrações. Se não souber, oriente o usuário a abrir um chamado em contato@velo.com.br.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY ausente");
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resp = await fetch(
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
              role: m.role === "assistant" ? "assistant" : "user",
              content: String(m.content ?? ""),
            })),
          ],
          temperature: 0.6,
          max_tokens: 1024,
        }),
      },
    );

    if (!resp.ok) {
      const text = await resp.text();
      console.error("atlas-chat gateway error", resp.status, text);
      if (resp.status === 429) {
        return new Response(
          JSON.stringify({ error: "Muitas requisições. Tente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (resp.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos para continuar." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const message: string =
      data.choices?.[0]?.message?.content ||
      "Desculpe, não consegui processar agora. Tente reformular sua pergunta.";

    return new Response(JSON.stringify({ message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("atlas-chat error", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
