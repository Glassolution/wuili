import { supabase } from "@/integrations/supabase/client";

type MercadoLivreConnectResponse = {
  authUrl?: unknown;
  auth_url?: unknown;
  url?: unknown;
  error?: unknown;
};

export const ML_CONNECT_FALLBACK_MESSAGE =
  "Não foi possível abrir a conexão com o Mercado Livre agora. Tente de novo em instantes ou abra Integrações no menu.";

const readUrl = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);

/**
 * Inicia o OAuth do Mercado Livre.
 *
 * `novaAba` existe para o guia do Atlas: sair da página fecharia o chat e o
 * usuário perderia o progresso do guia. A aba é aberta antes do await, senão o
 * navegador trata como popup e bloqueia.
 */
export const startMercadoLivreOAuth = async (options?: { novaAba?: boolean }) => {
  // Padrão: nova aba. Assim o usuário nunca perde a página (chat do Atlas, catálogo, etc.).
  const novaAba = options?.novaAba ?? true;
  const aba = novaAba ? window.open("about:blank", "_blank") : null;
  if (aba) aba.opener = null;

  try {
    const { data: rawData, error } = await supabase.functions.invoke("ml-connect");
    const data = rawData as MercadoLivreConnectResponse | null;

    if (error) {
      throw new Error(error.message || "Nao foi possivel iniciar a conexao com o Mercado Livre");
    }

    const authUrl = readUrl(data?.authUrl) ?? readUrl(data?.auth_url) ?? readUrl(data?.url);

    if (!authUrl) {
      const serverMessage = readUrl(data?.error);
      throw new Error(serverMessage || "A conexao com o Mercado Livre nao retornou uma URL de autorizacao");
    }

    if (!authUrl.startsWith("https://auth.mercadolivre.com")) {
      throw new Error("A URL de autorizacao do Mercado Livre veio em um formato invalido");
    }

    // Popup bloqueado: melhor navegar do que deixar o usuário sem caminho.
    if (aba && !aba.closed) aba.location.href = authUrl;
    else window.location.assign(authUrl);
  } catch (erro) {
    if (aba && !aba.closed) aba.close();
    throw erro;
  }
};

