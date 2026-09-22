// Números reais exibidos na landing (pública, sem login).
//
// Só devolve contagens agregadas — nenhum dado de pessoa, nenhum id. Usa a
// service role porque `subscriptions` tem RLS por usuário e um visitante
// deslogado não enxerga linha nenhuma.
//
// Deploy:
//   supabase functions deploy landing-stats --no-verify-jwt
//
// Sem o --no-verify-jwt a landing recebe 401 e simplesmente não mostra os
// números (o front trata isso; nada quebra).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Abaixo deste número o total de assinantes é omitido.
//
// Não é maquiagem: é o contrário. Prova social só prova alguma coisa a partir
// de um certo volume — publicar "7 assinantes" afasta quem chegou pelo anúncio
// e ainda deixa o número exato do negócio exposto para qualquer concorrente.
// Enquanto não passar do piso, a landing não mostra número nenhum no lugar.
const MINIMO_ASSINANTES = Number(Deno.env.get("LANDING_MIN_ASSINANTES") ?? "50");

// Os números mudam em dias. Cache na borda evita uma consulta por visita.
const CACHE_SEGUNDOS = 900;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    // Mesmo arranjo das outras functions: o banco pode viver em outro projeto.
    const dbUrl = Deno.env.get("DB_URL") ?? supabaseUrl;
    const dbKey = Deno.env.get("DB_SERVICE_ROLE_KEY") ?? serviceKey;
    const supabase = createClient(dbUrl, dbKey);

    // Mesmos filtros do endpoint `catalog`: o que a pessoa realmente vê lá dentro.
    const catalogo = await supabase
      .from("catalog_products")
      .select("id", { count: "exact", head: true })
      .eq("source", "c7drop")
      .eq("is_active", true)
      .eq("is_blocked", false)
      .gt("stock_quantity", 0);

    // "Ativo" aqui é o mesmo critério usado em subscription-sync-self.
    const assinaturas = await supabase
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .in("status", ["active", "trialing"]);

    const produtos = catalogo.error ? null : catalogo.count ?? 0;
    const totalAssinantes = assinaturas.error ? null : assinaturas.count ?? 0;

    return new Response(
      JSON.stringify({
        produtos,
        assinantesAtivos:
          totalAssinantes !== null && totalAssinantes >= MINIMO_ASSINANTES ? totalAssinantes : null,
        atualizadoEm: new Date().toISOString(),
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": `public, max-age=${CACHE_SEGUNDOS}, s-maxage=${CACHE_SEGUNDOS}`,
        },
      },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
