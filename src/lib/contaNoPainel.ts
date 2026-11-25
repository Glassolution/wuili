import { useSyncExternalStore } from "react";

/*
  Plano e permissão de admin da conta, para a barra do topo do painel.

  Quem descobre os dois é a DashboardSidebar, que já lê a assinatura e confere o
  admin. Ela publica aqui e a barra do topo (perfil) lê, sem uma segunda consulta
  ao banco. Fica só em memória, como o prazo do teste (`prazoDoTeste.ts`).
*/
export type ContaNoPainel = {
  plano: string;
  ehAdmin: boolean;
};

let conta: ContaNoPainel = { plano: "gratis", ehAdmin: false };
const ouvintes = new Set<() => void>();

export const definirContaNoPainel = (proxima: ContaNoPainel) => {
  if (proxima.plano === conta.plano && proxima.ehAdmin === conta.ehAdmin) return;
  conta = proxima;
  ouvintes.forEach((avisar) => avisar());
};

const assinar = (avisar: () => void) => {
  ouvintes.add(avisar);
  return () => {
    ouvintes.delete(avisar);
  };
};

export const useContaNoPainel = () => useSyncExternalStore(assinar, () => conta, () => conta);
