// Descontinuado: o reembolso agora segue o fluxo atual (request-refund / admin-refund-action).
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  return new Response(
    JSON.stringify({ error: "process-refund foi descontinuado. Use o fluxo de reembolso atual." }),
    { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
