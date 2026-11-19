/*
  Confere, antes do Purchase do navegador, se a assinatura do ?sid= foi paga.

  A ValidaPay manda a pessoa para /assinatura/confirmada antes de o webhook
  confirmar o pagamento (Pix pendente), e qualquer um pode abrir o endereço com
  um sid inventado. O servidor só manda o Purchase depois do webhook de pago;
  se o navegador mandasse antes, a Meta contaria uma compra sem par.

  A leitura passa pela RLS "Users can view own subscriptions" (auth.uid() =
  user_id): sid de outra pessoa ou inexistente volta vazio.
*/

import { supabase } from "@/integrations/supabase/client";

export const INTERVALO_CONFERENCIA_MS = 3000;
export const LIMITE_CONFERENCIA_MS = 30000;

type Opcoes = { intervaloMs?: number; limiteMs?: number; esperar?: (ms: number) => Promise<void> };

const esperarPadrao = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

/**
 * true só se a assinatura `sid` do usuário logado estiver "active".
 * "pending" (ou falha de rede) tenta de novo a cada 3s por até 30s; qualquer
 * outro status, sid inexistente ou de outra pessoa → false na hora.
 */
export async function assinaturaEstaPaga(sid: string, opcoes: Opcoes = {}): Promise<boolean> {
  const intervalo = opcoes.intervaloMs ?? INTERVALO_CONFERENCIA_MS;
  const limite = opcoes.limiteMs ?? LIMITE_CONFERENCIA_MS;
  const esperar = opcoes.esperar ?? esperarPadrao;
  if (!sid) return false;

  for (let decorrido = 0; ; decorrido += intervalo) {
    let tentarDeNovo = false;
    try {
      const { data, error } = await supabase.from("subscriptions").select("status").eq("id", sid).maybeSingle();
      if (error) tentarDeNovo = true;
      else if (!data) return false; // não existe ou não é deste usuário
      else if (data.status === "active") return true;
      else if (data.status === "pending") tentarDeNovo = true;
      else return false; // past_due, refunded, cancelled…
    } catch {
      tentarDeNovo = true;
    }
    if (!tentarDeNovo || decorrido + intervalo > limite) return false;
    await esperar(intervalo);
  }
}
