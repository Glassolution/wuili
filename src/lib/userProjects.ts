import { supabase, withFreshSupabaseSession } from "@/integrations/supabase/client";
import type { Json, Tables } from "@/integrations/supabase/types";
import type { ElementOverride } from "@/lib/storeOverrides";

export type ProjectType = "loja_completa" | "pagina_venda";
export type ProjectStatus = "rascunho" | "publicado";
export type ProjectRole = "owner" | "editor" | "viewer";
export type MemberStatus = "pending" | "active";
export type ProjectVisibility = "publico" | "privado";

export type UserProject = Omit<Tables<"user_projects">, "tipo_projeto" | "status"> & {
  tipo_projeto: ProjectType;
  status: ProjectStatus;
};

export type ProjectMember = Omit<Tables<"project_members">, "role" | "status"> & {
  role: ProjectRole;
  status: MemberStatus;
};

export async function fetchUserProjects(): Promise<UserProject[]> {
  const { data, error } = await withFreshSupabaseSession(() =>
    supabase.rpc("get_user_projects"),
  );

  if (error) throw error;
  return (data ?? []) as UserProject[];
}

export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 7);
}

export type CreateProjectInput = {
  nome: string;
  descricao: string;
  tipo: ProjectType;
  productIds: string[];
  template: string;
  logoImage?: string | null;
};

export async function createUserProject(input: CreateProjectInput): Promise<UserProject> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error("not_authenticated");

  const baseSlug = slugify(input.nome) || "loja";
  const slug = `${baseSlug}-${randomSuffix()}`;

  const metadata: Record<string, unknown> = {
    descricao: input.descricao.trim(),
    productIds: input.productIds,
    template: input.template,
    slug,
    visibility: "publico",
    storeName: input.nome.trim(),
  };
  if (input.logoImage) metadata.logoImage = input.logoImage;

  const { data, error } = await supabase
    .from("user_projects")
    .insert({
      user_id: user.id,
      nome: input.nome.trim() || "Meu projeto",
      tipo_projeto: input.tipo,
      status: "rascunho",
      metadata,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as UserProject;
}

/** Salva alterações do editor no metadata (autosave, sem botão). */
export async function saveProjectDraft(
  projectId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { data: current, error: readError } = await supabase
    .from("user_projects")
    .select("metadata")
    .eq("id", projectId)
    .maybeSingle();
  if (readError) throw readError;

  const base =
    current?.metadata && typeof current.metadata === "object" && !Array.isArray(current.metadata)
      ? (current.metadata as Record<string, unknown>)
      : {};

  const { error } = await supabase
    .from("user_projects")
    .update({ metadata: { ...base, ...patch } as Json, last_edited_at: new Date().toISOString() })
    .eq("id", projectId);
  if (error) throw error;
}

export async function publishProject(project: UserProject): Promise<UserProject> {
  const metadata = readMetadata(project);
  let slug = typeof metadata.slug === "string" ? metadata.slug : "";
  if (!slug) {
    slug = `${slugify(project.nome) || "loja"}-${randomSuffix()}`;
  }
  const nextMetadata = { ...metadata, slug } as Json;

  const { data, error } = await supabase
    .from("user_projects")
    .update({
      status: "publicado",
      published_at: new Date().toISOString(),
      metadata: nextMetadata,
    })
    .eq("id", project.id)
    .select("*")
    .single();

  if (error) throw error;
  return data as UserProject;
}

/** Variação real informada pelo fornecedor (ex.: { name: "Cor", options: ["Preto", "Branco"] }).
 *  O formato espelha o que o scraper grava em catalog_products.variants. */
export type ProductVariantOption = { name: string; options: string[] };

export type PublicStoreProduct = {
  id: string;
  title: string;
  price: number;
  originalPrice: number | null;
  imageUrl: string | null;
  category: string | null;
  /** [] quando o fornecedor não informa variação — a vitrine omite o seletor. */
  variants: ProductVariantOption[];
  /** HTML de especificações do fornecedor. Sanitizar antes de renderizar. */
  description: string | null;
};

function firstImage(images: Json | null): string | null {
  if (Array.isArray(images) && images.length > 0) {
    const first = images[0];
    if (typeof first === "string") return first;
    if (first && typeof first === "object" && "url" in first) {
      const url = (first as { url?: unknown }).url;
      return typeof url === "string" ? url : null;
    }
  }
  return null;
}

/** Carrega um projeto publicado por slug (visível sem login via RPC SECURITY DEFINER). */
export async function fetchPublicProject(slug: string): Promise<UserProject | null> {
  const { data, error } = await supabase.rpc("get_public_project", { p_slug: slug });
  if (error) throw error;
  // RPC com RETURNS composite devolve uma linha só de nulls quando não há match.
  const project = data as UserProject | null;
  if (!project || !project.id) return null;
  return project;
}

export function getProjectProductIds(project: UserProject | null): string[] {
  const value = readMetadata(project).productIds;
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
}

export function getProjectDescription(project: UserProject | null): string {
  const value = readMetadata(project).descricao;
  return typeof value === "string" ? value : "";
}

/** Nome de marca exibido na vitrine (o editor grava em metadata.storeName). */
export function getProjectStoreName(project: UserProject | null): string {
  const value = readMetadata(project).storeName;
  if (typeof value === "string" && value.trim()) return value.trim();
  return project?.nome?.trim() || "";
}

export function getProjectTemplate(project: UserProject | null): string {
  const value = readMetadata(project).template;
  return typeof value === "string" ? value : "loja-1";
}

// Customizações da vitrine salvas pelo editor (ver GeneratedStoreEditorPage).
export function getProjectAccent(project: UserProject | null): string {
  const value = readMetadata(project).accent;
  return typeof value === "string" ? value : "#111111";
}

export function getProjectFont(project: UserProject | null): string {
  const value = readMetadata(project).font;
  return typeof value === "string" ? value : "";
}

export function getProjectHeroImage(project: UserProject | null): string {
  const value = readMetadata(project).heroImage;
  return typeof value === "string" ? value : "";
}

export function getProjectLogoImage(project: UserProject | null): string | null {
  const value = readMetadata(project).logoImage;
  return typeof value === "string" ? value : null;
}

export function getProjectColumns(project: UserProject | null): number {
  const value = readMetadata(project).columns;
  return typeof value === "number" ? value : 3;
}

export function getProjectHeroCtaUrl(project: UserProject | null): string {
  const value = readMetadata(project).heroCtaUrl;
  return typeof value === "string" ? value : "/catalogo";
}

export function getProjectCopyVariant(project: UserProject | null): number {
  const value = readMetadata(project).copyVariant;
  return typeof value === "number" ? value : 0;
}

/** Overrides granulares por elemento (mapa path → override). */
export function getProjectOverrides(project: UserProject | null): Record<string, ElementOverride> {
  const value = readMetadata(project).elementOverrides;
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, ElementOverride>)
    : {};
}

/**
 * Produtos de um projeto público. Vai via RPC SECURITY DEFINER porque o RLS de
 * catalog_products só atende usuários autenticados — consultar a tabela direto
 * falha com "permission denied" para o visitante da loja publicada.
 */
export async function fetchPublicStoreProducts(productIds: string[]): Promise<PublicStoreProduct[]> {
  const { data, error } = await supabase.rpc("get_public_store_products", { p_ids: productIds });
  if (error) throw error;

  const rows = (data ?? []) as PublicProductRow[];
  const mapped = rows.map(mapPublicProduct);
  if (productIds.length === 0) return mapped;

  // Respeita a ordem em que o usuário escolheu os produtos: o primeiro é o destaque.
  const order = new Map(productIds.map((id, index) => [id, index]));
  return mapped.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

type PublicProductRow = {
  id: string;
  title: string;
  suggested_price: number | null;
  original_price: number | null;
  images: Json | null;
  category: string | null;
  variants: Json | null;
  description: string | null;
};

function mapPublicProduct(row: PublicProductRow): PublicStoreProduct {
  return {
    id: row.id,
    title: row.title?.trim() || "Produto",
    price: Number(row.suggested_price ?? 0),
    originalPrice: row.original_price,
    imageUrl: firstImage(row.images),
    category: row.category,
    variants: parseVariantOptions(row.variants),
    description: row.description,
  };
}

/**
 * Lê as variações reais gravadas pelo scraper ([{ name, values }]). Retorna []
 * quando o fornecedor não informa variação — a vitrine então OMITE o seletor em
 * vez de inventar cores/tamanhos.
 */
export function parseVariantOptions(value: Json | null): ProductVariantOption[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const { name, options } = entry as { name?: unknown; options?: unknown };
    if (typeof name !== "string" || !name.trim() || !Array.isArray(options)) return [];
    const parsed = options.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
    return parsed.length > 0 ? [{ name: name.trim(), options: parsed }] : [];
  });
}

export async function fetchUserProject(projectId: string): Promise<UserProject | null> {
  const { data, error } = await supabase
    .from("user_projects")
    .select("*")
    .eq("id", projectId)
    .maybeSingle();

  if (error) throw error;
  return (data as UserProject | null) ?? null;
}

/** Ativa convites pendentes deste usuário (só ativa se ele for pago). */
export async function claimProjectInvites(): Promise<number> {
  const { data, error } = await supabase.rpc("claim_project_invites");
  if (error) throw error;
  return data ?? 0;
}

export async function fetchProjectMembers(projectId: string): Promise<ProjectMember[]> {
  const { data, error } = await supabase
    .from("project_members")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ProjectMember[];
}

export type InviteErrorCode =
  | "owner_not_paid"
  | "not_owner"
  | "cannot_invite_self"
  | "invalid_role"
  | "not_authenticated"
  | "unknown";

export function parseInviteError(error: unknown): InviteErrorCode {
  const message = (error as { message?: string })?.message ?? "";
  if (message.includes("owner_not_paid")) return "owner_not_paid";
  if (message.includes("not_owner")) return "not_owner";
  if (message.includes("cannot_invite_self")) return "cannot_invite_self";
  if (message.includes("invalid_role")) return "invalid_role";
  if (message.includes("not_authenticated")) return "not_authenticated";
  return "unknown";
}

export async function inviteProjectMember(
  projectId: string,
  email: string,
  role: Exclude<ProjectRole, "owner">,
): Promise<ProjectMember> {
  const { data, error } = await supabase.rpc("invite_project_member", {
    p_project: projectId,
    p_email: email.trim().toLowerCase(),
    p_role: role,
  });

  if (error) throw error;
  return data as ProjectMember;
}

export async function removeProjectMember(memberId: string): Promise<void> {
  const { error } = await supabase.from("project_members").delete().eq("id", memberId);
  if (error) throw error;
}

// --- Metadados de publicação/domínio (armazenados em user_projects.metadata) ---

type ProjectMetadata = Record<string, unknown>;

function readMetadata(project: UserProject | null): ProjectMetadata {
  const metadata = project?.metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  return metadata as ProjectMetadata;
}

export function getProjectCategory(project: UserProject | null): string {
  const value = readMetadata(project).category;
  return typeof value === "string" ? value : "";
}

export function getProjectVisibility(project: UserProject | null): ProjectVisibility {
  const value = readMetadata(project).visibility;
  return value === "privado" ? "privado" : "publico";
}

export function getProjectSubdomain(project: UserProject | null): string {
  const value = readMetadata(project).subdomain;
  return typeof value === "string" ? value : "";
}

export async function updateProjectName(projectId: string, nome: string): Promise<void> {
  const { error } = await supabase.from("user_projects").update({ nome }).eq("id", projectId);
  if (error) throw error;
}

export async function updateProjectMetadata(
  project: UserProject,
  patch: Partial<{ category: string; visibility: ProjectVisibility; subdomain: string }>,
): Promise<UserProject> {
  const nextMetadata = { ...readMetadata(project), ...patch } as Json;
  const { data, error } = await supabase
    .from("user_projects")
    .update({ metadata: nextMetadata })
    .eq("id", project.id)
    .select("*")
    .maybeSingle();

  if (error) throw error;
  return (data as UserProject) ?? { ...project, metadata: nextMetadata };
}
