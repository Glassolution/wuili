/*
  Passo "Escolher um produto" do checklist do Início (celular).

  Conta como feito quando a pessoa abre a ficha de um produto do catálogo — antes
  era marcado ao tocar num produto da grade do Início, que saiu de lá. É progresso
  de interface, por usuário, e fica só no navegador. A chave é a mesma de antes,
  então quem já tinha concluído o passo continua com ele concluído.
*/
const chave = (userId: string) => `velo:first-product-chosen:${userId}`;

export const marcarProdutoEscolhido = (userId: string): void => {
  try {
    window.localStorage.setItem(chave(userId), "true");
  } catch {
    // Navegador bloqueando armazenamento: o passo só não fica lembrado.
  }
};

export const produtoJaEscolhido = (userId: string): boolean => {
  try {
    return window.localStorage.getItem(chave(userId)) === "true";
  } catch {
    return false;
  }
};
