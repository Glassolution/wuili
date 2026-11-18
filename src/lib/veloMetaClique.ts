/*
  Clique do anúncio da Meta (fbclid) guardado no navegador.

  Quem chega por um anúncio traz ?fbclid= na URL. Guardamos o fbclid e os
  cookies _fbp/_fbc em localStorage (velo_meta_click) para que, mais tarde, o
  servidor consiga mandar o Purchase com o clique certo. Se o cookie _fbc não
  existir (ou for de outro clique), montamos no formato da Meta: fb.1.<ms>.<fbclid>.

  Na criação da conta, salvarCliqueMetaNoPerfil grava o clique em
  profiles.meta_fbclid/meta_fbc/meta_fbp/meta_click_captured_at, que o
  validapay-webhook usa no Purchase pelo servidor.
*/

import { supabase } from "@/integrations/supabase/client";
import type { TablesUpdate } from "@/integrations/supabase/types";

export const CHAVE_CLIQUE_META = "velo_meta_click";

export type CliqueMeta = {
  fbclid: string;
  fbp: string | null;
  fbc: string;
  captured_at: string;
};

function lerCookie(nome: string): string | null {
  try {
    const achado = document.cookie.split("; ").find((par) => par.startsWith(`${nome}=`));
    return achado ? decodeURIComponent(achado.slice(nome.length + 1)) || null : null;
  } catch {
    return null;
  }
}

export function lerCliqueMeta(): CliqueMeta | null {
  try {
    const bruto = window.localStorage.getItem(CHAVE_CLIQUE_META);
    return bruto ? (JSON.parse(bruto) as CliqueMeta) : null;
  } catch {
    return null;
  }
}

/** Chamada a cada troca de rota. Só faz algo quando a URL tem fbclid. */
export function capturarCliqueMeta(): void {
  if (typeof window === "undefined") return;
  try {
    const fbclid = new URLSearchParams(window.location.search).get("fbclid")?.trim().slice(0, 500);
    if (!fbclid) return;

    const agora = Date.now();
    const anterior = lerCliqueMeta();
    // Mesmo fbclid de novo (F5, troca de rota): só completa o _fbp se faltava.
    if (anterior?.fbclid === fbclid) {
      if (!anterior.fbp) completarFbp();
      return;
    }

    // Um _fbc de um clique anterior (outro fbclid) não serve para este.
    const fbcCookie = lerCookie("_fbc");
    const clique: CliqueMeta = {
      fbclid,
      fbp: lerCookie("_fbp"),
      fbc: fbcCookie?.endsWith(`.${fbclid}`) ? fbcCookie : `fb.1.${agora}.${fbclid}`,
      captured_at: new Date(agora).toISOString(),
    };
    window.localStorage.setItem(CHAVE_CLIQUE_META, JSON.stringify(clique));
    if (!clique.fbp) completarFbp();
  } catch {
    // localStorage bloqueado ou cheio: segue sem guardar.
  }
}

/*
  O _fbp é criado pelo script da Meta, que carrega depois da primeira
  renderização. Na primeira visita ele ainda não existe; tentamos de novo
  alguns segundos depois.
*/
function completarFbp(): void {
  window.setTimeout(() => {
    try {
      const fbp = lerCookie("_fbp");
      const atual = lerCliqueMeta();
      if (!fbp || !atual || atual.fbp) return;
      window.localStorage.setItem(CHAVE_CLIQUE_META, JSON.stringify({ ...atual, fbp }));
    } catch {
      /* ignore */
    }
  }, 3000);
}

/**
 * Conta criada: grava o clique guardado no perfil. Só grava se houver clique e
 * se o perfil ainda não tiver um (o filtro em meta_fbclid nulo impede
 * sobrescrever um clique já salvo). Nunca lança erro nem atrasa o cadastro.
 */
export async function salvarCliqueMetaNoPerfil(userId: string): Promise<void> {
  const clique = lerCliqueMeta();
  if (!userId || !clique?.fbclid) return;
  const campos: TablesUpdate<"profiles"> = {
    meta_fbclid: clique.fbclid,
    meta_fbc: clique.fbc || null,
    meta_fbp: clique.fbp || null,
    meta_click_captured_at: clique.captured_at || null,
  };
  try {
    const { error } = await supabase
      .from("profiles")
      .update(campos)
      .eq("user_id", userId)
      .is("meta_fbclid", null);
    if (error) console.warn("[medição] clique da Meta não gravado no perfil:", error.message);
  } catch {
    /* medição nunca pode atrapalhar o cadastro */
  }
}
