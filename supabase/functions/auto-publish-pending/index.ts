// Publica automaticamente os anúncios que ficaram pendentes porque a conta do
// Mercado Livre ainda não estava habilitada a vender quando o usuário pagou.
//
// Regra: só entram aqui rascunhos criados por uma tentativa real de publicação
// de quem já tem plano ativo. A cada rodada conferimos no próprio Mercado Livre
// se a conta já pode anunciar; quando puder, publicamos com a mesma função
// `ml-publish` usada pelo app e avisamos a pessoa. Quem continua pendente
// recebe lembretes em D+1 e D+3.

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

  let escopoUsuario: string | null = null
  if (!cronSecret || headerSecret !== cronSecret) {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Não autorizado' }, 401)
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const authed = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data, error } = await authed.auth.getUser()
    if (error || !data?.user) return json({ error: 'Token inválido' }, 401)
    escopoUsuario = data.user.id
  }

  let query = admin
    .from('pending_publications')
    .select('id,user_id,product_id,title,payload,attempts,created_at,reminder_1d_at,reminder_3d_at')
    .eq('status', 'pending')
    .lt('attempts', MAX_ATTEMPTS)
    .order('created_at', { ascending: true })
    .limit(escopoUsuario ? 10 : 80)

  if (escopoUsuario) query = query.eq('user_id', escopoUsuario)

  const { data: pendentes, error: erroLista } = await query
  if (erroLista) return json({ error: erroLista.message }, 500)

  let publicados = 0
  let aguardando = 0
  const agora = Date.now()

  for (const item of (pendentes ?? []) as Pendente[]) {
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

    if (apta !== true) {
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
      await admin.from('pending_publications').update({
        status: 'published',
        published_at: new Date().toISOString(),
        seller_ready_at: new Date().toISOString(),
        ml_item_id: String(corpo.item_id),
        permalink: corpo.permalink ?? null,
        attempts: item.attempts + 1,
        last_error: null,
      }).eq('id', item.id)

      await admin.from('notifications').insert({
        user_id: item.user_id,
        type: 'ml_auto_published',
        title: 'Seu anúncio foi publicado',
        message: `Sua conta do Mercado Livre foi liberada e publicamos ${item.title ?? 'seu anúncio'} automaticamente.`,
        action_url: corpo.permalink ?? '/dashboard/publicacoes',
        metadata: { pending_publication_id: item.id, ml_item_id: corpo.item_id },
      })
    } else {
      await admin.from('pending_publications').update({
        attempts: item.attempts + 1,
        seller_ready_at: new Date().toISOString(),
        last_error: String(corpo?.error ?? `HTTP ${res.status}`).slice(0, 400),
      }).eq('id', item.id)
    }
  }

  return json({ ok: true, analisados: pendentes?.length ?? 0, publicados, aguardando })
})
