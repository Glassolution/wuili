import { useMemo, useState, type CSSProperties, type ElementType, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Activity, ArrowRight, BadgePercent, ChevronRight, Clock3, FilePlus2, FileText, FolderOpen, Globe, LayoutTemplate, PenLine, Plus, Wand2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { fetchUserProjects, type UserProject } from "@/lib/userProjects";
import MascoteVelo from "@/components/MascoteVelo";
import agenteLua from "@/assets/agentes/lua.png";
import agenteCubo from "@/assets/agentes/cubo.png";
import agenteFolha from "@/assets/agentes/folha.png";
import agenteSino from "@/assets/agentes/sino.png";
import agenteConcha from "@/assets/agentes/concha.png";
import agenteEstrela from "@/assets/agentes/estrela.png";
import { useProfile } from "@/lib/profileContext";

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
.velo-proj-link:hover { color: #18181B !important; text-decoration: underline; text-underline-offset: 3px; }
.velo-proj-linha-plana { transition: background-color 120ms ease-out; }
.velo-proj-linha-plana:hover { background: #FAFAFB !important; }
.velo-proj-secundario { transition: background-color 120ms ease-out, border-color 120ms ease-out; }
.velo-proj-secundario:hover { background: #F4F4F5 !important; border-color: #D4D4D8 !important; }
.velo-proj-atalho-tile { transition: background-color 150ms ease-out, border-color 150ms ease-out, transform 200ms cubic-bezier(0.22, 1, 0.36, 1); }
.velo-proj-atalho-tile:hover { background: #FFFFFF !important; border-color: #DCE3F5 !important; transform: translateY(-1px); }
.velo-proj-atalho-tile:hover .velo-proj-agente { transform: translateY(-1px) rotate(-4deg); }
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

type Evento = Trabalho & { id: string; projeto: UserProject; tipo: "criado" | "editado" | "publicado" };
const eventosDoSite = (projetos: UserProject[], limite: number): Evento[] => {
  const eventos: Evento[] = [];
  for (const projeto of projetos) {
    const criado = new Date(projeto.created_at).getTime();
    eventos.push({ id: `${projeto.id}-criado`, tipo: "criado", projeto, acao: "Criou o rascunho do site", quando: projeto.created_at, agente: agenteLua });
    if (projeto.last_edited_at && new Date(projeto.last_edited_at).getTime() - criado > 60_000) {
      eventos.push({ id: `${projeto.id}-editado`, tipo: "editado", projeto, acao: "Atualizou o site", quando: projeto.last_edited_at, agente: agenteCubo });
    }
    if (projeto.published_at) {
      eventos.push({ id: `${projeto.id}-publicado`, tipo: "publicado", projeto, acao: "Publicou o site", quando: projeto.published_at, agente: agenteFolha });
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

const ESTILO_PAINEL: CSSProperties = { boxShadow: "0 1px 2px rgba(16,24,40,0.04)" };

// Cartão do painel (como "Needs your approval" da referência): título, contagem e um link à direita.
const Painel = ({
  titulo,
  contagem,
  acao,
  entrada,
  children,
}: {
  titulo: string;
  contagem?: number;
  acao?: { rotulo: string; onClick: () => void };
  entrada: Entrada;
  children: ReactNode;
}) => (
  <motion.section {...entrada} aria-label={titulo} className="overflow-hidden rounded-[16px] border border-[#E9E9EC] bg-white" style={ESTILO_PAINEL}>
    <header className="flex h-[52px] items-center justify-between gap-3 border-b border-[#F0F0F2] px-5">
      <h2 className="m-0 flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em] text-[#18181B]">
        {titulo}
        {contagem !== undefined ? (
          <span className="grid h-5 min-w-[20px] place-items-center rounded-full bg-[#F1F1F3] px-1.5 text-[11.5px] font-medium text-[#52525B]">{contagem}</span>
        ) : null}
      </h2>
      {acao ? (
        <button
          type="button"
          onClick={acao.onClick}
          className="velo-proj-link text-[13px] font-medium text-[#3F3F46]"
          style={{ background: "transparent", boxShadow: "none", padding: 0 }}
        >
          {acao.rotulo}
        </button>
      ) : null}
    </header>
    {children}
  </motion.section>
);

// Cartão de número (como "Time saved this week"): ícone num quadradinho, rótulo, número e legenda.
const Numero = ({ Icone, rotulo, valor, legenda, entrada }: { Icone: ElementType; rotulo: string; valor: string; legenda: string; entrada: Entrada }) => (
  <motion.div {...entrada} className="rounded-[16px] border border-[#E9E9EC] bg-white px-4 pb-4 pt-3.5" style={ESTILO_PAINEL}>
    <div className="flex items-center gap-2.5">
      <span className="grid h-7 w-7 place-items-center rounded-[8px] border border-[#E4E4E7] bg-white text-[#52525B]">
        <Icone aria-hidden="true" className="h-[15px] w-[15px]" strokeWidth={1.8} />
      </span>
      <span className="truncate text-[13px] text-[#52525B]">{rotulo}</span>
    </div>
    <p className="m-0 mt-4 text-[28px] font-semibold leading-8 tracking-[-0.02em] text-[#18181B]">{valor}</p>
    <p className="m-0 mt-2.5 truncate text-[12px] text-[#71717A]">{legenda}</p>
  </motion.div>
);

const LinhasCarregando = ({ quantas = 3 }: { quantas?: number }) => (
  <div aria-hidden="true" className="divide-y divide-[#F0F0F2]">
    {Array.from({ length: quantas }, (_, i) => (
      <div key={i} className="flex items-center gap-3 px-5 py-3.5">
        <span className="h-7 w-7 shrink-0 animate-pulse rounded-full bg-[#F1F3F6]" />
        <span className="flex-1 space-y-2">
          <span className="block h-3 w-40 animate-pulse rounded-full bg-[#F1F3F6]" />
          <span className="block h-2.5 w-28 animate-pulse rounded-full bg-[#F5F6F8]" />
        </span>
      </div>
    ))}
  </div>
);

// Ícone colorido do tipo de trabalho, como os ícones de arquivo de "Recent files".
const ICONE_DA_ACAO: Record<string, { Icone: ElementType; cor: string; fundo: string }> = {
  criado: { Icone: FilePlus2, cor: "#0E9F6E", fundo: "#E7F7EF" },
  editado: { Icone: PenLine, cor: "#EA7A1A", fundo: "#FFF1E4" },
  publicado: { Icone: Globe, cor: "#2563EB", fundo: "#EAF1FF" },
};

// Em que etapa o site está: 1 criado, 2 editado, 3 no ar.
const etapaDoSite = (projeto: UserProject) => {
  if (projeto.status === "publicado") return { etapa: 3, agente: agenteFolha, falta: "No ar" };
  const criado = new Date(projeto.created_at).getTime();
  const editado = Boolean(projeto.last_edited_at && new Date(projeto.last_edited_at).getTime() - criado > 60_000);
  return editado ? { etapa: 2, agente: agenteCubo, falta: "Falta publicar" } : { etapa: 1, agente: agenteLua, falta: "Falta personalizar" };
};

const saudacao = () => {
  const hora = new Date().getHours();
  return hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
};

const hojePorExtenso = () => {
  const texto = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

const SEMANA_MS = 7 * 24 * 60 * 60 * 1000;

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
  const [verTodosRascunhos, setVerTodosRascunhos] = useState(false);
  const { nomeCurto } = useProfile();
  const primeiroNome = (() => {
    const primeiro = (nomeCurto ?? "").trim().split(" ")[0] ?? "";
    return /^usu[aá]rio$/i.test(primeiro) ? "" : primeiro;
  })();

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

  const rascunhos = projetos.filter((p) => p.status !== "publicado").sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const rascunhoMaisAntigo = rascunhos[0];
  const lojas = projetos.filter((p) => p.tipo_projeto === "loja_completa").length;
  const paginas = projetos.length - lojas;
  const ultimaPublicacao = projetos
    .map((p) => p.published_at)
    .filter((d): d is string => Boolean(d))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
  const todosOsEventos = eventosDoSite(projetos, Number.POSITIVE_INFINITY);
  const mudancasDaSemana = todosOsEventos.filter((e) => Date.now() - new Date(e.quando).getTime() < SEMANA_MS);

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

  // Atalhos no lugar de "Your agents" da referência: cada um com um agente e um selo do que faz.
  const atalhos: { titulo: string; selo: string; imagem: string; acao: () => void }[] = [
    { titulo: "Novo site", selo: "Criar", imagem: agenteLua, acao: criarProjeto },
    { titulo: "Modelos", selo: "Visual", imagem: agenteCubo, acao: () => navigate("/dashboard/modelos") },
    { titulo: "Página IA", selo: "Vender", imagem: agenteFolha, acao: () => navigate("/dashboard/paginas-com-ia/criar") },
    { titulo: "Catálogo", selo: "Produtos", imagem: agenteConcha, acao: () => navigate("/dashboard/catalogo") },
    { titulo: "Publicações", selo: "Anúncios", imagem: agenteSino, acao: () => navigate("/dashboard/publicacoes") },
    { titulo: "Afiliados", selo: "Indicar", imagem: agenteEstrela, acao: () => navigate("/dashboard/comissoes") },
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

      <div className="mx-auto w-full max-w-[1120px] px-8 pb-16 pt-8">
        {/* Topo do painel: data, saudação e resumo real. O chat da referência fica de fora. */}
        <motion.div {...entrada(0)} className="flex items-end justify-between gap-6">
          <div className="min-w-0">
            <p className="m-0 text-[13px] text-[#71717A]">{hojePorExtenso()}</p>
            <h1 className="m-0 mt-1 text-[28px] font-semibold leading-9 tracking-[-0.02em]">
              {saudacao()}
              {primeiroNome ? `, ${primeiroNome}` : ""}
            </h1>
            <p className="m-0 mt-1 text-[14px] text-[#71717A]">
              {projetosDaLoja.isLoading
                ? "Carregando seus projetos…"
                : projetos.length === 0
                  ? "Você ainda não tem projetos. Crie o primeiro e os agentes cuidam do resto."
                  : `${
                      rascunhos.length === 0
                        ? "Todos os seus sites estão no ar."
                        : rascunhos.length === 1
                          ? "1 site espera você publicar."
                          : `${rascunhos.length} sites esperam você publicar.`
                    } ${
                      mudancasDaSemana.length === 0
                        ? "Nenhuma mudança nos últimos 7 dias."
                        : `Os agentes fizeram ${mudancasDaSemana.length} ${mudancasDaSemana.length === 1 ? "mudança" : "mudanças"} nesta semana.`
                    }`}
            </p>
          </div>
          <button
            type="button"
            onClick={criarProjeto}
            className="velo-proj-novo flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-[14px] font-medium text-white"
            style={{ background: "#2563EB", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18), 0 1px 2px rgba(16,24,40,0.12)" }}
          >
            <Plus aria-hidden="true" className="h-4 w-4" strokeWidth={2.2} />
            Novo projeto
          </button>
        </motion.div>

        {aba === "visao-geral" ? (
          <>
            {/* Quatro números, todos vindos dos projetos. */}
            <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Numero
                entrada={entrada(0.04)}
                Icone={FolderOpen}
                rotulo="Seus projetos"
                valor={projetosDaLoja.isLoading ? "–" : String(projetos.length)}
                legenda={`${lojas} ${lojas === 1 ? "loja" : "lojas"} · ${paginas} ${paginas === 1 ? "página de venda" : "páginas de venda"}`}
              />
              <Numero
                entrada={entrada(0.07)}
                Icone={Globe}
                rotulo="No ar"
                valor={projetosDaLoja.isLoading ? "–" : String(publicados)}
                legenda={ultimaPublicacao ? `Última publicação ${tempoRelativo(ultimaPublicacao)}` : "Nenhum site publicado ainda"}
              />
              <Numero
                entrada={entrada(0.1)}
                Icone={Clock3}
                rotulo="Esperando você"
                valor={projetosDaLoja.isLoading ? "–" : String(rascunhos.length)}
                legenda={rascunhoMaisAntigo ? `O mais antigo é de ${dataCurta(rascunhoMaisAntigo.created_at)}` : "Nada pendente"}
              />
              <Numero
                entrada={entrada(0.13)}
                Icone={Activity}
                rotulo="Mudanças na semana"
                valor={projetosDaLoja.isLoading ? "–" : String(mudancasDaSemana.length)}
                legenda={mudancasDaSemana[0] ? `A última ${tempoRelativo(mudancasDaSemana[0].quando)}` : "Nenhuma nos últimos 7 dias"}
              />
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.62fr)_minmax(0,1fr)]">
              {/* Coluna da esquerda: o que espera você e o andamento de cada site. */}
              <div className="flex min-w-0 flex-col gap-3">
                <Painel
                  titulo="Esperando você"
                  contagem={projetosDaLoja.isLoading ? undefined : rascunhos.length}
                  acao={rascunhos.length > 3 ? { rotulo: verTodosRascunhos ? "Ver menos" : "Ver todos", onClick: () => setVerTodosRascunhos((v) => !v) } : undefined}
                  entrada={entrada(0.16)}
                >
                  {projetosDaLoja.isLoading ? (
                    <LinhasCarregando quantas={2} />
                  ) : rascunhos.length === 0 ? (
                    <div className="flex items-center gap-3 px-5 py-4">
                      <img src={agenteSino} alt="" aria-hidden="true" draggable={false} className="h-9 w-9 shrink-0 object-contain" />
                      <span className="min-w-0">
                        <span className="block text-[14px] font-medium text-[#18181B]">Nada esperando você</span>
                        <span className="block text-[12.5px] text-[#71717A]">
                          {projetos.length === 0 ? "Crie um projeto para começar." : "Todos os seus sites estão no ar."}
                        </span>
                      </span>
                    </div>
                  ) : (
                    <ul className="m-0 list-none divide-y divide-[#F0F0F2] p-0">
                      {(verTodosRascunhos ? rascunhos : rascunhos.slice(0, 3)).map((projeto) => {
                        const { agente, falta } = etapaDoSite(projeto);
                        const ehLoja = projeto.tipo_projeto === "loja_completa";
                        return (
                          <li key={projeto.id} className="flex items-center gap-3 px-5 py-3">
                            <span className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-[6px]" style={{ background: ehLoja ? "#EAF1FF" : "#FDEBF3", color: ehLoja ? "#2563EB" : "#DB2777" }}>
                              <FileText aria-hidden="true" className="h-[13px] w-[13px]" strokeWidth={2} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[14px] font-medium text-[#18181B]">
                                Publicar {ehLoja ? "a loja" : "a página"} {projeto.nome}
                              </span>
                              <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[12px] text-[#71717A]">
                                <img src={agente} alt="" aria-hidden="true" draggable={false} className="h-3.5 w-3.5 shrink-0 object-contain" />
                                <span className="truncate">
                                  {falta} · rascunho de {dataCurta(projeto.created_at)}
                                </span>
                              </span>
                            </span>
                            <button
                              type="button"
                              onClick={() => abrirEditor(projeto)}
                              className="velo-proj-secundario h-8 shrink-0 rounded-full border border-[#E4E4E7] px-3.5 text-[13px] font-medium text-[#27272A]"
                              style={{ background: "#FFFFFF", boxShadow: "none" }}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => abrirEditor(projeto)}
                              className="velo-proj-novo h-8 shrink-0 rounded-full px-3.5 text-[13px] font-medium text-white"
                              style={{ background: "#2563EB", boxShadow: "none" }}
                            >
                              Continuar
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Painel>

                <Painel
                  titulo="Andamento dos sites"
                  contagem={projetosDaLoja.isLoading ? undefined : projetos.length}
                  acao={projetos.length > 0 ? { rotulo: "Ver atividade", onClick: () => setAba("atividade") } : undefined}
                  entrada={entrada(0.2)}
                >
                  {projetosDaLoja.isLoading ? (
                    <LinhasCarregando />
                  ) : projetosDaLoja.isError ? (
                    <p className="m-0 px-5 py-4 text-[14px] text-[#71717A]">Não foi possível carregar seus projetos agora.</p>
                  ) : projetos.length === 0 ? (
                    <div className="flex flex-col items-center px-6 pb-7 pt-5 text-center">
                      <MascoteVelo pose="acenando" altura={76} />
                      <p className="m-0 mt-3 text-[14.5px] font-semibold text-[#18181B]">Nenhum projeto ainda</p>
                      <p className="m-0 mt-1 max-w-sm text-[13px] text-[#71717A]">Crie o site da sua loja e acompanhe aqui cada etapa.</p>
                    </div>
                  ) : (
                    <ul className="m-0 list-none divide-y divide-[#F0F0F2] p-0">
                      {projetos.map((projeto) => {
                        const { etapa, agente, falta } = etapaDoSite(projeto);
                        const slug = etapa === 3 ? slugDoProjeto(projeto) : null;
                        return (
                          <li key={projeto.id}>
                            <button
                              type="button"
                              onClick={() => abrirEditor(projeto)}
                              className="velo-proj-linha-plana flex w-full items-center gap-3 px-5 py-3 text-left"
                              style={{ background: "transparent", boxShadow: "none" }}
                            >
                              <img src={agente} alt="" aria-hidden="true" draggable={false} className="h-7 w-7 shrink-0 select-none object-contain" />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[14px] font-medium text-[#18181B]">{projeto.nome}</span>
                                <span className="block truncate text-[12px] text-[#71717A]">
                                  {TIPO[projeto.tipo_projeto] ?? "Projeto"} · Etapa {etapa} de 3{slug ? ` · /loja/${slug}` : ""}
                                </span>
                              </span>
                              <span className="flex w-[104px] shrink-0 flex-col items-end gap-1.5">
                                <span className="h-[5px] w-full overflow-hidden rounded-full bg-[#ECEEF2]" role="progressbar" aria-valuemin={0} aria-valuemax={3} aria-valuenow={etapa} aria-label={`Etapa ${etapa} de 3`}>
                                  <motion.span
                                    className="block h-full rounded-full"
                                    style={{ background: etapa === 3 ? "#10B981" : "#2563EB" }}
                                    initial={reduzir ? false : { width: 0 }}
                                    animate={{ width: `${(etapa / 3) * 100}%` }}
                                    transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
                                  />
                                </span>
                                <span className="text-[11.5px] text-[#71717A]">{falta}</span>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Painel>
              </div>

              {/* Coluna da direita: atividade recente e atalhos. */}
              <div className="flex min-w-0 flex-col gap-3">
                <Painel titulo="Atividade recente" acao={eventos.length > 0 ? { rotulo: "Ver tudo", onClick: () => setAba("atividade") } : undefined} entrada={entrada(0.18)}>
                  {projetosDaLoja.isLoading ? (
                    <LinhasCarregando quantas={4} />
                  ) : eventos.length === 0 ? (
                    <p className="m-0 px-5 py-4 text-[13px] text-[#71717A]">Nenhuma atividade no site ainda.</p>
                  ) : (
                    <ul className="m-0 list-none divide-y divide-[#F0F0F2] p-0">
                      {eventos.slice(0, 4).map((evento) => {
                        const icone = ICONE_DA_ACAO[evento.tipo];
                        return (
                          <li key={evento.id}>
                            <button
                              type="button"
                              onClick={() => abrirEditor(evento.projeto)}
                              className="velo-proj-linha-plana flex w-full items-center gap-3 px-5 py-3 text-left"
                              style={{ background: "transparent", boxShadow: "none" }}
                            >
                              <span className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-[6px]" style={{ background: icone.fundo, color: icone.cor }}>
                                <icone.Icone aria-hidden="true" className="h-[13px] w-[13px]" strokeWidth={2} />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[14px] font-medium text-[#18181B]">{evento.projeto.nome}</span>
                                <span className="block truncate text-[12px] text-[#71717A]">
                                  {evento.acao} · {tempoRelativo(evento.quando)}
                                </span>
                              </span>
                              <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-[#A1A1AA]" />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Painel>

                <Painel titulo="Atalhos" contagem={atalhos.length} entrada={entrada(0.22)}>
                  <div className="grid grid-cols-3 gap-2 p-3">
                    {atalhos.map((atalho) => (
                      <button
                        key={atalho.titulo}
                        type="button"
                        onClick={atalho.acao}
                        className="velo-proj-atalho-tile flex min-w-0 flex-col items-start rounded-[12px] border border-[#EFEFF1] px-3 pb-2.5 pt-3 text-left"
                        style={{ background: "#F7F7F8", boxShadow: "none" }}
                      >
                        <img src={atalho.imagem} alt="" aria-hidden="true" draggable={false} className="velo-proj-agente h-7 w-7 select-none object-contain" />
                        <span className="mt-2 w-full truncate text-[13px] font-semibold text-[#18181B]">{atalho.titulo}</span>
                        <span className="mt-1.5 inline-flex h-5 items-center gap-1 rounded-full bg-[#E6EEFF] px-2 text-[11px] font-medium text-[#1D4ED8]">
                          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#2563EB]" />
                          {atalho.selo}
                        </span>
                      </button>
                    ))}
                  </div>
                </Painel>
              </div>
            </div>
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
