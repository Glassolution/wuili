import { useEffect, useState } from "react";
import { supabaseAnonKey, supabaseUrl } from "@/integrations/supabase/client";
import { createTimeoutSignal } from "@/lib/requestTimeout";

/*
  Números reais da landing.

  Regra desta tela: número que aparece é número que veio do banco. Se a rede
  falhar, o bloco simplesmente não aparece — nunca cai num valor "bonito"
  escrito no código, porque isso seria inventar prova social.

  Duas fontes, nesta ordem:

  1. `landing-stats` (supabase/functions/landing-stats) — devolve produtos ativos
     e assinantes ativos. Precisa ser deployada com --no-verify-jwt.
  2. `catalog` — já está no ar hoje e devolve o total de produtos. É a rede de
     segurança enquanto a primeira não existir no projeto.
*/

export type LandingStats = {
  /** Produtos ativos no catálogo, com estoque. */
  produtos: number | null;
  /**
   * Assinantes ativos. Vem como `null` quando o endpoint não está no ar OU
   * quando o número ainda é pequeno demais para ser exibido — essa decisão é
   * tomada no servidor, para o número cru não ficar público antes da hora.
   */
  assinantesAtivos: number | null;
};

const VAZIO: LandingStats = { produtos: null, assinantesAtivos: null };

// Uma consulta por aba. Os números mudam em dias, não em segundos.
const CHAVE_CACHE = "velo_landing_stats";

const inteiroPositivo = (valor: unknown): number | null => {
  const numero = typeof valor === "number" ? valor : Number(valor);
  return Number.isFinite(numero) && numero > 0 ? Math.floor(numero) : null;
};

function lerCache(): LandingStats | null {
  try {
    const bruto = window.sessionStorage.getItem(CHAVE_CACHE);
    if (!bruto) return null;
    const dados = JSON.parse(bruto) as LandingStats;
    return { produtos: inteiroPositivo(dados.produtos), assinantesAtivos: inteiroPositivo(dados.assinantesAtivos) };
  } catch {
    return null;
  }
}

function gravarCache(stats: LandingStats) {
  try {
    window.sessionStorage.setItem(CHAVE_CACHE, JSON.stringify(stats));
  } catch {
    // Modo anônimo ou storage bloqueado: seguir sem cache.
  }
}

async function buscar(caminho: string, sinal: AbortSignal): Promise<unknown | null> {
  if (!supabaseUrl || !supabaseAnonKey) return null;

  const timeout = createTimeoutSignal(6000, sinal);
  try {
    const resposta = await fetch(`${supabaseUrl}/functions/v1/${caminho}`, {
      headers: { Authorization: `Bearer ${supabaseAnonKey}` },
      signal: timeout.signal,
    });
    if (!resposta.ok) return null;
    return (await resposta.json()) as unknown;
  } catch {
    return null;
  } finally {
    timeout.clear();
  }
}

export function useLandingStats(): LandingStats {
  const [stats, setStats] = useState<LandingStats>(() => (typeof window === "undefined" ? VAZIO : lerCache() ?? VAZIO));

  useEffect(() => {
    if (lerCache()) return;

    const controller = new AbortController();

    (async () => {
      const proprio = (await buscar("landing-stats", controller.signal)) as
        | { produtos?: unknown; assinantesAtivos?: unknown }
        | null;

      if (controller.signal.aborted) return;

      let resultado: LandingStats = {
        produtos: inteiroPositivo(proprio?.produtos),
        assinantesAtivos: inteiroPositivo(proprio?.assinantesAtivos),
      };

      // Sem a function nova, ainda dá para mostrar o catálogo: o endpoint
      // `catalog` devolve o total exato junto com a primeira página.
      if (resultado.produtos === null) {
        const catalogo = (await buscar("catalog?page=1&limit=1", controller.signal)) as { total?: unknown } | null;
        if (controller.signal.aborted) return;
        resultado = { ...resultado, produtos: inteiroPositivo(catalogo?.total) };
      }

      if (resultado.produtos === null && resultado.assinantesAtivos === null) return;

      gravarCache(resultado);
      setStats(resultado);
    })();

    return () => controller.abort();
  }, []);

  return stats;
}
