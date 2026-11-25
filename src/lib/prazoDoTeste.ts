import { useSyncExternalStore } from "react";

/*
  Fim do período de teste da conta (ISO) ou null quando a pessoa não está em teste.

  Quem descobre o valor é a DashboardSidebar, que já carrega a assinatura para o
  card "Trial ativo". Ela publica aqui e a Início lê, sem uma segunda consulta ao
  banco. Fica só em memória: recarregar a página volta a null até a sidebar ler.
*/
let fimDoTeste: string | null = null;
const ouvintes = new Set<() => void>();

export const definirFimDoTeste = (valor: string | null) => {
  if (valor === fimDoTeste) return;
  fimDoTeste = valor;
  ouvintes.forEach((avisar) => avisar());
};

const assinar = (avisar: () => void) => {
  ouvintes.add(avisar);
  return () => {
    ouvintes.delete(avisar);
  };
};

export const useFimDoTeste = () => useSyncExternalStore(assinar, () => fimDoTeste, () => null);

/** "47:53:25": horas totais (podem passar de 24), minutos e segundos. */
export const formatarContagem = (restanteMs: number) => {
  const total = Math.max(0, Math.floor(restanteMs / 1000));
  const horas = Math.floor(total / 3600);
  const minutos = Math.floor((total % 3600) / 60);
  const segundos = total % 60;
  const dois = (n: number) => String(n).padStart(2, "0");
  return `${dois(horas)}:${dois(minutos)}:${dois(segundos)}`;
};
