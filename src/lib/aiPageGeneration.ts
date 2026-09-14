import { supabase } from "@/integrations/supabase/client";

/**
 * Geração de páginas de produto com IA (motor: PagePilot).
 *
 * Esta fase termina em PREVIEW: o conteúdo é salvo na Velo e mostrado numa tela
 * de revisão. Nada aqui publica em Shopify nem em loja externa.
 *
 * A chave da API vive só nas Edge Functions — o frontend nunca a vê.
 */

export type AiPageStatus = "gerando" | "pronto" | "erro";

export type AiProductPageRow = {
  id: string;
  user_id: string;
  catalog_product_id: string | null;
  source_url: string | null;
  language: string;
  image_count: number;
  status: AiPageStatus;
  content: Record<string, unknown>;
  images: string[];
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
};

/** Limite do PagePilot com a chave padrão: 1 criação por minuto. */
export const AI_PAGE_COOLDOWN_SECONDS = 60;

export type AiPageErrorCode =
  | "rate_limited"
  | "plan_required"
  | "invalid_url"
  | "product_without_url"
  | "product_not_found"
  | "missing_api_key"
  | "provider_unreachable"
  | "provider_error"
  | "persist_failed"
  | "timeout"
  | "unauthorized"
  | "unknown";

export class AiPageError extends Error {
  code: AiPageErrorCode;
  retryAfterSeconds?: number;

  constructor(code: AiPageErrorCode, message: string, retryAfterSeconds?: number) {
    super(message);
    this.name = "AiPageError";
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** Mensagem em pt-BR por código, para a UI não montar texto solto. */
export const aiPageErrorMessage = (error: AiPageError): string => {
  switch (error.code) {
    case "rate_limited":
      return error.retryAfterSeconds
        ? `Aguarde ${error.retryAfterSeconds}s para gerar outra página. O PagePilot libera uma geração por minuto.`
        : "Aguarde um minuto entre uma geração e outra.";
    case "plan_required":
      return "A conta PagePilot conectada precisa do plano Starter ou superior. Verifique o plano dessa conta e tente de novo.";
    case "invalid_url":
      return "Não conseguimos ler esse link. Use a URL da página do produto no AliExpress, Amazon, TikTok Shop ou Etsy.";
    case "product_without_url":
      return "Esse produto salvo não tem link de origem. Cole a URL do produto para gerar a página.";
    case "product_not_found":
      return "Produto não encontrado na sua conta.";
    case "missing_api_key":
      return "A integração com o PagePilot não está configurada. Fale com o suporte da Velo.";
    case "provider_unreachable":
      return "O PagePilot não respondeu. Tente de novo em instantes.";
    case "timeout":
      return "A geração passou do tempo e foi interrompida. Tente gerar de novo.";
    case "persist_failed":
      return "A página foi gerada, mas falhou ao salvar. Tente de novo.";
    case "unauthorized":
      return "Sua sessão expirou. Entre de novo para continuar.";
    default:
      return "Não foi possível gerar a página agora. Tente de novo em instantes.";
  }
};

type FunctionErrorBody = {
  error?: string;
  message?: string;
  retry_after_seconds?: number;
};

/**
 * supabase.functions.invoke não expõe o corpo em respostas 4xx/5xx — devolve um
 * FunctionsHttpError genérico. Sem ler o corpo não dá para diferenciar rate
 * limit de plano insuficiente, que é justamente o que a UI precisa distinguir.
 */
const readErrorBody = async (error: unknown): Promise<FunctionErrorBody> => {
  const context = (error as { context?: unknown })?.context;
  if (context instanceof Response) {
    return (await context.clone().json().catch(() => ({}))) as FunctionErrorBody;
  }
  return {};
};

const toAiPageError = async (error: unknown): Promise<AiPageError> => {
  const body = await readErrorBody(error);
  const code = (body.error ?? "unknown") as AiPageErrorCode;
  return new AiPageError(code, body.message ?? "", body.retry_after_seconds);
};

export type CreateAiPageInput = {
  productUrl?: string;
  catalogProductId?: string | null;
  language: string;
  imageCount: number;
};

/** Dispara a geração. Devolve o id da página para acompanhar o status. */
export const createAiProductPage = async (
  input: CreateAiPageInput,
): Promise<{ id: string; createdAt: string }> => {
  const { data, error } = await supabase.functions.invoke("ai-page-create", {
    body: {
      product_url: input.productUrl?.trim() || undefined,
      catalog_product_id: input.catalogProductId || undefined,
      language: input.language,
      image_count: input.imageCount,
    },
  });

  if (error) throw await toAiPageError(error);

  const payload = data as { id: string; created_at: string };
  return { id: payload.id, createdAt: payload.created_at };
};

export type AiPageStatusResult = {
  id: string;
  status: AiPageStatus;
  content: Record<string, unknown>;
  images: string[];
  errorCode?: string;
  message?: string;
};

/** Pergunta ao backend como está a geração; ele persiste o conteúdo ao ficar pronto. */
export const fetchAiPageStatus = async (pageId: string): Promise<AiPageStatusResult> => {
  const { data, error } = await supabase.functions.invoke("ai-page-status", {
    body: { page_id: pageId },
  });

  if (error) throw await toAiPageError(error);

  const payload = data as {
    id: string;
    status: AiPageStatus;
    content?: Record<string, unknown>;
    images?: string[];
    error?: string;
    message?: string;
  };

  return {
    id: payload.id,
    status: payload.status,
    content: payload.content ?? {},
    images: payload.images ?? [],
    errorCode: payload.error,
    message: payload.message,
  };
};

const aiPagesTable = () => supabase.from("ai_product_pages");

/** Lê a prévia salva (tela de preview e reabertura posterior). */
export const fetchAiProductPage = async (pageId: string): Promise<AiProductPageRow | null> => {
  const { data, error } = await aiPagesTable().select("*").eq("id", pageId).maybeSingle();
  if (error) throw error;
  return (data as AiProductPageRow | null) ?? null;
};

/** Lista as prévias do usuário, mais recentes primeiro (RLS filtra por dono). */
export const listAiProductPages = async (limit = 20): Promise<AiProductPageRow[]> => {
  const { data, error } = await aiPagesTable()
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as AiProductPageRow[] | null) ?? [];
};

/**
 * Segundos restantes do cooldown, a partir da última geração do usuário.
 * Serve só para a UI antecipar o bloqueio — quem decide é a Edge Function.
 */
export const secondsUntilNextGeneration = (lastCreatedAt: string | null | undefined): number => {
  if (!lastCreatedAt) return 0;
  const elapsed = (Date.now() - new Date(lastCreatedAt).getTime()) / 1000;
  return Math.max(0, Math.ceil(AI_PAGE_COOLDOWN_SECONDS - elapsed));
};

/** Última geração não-falha do usuário, para calcular o cooldown ao abrir a tela. */
export const fetchLastGenerationAt = async (): Promise<string | null> => {
  const { data, error } = await aiPagesTable()
    .select("created_at")
    .neq("status", "erro")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return null;
  return (data as { created_at: string } | null)?.created_at ?? null;
};

/**
 * Achata o conteúdo devolvido pelo provedor em seções exibíveis.
 * O contrato do PagePilot ainda não está confirmado, então percorremos o objeto
 * de forma defensiva em vez de assumir um formato fixo.
 */
export type PreviewSection = { title: string; body: string };

export const toPreviewSections = (content: Record<string, unknown>): PreviewSection[] => {
  const sections: PreviewSection[] = [];

  const pushText = (title: string, value: unknown) => {
    if (typeof value === "string" && value.trim()) {
      sections.push({ title, body: value.trim() });
    }
  };

  const humanize = (key: string) =>
    key.replace(/[_-]+/g, " ").replace(/^./, (char) => char.toUpperCase());

  const walk = (value: unknown, path: string) => {
    if (typeof value === "string") {
      pushText(humanize(path), value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, `${path} ${index + 1}`));
      return;
    }
    if (value && typeof value === "object") {
      for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
        // Campos de controle não interessam na prévia.
        if (["id", "status", "state", "created_at", "updated_at", "url"].includes(key)) continue;
        walk(nested, path ? `${path} · ${humanize(key)}` : humanize(key));
      }
    }
  };

  walk(content, "");
  return sections;
};

/**
 * Descrição curta para o bloco de compra do template.
 *
 * O `content` do PagePilot não tem formato fixo, então procuramos as chaves que
 * costumam trazer o texto de venda, em ordem de preferência, e paramos na
 * primeira que sirva. O texto do fornecedor (catalog_products.description) NÃO
 * entra aqui de propósito: é ficha técnica raspada, sai como parágrafo corrido
 * gigante e estica a coluna de compra para longe da imagem do produto.
 */
const DESCRIPTION_KEYS = [
  "short_description",
  "shortDescription",
  "product_description",
  "productDescription",
  "description",
  "subheadline",
  "subheading",
  "subtitle",
  "summary",
  "intro",
  "hero_text",
  "heroText",
  "tagline",
];

/** Corta no fim de frase para o parágrafo não terminar no meio da palavra. */
const trimToSentence = (text: string, limit: number): string => {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= limit) return clean;
  const cut = clean.slice(0, limit);
  const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  if (lastStop > limit * 0.5) return cut.slice(0, lastStop + 1);
  return `${cut.slice(0, cut.lastIndexOf(" "))}…`;
};

export const extractAiDescription = (
  content: Record<string, unknown> | null | undefined,
  limit = 260,
): string => {
  if (!content || typeof content !== "object") return "";

  // Busca em largura: campos do topo valem mais que os aninhados.
  const queue: Array<Record<string, unknown>> = [content];
  while (queue.length > 0) {
    const node = queue.shift() as Record<string, unknown>;
    for (const key of DESCRIPTION_KEYS) {
      const value = node[key];
      if (typeof value === "string" && value.trim().length >= 40) {
        return trimToSentence(value, limit);
      }
    }
    for (const value of Object.values(node)) {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        queue.push(value as Record<string, unknown>);
      } else if (Array.isArray(value)) {
        for (const item of value) {
          if (item && typeof item === "object" && !Array.isArray(item)) queue.push(item as Record<string, unknown>);
        }
      }
    }
  }
  return "";
};

/** Descrição pronta para o template a partir da página de IA do produto. */
export const aiDescriptionForProduct = async (catalogProductId: string): Promise<string> => {
  const { data, error } = await aiPagesTable()
    .select("content,status")
    .eq("catalog_product_id", catalogProductId)
    .eq("status", "pronto")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return "";
  return extractAiDescription((data as { content: Record<string, unknown> }).content);
};
