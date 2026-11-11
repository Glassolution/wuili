// Publica automaticamente os anúncios que ficaram pendentes porque a conta do
// Mercado Livre ainda não estava habilitada a vender quando o usuário pagou.
//
// Regra: só entram aqui rascunhos criados por uma tentativa real de publicação
// de quem já tem plano ativo. A cada rodada conferimos no próprio Mercado Livre
// se a conta já pode anunciar; quando puder, publicamos com a mesma função
// `ml-publish` usada pelo app e avisamos a pessoa. Quem continua pendente
// recebe lembretes em D+1 e D+3.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { authenticateCronRequest } from '../_shared/cron-auth.ts'

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

type Pendente = {
  id: string
  user_id: string
  product_id: string | null
  title: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- corpo do ml-publish, formato varia por produto
  payload: Record<string, any>
  attempts: number
  created_at: string
  reminder_1d_at: string | null
  reminder_3d_at: string | null
  reason: string
  support_notified_at: string | null
}

const MAX_ATTEMPTS = 25

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const repairToken = Deno.env.get('ML_REPAIR_TOKEN')
  const cronSecret = Deno.env.get('CRON_SECRET')
  if (!supabaseUrl || !serviceKey || !repairToken) return json({ error: 'Configuração incompleta' }, 500)

  // Aceita chamada do cron (segredo) ou de um usuário autenticado pedindo a
  // verificação da própria fila ("Já criei minha conta, verificar de novo").
  const headerSecret = req.headers.get('x-cron-secret')
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  // O agendamento usa um token guardado em cron_tokens (mesmo padrão já usado
  // por outros jobs), para não escrever segredo dentro do SQL do cron.
  let cronOk = Boolean(cronSecret && headerSecret && headerSecret === cronSecret) || authenticateCronRequest(req) === null
  if (!cronOk && headerSecret) {
    const { data: tok } = await admin
      .from('cron_tokens')
      .select('token')
      .eq('name', 'auto-publish-pending')
      .maybeSingle()
    cronOk = Boolean(tok?.token && tok.token === headerSecret)
  }

  let escopoUsuario: string | null = null
  if (!cronOk) {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Não autorizado' }, 401)
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const authed = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data, error } = await authed.auth.getUser()
    if (error || !data?.user) return json({ error: 'Token inválido' }, 401)
    escopoUsuario = data.user.id
  }

  const owner = crypto.randomUUID()
  const { data: locked, error: lockError } = await admin.rpc('claim_publication_worker', { p_owner: owner })
  if (lockError) return json({ error: lockError.message }, 500)
  if (!locked) return json({ ok: true, busy: true })
  try {
  let query = admin
    .from('pending_publications')
    .select('id,user_id,product_id,title,payload,attempts,created_at,reminder_1d_at,reminder_3d_at,reason,support_notified_at')
    .eq('status', 'pending')
    .lt('attempts', MAX_ATTEMPTS)
    .order('created_at', { ascending: true })
    .limit(1)

  if (escopoUsuario) query = query.eq('user_id', escopoUsuario)

  const { data: pendentes, error: erroLista } = await query
  if (erroLista) return json({ error: erroLista.message }, 500)

  let publicados = 0
  let aguardando = 0
  const agora = Date.now()

  for (const item of (pendentes ?? []) as Pendente[]) {
    if (item.reason === 'image_compliance_unavailable' && !item.support_notified_at && agora - new Date(item.created_at).getTime() >= 864e5) {
      const { error } = await admin.rpc('notify_overdue_image_publication', { p_id: item.id })
      if (error) return json({ error: error.message }, 500)
    }
    // A saved successful publication is idempotent progress, not another provider request.
    const { data: existing, error: existingError } = await admin.from('user_publications')
      .select('ml_item_id,permalink').eq('user_id',item.user_id).eq('catalog_product_id',item.product_id)
      .in('status',['active','published']).limit(1).maybeSingle()
    if (existingError) return json({error:existingError.message},500)
    if(existing?.ml_item_id) {
      const {error}=await admin.rpc('complete_pending_publication',{p_id:item.id,p_item_id:existing.ml_item_id,p_permalink:existing.permalink})
      if(error) return json({error:error.message},500)
      publicados++; continue
    }
    // 1. A conta já pode anunciar?
    const { data: integ } = await admin
      .from('user_integrations')
      .select('access_token')
      .eq('user_id', item.user_id)
      .eq('platform', 'mercadolivre')
      .maybeSingle()

    let apta: boolean | null = null
    if (integ?.access_token) {
      try {
        const res = await fetch('https://api.mercadolibre.com/users/me', {
          headers: { Authorization: `Bearer ${integ.access_token}` },
        })
        if (res.ok) {
          const me = await res.json().catch(() => ({}))
          const allow = me?.status?.list?.allow
          apta = typeof allow === 'boolean' ? allow : null
        }
      } catch (_) {
        apta = null
      }
    }

    if (apta !== true && item.reason !== 'image_compliance_unavailable') {
      aguardando += 1
      // Lembretes proativos para quem pagou e ainda não conseguiu publicar.
      const idadeHoras = (agora - new Date(item.created_at).getTime()) / 36e5
      const lembrete = !item.reminder_1d_at && idadeHoras >= 24
        ? 'reminder_1d_at'
        : !item.reminder_3d_at && idadeHoras >= 72
          ? 'reminder_3d_at'
          : null
      if (lembrete) {
        await admin.from('notifications').insert({
          user_id: item.user_id,
          type: 'ml_seller_pending',
          title: 'Seu anúncio está pronto esperando sua conta de vendedor',
          message:
            'Falta liberar sua conta do Mercado Livre para vender. Assim que estiver liberada, publicamos seu anúncio automaticamente. Se precisar, fale com a gente pelo suporte.',
          action_url: '/dashboard/catalogo',
          metadata: { pending_publication_id: item.id },
        })
        await admin.from('pending_publications').update({ [lembrete]: new Date().toISOString() }).eq('id', item.id)
      }
      continue
    }

    // 2. Conta apta → publica com a mesma rotina do app.
    const res = await fetch(`${supabaseUrl}/functions/v1/ml-publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-repair-token': repairToken,
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ user_id: item.user_id, product: item.payload?.product ?? item.payload }),
    })
    const corpo = await res.json().catch(() => ({}))

    if (res.ok && !corpo?.error && corpo?.item_id) {
      publicados += 1
      const {error}=await admin.rpc('complete_pending_publication',{p_id:item.id,p_item_id:String(corpo.item_id),p_permalink:corpo.permalink ?? null})
      if(error) return json({error:error.message},500)
    } else {
      const unavailable = corpo?.code === 'IMAGE_COMPLIANCE_UNAVAILABLE'
      const { error } = await admin.from('pending_publications').update({
        attempts: unavailable ? item.attempts : item.attempts + 1,
        seller_ready_at: new Date().toISOString(),
        last_error: String(corpo?.error ?? `HTTP ${res.status}`).slice(0, 400),
      }).eq('id', item.id)
      if(error) return json({error:error.message},500)
      // Circuit breaker covers the whole batch, not just this product.
      if (unavailable) { aguardando++; break }
    }
  }

  return json({ ok: true, analisados: pendentes?.length ?? 0, publicados, aguardando })
  } finally {
    const {error}=await admin.rpc('release_publication_worker',{p_owner:owner})
    if(error) console.error('Não foi possível liberar execução:',error.message)
  }
})
