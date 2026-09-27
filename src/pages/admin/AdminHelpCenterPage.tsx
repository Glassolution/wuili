import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  ExternalLink,
  FolderTree,
  Layers,
  Loader2,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
} from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminBadge, AdminCard, AdminPill, AdminSelectPill, AdminToolTile } from "@/components/admin/AdminPrimitives";
import HelpArticleContent from "@/components/help-center/HelpArticleContent";
import { HELP_CATEGORY_ICONS, helpCategoryIcon } from "@/components/help-center/helpCenterIcons";
import { veloToast as toast } from "@/components/ui/velo-toast";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
  deleteHelpArticle,
  deleteHelpCategory,
  fetchHelpCenter,
  helpCenterErrorMessage,
  helpCenterKeys,
  isValidSlug,
  matchesHelpQuery,
  saveHelpArticle,
  saveHelpCategory,
  setHelpArticleStatus,
  slugify,
  swapHelpPositions,
  type HelpArticle,
  type HelpArticleInput,
  type HelpArticleStatus,
  type HelpCategory,
  type HelpCategoryInput,
} from "@/lib/helpCenter";

/*
  Admin da Central de Ajuda: artigos (criar, editar, ordenar, publicar e
  despublicar) e categorias (menu lateral e cards de acesso rápido). Tudo que é
  salvo aqui aparece em /ajuda e /dashboard/ajuda — e é o que o assistente de
  suporte por IA vai ler.
*/

type Tab = "articles" | "categories";
type StatusFilter = "all" | HelpArticleStatus;

const inputClass =
  "w-full rounded-[8px] border border-[#e4e4e0] bg-white px-3 py-2 text-[13.5px] text-[#1a1a1a] outline-none transition placeholder:text-[#a3a39d] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15";

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const Field = ({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) => (
  <label className="block">
    <span className="mb-1.5 block text-[12.5px] font-medium text-[#1a1a1a]">{label}</span>
    {children}
    {hint ? <span className="mt-1 block text-[12px] text-[#8c8f93]">{hint}</span> : null}
  </label>
);

const AdminHelpCenterPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("articles");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: helpCenterKeys.admin,
    queryFn: () => fetchHelpCenter({ includeDrafts: true }),
  });
  const categories = useMemo(() => data?.categories ?? [], [data]);
  const articles = useMemo(() => data?.articles ?? [], [data]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: helpCenterKeys.all });

  const run = useMutation({
    mutationFn: async (action: { task: () => Promise<void>; success: string }) => {
      await action.task();
      return action.success;
    },
    onSuccess: (message) => {
      toast.success(message);
      invalidate();
    },
    onError: (error) => {
      console.error("[central-de-ajuda]", error);
      toast.error(helpCenterErrorMessage(error));
    },
  });

  const publishedCount = articles.filter((article) => article.status === "published").length;

  return (
    <AdminShell
      active="helpCenter"
      userId="admin"
      title="Central de ajuda"
      subtitle="Artigos que aparecem em /ajuda e no painel do usuário. O mesmo conteúdo vai alimentar o assistente de suporte por IA."
      actions={
        <>
          <div className="admin-segmented" role="tablist" aria-label="Seção">
            <button type="button" role="tab" data-active={tab === "articles"} aria-selected={tab === "articles"} onClick={() => setTab("articles")}>
              <Layers size={14} aria-hidden="true" /> Artigos
            </button>
            <button type="button" role="tab" data-active={tab === "categories"} aria-selected={tab === "categories"} onClick={() => setTab("categories")}>
              <FolderTree size={14} aria-hidden="true" /> Categorias
            </button>
          </div>
          <Link to="/ajuda" target="_blank" rel="noopener noreferrer" className="admin-pill inline-flex items-center gap-1.5">
            <ExternalLink size={14} aria-hidden="true" /> Ver central pública
          </Link>
        </>
      }
    >
      {isLoading ? (
        <div className="flex min-h-[240px] items-center justify-center text-[#8c8f93]">
          <Loader2 size={18} className="mr-2 animate-spin" aria-hidden="true" /> Carregando...
        </div>
      ) : isError ? (
        <AdminCard className="p-6 text-center">
          <p className="text-[14px] font-medium text-[#1a1a1a]">Não foi possível carregar a central de ajuda.</p>
          <p className="mt-1 text-[13px] text-[#8c8f93]">Se as tabelas ainda não existem, rode a migration `help_center`.</p>
          <AdminPill className="mt-4" onClick={() => refetch()}>Tentar novamente</AdminPill>
        </AdminCard>
      ) : tab === "articles" ? (
        <ArticlesTab
          categories={categories}
          articles={articles}
          publishedCount={publishedCount}
          busy={run.isPending}
          onGoToCategories={() => setTab("categories")}
          onSave={(input, id) =>
            run.mutateAsync({
              task: () => saveHelpArticle(input, user?.id, id),
              success: id ? "Artigo atualizado." : "Artigo criado.",
            })
          }
          onToggleStatus={(article) => {
            const next: HelpArticleStatus = article.status === "published" ? "draft" : "published";
            run.mutate({
              task: () => setHelpArticleStatus(article.id, next, user?.id),
              success: next === "published" ? "Artigo publicado." : "Artigo despublicado.",
            });
          }}
          onDelete={(article) => {
            if (!window.confirm(`Excluir o artigo "${article.title}"? Essa ação não pode ser desfeita.`)) return;
            run.mutate({ task: () => deleteHelpArticle(article.id), success: "Artigo excluído." });
          }}
          onMove={(a, b) => run.mutate({ task: () => swapHelpPositions("help_articles", a, b), success: "Ordem atualizada." })}
        />
      ) : (
        <CategoriesTab
          categories={categories}
          articles={articles}
          busy={run.isPending}
          onSave={(input, id) =>
            run.mutateAsync({
              task: () => saveHelpCategory(input, id),
              success: id ? "Categoria atualizada." : "Categoria criada.",
            })
          }
          onDelete={(category) => {
            if (!window.confirm(`Excluir a categoria "${category.title}"?`)) return;
            run.mutate({ task: () => deleteHelpCategory(category.id), success: "Categoria excluída." });
          }}
          onMove={(a, b) => run.mutate({ task: () => swapHelpPositions("help_categories", a, b), success: "Ordem atualizada." })}
        />
      )}
    </AdminShell>
  );
};

// ── Artigos ──────────────────────────────────────────────────────────────────

type ArticlesTabProps = {
  categories: HelpCategory[];
  articles: HelpArticle[];
  publishedCount: number;
  busy: boolean;
  onGoToCategories: () => void;
  onSave: (input: HelpArticleInput, id?: string) => Promise<unknown>;
  onToggleStatus: (article: HelpArticle) => void;
  onDelete: (article: HelpArticle) => void;
  onMove: (a: HelpArticle, b: HelpArticle) => void;
};

function ArticlesTab({
  categories,
  articles,
  publishedCount,
  busy,
  onGoToCategories,
  onSave,
  onToggleStatus,
  onDelete,
  onMove,
}: ArticlesTabProps) {
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [editing, setEditing] = useState<HelpArticle | "new" | null>(null);

  const groups = useMemo(
    () =>
      categories
        .filter((category) => categoryFilter === "all" || category.id === categoryFilter)
        .map((category) => {
          const all = articles.filter((article) => article.category_id === category.id);
          const visible = all.filter(
            (article) =>
              (statusFilter === "all" || article.status === statusFilter) &&
              matchesHelpQuery(article, category, query),
          );
          return { category, all, visible };
        })
        .filter((group) => group.visible.length > 0 || (!query && statusFilter === "all")),
    [categories, articles, categoryFilter, statusFilter, query],
  );

  if (editing) {
    return (
      <ArticleEditor
        article={editing === "new" ? null : editing}
        categories={categories}
        defaultCategoryId={categoryFilter !== "all" ? categoryFilter : categories[0]?.id}
        nextPositionFor={(categoryId) =>
          articles.filter((a) => a.category_id === categoryId).reduce((max, a) => Math.max(max, a.position), 0) + 10
        }
        busy={busy}
        onCancel={() => setEditing(null)}
        onSave={async (input, id) => {
          await onSave(input, id);
          setEditing(null);
        }}
      />
    );
  }

  if (!categories.length) {
    return (
      <AdminCard className="p-8 text-center">
        <p className="text-[14px] font-medium text-[#1a1a1a]">Crie uma categoria antes do primeiro artigo.</p>
        <p className="mt-1 text-[13px] text-[#8c8f93]">As categorias formam o menu lateral da central.</p>
        <AdminPill variant="primary" className="mt-4" onClick={onGoToCategories}>
          <Plus size={14} aria-hidden="true" /> Nova categoria
        </AdminPill>
      </AdminCard>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="admin-control min-w-[220px] flex-1 sm:max-w-[340px]">
          <Search size={14} aria-hidden="true" className="shrink-0 text-[#8c8f93]" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por título, texto ou palavra-chave"
            aria-label="Buscar artigos"
            className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
          />
        </label>
        <AdminSelectPill
          icon={FolderTree}
          label="Categoria"
          value={categoryFilter}
          onChange={setCategoryFilter}
          options={[{ value: "all", label: "Todas as categorias" }, ...categories.map((c) => ({ value: c.id, label: c.title }))]}
        />
        <AdminSelectPill
          icon={Eye}
          label="Status"
          value={statusFilter}
          onChange={(value) => setStatusFilter(value as StatusFilter)}
          options={[
            { value: "all", label: "Todos os status" },
            { value: "published", label: "Publicados" },
            { value: "draft", label: "Rascunhos" },
          ]}
        />
        <span className="ml-auto text-[12.5px] text-[#8c8f93]">
          {publishedCount} de {articles.length} publicados
        </span>
        <AdminPill variant="primary" onClick={() => setEditing("new")}>
          <Plus size={14} aria-hidden="true" /> Novo artigo
        </AdminPill>
      </div>

      {groups.length === 0 ? (
        <AdminCard className="p-8 text-center text-[13px] text-[#8c8f93]">Nenhum artigo com esses filtros.</AdminCard>
      ) : (
        groups.map(({ category, all, visible }) => {
          const Icon = helpCategoryIcon(category.icon);
          return (
            <AdminCard key={category.id} className="overflow-hidden p-0">
              <header className="flex items-center gap-2 border-b border-[#efefec] px-4 py-3">
                <Icon size={15} aria-hidden="true" className="text-[#2563eb]" />
                <h2 className="text-[13.5px] font-semibold text-[#1a1a1a]">{category.title}</h2>
                <span className="text-[12px] text-[#8c8f93]">
                  {all.length} {all.length === 1 ? "artigo" : "artigos"} · {category.section}
                </span>
              </header>
              {visible.length === 0 ? (
                <p className="px-4 py-4 text-[13px] text-[#8c8f93]">Nenhum artigo nesta categoria ainda.</p>
              ) : (
                <ul className="divide-y divide-[#f2f2ef]">
                  {visible.map((article) => {
                    // Setas trocam de lugar com o vizinho dentro da categoria inteira,
                    // não só do que o filtro mostra.
                    const index = all.indexOf(article);
                    const prev = all[index - 1];
                    const next = all[index + 1];
                    const published = article.status === "published";
                    return (
                      <li key={article.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                        <div className="flex flex-col">
                          <button
                            type="button"
                            disabled={!prev || busy}
                            onClick={() => prev && onMove(article, prev)}
                            aria-label={`Mover "${article.title}" para cima`}
                            className="grid h-5 w-6 place-items-center rounded text-[#8c8f93] hover:bg-[#f2f2ef] hover:text-[#1a1a1a] disabled:opacity-30"
                          >
                            <ArrowUp size={13} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            disabled={!next || busy}
                            onClick={() => next && onMove(article, next)}
                            aria-label={`Mover "${article.title}" para baixo`}
                            className="grid h-5 w-6 place-items-center rounded text-[#8c8f93] hover:bg-[#f2f2ef] hover:text-[#1a1a1a] disabled:opacity-30"
                          >
                            <ArrowDown size={13} aria-hidden="true" />
                          </button>
                        </div>
                        <button type="button" onClick={() => setEditing(article)} className="min-w-0 flex-1 text-left">
                          <span className="block truncate text-[13.5px] font-medium text-[#1a1a1a] hover:text-[#2563eb]">
                            {article.title}
                          </span>
                          <span className="block truncate text-[12px] text-[#8c8f93]">
                            /ajuda/{category.slug}/{article.slug} · atualizado em {fmtDate(article.updated_at)}
                          </span>
                        </button>
                        <AdminBadge tone={published ? "success" : "neutral"}>{published ? "Publicado" : "Rascunho"}</AdminBadge>
                        <div className="flex items-center gap-1.5">
                          <AdminPill onClick={() => onToggleStatus(article)} disabled={busy}>
                            {published ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
                            {published ? "Despublicar" : "Publicar"}
                          </AdminPill>
                          <AdminPill onClick={() => setEditing(article)} aria-label={`Editar "${article.title}"`}>
                            <Pencil size={14} aria-hidden="true" />
                          </AdminPill>
                          <AdminPill onClick={() => onDelete(article)} disabled={busy} aria-label={`Excluir "${article.title}"`}>
                            <Trash2 size={14} aria-hidden="true" className="text-[#d72c0d]" />
                          </AdminPill>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </AdminCard>
          );
        })
      )}
    </div>
  );
}

function ArticleEditor({
  article,
  categories,
  defaultCategoryId,
  nextPositionFor,
  busy,
  onCancel,
  onSave,
}: {
  article: HelpArticle | null;
  categories: HelpCategory[];
  defaultCategoryId?: string;
  nextPositionFor: (categoryId: string) => number;
  busy: boolean;
  onCancel: () => void;
  onSave: (input: HelpArticleInput, id?: string) => Promise<void>;
}) {
  const [title, setTitle] = useState(article?.title ?? "");
  const [slug, setSlug] = useState(article?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(article));
  const [categoryId, setCategoryId] = useState(article?.category_id ?? defaultCategoryId ?? "");
  const [summary, setSummary] = useState(article?.summary ?? "");
  const [content, setContent] = useState(article?.content ?? "");
  const [keywords, setKeywords] = useState((article?.keywords ?? []).join(", "));
  const [position, setPosition] = useState(String(article?.position ?? nextPositionFor(categoryId)));
  // Artigo novo: a posição sugerida acompanha a categoria (vai para o fim dela).
  const [positionTouched, setPositionTouched] = useState(Boolean(article));
  const effectivePosition = positionTouched ? position : String(nextPositionFor(categoryId));
  const [showPreview, setShowPreview] = useState(false);

  const category = categories.find((c) => c.id === categoryId);
  const effectiveSlug = slugTouched ? slug : slugify(title);
  const slugOk = isValidSlug(effectiveSlug);
  const canSave = title.trim().length > 0 && slugOk && Boolean(categoryId) && !busy;

  const submit = (status: HelpArticleStatus) => {
    if (!canSave) return;
    onSave(
      {
        category_id: categoryId,
        slug: effectiveSlug,
        title: title.trim(),
        summary: summary.trim() || null,
        content: content.trim(),
        keywords: keywords
          .split(",")
          .map((keyword) => keyword.trim().toLowerCase())
          .filter(Boolean),
        status,
        position: Number.parseInt(effectivePosition, 10) || 0,
      },
      article?.id,
    ).catch(() => undefined); // erro já vira toast no useMutation
  };

  const isPublished = article?.status === "published";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <AdminPill onClick={onCancel}>← Voltar para a lista</AdminPill>
        <h2 className="text-[15px] font-semibold text-[#1a1a1a]">{article ? "Editar artigo" : "Novo artigo"}</h2>
        {article ? <AdminBadge tone={isPublished ? "success" : "neutral"}>{isPublished ? "Publicado" : "Rascunho"}</AdminBadge> : null}
        <div className="ml-auto flex flex-wrap gap-2">
          {/* Wrapper porque .admin-pill fixa o display e venceria o lg:hidden. */}
          <span className="lg:hidden">
            <AdminPill onClick={() => setShowPreview((v) => !v)}>{showPreview ? "Editar" : "Prévia"}</AdminPill>
          </span>
          {isPublished ? (
            <>
              <AdminPill onClick={() => submit("draft")} disabled={!canSave}>Salvar e despublicar</AdminPill>
              <AdminPill variant="primary" onClick={() => submit("published")} disabled={!canSave}>
                {busy ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : null} Salvar
              </AdminPill>
            </>
          ) : (
            <>
              <AdminPill onClick={() => submit("draft")} disabled={!canSave}>Salvar rascunho</AdminPill>
              <AdminPill variant="primary" onClick={() => submit("published")} disabled={!canSave}>
                {busy ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : null} Salvar e publicar
              </AdminPill>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AdminCard className={cn("space-y-4 p-5", showPreview && "max-lg:hidden")}>
          <Field label="Título">
            <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Meu anúncio está pausado. E agora?" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Categoria">
              <select className={inputClass} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            </Field>
            <Field label="Posição" hint="Menor aparece primeiro no menu.">
              <input
                className={inputClass}
                type="number"
                value={effectivePosition}
                onChange={(e) => {
                  setPositionTouched(true);
                  setPosition(e.target.value);
                }}
              />
            </Field>
          </div>
          <Field
            label="Endereço (slug)"
            hint={
              slugOk ? (
                <>/ajuda/{category?.slug ?? "categoria"}/{effectiveSlug}</>
              ) : (
                <span className="text-[#d72c0d]">Use só letras minúsculas, números e hífens.</span>
              )
            }
          >
            <input
              className={inputClass}
              value={effectiveSlug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              placeholder="gerado a partir do título"
            />
          </Field>
          <Field label="Resumo" hint="Uma ou duas frases. Aparece abaixo do título e é o que a IA lê primeiro.">
            <textarea className={cn(inputClass, "min-h-[64px] resize-y")} value={summary} onChange={(e) => setSummary(e.target.value)} />
          </Field>
          <Field
            label="Conteúdo (Markdown)"
            hint={
              <>
                Passos: <code>1. Faça isso</code> · destaque: <code>**Integrações**</code> · dica: <code>&gt; **Dica:** ...</code> ·
                subtítulo: <code>## Título</code> · link: <code>[texto](/dashboard/integracoes)</code>
              </>
            }
          >
            <textarea
              className={cn(inputClass, "min-h-[280px] resize-y font-mono text-[12.5px] leading-[1.6]")}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={"1. Vá em **Integrações**.\n2. Clique em Conectar Mercado Livre.\n\n> **Dica:** ..."}
            />
          </Field>
          <Field label="Palavras-chave" hint="Separadas por vírgula. Como o usuário perguntaria: senha, pausado, reembolso...">
            <input className={inputClass} value={keywords} onChange={(e) => setKeywords(e.target.value)} />
          </Field>
        </AdminCard>

        <AdminCard className={cn("p-5", !showPreview && "max-lg:hidden")}>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8c8f93]">Prévia</p>
          <div className="font-['Inter',system-ui,sans-serif]">
            {category ? <p className="text-[12.5px] font-medium text-[#8A8F9C]">{category.title}</p> : null}
            <h3 className="mt-1 text-[19px] font-semibold tracking-[-0.02em] text-[#0F1117]">{title || "Título do artigo"}</h3>
            {summary ? <p className="mt-2 text-[14px] leading-[1.7] text-[#3F4350]">{summary}</p> : null}
            <HelpArticleContent markdown={content || "_Escreva o conteúdo ao lado._"} variant="note" />
          </div>
        </AdminCard>
      </div>
    </div>
  );
}

// ── Categorias ───────────────────────────────────────────────────────────────

function CategoriesTab({
  categories,
  articles,
  busy,
  onSave,
  onDelete,
  onMove,
}: {
  categories: HelpCategory[];
  articles: HelpArticle[];
  busy: boolean;
  onSave: (input: HelpCategoryInput, id?: string) => Promise<unknown>;
  onDelete: (category: HelpCategory) => void;
  onMove: (a: HelpCategory, b: HelpCategory) => void;
}) {
  const [editing, setEditing] = useState<HelpCategory | "new" | null>(null);
  const sectionOptions = useMemo(() => Array.from(new Set(categories.map((c) => c.section))), [categories]);
  const nextPosition = categories.reduce((max, c) => Math.max(max, c.position), 0) + 10;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <p className="text-[12.5px] text-[#8c8f93]">
          Categorias formam o menu lateral. As marcadas como destaque viram cards no topo da central. Categorias sem artigo
          publicado ficam ocultas para o usuário.
        </p>
        <AdminPill variant="primary" className="ml-auto shrink-0" onClick={() => setEditing("new")}>
          <Plus size={14} aria-hidden="true" /> Nova categoria
        </AdminPill>
      </div>

      {editing === "new" ? (
        <CategoryForm
          sectionOptions={sectionOptions}
          nextPosition={nextPosition}
          busy={busy}
          onCancel={() => setEditing(null)}
          onSave={async (input) => {
            await onSave(input);
            setEditing(null);
          }}
        />
      ) : null}

      <AdminCard className="overflow-hidden p-0">
        <ul className="divide-y divide-[#f2f2ef]">
          {categories.map((category, index) => {
            const Icon = helpCategoryIcon(category.icon);
            const total = articles.filter((a) => a.category_id === category.id).length;
            const published = articles.filter((a) => a.category_id === category.id && a.status === "published").length;
            if (editing !== "new" && editing?.id === category.id) {
              return (
                <li key={category.id} className="p-3">
                  <CategoryForm
                    category={category}
                    sectionOptions={sectionOptions}
                    nextPosition={nextPosition}
                    busy={busy}
                    onCancel={() => setEditing(null)}
                    onSave={async (input) => {
                      await onSave(input, category.id);
                      setEditing(null);
                    }}
                  />
                </li>
              );
            }
            return (
              <li key={category.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <div className="flex flex-col">
                  <button
                    type="button"
                    disabled={index === 0 || busy}
                    onClick={() => onMove(category, categories[index - 1])}
                    aria-label={`Mover "${category.title}" para cima`}
                    className="grid h-5 w-6 place-items-center rounded text-[#8c8f93] hover:bg-[#f2f2ef] disabled:opacity-30"
                  >
                    <ArrowUp size={13} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    disabled={index === categories.length - 1 || busy}
                    onClick={() => onMove(category, categories[index + 1])}
                    aria-label={`Mover "${category.title}" para baixo`}
                    className="grid h-5 w-6 place-items-center rounded text-[#8c8f93] hover:bg-[#f2f2ef] disabled:opacity-30"
                  >
                    <ArrowDown size={13} aria-hidden="true" />
                  </button>
                </div>
                <AdminToolTile icon={Icon} tone="blue" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-[13.5px] font-medium text-[#1a1a1a]">
                    {category.title}
                    {category.featured ? <Star size={13} aria-label="Destaque" className="fill-[#f5b301] text-[#f5b301]" /> : null}
                  </p>
                  <p className="truncate text-[12px] text-[#8c8f93]">
                    {category.section} · /ajuda/{category.slug} · {published} de {total} publicados
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <AdminPill onClick={() => setEditing(category)} aria-label={`Editar "${category.title}"`}>
                    <Pencil size={14} aria-hidden="true" /> Editar
                  </AdminPill>
                  <AdminPill
                    onClick={() => onDelete(category)}
                    disabled={busy || total > 0}
                    title={total > 0 ? "Mova ou exclua os artigos desta categoria antes" : undefined}
                    aria-label={`Excluir "${category.title}"`}
                  >
                    <Trash2 size={14} aria-hidden="true" className="text-[#d72c0d]" />
                  </AdminPill>
                </div>
              </li>
            );
          })}
          {categories.length === 0 ? <li className="px-4 py-6 text-center text-[13px] text-[#8c8f93]">Nenhuma categoria ainda.</li> : null}
        </ul>
      </AdminCard>
    </div>
  );
}

function CategoryForm({
  category,
  sectionOptions,
  nextPosition,
  busy,
  onCancel,
  onSave,
}: {
  category?: HelpCategory;
  sectionOptions: string[];
  nextPosition: number;
  busy: boolean;
  onCancel: () => void;
  onSave: (input: HelpCategoryInput) => Promise<void>;
}) {
  const [title, setTitle] = useState(category?.title ?? "");
  const [slug, setSlug] = useState(category?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(category));
  const [description, setDescription] = useState(category?.description ?? "");
  const [icon, setIcon] = useState(category?.icon ?? "BookOpen");
  const [section, setSection] = useState(category?.section ?? sectionOptions[0] ?? "Central de ajuda");
  const [featured, setFeatured] = useState(category?.featured ?? false);

  const effectiveSlug = slugTouched ? slug : slugify(title);
  const slugOk = isValidSlug(effectiveSlug);
  const canSave = title.trim().length > 0 && slugOk && section.trim().length > 0 && !busy;

  return (
    <AdminCard className="space-y-4 border-[#2563eb]/25 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome">
          <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Conexão com Mercado Livre" />
        </Field>
        <Field
          label="Endereço (slug)"
          hint={slugOk ? `/ajuda/${effectiveSlug}` : <span className="text-[#d72c0d]">Use só letras minúsculas, números e hífens.</span>}
        >
          <input
            className={inputClass}
            value={effectiveSlug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
          />
        </Field>
      </div>
      <Field label="Descrição" hint="Aparece no topo do artigo e no balão do card de destaque.">
        <input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Grupo do menu" hint='Ex.: "Central de ajuda" ou "Outros".'>
          <input className={inputClass} value={section} onChange={(e) => setSection(e.target.value)} list="help-sections" />
          <datalist id="help-sections">
            {sectionOptions.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </Field>
        <div>
          <span className="mb-1.5 block text-[12.5px] font-medium text-[#1a1a1a]">Ícone</span>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Ícone da categoria">
            {Object.entries(HELP_CATEGORY_ICONS).map(([name, Icon]) => (
              <button
                key={name}
                type="button"
                role="radio"
                aria-checked={icon === name}
                aria-label={name}
                onClick={() => setIcon(name)}
                className={cn(
                  "grid h-8 w-8 place-items-center rounded-[8px] border transition",
                  icon === name ? "border-[#2563eb] bg-[#eaf0ff] text-[#2563eb]" : "border-[#e4e4e0] text-[#5f6368] hover:bg-[#f6f6f3]",
                )}
              >
                <Icon size={15} aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      </div>
      <label className="flex items-center gap-2 text-[13px] text-[#1a1a1a]">
        <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} className="h-4 w-4 accent-[#2563eb]" />
        Mostrar como card de acesso rápido no topo da central
      </label>
      <div className="flex justify-end gap-2">
        <AdminPill onClick={onCancel}>Cancelar</AdminPill>
        <AdminPill
          variant="primary"
          disabled={!canSave}
          onClick={() =>
            onSave({
              title: title.trim(),
              slug: effectiveSlug,
              description: description.trim() || null,
              icon,
              section: section.trim(),
              featured,
              position: category?.position ?? nextPosition,
            }).catch(() => undefined)
          }
        >
          {category ? "Salvar categoria" : "Criar categoria"}
        </AdminPill>
      </div>
    </AdminCard>
  );
}

export default AdminHelpCenterPage;
