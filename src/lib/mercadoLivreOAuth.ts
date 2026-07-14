import { supabase } from "@/integrations/supabase/client";

type MercadoLivreConnectResponse = {
  authUrl?: unknown;
  auth_url?: unknown;
  url?: unknown;
  error?: unknown;
};

const readUrl = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);

export const startMercadoLivreOAuth = async () => {
  const { data, error } = await supabase.functions.invoke<MercadoLivreConnectResponse>("ml-connect");

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

  window.location.assign(authUrl);
};
