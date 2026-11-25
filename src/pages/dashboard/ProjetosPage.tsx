import { useMemo, useState, type CSSProperties, type ElementType, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, BadgePercent, ChevronRight, ExternalLink, LayoutTemplate, PenLine, Plus, Wand2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { fetchUserProjects, type UserProject } from "@/lib/userProjects";
import MascoteVelo from "@/components/MascoteVelo";
import agenteLua from "@/assets/agentes/lua.png";
import agenteCubo from "@/assets/agentes/cubo.png";
import agenteFolha from "@/assets/agentes/folha.png";
import agenteSino from "@/assets/agentes/sino.png";

/*
  Projetos (`/dashboard/projetos`), no modelo da referência "Dashboards" (25/11/2026):
  breadcrumb e abas no topo, título com a contagem real de projetos, três cartões de
  atalho (criar projeto, personalizar o visual, página de vendas com IA) e a lista
  dos projetos numa tabela: projeto, último trabalho dos agentes, status, data e
  ações (ver o site publicado e editar no editor). Tudo vem do RPC
  `get_user_projects` (mesma leitura da sidebar e da Minha loja, sem consulta nova).

  O banco ainda não guarda agentes nem qual agente fez cada mudança: a foto do
  agente segue o tipo do trabalho (lua = rascunho, cubo = edição, folha =
  publicação) e não há nome de agente. Criar agentes depende disso existir.
*/

const PAGINA_CSS = `
.velo-proj-root, .velo-proj-root * { font-feature-settings: normal !important; }
.velo-proj-root h1, .velo-proj-root h2 { font-family: "Inter", ui-sans-serif, system-ui, sans-serif !important; }
.velo-proj-aba { transition: color 150ms ease-out; }
.velo-proj-aba:hover { color: #18181B !important; }
.velo-proj-atalho { transition: border-color 150ms ease-out, box-shadow 200ms ease-out, transform 200ms cubic-bezier(0.22, 1, 0.36, 1); }
.velo-proj-atalho:hover { border-color: #C7D2FE !important; box-shadow: 0 10px 24px -14px rgba(37,99,235,0.35) !important; transform: translateY(-1px); }
.velo-proj-atalho:hover .velo-proj-atalho-img { transform: translateY(-2px) scale(1.04); }
.velo-proj-atalho-img { transition: transform 250ms cubic-bezier(0.22, 1, 0.36, 1); }
.velo-proj-linha { transition: background-color 150ms ease-out; }
.velo-proj-linha:hover { background: #F7F7F8; }
.velo-proj-linha:hover .velo-proj-agente { transform: translateY(-1px) rotate(-3deg); }
.velo-proj-agente { transition: transform 250ms cubic-bezier(0.22, 1, 0.36, 1); }
.velo-proj-redondo { transition: background-color 120ms ease-out, border-color 120ms ease-out, color 120ms ease-out; }
.velo-proj-redondo:hover { background: #FFFFFF !important; border-color: #D4D4D8 !important; color: #18181B !important; }
.velo-proj-icone { transition: background-color 120ms ease-out, border-color 120ms ease-out, color 120ms ease-out; }
.velo-proj-icone:hover { background: #F4F4F5 !important; border-color: #D4D4D8 !important; color: #18181B !important; }
.velo-proj-novo { transition: background-color 150ms ease-out, transform 120ms ease-out; }
.velo-proj-novo:hover { background: #1D4ED8 !important; }
.velo-proj-novo:active { transform: scale(0.98); }
.velo-proj-root button:focus-visible { outline: none; box-shadow: 0 0 0 2px #FFFFFF, 0 0 0 4px rgba(37,99,235,0.45) !important; }
`;

// "24 nov", ou "21 jul 2025" quando é de outro ano.
const dataCurta = (iso: string) => {
  const data = new Date(iso);
  const mes = data.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  const ano = data.getFullYear() === new Date().getFullYear() ? "" : ` ${data.getFullYear()}`;
  return `${data.getDate()} ${mes}${ano}`;
};

// "há 5 min", "há 3 h", "há 2 d" — e a data curta para o que passou de uma semana.
const tempoRelativo = (iso: string, agora = Date.now()) => {
  const diff = Math.max(0, agora - new Date(iso).getTime());
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.floor(horas / 24);
  if (dias < 7) return `há ${dias} d`;
  return dataCurta(iso);
};

const metaDoProjeto = (projeto: UserProject) => {
  const meta = projeto.metadata;
  return meta && typeof meta === "object" && !Array.isArray(meta) ? (meta as Record<string, unknown>) : null;
};
const slugDoProjeto = (projeto: UserProject) => {
  const slug = metaDoProjeto(projeto)?.slug;
  return typeof slug === "string" && slug.trim() ? slug.trim() : null;
};
const TIPO = { loja_completa: "Loja completa", pagina_venda: "Página de venda" } as const;

type Trabalho = { acao: string; quando: string; agente: string };

// Último trabalho no site, com o que o banco registra (criação, edição e publicação).
const ultimoTrabalho = (projeto: UserProject): Trabalho => {
  const opcoes: Trabalho[] = [{ acao: "Criou o rascunho", quando: projeto.created_at, agente: agenteLua }];
  const criado = new Date(projeto.created_at).getTime();
  if (projeto.last_edited_at && new Date(projeto.last_edited_at).getTime() - criado > 60_000) {
    opcoes.push({ acao: "Atualizou o site", quando: projeto.last_edited_at, agente: agenteCubo });
  }
  if (projeto.published_at) opcoes.push({ acao: "Publicou o site", quando: projeto.published_at, agente: agenteFolha });
  return opcoes.sort((a, b) => new Date(b.quando).getTime() - new Date(a.quando).getTime())[0];
};

type Evento = Trabalho & { id: string; projeto: UserProject };
const eventosDoSite = (projetos: UserProject[], limite: number): Evento[] => {
  const eventos: Evento[] = [];
  for (const projeto of projetos) {
    const criado = new Date(projeto.created_at).getTime();
    eventos.push({ id: `${projeto.id}-criado`, projeto, acao: "Criou o rascunho do site", quando: projeto.created_at, agente: agenteLua });
    if (projeto.last_edited_at && new Date(projeto.last_edited_at).getTime() - criado > 60_000) {
      eventos.push({ id: `${projeto.id}-editado`, projeto, acao: "Atualizou o site", quando: projeto.last_edited_at, agente: agenteCubo });
    }
    if (projeto.published_at) {
      eventos.push({ id: `${projeto.id}-publicado`, projeto, acao: "Publicou o site", quando: projeto.published_at, agente: agenteFolha });
    }
  }
  return eventos.sort((a, b) => new Date(b.quando).getTime() - new Date(a.quando).getTime()).slice(0, limite);
};

const quandoMexeu = (projeto: UserProject) => projeto.last_edited_at ?? projeto.published_at ?? projeto.created_at;

const ESTILO_CARTAO: CSSProperties = { boxShadow: "0 1px 2px rgba(16,24,40,0.04), 0 12px 32px -20px rgba(16,24,40,0.18)" };

type Entrada = Record<string, unknown>;

// Botão redondo e claro do lado direito da linha (como os da referência "Recent activity").
const BotaoRedondo = ({ rotulo, dica, onClick, children }: { rotulo: string; dica: string; onClick: () => void; children: ReactNode }) => (
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
    aria-label={rotulo}
    title={dica}
    className="velo-proj-redondo grid h-9 w-9 place-items-center rounded-full border border-[#EDEDF0] text-[#71717A]"
    style={{ background: "#FAFAFB", boxShadow: "none" }}
  >
    {children}
  </button>
);

// Uma linha: agente à esquerda, nome em negrito, o que foi feito em cinza e quando, mais claro.
const LinhaDeAtividade = ({
  entrada,
  agente,
  titulo,
  publicado,
  texto,
  quando,
  onAbrir,
  acoes,
}: {
  entrada: Entrada;
  agente: string;
  titulo: string;
  publicado?: boolean;
  texto: string;
  quando: string;
  onAbrir: () => void;
  acoes: ReactNode;
}) => (
  <motion.li {...entrada} className="velo-proj-linha flex cursor-pointer items-center gap-3.5 rounded-[14px] px-3 py-2.5" onClick={onAbrir}>
    <span className="grid h-12 w-12 shrink-0 place-items-center">
      <img src={agente} alt="" aria-hidden="true" draggable={false} className="velo-proj-agente h-11 w-11 select-none object-contain" />
    </span>
    <span className="min-w-0 flex-1">
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate text-[14.5px] font-semibold leading-5 text-[#18181B]">{titulo}</span>
        {publicado !== undefined ? (
          <span className="inline-flex shrink-0 items-center gap-1 text-[11.5px] font-medium" style={{ color: publicado ? "#059669" : "#A1A1AA" }}>
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ background: publicado ? "#10B981" : "#D4D4D8" }} />
            {publicado ? "No ar" : "Rascunho"}
          </span>
        ) : null}
      </span>
      <span className="block truncate text-[13px] leading-[18px] text-[#71717A]">{texto}</span>
      <span className="block text-[11.5px] leading-4 text-[#A1A1AA]" title={new Date(quando).toLocaleString("pt-BR")}>
        {tempoRelativo(quando)}
      </span>
    </span>
    <span className="flex shrink-0 items-center gap-1.5">{acoes}</span>
  </motion.li>
);

const EsqueletoDaLista = () => (
  <div aria-hidden="true">
    {[0, 1, 2].map((i) => (
      <div key={i} className="flex items-center gap-3.5 px-3 py-3">
        <span className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-[#F1F3F6]" />
        <span className="flex-1 space-y-2">
          <span className="block h-3 w-40 animate-pulse rounded-full bg-[#F1F3F6]" />
          <span className="block h-2.5 w-56 animate-pulse rounded-full bg-[#F5F6F8]" />
        </span>
      </div>
    ))}
  </div>
);

const ABAS = [
  { id: "visao-geral", label: "Visão geral" },
  { id: "atividade", label: "Atividade" },
  { id: "ferramentas", label: "Ferramentas" },
] as const;
type Aba = (typeof ABAS)[number]["id"];

const ProjetosPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const reduzir = !!useReducedMotion();
  const [aba, setAba] = useState<Aba>("visao-geral");

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
  const publicados = projetos.filter((p) => p.status === "publicado").length;

  const criarProjeto = () => navigate("/dashboard/minha-loja", { state: { abrirCriacao: true } });
  const abrirEditor = (projeto: UserProject) =>
    navigate(`/minha-loja/editor/${projeto.id}`, { state: { projectId: projeto.id, sourceId: projeto.source_id } });

  const entrada = (atraso: number, distancia = 8) =>
    reduzir
      ? { initial: false as const }
      : {
          initial: { opacity: 0, y: distancia },
          animate: { opacity: 1, y: 0 },
          transition: { delay: atraso, duration: 0.4, ease: [0.22, 1, 0.36, 1] as const },
        };

  const atalhos: { titulo: string; texto: string; imagem: string; fundo: string; acao: () => void }[] = [
    {
      titulo: "Crie um novo projeto",
      texto: "Comece o site de uma loja ou uma página de venda.",
      imagem: agenteLua,
      fundo: "linear-gradient(180deg, #EEF2FF 0%, #C7D2FE 100%)",
      acao: criarProjeto,
    },
    {
      titulo: "Personalize o visual",
      texto: "Escolha um modelo da Velo e deixe com a cara da sua marca.",
      imagem: agenteCubo,
      fundo: "linear-gradient(180deg, #FFF7ED 0%, #FED7AA 100%)",
      acao: () => navigate("/dashboard/modelos"),
    },
    {
      titulo: "Página com IA",
      texto: "Os agentes montam uma página pronta para vender um produto.",
      imagem: agenteFolha,
      fundo: "linear-gradient(180deg, #F0FDF4 0%, #BBF7D0 100%)",
      acao: () => navigate("/dashboard/paginas-com-ia/criar"),
    },
  ];

  const ferramentas: { titulo: string; texto: string; Icone: ElementType; cor: string; fundo: string; botao: string; acao: () => void }[] = [
    {
      titulo: "Modelos da Velo",
      texto: "Templates profissionais para o site da sua loja.",
      Icone: LayoutTemplate,
      cor: "#2563EB",
      fundo: "#EFF6FF",
      botao: "Ver modelos",
      acao: () => navigate("/dashboard/modelos"),
    },
    {
      titulo: "Página de vendas com IA",
      texto: "Crie uma página profissional para apresentar e vender seu produto.",
      Icone: Wand2,
      cor: "#0F766E",
      fundo: "#E6F6F3",
      botao: "Criar página",
      acao: () => navigate("/dashboard/paginas-com-ia/criar"),
    },
    {
      titulo: "Programa de afiliados",
      texto: "Indique a Velo e ganhe 30% na primeira venda de cada novo cliente.",
      Icone: BadgePercent,
      cor: "#6D28D9",
      fundo: "#F3EEFF",
      botao: "Quero ser afiliado",
      acao: () => navigate("/dashboard/comissoes"),
    },
  ];

  const eventos = eventosDoSite(projetos, aba === "atividade" ? 20 : 5);

  return (
    <main className="velo-proj-root velo-fonte-inter shrink-0 overflow-auto bg-white text-[#18181B] -m-5 min-h-[calc(100%+2.5rem)] sm:-m-6 sm:min-h-[calc(100%+3rem)] lg:-m-7 lg:min-h-[calc(100%+3.5rem)]">
      <style>{PAGINA_CSS}</style>

      {/* Topo da referência: breadcrumb e abas de ponta a ponta, com filete embaixo. */}
      <div className="border-b border-[#EDEDF0] px-8">
        <nav aria-label="Caminho" className="flex h-14 items-center gap-2 text-[14px]">
          <img src="/logo.png" alt="" className="h-5 w-5 object-contain" draggable={false} />
          <button type="button" onClick={() => navigate("/dashboard")} className="font-medium text-[#52525B] hover:text-[#18181B]" style={{ background: "transparent", boxShadow: "none" }}>
            Velo
          </button>
          <ChevronRight aria-hidden="true" className="h-4 w-4 text-[#A1A1AA]" />
          <span className="font-medium text-[#18181B]">Projetos</span>
        </nav>
        <div role="tablist" aria-label="Seções de Projetos" className="flex gap-8">
          {ABAS.map((item) => {
            const ativa = aba === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={ativa}
                onClick={() => setAba(item.id)}
                className="velo-proj-aba relative h-11 text-[14.5px]"
                style={{ background: "transparent", boxShadow: "none", color: ativa ? "#18181B" : "#71717A", fontWeight: ativa ? 500 : 400 }}
              >
                {item.label}
                {ativa ? (
                  <motion.span
                    layoutId="projetos-aba-ativa"
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-[#18181B]"
                    transition={reduzir ? { duration: 0 } : { duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1040px] px-8 pb-16 pt-10">
        {/* Título com a contagem real e o botão de novo projeto. */}
        <motion.div {...entrada(0)} className="flex items-end justify-between gap-6">
          <div className="min-w-0">
            <h1 className="m-0 text-[30px] font-semibold leading-9 tracking-[-0.02em]">Projetos</h1>
            <p className="m-0 mt-1.5 text-[15px] text-[#71717A]">
              {projetosDaLoja.isLoading ? (
                "Carregando seus projetos…"
              ) : (
                <>
                  Você tem <strong className="font-semibold text-[#18181B]">{projetos.length}</strong>{" "}
                  {projetos.length === 1 ? "projeto" : "projetos"}
                  {projetos.length > 0 ? (
                    <>
                      {" "}· <strong className="font-semibold text-[#18181B]">{publicados}</strong>{" "}
                      {publicados === 1 ? "publicado" : "publicados"}
                    </>
                  ) : null}
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={criarProjeto}
            className="velo-proj-novo flex h-10 shrink-0 items-center gap-2 rounded-[10px] px-4 text-[14px] font-medium text-white"
            style={{ background: "#2563EB", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18), 0 1px 2px rgba(16,24,40,0.12)" }}
          >
            <Plus aria-hidden="true" className="h-4 w-4" strokeWidth={2.2} />
            Novo projeto
          </button>
        </motion.div>

        {aba === "visao-geral" ? (
          <>
            {/* Cartões de atalho, como "Set up your first Workflow" da referência. */}
            <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
              {atalhos.map((atalho, i) => (
                <motion.button
                  key={atalho.titulo}
                  type="button"
                  onClick={atalho.acao}
                  {...entrada(0.05 + i * 0.05)}
                  className="velo-proj-atalho flex min-h-[104px] overflow-hidden rounded-[16px] border border-[#E4E4E7] bg-white text-left"
                  style={{ boxShadow: "0 1px 2px rgba(16,24,40,0.04)" }}
                >
                  <span className="grid w-[100px] shrink-0 place-items-center border-r border-[#EDEDF0] bg-[#FAFAFB]">
                    <span className="relative grid h-[68px] w-[68px] place-items-center overflow-hidden rounded-full" style={{ background: atalho.fundo, boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.7), 0 4px 10px -4px rgba(16,24,40,0.15)" }}>
                      <img src={atalho.imagem} alt="" draggable={false} className="velo-proj-atalho-img h-11 w-11 select-none object-contain" />
                    </span>
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col justify-center px-4 py-3">
                    <span className="text-[15px] font-semibold leading-5 tracking-[-0.01em] text-[#18181B]">{atalho.titulo}</span>
                    <span className="mt-1 text-[13px] leading-[19px] text-[#71717A]">{atalho.texto}</span>
                  </span>
                </motion.button>
              ))}
            </div>

            {/* Seus projetos, no cartão de "Recent activity" da referência: agente, nome, o que foi feito e quando. */}
            <motion.section {...entrada(0.2)} aria-labelledby="projetos-lista" className="mt-10 rounded-[20px] border border-[#EDEDF0] bg-white p-2" style={ESTILO_CARTAO}>
              <div className="flex items-baseline justify-between gap-4 px-4 pb-2 pt-3">
                <h2 id="projetos-lista" className="m-0 text-[15px] font-semibold tracking-[-0.01em]">
                  Seus projetos
                </h2>
                {projetos.length > 0 ? (
                  <span className="text-[12.5px] text-[#A1A1AA]">
                    {projetos.length === 1 ? "1 site" : `${projetos.length} sites`} · {publicados} no ar
                  </span>
                ) : null}
              </div>

              {projetosDaLoja.isLoading ? (
                <EsqueletoDaLista />
              ) : projetosDaLoja.isError ? (
                <p className="m-0 px-4 pb-4 pt-1 text-[14px] text-[#71717A]">Não foi possível carregar seus projetos agora.</p>
              ) : projetos.length === 0 ? (
                <div className="flex flex-col items-center px-6 pb-8 pt-4 text-center">
                  <MascoteVelo pose="acenando" altura={84} />
                  <p className="m-0 mt-3 text-[15px] font-semibold text-[#18181B]">Nenhum projeto ainda</p>
                  <p className="m-0 mt-1 max-w-sm text-[13.5px] text-[#71717A]">Crie o site da sua loja e os agentes cuidam do resto.</p>
                  <button
                    type="button"
                    onClick={criarProjeto}
                    className="velo-proj-novo mt-4 flex h-9 items-center gap-2 rounded-[10px] px-4 text-[13.5px] font-medium text-white"
                    style={{ background: "#2563EB", boxShadow: "none" }}
                  >
                    <Plus aria-hidden="true" className="h-4 w-4" strokeWidth={2.2} />
                    Criar primeiro projeto
                  </button>
                </div>
              ) : (
                <ul className="m-0 list-none p-0">
                  {projetos.map((projeto, i) => {
                    const trabalho = ultimoTrabalho(projeto);
                    const slug = projeto.status === "publicado" ? slugDoProjeto(projeto) : null;
                    return (
                      <LinhaDeAtividade
                        key={projeto.id}
                        entrada={entrada(0.24 + Math.min(i, 8) * 0.035, 4)}
                        agente={trabalho.agente}
                        titulo={projeto.nome}
                        publicado={projeto.status === "publicado"}
                        texto={`${trabalho.acao} · ${TIPO[projeto.tipo_projeto] ?? "Projeto"}`}
                        quando={trabalho.quando}
                        onAbrir={() => abrirEditor(projeto)}
                        acoes={
                          <>
                            {slug ? (
                              <BotaoRedondo rotulo={`Ver o site publicado de ${projeto.nome}`} dica="Ver site publicado" onClick={() => navigate(`/loja/${slug}`)}>
                                <ExternalLink aria-hidden="true" className="h-[15px] w-[15px]" strokeWidth={1.8} />
                              </BotaoRedondo>
                            ) : null}
                            <BotaoRedondo rotulo={`Editar e personalizar ${projeto.nome}`} dica="Editar e personalizar" onClick={() => abrirEditor(projeto)}>
                              <PenLine aria-hidden="true" className="h-[15px] w-[15px]" strokeWidth={1.8} />
                            </BotaoRedondo>
                          </>
                        }
                      />
                    );
                  })}
                </ul>
              )}
            </motion.section>
          </>
        ) : null}

        {/* Atividade: o trabalho dos agentes no site, do mais recente para o mais antigo. */}
        {aba === "atividade" ? (
          <motion.section {...entrada(0.05)} aria-labelledby="projetos-atividade" className="mt-8 rounded-[20px] border border-[#EDEDF0] bg-white p-2" style={ESTILO_CARTAO}>
            <h2 id="projetos-atividade" className="m-0 px-4 pb-2 pt-3 text-[15px] font-semibold tracking-[-0.01em]">
              Atividade recente
            </h2>
            {projetosDaLoja.isLoading ? (
              <EsqueletoDaLista />
            ) : eventos.length === 0 ? (
              <div className="flex items-center gap-3.5 px-4 pb-4 pt-1">
                <img src={agenteSino} alt="" aria-hidden="true" className="h-11 w-11 shrink-0 object-contain" draggable={false} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-medium">Nenhuma atividade no site ainda</span>
                  <span className="block text-[13px] text-[#71717A]">Crie o site da sua loja e acompanhe aqui cada mudança.</span>
                </span>
              </div>
            ) : (
              <ul className="m-0 list-none p-0">
                {eventos.map((evento, i) => (
                  <LinhaDeAtividade
                    key={evento.id}
                    entrada={entrada(0.06 + Math.min(i, 10) * 0.03, 4)}
                    agente={evento.agente}
                    titulo={evento.projeto.nome}
                    texto={`${evento.acao} · ${TIPO[evento.projeto.tipo_projeto] ?? "Projeto"}`}
                    quando={evento.quando}
                    onAbrir={() => abrirEditor(evento.projeto)}
                    acoes={
                      <BotaoRedondo rotulo={`Editar e personalizar ${evento.projeto.nome}`} dica="Editar e personalizar" onClick={() => abrirEditor(evento.projeto)}>
                        <PenLine aria-hidden="true" className="h-[15px] w-[15px]" strokeWidth={1.8} />
                      </BotaoRedondo>
                    }
                  />
                ))}
              </ul>
            )}
          </motion.section>
        ) : null}

        {/* Ferramentas para o site da loja. */}
        {aba === "ferramentas" ? (
          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            {ferramentas.map((f, i) => (
              <motion.div
                key={f.titulo}
                {...entrada(0.05 + i * 0.05)}
                className="flex flex-col rounded-[16px] border border-[#E4E4E7] bg-white p-5"
              >
                <span className="grid h-10 w-10 place-items-center rounded-[12px]" style={{ background: f.fundo, color: f.cor }}>
                  <f.Icone aria-hidden="true" className="h-5 w-5" strokeWidth={1.7} />
                </span>
                <span className="mt-4 text-[15px] font-semibold">{f.titulo}</span>
                <span className="mt-1 flex-1 text-[13.5px] leading-5 text-[#71717A]">{f.texto}</span>
                <button
                  type="button"
                  onClick={f.acao}
                  className="velo-proj-icone mt-4 flex h-9 items-center justify-center gap-1.5 rounded-[10px] border border-[#E4E4E7] text-[13.5px] font-medium text-[#27272A]"
                  style={{ background: "#FFFFFF", boxShadow: "none" }}
                >
                  {f.botao}
                  <ArrowRight aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
                </button>
              </motion.div>
            ))}
          </div>
        ) : null}
      </div>
    </main>
  );
};

export default ProjetosPage;
