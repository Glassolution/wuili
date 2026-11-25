import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ExternalLink, FolderOpen, LayoutGrid, Link2, List, MoreHorizontal, Plus, Search, Settings2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { fetchUserProjects, type UserProject } from "@/lib/userProjects";
import { veloToast } from "@/components/ui/velo-toast";
import MascoteVelo from "@/components/MascoteVelo";

/*
  Projetos (`/dashboard/projetos`), 25/11/2026: a lista dos sites da pessoa, no modelo
  de grade de cards da referência do dono (adaptado ao tema claro da Velo). Cada card
  mostra status, logo (ou inicial), nome e tipo; clicar entra no editor, onde o site
  é configurado. O menu "..." tem abrir e configurar, ver o site e copiar o link.
  Grade ou lista, busca pelo nome e "Carregar mais" de 18 em 18.

  Sem projetos: só um botão grande no meio da página, com o mascote, para criar o
  primeiro (abre o assistente de criação da Minha loja).

  Tudo vem do RPC `get_user_projects` (`fetchUserProjects`), sem consulta nova.
*/

const PAGINA_CSS = `
.velo-proj-root, .velo-proj-root * { font-feature-settings: normal !important; }
.velo-proj-root h1 { font-family: "Inter", ui-sans-serif, system-ui, sans-serif !important; }
.velo-proj-card { transition: border-color 150ms ease-out, box-shadow 200ms ease-out, transform 200ms cubic-bezier(0.22, 1, 0.36, 1); }
.velo-proj-card:hover { border-color: #D4D4D8 !important; box-shadow: 0 12px 28px -18px rgba(16,24,40,0.28) !important; transform: translateY(-2px); }
.velo-proj-card:hover .velo-proj-logo { transform: scale(1.05); }
.velo-proj-logo { transition: transform 250ms cubic-bezier(0.22, 1, 0.36, 1); }
.velo-proj-icone { transition: background-color 120ms ease-out, color 120ms ease-out; }
.velo-proj-icone:hover { background: #F1F1F3 !important; color: #18181B !important; }
.velo-proj-item { transition: background-color 120ms ease-out; }
.velo-proj-item:hover { background: #F4F4F5 !important; }
.velo-proj-azul { transition: background-color 150ms ease-out, transform 120ms ease-out; }
.velo-proj-azul:hover { background: #1D4ED8 !important; }
.velo-proj-azul:active { transform: scale(0.98); }
.velo-proj-contorno { transition: background-color 120ms ease-out, border-color 120ms ease-out; }
.velo-proj-contorno:hover { background: #F4F4F5 !important; border-color: #D4D4D8 !important; }
.velo-proj-linha { transition: background-color 120ms ease-out; }
.velo-proj-linha:hover { background: #FAFAFB !important; }
.velo-proj-criar { transition: border-color 200ms ease-out, box-shadow 250ms ease-out, transform 250ms cubic-bezier(0.22, 1, 0.36, 1); }
.velo-proj-criar:hover { border-color: #93B4F7 !important; box-shadow: 0 24px 48px -28px rgba(37,99,235,0.45) !important; transform: translateY(-3px); }
.velo-proj-criar:hover .velo-proj-criar-botao { background: #1D4ED8 !important; }
.velo-proj-busca:focus-within { border-color: #93B4F7 !important; box-shadow: 0 0 0 3px rgba(37,99,235,0.12) !important; }
.velo-proj-root button:focus-visible { outline: none; box-shadow: 0 0 0 2px #FFFFFF, 0 0 0 4px rgba(37,99,235,0.45) !important; }
`;

const POR_PAGINA = 18;

const TIPO = { loja_completa: "Loja completa", pagina_venda: "Página de venda" } as const;

const metaDoProjeto = (projeto: UserProject) => {
  const meta = projeto.metadata;
  return meta && typeof meta === "object" && !Array.isArray(meta) ? (meta as Record<string, unknown>) : null;
};
const slugDoProjeto = (projeto: UserProject) => {
  const slug = metaDoProjeto(projeto)?.slug;
  return projeto.status === "publicado" && typeof slug === "string" && slug.trim() ? slug.trim() : null;
};
const logoDoProjeto = (projeto: UserProject) => {
  const logo = metaDoProjeto(projeto)?.logoImage;
  return typeof logo === "string" && logo.trim() ? logo : null;
};

const CORES = ["#2563EB", "#7C3AED", "#0E9F6E", "#F08A24", "#E11D74", "#0F766E"];
const corDoProjeto = (id: string) => {
  let soma = 0;
  for (const letra of id) soma = (soma + letra.charCodeAt(0)) % 9973;
  return CORES[soma % CORES.length];
};

const quandoMexeu = (projeto: UserProject) => projeto.last_edited_at ?? projeto.published_at ?? projeto.created_at;

// "24 nov", ou "21 jul 2025" quando é de outro ano.
const dataCurta = (iso: string) => {
  const data = new Date(iso);
  const mes = data.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  const ano = data.getFullYear() === new Date().getFullYear() ? "" : ` ${data.getFullYear()}`;
  return `${data.getDate()} ${mes}${ano}`;
};

const LogoDoProjeto = ({ projeto, tamanho }: { projeto: UserProject; tamanho: number }) => {
  const logo = logoDoProjeto(projeto);
  return (
    <span
      className="velo-proj-logo grid shrink-0 place-items-center overflow-hidden font-semibold text-white"
      style={{
        width: tamanho,
        height: tamanho,
        borderRadius: Math.round(tamanho * 0.26),
        fontSize: Math.round(tamanho * 0.4),
        background: logo ? "#FFFFFF" : corDoProjeto(projeto.id),
        boxShadow: logo ? "inset 0 0 0 1px #E4E4E7" : "inset 0 -2px 0 rgba(0,0,0,0.12), 0 6px 14px -8px rgba(16,24,40,0.35)",
      }}
    >
      {logo ? <img src={logo} alt="" className="h-full w-full object-contain p-1.5" /> : (projeto.nome || "P").trim().charAt(0).toUpperCase()}
    </span>
  );
};

const SeloStatus = ({ publicado }: { publicado: boolean }) => (
  <span
    className="inline-flex h-[22px] items-center gap-1.5 rounded-full px-2 text-[11.5px] font-medium"
    style={publicado ? { background: "#ECFDF5", color: "#047857" } : { background: "#F4F4F5", color: "#52525B" }}
  >
    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ background: publicado ? "#10B981" : "#A1A1AA" }} />
    {publicado ? "No ar" : "Rascunho"}
  </span>
);

// Menu "..." do card: abrir e configurar, ver o site e copiar o link (os dois últimos só no ar).
const MenuDoProjeto = ({
  projeto,
  aberto,
  onAlternar,
  onFechar,
  onAbrir,
}: {
  projeto: UserProject;
  aberto: boolean;
  onAlternar: () => void;
  onFechar: () => void;
  onAbrir: () => void;
}) => {
  const navigate = useNavigate();
  const caixa = useRef<HTMLDivElement>(null);
  const slug = slugDoProjeto(projeto);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) onFechar();
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto, onFechar]);

  const copiarLink = async () => {
    if (!slug) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/loja/${slug}`);
      veloToast.success("Link do site copiado");
    } catch {
      veloToast.error("Não foi possível copiar o link");
    }
    onFechar();
  };

  const itens = [
    { rotulo: "Abrir e configurar", Icone: Settings2, acao: () => { onFechar(); onAbrir(); } },
    ...(slug
      ? [
          { rotulo: "Ver site publicado", Icone: ExternalLink, acao: () => { onFechar(); navigate(`/loja/${slug}`); } },
          { rotulo: "Copiar link do site", Icone: Link2, acao: copiarLink },
        ]
      : []),
  ];

  return (
    <div ref={caixa} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={onAlternar}
        aria-label={`Opções de ${projeto.nome}`}
        aria-haspopup="menu"
        aria-expanded={aberto}
        className="velo-proj-icone grid h-7 w-7 place-items-center rounded-full text-[#71717A]"
        style={{ background: aberto ? "#F1F1F3" : "transparent", boxShadow: "none" }}
      >
        <MoreHorizontal aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
      </button>
      <AnimatePresence>
        {aberto ? (
          <motion.div
            role="menu"
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -2 }}
            transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 top-8 z-20 w-[196px] origin-top-right rounded-[12px] border border-[#E4E4E7] bg-white p-1"
            style={{ boxShadow: "0 16px 36px -16px rgba(16,24,40,0.28)" }}
          >
            {itens.map(({ rotulo, Icone, acao }) => (
              <button
                key={rotulo}
                type="button"
                role="menuitem"
                onClick={acao}
                className="velo-proj-item flex h-9 w-full items-center gap-2.5 rounded-[8px] px-2.5 text-left text-[13px] text-[#27272A]"
                style={{ background: "transparent", boxShadow: "none" }}
              >
                <Icone aria-hidden="true" className="h-4 w-4 text-[#71717A]" strokeWidth={1.8} />
                {rotulo}
              </button>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

const ProjetosPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const reduzir = !!useReducedMotion();
  const [visao, setVisao] = useState<"grade" | "lista">("grade");
  const [busca, setBusca] = useState("");
  const [quantos, setQuantos] = useState(POR_PAGINA);
  const [menuAberto, setMenuAberto] = useState<string | null>(null);

  // Mesma leitura da sidebar e da tela "Minha loja" (RPC get_user_projects), sem consulta nova.
  const projetosDaLoja = useQuery({
    queryKey: ["home-projetos-da-loja", user?.id],
    enabled: Boolean(user?.id),
    staleTime: 60_000,
    queryFn: fetchUserProjects,
  });

  const projetos = useMemo(() => {
    const lista = [...(projetosDaLoja.data ?? [])];
    lista.sort((a, b) => new Date(quandoMexeu(b)).getTime() - new Date(quandoMexeu(a)).getTime());
    return lista;
  }, [projetosDaLoja.data]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return termo ? projetos.filter((p) => (p.nome ?? "").toLowerCase().includes(termo)) : projetos;
  }, [projetos, busca]);
  const visiveis = filtrados.slice(0, quantos);

  const carregando = projetosDaLoja.isLoading;
  const semProjetos = !carregando && !projetosDaLoja.isError && projetos.length === 0;

  const criarProjeto = () => navigate("/dashboard/minha-loja", { state: { abrirCriacao: true } });
  const abrirEditor = (projeto: UserProject) =>
    navigate(`/minha-loja/editor/${projeto.id}`, { state: { projectId: projeto.id, sourceId: projeto.source_id } });

  const entrada = (atraso: number) =>
    reduzir
      ? { initial: false as const }
      : {
          initial: { opacity: 0, y: 8 },
          animate: { opacity: 1, y: 0 },
          transition: { delay: atraso, duration: 0.35, ease: [0.22, 1, 0.36, 1] as const },
        };

  return (
    <main className="velo-proj-root velo-fonte-inter flex shrink-0 flex-col overflow-auto bg-[#F7F7F8] text-[#18181B] -m-5 min-h-[calc(100%+2.5rem)] sm:-m-6 sm:min-h-[calc(100%+3rem)] lg:-m-7 lg:min-h-[calc(100%+3.5rem)]">
      <style>{PAGINA_CSS}</style>

      <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col px-8 pb-10 pt-8">
        {/* Barra do topo: título, grade/lista, busca e novo projeto. */}
        <motion.div {...entrada(0)} className="flex items-center gap-4 border-b border-[#E7E7EA] pb-5">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] border border-[#E4E4E7] bg-white text-[#3F3F46]">
              <FolderOpen aria-hidden="true" className="h-4 w-4" strokeWidth={1.9} />
            </span>
            <h1 className="m-0 text-[17px] font-semibold tracking-[-0.015em]">Projetos</h1>
            {projetos.length > 0 ? (
              <span className="grid h-5 min-w-[20px] place-items-center rounded-full bg-[#EDEDF0] px-1.5 text-[11.5px] font-medium text-[#52525B]">{projetos.length}</span>
            ) : null}
          </div>

          {!semProjetos ? (
            <>
              <div role="tablist" aria-label="Modo de exibição" className="flex shrink-0 items-center rounded-full border border-[#E4E4E7] bg-white p-1">
                {(
                  [
                    { id: "grade", rotulo: "Grade", Icone: LayoutGrid },
                    { id: "lista", rotulo: "Lista", Icone: List },
                  ] as const
                ).map(({ id, rotulo, Icone }) => {
                  const ativo = visao === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={ativo}
                      onClick={() => setVisao(id)}
                      className="relative flex h-7 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium"
                      style={{ background: "transparent", boxShadow: "none", color: ativo ? "#FFFFFF" : "#52525B" }}
                    >
                      {ativo ? (
                        <motion.span
                          layoutId="projetos-visao-ativa"
                          aria-hidden="true"
                          className="absolute inset-0 rounded-full bg-[#18181B]"
                          transition={reduzir ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 38 }}
                        />
                      ) : null}
                      <Icone aria-hidden="true" className="relative h-3.5 w-3.5" strokeWidth={2} />
                      <span className="relative">{rotulo}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-1 items-center justify-end gap-2.5">
                <label className="velo-proj-busca flex h-9 w-[220px] items-center gap-2 rounded-full border border-[#E4E4E7] bg-white px-3.5 transition-shadow">
                  <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-[#A1A1AA]" strokeWidth={2} />
                  <input
                    type="search"
                    value={busca}
                    onChange={(e) => {
                      setBusca(e.target.value);
                      setQuantos(POR_PAGINA);
                    }}
                    placeholder="Buscar projeto"
                    aria-label="Buscar projeto pelo nome"
                    className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[13px] text-[#18181B] outline-none placeholder:text-[#A1A1AA] focus:ring-0"
                  />
                </label>
                <button
                  type="button"
                  onClick={criarProjeto}
                  className="velo-proj-azul flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-[13px] font-medium text-white"
                  style={{ background: "#2563EB", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18), 0 1px 2px rgba(16,24,40,0.12)" }}
                >
                  <Plus aria-hidden="true" className="h-4 w-4" strokeWidth={2.2} />
                  Novo projeto
                </button>
              </div>
            </>
          ) : null}
        </motion.div>

        {carregando ? (
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6" aria-hidden="true">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex h-[188px] flex-col items-center rounded-[16px] border border-[#E7E7EA] bg-white p-3">
                <span className="h-5 w-16 self-start animate-pulse rounded-full bg-[#F1F3F6]" />
                <span className="mt-6 h-12 w-12 animate-pulse rounded-[13px] bg-[#F1F3F6]" />
                <span className="mt-5 h-3 w-24 animate-pulse rounded-full bg-[#F1F3F6]" />
                <span className="mt-2 h-2.5 w-16 animate-pulse rounded-full bg-[#F5F6F8]" />
              </div>
            ))}
          </div>
        ) : projetosDaLoja.isError ? (
          <p className="m-0 mt-8 text-center text-[14px] text-[#71717A]">Não foi possível carregar seus projetos agora. Tente de novo em instantes.</p>
        ) : semProjetos ? (
          /* Sem projetos: um botão grande no meio da página, com o mascote. */
          <div className="grid flex-1 place-items-center py-12">
            <motion.button
              type="button"
              onClick={criarProjeto}
              {...entrada(0.08)}
              className="velo-proj-criar flex w-full max-w-[400px] flex-col items-center rounded-[24px] border-2 border-dashed border-[#C9D6F2] bg-white px-10 pb-9 pt-8 text-center"
              style={{ boxShadow: "0 1px 2px rgba(16,24,40,0.04)" }}
            >
              <MascoteVelo pose="acenando" altura={116} atraso={0.15} />
              <span className="mt-5 text-[18px] font-semibold tracking-[-0.015em] text-[#18181B]">Crie seu primeiro projeto</span>
              <span className="mt-1.5 max-w-[300px] text-[13.5px] leading-5 text-[#71717A]" style={{ textWrap: "balance" }}>
                Monte o site da sua loja ou uma página de venda. Os agentes ajudam em cada passo.
              </span>
              <span
                className="velo-proj-criar-botao mt-6 inline-flex h-10 items-center gap-2 rounded-full px-5 text-[14px] font-medium text-white"
                style={{ background: "#2563EB", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18), 0 1px 2px rgba(16,24,40,0.12)", transition: "background-color 150ms ease-out" }}
              >
                <Plus aria-hidden="true" className="h-4 w-4" strokeWidth={2.2} />
                Criar projeto
              </span>
            </motion.button>
          </div>
        ) : filtrados.length === 0 ? (
          <p className="m-0 mt-10 text-center text-[14px] text-[#71717A]">Nenhum projeto com “{busca.trim()}”.</p>
        ) : visao === "grade" ? (
          /* Grade de cards, como a referência. */
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {visiveis.map((projeto, i) => {
              const publicado = projeto.status === "publicado";
              return (
                <motion.div
                  key={projeto.id}
                  {...entrada(0.05 + Math.min(i, 12) * 0.03)}
                  role="button"
                  tabIndex={0}
                  onClick={() => abrirEditor(projeto)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      abrirEditor(projeto);
                    }
                  }}
                  aria-label={`Abrir e configurar ${projeto.nome}`}
                  className="velo-proj-card relative flex h-[188px] cursor-pointer flex-col rounded-[16px] border border-[#E7E7EA] bg-white p-3 outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/40"
                  style={{ boxShadow: "0 1px 2px rgba(16,24,40,0.04)", zIndex: menuAberto === projeto.id ? 10 : undefined }}
                >
                  <div className="flex items-center justify-between">
                    <SeloStatus publicado={publicado} />
                    <MenuDoProjeto
                      projeto={projeto}
                      aberto={menuAberto === projeto.id}
                      onAlternar={() => setMenuAberto((atual) => (atual === projeto.id ? null : projeto.id))}
                      onFechar={() => setMenuAberto(null)}
                      onAbrir={() => abrirEditor(projeto)}
                    />
                  </div>
                  <div className="grid flex-1 place-items-center">
                    <LogoDoProjeto projeto={projeto} tamanho={48} />
                  </div>
                  <p className="m-0 truncate text-center text-[13.5px] font-semibold text-[#18181B]">{projeto.nome}</p>
                  <p className="m-0 mt-0.5 truncate text-center text-[12px] text-[#71717A]">{TIPO[projeto.tipo_projeto] ?? "Projeto"}</p>
                </motion.div>
              );
            })}
          </div>
        ) : (
          /* Lista: as mesmas informações em linhas, com a data. */
          <motion.div {...entrada(0.05)} className="mt-6 rounded-[16px] border border-[#E7E7EA] bg-white" style={{ boxShadow: "0 1px 2px rgba(16,24,40,0.04)" }}>
            <ul className="m-0 list-none p-0">
              {visiveis.map((projeto) => {
                const slug = slugDoProjeto(projeto);
                return (
                  <li
                    key={projeto.id}
                    className="velo-proj-linha relative flex cursor-pointer items-center gap-3.5 border-t border-[#F0F0F2] px-4 py-3 first:rounded-t-[16px] first:border-t-0 last:rounded-b-[16px]"
                    style={{ zIndex: menuAberto === projeto.id ? 10 : undefined }}
                    onClick={() => abrirEditor(projeto)}
                  >
                    <LogoDoProjeto projeto={projeto} tamanho={36} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold text-[#18181B]">{projeto.nome}</span>
                      <span className="block truncate text-[12px] text-[#71717A]">
                        {TIPO[projeto.tipo_projeto] ?? "Projeto"}
                        {slug ? ` · /loja/${slug}` : ""}
                      </span>
                    </span>
                    <SeloStatus publicado={projeto.status === "publicado"} />
                    <span className="hidden w-[90px] shrink-0 text-right text-[12.5px] text-[#71717A] sm:block">{dataCurta(quandoMexeu(projeto))}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        abrirEditor(projeto);
                      }}
                      className="velo-proj-contorno h-8 shrink-0 rounded-full border border-[#E4E4E7] px-3.5 text-[12.5px] font-medium text-[#27272A]"
                      style={{ background: "#FFFFFF", boxShadow: "none" }}
                    >
                      Abrir
                    </button>
                    <MenuDoProjeto
                      projeto={projeto}
                      aberto={menuAberto === projeto.id}
                      onAlternar={() => setMenuAberto((atual) => (atual === projeto.id ? null : projeto.id))}
                      onFechar={() => setMenuAberto(null)}
                      onAbrir={() => abrirEditor(projeto)}
                    />
                  </li>
                );
              })}
            </ul>
          </motion.div>
        )}

        {/* Carregar mais, de 18 em 18. */}
        {!carregando && filtrados.length > quantos ? (
          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={() => setQuantos((q) => q + POR_PAGINA)}
              className="velo-proj-contorno h-9 rounded-full border border-[#E4E4E7] px-5 text-[13px] font-medium text-[#27272A]"
              style={{ background: "#FFFFFF", boxShadow: "none" }}
            >
              Carregar mais ({filtrados.length - quantos})
            </button>
          </div>
        ) : null}
      </div>
    </main>
  );
};

export default ProjetosPage;
