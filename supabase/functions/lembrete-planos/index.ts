// Lembra quem preparou um anúncio, chegou na página de planos e não assinou.
//
// Regra: só entra quem realmente abriu a página de planos (evento real do app),
// não tem assinatura ativa e ainda não recebeu esse lembrete. Dois avisos no
// máximo, em D+1 e D+3, sempre dentro do app (nada de e-mail sem autorização).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const DIA = 24 * 60 * 60 * 1000

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const cronSecret = Deno.env.get('CRON_SECRET')
  if (!supabaseUrl || !serviceKey) return json({ error: 'Configuração incompleta' }, 500)

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  const headerSecret = req.headers.get('x-cron-secret')
  let cronOk = Boolean(cronSecret && headerSecret && headerSecret === cronSecret)
  if (!cronOk && headerSecret) {
    const { data: tok } = await admin
      .from('cron_tokens')
      .select('token')
      .eq('name', 'lembrete-planos')
      .maybeSingle()
    cronOk = Boolean(tok?.token && tok.token === headerSecret)
  }
  if (!cronOk) return json({ error: 'Não autorizado' }, 401)

  const agora = Date.now()
  const desde = new Date(agora - 5 * DIA).toISOString()

  const { data: eventos, error } = await admin
    .from('mobile_home_events')
    .select('user_id,product_id,created_at')
    .eq('event', 'plans_open')
    .gte('created_at', desde)
    .order('created_at', { ascending: false })
    .limit(2000)

  if (error) return json({ error: error.message }, 500)

  // Uma entrada por pessoa: a visita mais recente à página de planos.
  const porUsuario = new Map<string, { product_id: string | null; created_at: string }>()
  for (const ev of eventos ?? []) {
    if (!ev.user_id) continue
    if (!porUsuario.has(ev.user_id)) {
      porUsuario.set(ev.user_id, { product_id: ev.product_id ?? null, created_at: ev.created_at })
    }
  }
  if (porUsuario.size === 0) return json({ ok: true, avisados: 0 })

  const ids = [...porUsuario.keys()]

  const { data: assinaturas } = await admin
    .from('subscriptions')
    .select('user_id')
    .in('user_id', ids)
    .in('status', ['active', 'paid', 'approved', 'trialing'])
  const pagantes = new Set((assinaturas ?? []).map((s) => s.user_id))

  const { data: jaAvisados } = await admin
    .from('notifications')
    .select('user_id,type')
    .in('user_id', ids)
    .in('type', ['plano_lembrete_1d', 'plano_lembrete_3d'])
  const avisados = new Set((jaAvisados ?? []).map((n) => `${n.user_id}:${n.type}`))

  let enviados = 0
  for (const [userId, info] of porUsuario) {
    if (pagantes.has(userId)) continue
    const idade = agora - new Date(info.created_at).getTime()
    let tipo: 'plano_lembrete_1d' | 'plano_lembrete_3d' | null = null
    if (idade >= 3 * DIA) tipo = 'plano_lembrete_3d'
    else if (idade >= 1 * DIA) tipo = 'plano_lembrete_1d'
    if (!tipo) continue
    if (avisados.has(`${userId}:${tipo}`)) continue
    // Quem já recebeu o de D+3 não recebe mais nada.
    if (tipo === 'plano_lembrete_1d' && avisados.has(`${userId}:plano_lembrete_3d`)) continue

    const { error: insErro } = await admin.from('notifications').insert({
      user_id: userId,
      type: tipo,
      title: 'Seu anúncio está guardado',
      message:
        tipo === 'plano_lembrete_1d'
          ? 'Você deixou um anúncio pronto. Para publicá-lo no Mercado Livre, falta escolher um plano.'
          : 'Seu anúncio continua guardado. Quando quiser publicar, é só escolher um plano — dá para cancelar quando quiser.',
      action_url: '/dashboard/planos',
      metadata: { product_id: info.product_id },
    })
    if (!insErro) enviados += 1
  }

  return json({ ok: true, analisados: porUsuario.size, avisados: enviados })
})
