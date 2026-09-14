/*
  Nome usado para exibir o usuário dentro da Velo.

  O cadastro guarda o nome completo (e é ele que continua salvo em
  `profiles.display_name`), mas na interface só mostramos os dois primeiros
  nomes — "Luis Felipe Ferreira Xavier" virava "Luis Felipe Ferreira X..."
  cortado na lateral. Quando não há nome utilizável, cai para a parte local
  do e-mail.

  Importante: use isto apenas para EXIBIR. Formulários que editam e salvam o
  nome devem continuar trabalhando com o valor completo, senão o primeiro
  salvamento apaga o resto do nome.
*/
const PADRAO = "Usuário";

export const nomeDeExibicao = (nomeCompleto?: string | null, email?: string | null): string => {
  const partes = (nomeCompleto ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

  if (partes.length > 0) return partes.slice(0, 2).join(" ");

  const local = (email ?? "").split("@")[0]?.trim();
  return local || PADRAO;
};

// Só o primeiro nome — para saudações ("Bem-vindo, Luis!").
export const primeiroNome = (nomeCompleto?: string | null, email?: string | null): string =>
  nomeDeExibicao(nomeCompleto, email).split(" ")[0] || PADRAO;
