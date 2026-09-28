import { supabase } from "@/integrations/supabase/client";

/*
  Medição da etapa de login/cadastro. Reaproveita a mesma tabela de eventos da landing
  (landing_events) através da RPC pública rpc_signup_track, que só aceita os eventos
  listados no banco — nada aqui grava dado pessoal.
*/

const VISITOR_KEY = "velo_visitor_id";

export function getVisitorId(): string {
  try {
    const existing = localStorage.getItem(VISITOR_KEY);
    if (existing) return existing;
    const novo = crypto.randomUUID();
    localStorage.setItem(VISITOR_KEY, novo);
    return novo;
  } catch {
    return "anon";
  }
}

export function getDevice(): "mobile" | "desktop" {
  if (typeof window === "undefined") return "desktop";
  return window.innerWidth < 1024 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    ? "mobile"
    : "desktop";
}

/*
  Navegadores embutidos de Instagram, Facebook, TikTok, Messenger e afins. O Google
  recusa OAuth nesses ambientes (403 disallowed_useragent), então precisamos detectar
  antes de mandar a pessoa para a tela do Google e ela ver um erro cru.
*/
export function detectInAppBrowser(): string | null {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent || "";
  if (/Instagram/i.test(ua)) return "Instagram";
  if (/FBAN|FBAV|FB_IAB|Messenger/i.test(ua)) return "Facebook";
  if (/musical_ly|Bytedance|TikTok|BytedanceWebview|Trill/i.test(ua)) return "TikTok";
  if (/Twitter/i.test(ua)) return "X";
  if (/Linkedin/i.test(ua)) return "LinkedIn";
  if (/Snapchat/i.test(ua)) return "Snapchat";
  if (/KAKAOTALK|Line\//i.test(ua)) return "Mensageiro";
  // WebView genérico de Android sem indicação de Chrome completo.
  if (/Android.*; wv\)/i.test(ua)) return "aplicativo";
  return null;
}

export function trackSignup(event: string, detail?: string) {
  try {
    const origem = readOrigin();
    // O cliente do banco só dispara a chamada quando alguém "escuta" a promessa:
    // sem o .then() abaixo nenhum evento de cadastro era gravado.
    void supabase
      .rpc("rpc_signup_track", {
        p_event: event,
        p_visitor_id: getVisitorId(),
        p_device: getDevice(),
        p_detail: detail ?? null,
        p_referrer: typeof document !== "undefined" ? document.referrer || null : null,
        p_origem: origem.utm_source || origem.signup_source || null,
        p_browser: detectInAppBrowser() ? "interno" : "normal",
      })
      .then(({ error }) => {
        if (error) console.warn("[medição] cadastro não registrado:", error.message);
      });
  } catch {
    /* medição nunca pode atrapalhar o cadastro */
  }
}

/* ─── Origem do visitante (UTM) ───────────────────────────────────────────── */

const ORIGEM_KEY = "velo_signup_origin";

export type OrigemCadastro = {
  signup_source: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
};

export function captureOrigin(): void {
  try {
    const params = new URLSearchParams(window.location.search);
    const utm_source = params.get("utm_source");
    const utm_medium = params.get("utm_medium");
    const utm_campaign = params.get("utm_campaign");
    const jaTem = localStorage.getItem(ORIGEM_KEY);
    // A primeira origem vista é a que conta; não sobrescrevemos com navegação interna.
    if (jaTem && !utm_source) return;
    const origem: OrigemCadastro = {
      signup_source: utm_source || (document.referrer ? new URL(document.referrer).hostname : "direto"),
      utm_source,
      utm_medium,
      utm_campaign,
    };
    localStorage.setItem(ORIGEM_KEY, JSON.stringify(origem));
  } catch {
    /* ignore */
  }
}

export function readOrigin(): OrigemCadastro {
  try {
    const raw = localStorage.getItem(ORIGEM_KEY);
    if (raw) return JSON.parse(raw) as OrigemCadastro;
  } catch {
    /* ignore */
  }
  return { signup_source: "direto", utm_source: null, utm_medium: null, utm_campaign: null };
}

/* ─── Correção de erros comuns de digitação no e-mail ─────────────────────── */

const DOMINIOS_CORRETOS: Record<string, string> = {
  "gmail.con": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.cm": "gmail.com",
  "gmai.com": "gmail.com",
  "gmial.com": "gmail.com",
  "gmail.comm": "gmail.com",
  "hotmail.con": "hotmail.com",
  "hotmial.com": "hotmail.com",
  "hotmai.com": "hotmail.com",
  "hotmail.co": "hotmail.com",
  "outlok.com": "outlook.com",
  "outlook.con": "outlook.com",
  "yaho.com": "yahoo.com",
  "yahoo.con": "yahoo.com",
  "icloud.con": "icloud.com",
  "bol.com": "bol.com.br",
  "uol.com": "uol.com.br",
};

export function sugerirEmail(email: string): string | null {
  const limpo = email.trim().toLowerCase();
  const at = limpo.lastIndexOf("@");
  if (at < 1) return null;
  const dominio = limpo.slice(at + 1);
  const correto = DOMINIOS_CORRETOS[dominio];
  if (!correto || correto === dominio) return null;
  return `${limpo.slice(0, at)}@${correto}`;
}

/* ─── Erros em português simples ──────────────────────────────────────────── */

export function mensagemDeErro(bruta: string): string {
  const m = bruta.toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos. Confira e tente de novo.";
  if (m.includes("user already registered") || m.includes("already been registered"))
    return "Este e-mail já tem conta na Velo. Entre com a sua senha.";
  if (m.includes("pwned") || m.includes("compromised") || m.includes("known to be weak"))
    return "Essa senha é comum demais e já apareceu em vazamentos. Evite senhas comuns, como 12345678 ou seu nome.";
  if (m.includes("password should be at least") || m.includes("password is too short"))
    return "A senha precisa ter pelo menos 8 caracteres.";
  if (m.includes("password should contain"))
    return "A senha precisa ter os tipos de caracteres exigidos. Tente outra.";
  if (m.includes("email not confirmed"))
    return "Falta confirmar seu e-mail. Abra o e-mail que enviamos e toque no link.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Muitas tentativas seguidas. Espere um minutinho e tente de novo.";
  if (m.includes("invalid email") || m.includes("unable to validate email"))
    return "Esse e-mail parece inválido. Confira se está escrito certo.";
  if (m.includes("network") || m.includes("fetch"))
    return "Sua internet oscilou. Tente novamente.";
  if (m.includes("disallowed_useragent"))
    return "Abra a Velo no navegador do celular para entrar com o Google, ou use seu e-mail aqui mesmo.";
  return "Não conseguimos concluir agora. Tente de novo em instantes.";
}

export function tipoDeErro(bruta: string): string {
  const m = bruta.toLowerCase();
  if (m.includes("invalid login credentials")) return "senha_incorreta";
  if (m.includes("already registered")) return "email_existente";
  if (m.includes("pwned") || m.includes("compromised") || m.includes("known to be weak")) return "senha_vazada";
  if (m.includes("should be at least") || m.includes("too short")) return "senha_curta";
  if (m.includes("password should contain") || m.includes("password")) return "senha_requisitos";
  if (m.includes("email not confirmed")) return "email_nao_confirmado";
  if (m.includes("rate limit") || m.includes("too many")) return "limite_tentativas";
  if (m.includes("network") || m.includes("fetch")) return "rede";
  return "outro";
}

/*
  Cadastro pelo Google volta do OAuth direto para /dashboard, sem passar pelo trecho
  do LoginPage que liga o visitante da landing à conta e registra signup_success.
  Sem isto, quase toda conta Google aparecia como "direto" e fora do funil.
  Só vale para conta recém-criada (até 30 min) e roda uma vez por conta neste navegador.
*/
export function atribuirCadastroOAuth(user: {
  id: string;
  created_at?: string;
  app_metadata?: { provider?: string } | null;
} | null) {
  if (typeof window === "undefined" || !user?.id) return;
  const provedor = user.app_metadata?.provider;
  if (!provedor || provedor === "email") return;
  const criadaEm = new Date(user.created_at ?? "").getTime();
  if (!Number.isFinite(criadaEm) || Date.now() - criadaEm > 30 * 60 * 1000) return;

  const chave = `velo-atribuicao-oauth:${user.id}`;
  try {
    if (window.localStorage.getItem(chave)) return;
    window.localStorage.setItem(chave, "1");
  } catch {
    return;
  }

  trackSignup("signup_success", provedor);
  const origem = readOrigin();
  // O filtro em visitor_id nulo impede sobrescrever uma atribuição feita em outro navegador.
  void supabase
    .from("profiles")
    .update({
      signup_source: origem.signup_source,
      utm_source: origem.utm_source,
      utm_medium: origem.utm_medium,
      utm_campaign: origem.utm_campaign,
      visitor_id: getVisitorId(),
    })
    .eq("user_id", user.id)
    .is("visitor_id", null)
    .then(({ error }) => {
      if (error) console.warn("[medição] origem do cadastro Google não gravada:", error.message);
    });
}

/*
  Primeira vez que a pessoa vê produto de verdade depois de criar a conta.
  Guardamos só o tempo em faixas (não o instante exato) porque o que interessa
  é saber se o caminho cadastro → catálogo está rápido, e o evento é anônimo
  por visitante, como os demais do funil.
*/
export function trackPrimeiroProdutoVisto(userId: string, contaCriadaEm?: string | null) {
  if (typeof window === "undefined" || !userId) return;
  const chave = `velo-primeiro-produto:${userId}`;
  if (window.localStorage.getItem(chave)) return;
  window.localStorage.setItem(chave, "1");

  let faixa = "desconhecido";
  if (contaCriadaEm) {
    const seg = (Date.now() - new Date(contaCriadaEm).getTime()) / 1000;
    if (seg < 0) faixa = "desconhecido";
    else if (seg <= 60) faixa = "ate-1min";
    else if (seg <= 300) faixa = "ate-5min";
    else if (seg <= 1800) faixa = "ate-30min";
    else if (seg <= 86400) faixa = "ate-24h";
    else faixa = "mais-de-24h";
  }
  trackSignup("onboarding_first_product_view", faixa);
}
