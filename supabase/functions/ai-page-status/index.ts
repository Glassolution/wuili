// Consulta o status da geração no PagePilot e persiste o resultado.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { getStatus, PagePilotError } from "../_shared/pagepilot.ts";

const TIMEOUT_MS = 5 * 60 * 1000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE);

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "unauthorized" }, 401);
    const userId = userData.user.id;

    const body = (await req.json().catch(() => ({}))) as { page_id?: string };
    if (!body.page_id) return json({ error: "page_id required" }, 400);

    const { data: page, error: pageErr } = await admin
      .from("ai_product_pages")
      .select("*")
      .eq("id", body.page_id)
      .maybeSingle();
    if (pageErr || !page) return json({ error: "page_not_found" }, 404);
    // service_role ignora RLS: checagem de dono feita na mão.
    if (page.user_id !== userId) return json({ error: "forbidden" }, 403);

    const respond = (row: Record<string, unknown>) =>
      json({
        id: row.id,
        status: row.status,
        content: row.content,
        images: row.images,
        error_code: row.error_code,
        error_message: row.error_message,
        created_at: row.created_at,
        completed_at: row.completed_at,
      });

    if (page.status === "pronto" || page.status === "erro") return respond(page);

    if (!page.provider_page_id) {
      const { data: updated } = await admin
        .from("ai_product_pages")
        .update({ status: "erro", error_code: "missing_provider_id", error_message: "Geração sem id do provedor" })
        .eq("id", page.id)
        .select("*")
        .single();
      return respond(updated ?? page);
    }

    let result;
    try {
      result = await getStatus(page.provider_page_id);
    } catch (e) {
      if (e instanceof PagePilotError && e.transient) {
        // Erro transitório: mantém 'gerando' para não queimar a geração.
        console.warn("pagepilot status transient error:", e.code, e.message);
        return respond(page);
      }
      const message = e instanceof Error ? e.message : "erro desconhecido";
      const { data: updated } = await admin
        .from("ai_product_pages")
        .update({
          status: "erro",
          error_code: e instanceof PagePilotError ? e.code : "provider_error",
          error_message: message,
          completed_at: new Date().toISOString(),
        })
        .eq("id", page.id)
        .select("*")
        .single();
      return respond(updated ?? page);
    }

    if (result.state === "pronto") {
      const { data: updated } = await admin
        .from("ai_product_pages")
        .update({
          status: "pronto",
          content: result.content,
          images: result.images,
          error_code: null,
          error_message: null,
          completed_at: new Date().toISOString(),
        })
        .eq("id", page.id)
        .select("*")
        .single();
      return respond(updated ?? page);
    }

    if (result.state === "erro") {
      const { data: updated } = await admin
        .from("ai_product_pages")
        .update({
          status: "erro",
          error_code: "provider_failed",
          error_message: result.errorMessage ?? "O provedor não conseguiu gerar a página",
          completed_at: new Date().toISOString(),
        })
        .eq("id", page.id)
        .select("*")
        .single();
      return respond(updated ?? page);
    }

    // Ainda gerando: aplica timeout de 5 minutos.
    if (Date.now() - new Date(page.created_at as string).getTime() > TIMEOUT_MS) {
      const { data: updated } = await admin
        .from("ai_product_pages")
        .update({
          status: "erro",
          error_code: "timeout",
          error_message: "A geração excedeu o tempo limite de 5 minutos",
          completed_at: new Date().toISOString(),
        })
        .eq("id", page.id)
        .select("*")
        .single();
      return respond(updated ?? page);
    }

    return respond(page);
  } catch (e) {
    console.error("ai-page-status error:", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});
