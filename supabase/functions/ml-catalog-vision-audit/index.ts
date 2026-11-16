// A auditoria visual em lote foi desativada para reduzir consumo. Novas análises
// acontecem somente na publicação solicitada pelo cliente (ml-publish e fila).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { IMAGE_VALIDATION_REVISION } from '../_shared/ml-vision-request.ts';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    const isServiceRole = !!token && token === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const repairToken = Deno.env.get('ML_REPAIR_TOKEN');
    const hasRepairToken = !!repairToken && req.headers.get('x-repair-token') === repairToken;
    if (!isServiceRole && !hasRepairToken) {
      const { data: userData } = await supabase.auth.getUser(token);
      const uid = userData?.user?.id;
      if (!uid) return json({ error: 'não autenticado' }, 401);
      const { data: isAdmin } = await supabase.rpc('is_admin', { _user_id: uid });
      if (!isAdmin) return json({ error: 'acesso restrito a administradores' }, 403);
    }
    const body = await req.json().catch(() => ({}));
    if (body.action === 'status') return json({
      revision: IMAGE_VALIDATION_REVISION,
      tri_state: true,
      technical_failure_blocks: false,
      batch_analysis_enabled: false,
      analysis_entrypoint: 'ml-publish',
    });
    return json({
      error: 'A auditoria de fotos em lote foi desativada. A análise agora acontece somente quando um cliente pede uma publicação.',
      code: 'BATCH_VISION_DISABLED',
    }, 410);
  } catch (error) {
    console.error('[ml-catalog-vision-audit]', error);
    return json({ error: String(error) }, 500);
  }
});
