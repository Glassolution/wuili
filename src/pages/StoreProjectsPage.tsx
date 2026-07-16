import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  FileText,
  FlaskConical,
  Inbox,
  Loader2,
  Mail,
  Plus,
  SlidersHorizontal,
  Sparkles,
  Store,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { fetchUserProjects, type ProjectType, type UserProject } from "@/lib/userProjects";
import { isAdminEmail } from "@/lib/adminAccess";
import ProjectCreationWizard from "@/components/projects/ProjectCreationWizard";

type ProjectCard = {
  id: string;
  nome: string;
  tipo: "loja_completa" | "pagina_venda";
  status: "rascunho" | "publicado";
  previewUrl: string | null;
  lastEditedAt: string;
  sourceId: string | null;
  slug: string | null;
};

const formatLastEdited = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

const readMetadataString = (metadata: Json, key: string) => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = metadata[key];
  return typeof value === "string" ? value : null;
};

const getProjectDescription = (project: ProjectCard) => {
  if (project.tipo === "loja_completa") {
    return project.status === "publicado"
      ? "Loja completa publicada, pronta para editar produtos, vitrine e ofertas."
      : "Loja completa em rascunho, continue configurando vitrine e catálogo.";
  }

  return project.status === "publicado"
    ? "Página de venda publicada para um produto único com oferta focada."
    : "Página de venda em rascunho para validar uma oferta de produto.";
};

const mapUserProject = (project: UserProject): ProjectCard => ({
  id: project.id,
  nome: project.nome,
  tipo: project.tipo_projeto,
  status: project.status,
  previewUrl: project.preview_url,
  lastEditedAt: project.last_edited_at,
  sourceId: project.source_id,
  slug: readMetadataString(project.metadata, "slug"),
});

const loadLegacyProjects = async (userId: string): Promise<ProjectCard[]> => {
  const [profileResult, pagesResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,store_name,loja_nome,display_name,onboarding_completed,created_at,updated_at")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("generated_sales_pages")
      .select("id,product_title,headline,hero_image_url,published,published_at,slug,created_at,updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(12),
  ]);

  const projects: ProjectCard[] = [];
  const profile = profileResult.data;

  if (profile?.store_name || profile?.loja_nome || profile?.onboarding_completed) {
    projects.push({
      id: profile.id,
      nome: profile.store_name || profile.loja_nome || profile.display_name || "Minha loja",
      tipo: "loja_completa",
      status: profile.onboarding_completed ? "publicado" : "rascunho",
      previewUrl: null,
      lastEditedAt: profile.updated_at || profile.created_at,
      sourceId: profile.id,
      slug: null,
    });
  }

  for (const page of pagesResult.data ?? []) {
    projects.push({
      id: page.id,
      nome: page.product_title || page.headline || "Página de venda",
      tipo: "pagina_venda",
      status: page.published ? "publicado" : "rascunho",
      previewUrl: page.hero_image_url,
      lastEditedAt: page.updated_at || page.created_at,
      sourceId: page.id,
      slug: page.slug,
    });
  }

  return projects.sort((a, b) => new Date(b.lastEditedAt).getTime() - new Date(a.lastEditedAt).getTime());
};

const ProjectScreenPreview = ({ project }: { project: ProjectCard }) => {
  const fallbackPreview =
    project.tipo === "loja_completa" ? "/template-01-loja-preview.png" : "/template-produto-preview.png";

  return <img src={project.previewUrl || fallbackPreview} alt="" className="h-full w-full object-cover" />;
};

const StoreProjectsPage = () => {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const [projects, setProjects] = useState<ProjectCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const metadataRole =
    (user?.app_metadata?.role as string | undefined) ??
    (user?.user_metadata?.role as string | undefined);
  const isAdmin = role === "admin" || metadataRole === "admin" || isAdminEmail(user?.email);
  const visibleProjects = useMemo(
    () => isAdmin ? projects : projects.filter((project) => project.tipo === "pagina_venda"),
    [isAdmin, projects],
  );

  useEffect(() => {
    if (!user?.id) return;

    let active = true;

    const load = async () => {
      setLoading(true);

      try {
        const userProjects = await fetchUserProjects();
        if (!active) return;
        setProjects(userProjects.map(mapUserProject));
      } catch (error) {
        console.warn("[StoreProjectsPage] usando fallback legado para projetos.", error);
        const legacyProjects = await loadLegacyProjects(user.id);
        if (!active) return;
        setProjects(legacyProjects);
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [user?.id]);

  const projectCounts = useMemo(() => {
    const stores = visibleProjects.filter((project) => project.tipo === "loja_completa").length;
    const pages = visibleProjects.filter((project) => project.tipo === "pagina_venda").length;
    return { stores, pages };
  }, [visibleProjects]);

  useEffect(() => {
    if (visibleProjects.length === 0) {
      setSelectedProjectId(null);
      return;
    }

    setSelectedProjectId((current) => (current && visibleProjects.some((project) => project.id === current) ? current : visibleProjects[0].id));
  }, [visibleProjects]);

  const selectedProject = visibleProjects.find((project) => project.id === selectedProjectId) ?? visibleProjects[0] ?? null;
  const lastUpdateLabel = selectedProject ? `Última edição ${formatLastEdited(selectedProject.lastEditedAt)}` : "Nenhum projeto ainda";

  const openProject = (project: ProjectCard) => {
    if (project.tipo === "loja_completa") {
      navigate("/minha-loja/editor", { state: { projectId: project.id, sourceId: project.sourceId } });
      return;
    }

    navigate("/produto/editor", { state: { projectId: project.id, sourceId: project.sourceId, slug: project.slug } });
  };

  const handleProjectCreated = async (projectId: string) => {
    setWizardOpen(false);
    try {
      const userProjects = await fetchUserProjects();
      setProjects(userProjects.map(mapUserProject));
      const created = userProjects.find((project) => project.id === projectId);
      if (created?.tipo_projeto === "loja_completa") {
        navigate("/minha-loja/editor", { state: { projectId } });
        return;
      }
      navigate("/produto/editor", { state: { projectId } });
    } catch {
      navigate("/minha-loja/editor", { state: { projectId } });
    }
  };

  const wizardDefaultTipo: ProjectType = isAdmin ? "loja_completa" : "pagina_venda";

  return (
    <div className="-m-5 flex min-h-[calc(100vh-92px)] flex-1 flex-col bg-white text-[#171717] sm:-m-6 lg:-m-7">
      <header className="flex h-[52px] shrink-0 items-center justify-between border-b border-[#ececea] px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Mail size={15} strokeWidth={1.9} className="text-[#666b70]" />
          <h1 className="text-[15px] font-semibold tracking-[-0.01em]">Projetos</h1>
          <span className="text-[#a4a4a0]">·</span>
          <span className="text-[14px] font-semibold text-[#5f6368]">{visibleProjects.length} projetos</span>
        </div>
        <span className="hidden text-[12px] font-semibold text-[#8c908f] md:inline">{lastUpdateLabel}</span>
      </header>

      <div className="flex h-[54px] shrink-0 items-center gap-3 border-b border-[#ececea] px-6">
        <button
          type="button"
          onClick={() => setWizardOpen(true)}
          className="flex h-9 items-center gap-2 rounded-[7px] bg-[#1d1d1f] px-4 text-[13px] font-semibold text-white shadow-[0_10px_18px_rgba(0,0,0,0.10)] transition hover:bg-black"
        >
          <Plus size={15} />
          {isAdmin ? "Novo projeto" : "Nova página de venda"}
        </button>

        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          <button type="button" className="flex h-9 items-center gap-2 rounded-[7px] bg-[#f2f2f0] px-3 text-[13px] font-semibold text-black">
            <Inbox size={15} strokeWidth={1.8} />
            Todos {visibleProjects.length}
          </button>
          {isAdmin ? (
            <button type="button" className="flex h-9 items-center gap-2 rounded-[7px] px-3 text-[13px] font-semibold text-[#777b82] transition hover:bg-[#f7f7f5]">
              <Store size={15} strokeWidth={1.8} />
              Lojas {projectCounts.stores}
            </button>
          ) : (
            <span className="flex h-9 items-center gap-2 rounded-[7px] bg-[#f3f3f1] px-3 text-[12px] font-semibold text-[#6d7177]">
              <FlaskConical size={14} strokeWidth={1.8} />
              Loja completa · Em fase de testes
            </span>
          )}
          <button type="button" className="flex h-9 items-center gap-2 rounded-[7px] px-3 text-[13px] font-semibold text-[#777b82] transition hover:bg-[#f7f7f5]">
            <FileText size={15} strokeWidth={1.8} />
            Páginas {projectCounts.pages}
          </button>
          <span className="mx-2 h-6 w-px bg-[#e2e2df]" />
          <button type="button" className="flex h-9 items-center gap-2 rounded-[7px] px-3 text-[13px] font-semibold text-[#777b82] transition hover:bg-[#f7f7f5]">
            <Sparkles size={15} strokeWidth={1.8} />
            Produtos em alta
          </button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[350px_minmax(0,1fr)]">
        <aside className="min-h-0 border-r border-[#ececea] bg-white">
          <div className="overflow-hidden bg-white">
            <div className="flex h-11 items-center justify-between border-b border-[#ececea] px-5">
              <div className="flex items-center gap-2.5">
                <span className="h-3.5 w-3.5 rounded-[4px] border border-[#deded9] bg-white" />
                <span className="text-[13px] font-semibold text-[#1f2024]">Projetos</span>
              </div>
              <button
                type="button"
                className="flex h-7 w-7 items-center justify-center rounded-[7px] text-[#4f5358] transition hover:bg-[#f3f3f1] hover:text-black"
                aria-label="Filtrar projetos"
              >
                <SlidersHorizontal size={16} strokeWidth={1.9} />
              </button>
            </div>

            <div className="max-h-[calc(100vh-164px)] overflow-y-auto">
            {loading ? (
              <div className="flex h-44 items-center justify-center gap-3 text-[13px] font-semibold text-[#747982]">
                <Loader2 size={17} className="animate-spin" />
                Carregando projetos...
              </div>
            ) : visibleProjects.length > 0 ? (
              visibleProjects.map((project) => {
                const active = selectedProject?.id === project.id;
                return (
                  <button
                    key={`${project.tipo}-${project.id}`}
                    type="button"
                    onClick={() => setSelectedProjectId(project.id)}
                    className={`flex w-full gap-3 border-b border-[#eeeeeb] px-5 py-3.5 text-left transition last:border-b-0 ${
                      active ? "bg-[#f6f6f4]" : "bg-white hover:bg-[#fafafa]"
                    }`}
                  >
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#efefec] text-black">
                      {project.previewUrl ? (
                        <img src={project.previewUrl} alt="" className="h-full w-full object-cover" />
                      ) : project.tipo === "loja_completa" ? (
                        <Store size={16} strokeWidth={1.8} />
                      ) : (
                        <FileText size={16} strokeWidth={1.8} />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <h3 className="truncate text-[14px] font-semibold leading-5 text-[#18191c]">{project.nome}</h3>
                            {project.status === "publicado" ? (
                              <span className="flex h-3 w-3 shrink-0 items-center justify-center rounded-full bg-[#9fdff2] text-[8px] font-black leading-none text-white">
                                ✓
                              </span>
                            ) : null}
                          </div>
                          <p className="truncate text-[11px] font-medium text-[#5d6268]">
                            {project.tipo === "loja_completa" ? "loja@velo.app" : "pagina@velo.app"}
                          </p>
                        </div>
                        <span className="shrink-0 text-[11px] font-semibold text-[#55595f]">{formatLastEdited(project.lastEditedAt)}</span>
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-[11px] font-medium leading-4 text-[#34373c]">
                        {getProjectDescription(project)}
                      </p>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="flex h-56 flex-col items-center justify-center bg-white px-8 text-center">
                <Box size={24} />
                <p className="mt-3 text-[15px] font-semibold">Nenhum projeto</p>
                <p className="mt-2 text-[12px] leading-5 text-[#727780]">
                  {isAdmin ? "Crie uma loja completa ou uma página de venda para começar." : "Crie sua primeira página de venda para começar."}
                </p>
              </div>
            )}
            </div>
          </div>
        </aside>

        <section className="min-h-0 overflow-y-auto bg-white">
          {selectedProject ? (
            <article className="min-h-full bg-white">
              <div className="bg-white">
                <div className="flex items-center justify-between gap-4 border-b border-[#ececea] px-6 py-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[9px] bg-black text-white shadow-[0_8px_18px_rgba(0,0,0,0.14)]">
                      {selectedProject.previewUrl ? (
                        <img src={selectedProject.previewUrl} alt="" className="h-full w-full object-cover" />
                      ) : selectedProject.tipo === "loja_completa" ? (
                        <Store size={20} strokeWidth={1.8} />
                      ) : (
                        <FileText size={20} strokeWidth={1.8} />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.28em] text-[#9a9a96]">
                        {selectedProject.tipo === "loja_completa" ? "Loja completa" : "Página de venda"}
                      </p>
                      <div className="flex min-w-0 items-center gap-2">
                        <h2 className="truncate text-[20px] font-semibold tracking-[-0.025em]">{selectedProject.nome}</h2>
                        <span className="rounded-full bg-[#f1f1ee] px-2.5 py-1 text-[11px] font-semibold text-[#4f5358]">
                          {selectedProject.status === "publicado" ? "Publicado" : "Rascunho"}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-[12px] font-semibold text-[#777d85]">
                        {selectedProject.tipo === "loja_completa" ? "loja@velo.app" : "pagina@velo.app"} · editado em {formatLastEdited(selectedProject.lastEditedAt)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openProject(selectedProject)}
                    className="flex h-9 shrink-0 items-center rounded-[7px] bg-black px-5 text-[13px] font-semibold text-white shadow-[0_10px_22px_rgba(0,0,0,0.18)] transition hover:bg-[#202020]"
                  >
                    Editar
                  </button>
                </div>
                <div className="h-[min(520px,calc(100vh-292px))] min-h-[360px] bg-[#f7f7f5]">
                  <ProjectScreenPreview project={selectedProject} />
                </div>
                <div className="grid gap-4 border-t border-[#ececea] bg-white px-6 py-4 md:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-[#191a1d]">Resumo do projeto</p>
                    <p className="mt-1 max-w-[760px] text-[12px] font-medium leading-5 text-[#68707a]">
                      {getProjectDescription(selectedProject)} Confira o visual, revise a oferta e use o botão de edição para continuar ajustando
                      produtos, textos e chamadas de venda.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-[#5f656d]">
                    <span className="rounded-full bg-[#f2f2ef] px-2.5 py-1">
                      {selectedProject.tipo === "loja_completa" ? "Vitrine completa" : "Oferta única"}
                    </span>
                    <span className="rounded-full bg-[#f2f2ef] px-2.5 py-1">
                      {selectedProject.status === "publicado" ? "Online" : "Salvo"}
                    </span>
                    <span className="rounded-full bg-[#f2f2ef] px-2.5 py-1">Preview ativo</span>
                  </div>
                </div>
              </div>
            </article>
          ) : (
            <div className="flex min-h-[460px] flex-col items-center justify-center rounded-[12px] border border-dashed border-[#dcdcd7] bg-[#fbfbfa] px-8 text-center">
              <Box size={38} />
              <h2 className="mt-5 text-[24px] font-semibold tracking-[-0.03em]">Nenhum projeto encontrado</h2>
              <p className="mt-2 max-w-[420px] text-[14px] leading-6 text-[#6f7680]">
                {isAdmin
                  ? "Crie sua primeira loja completa ou comece por uma página de venda de produto único."
                  : "A loja completa está em fase de testes. Por enquanto, crie uma página de venda para um produto único."}
              </p>
              <button
                type="button"
                onClick={() => setWizardOpen(true)}
                className="mt-6 h-10 rounded-[8px] bg-black px-5 text-[13px] font-semibold text-white transition hover:bg-[#202020]"
              >
                {isAdmin ? "Criar primeiro projeto" : "Criar página de venda"}
              </button>
            </div>
          )}
        </section>
      </div>

      <ProjectCreationWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        defaultTipo={wizardDefaultTipo}
        onCreated={handleProjectCreated}
      />
    </div>
  );
};

export default StoreProjectsPage;
