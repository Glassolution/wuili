import { useMemo, useState, type ElementType, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronRight, FilePlus2, FileText, Globe, PenLine } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { fetchUserProjects, type UserProject } from "@/lib/userProjects";
import { useProfile } from "@/lib/profileContext";
import agenteLua from "@/assets/agentes/lua.png";
import agenteCubo from "@/assets/agentes/cubo.png";
import agenteFolha from "@/assets/agentes/folha.png";
import agenteSino from "@/assets/agentes/sino.png";
import agenteConcha from "@/assets/agentes/concha.png";
import agenteEstrela from "@/assets/agentes/estrela.png";

/*
  Projetos (`/dashboard/projetos`), copiando o painel de agentes da referência do dono
  (25/11/2026), sem o chat de IA: data e saudação, três cards dos agentes, "Precisa de você",
  "Em andamento", "Atividade recente" e "Atalhos". Fundo cinza claro e cartões brancos.

  Tudo vem do RPC `get_user_projects` (`fetchUserProjects`, a mesma leitura da sidebar),
  sem consulta nova. O banco não guarda agentes nem tarefas rodando: a foto do agente
  segue o tipo de trabalho (lua = rascunho, cubo = edição, folha = publicação) e o
  "andamento" é a etapa real do site (criado, editado, no ar), não uma estimativa.
*/

const PAGINA_CSS = `
.velo-proj-root, .velo-proj-root * { font-feature-settings: normal !important; }
.velo-proj-root h1, .velo-proj-root h2 { font-family: "Inter", ui-sans-serif, system-ui, sans-serif !important; }
.velo-proj-linha { transition: background-color 120ms ease-out; }
.velo-proj-linha:hover { background: #FAFAFB !important; }
.velo-proj-root li:last-child > .velo-proj-linha { border-bottom-left-radius: 13px; border-bottom-right-radius: 13px; }
.velo-proj-link { transition: color 120ms ease-out; }
.velo-proj-link:hover { color: #18181B !important; }
.velo-proj-contorno { transition: background-color 120ms ease-out, border-color 120ms ease-out; }
.velo-proj-contorno:hover { background: #F4F4F5 !important; border-color: #D4D4D8 !important; }
.velo-proj-azul { transition: background-color 120ms ease-out; }
.velo-proj-azul:hover { background: #1D4ED8 !important; }
.velo-proj-bloco { transition: background-color 150ms ease-out, box-shadow 150ms ease-out; }
.velo-proj-bloco:hover { background: #EFEFF1 !important; }
.velo-proj-card-agente { transition: border-color 150ms ease-out, box-shadow 200ms ease-out, transform 200ms cubic-bezier(0.22, 1, 0.36, 1); }
.velo-proj-card-agente:hover { border-color: #C7D2FE !important; box-shadow: 0 10px 24px -14px rgba(37,99,235,0.35) !important; transform: translateY(-1px); }
.velo-proj-card-agente-img { transition: transform 250ms cubic-bezier(0.22, 1, 0.36, 1); }
.velo-proj-card-agente:hover .velo-proj-card-agente-img { transform: translateY(-2px) scale(1.04); }
.velo-proj-root button:focus-visible { outline: none; box-shadow: 0 0 0 2px #FFFFFF, 0 0 0 4px rgba(37,99,235,0.45) !important; }
`;

// "24 nov", ou "21 jul 2025" quando é de outro ano.
const dataCurta = (iso: string) => {
  const data = new Date(iso);
  const mes = data.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  const ano = data.getFullYear() === new Date().getFullYear() ? "" : ` ${data.getFullYear()}`;
  return `${data.getDate()} ${mes}${ano}`;
};

// "há 5 min", "há 3 h", "há 2 d" e a data curta para o que passou de uma semana.
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

const slugDoProjeto = (projeto: UserProject) => {
  const meta = projeto.metadata;
  const slug = meta && typeof meta === "object" && !Array.isArray(meta) ? (meta as Record<string, unknown>).slug : null;
  return typeof slug === "string" && slug.trim() ? slug.trim() : null;
};

const TIPO = { loja_completa: "Loja completa", pagina_venda: "Página de venda" } as const;

const foiEditado = (projeto: UserProject) =>
  Boolean(projeto.last_edited_at && new Date(projeto.last_edited_at).getTime() - new Date(projeto.created_at).getTime() > 60_000);

const quandoMexeu = (projeto: UserProject) => projeto.last_edited_at ?? projeto.published_at ?? projeto.created_at;

type TipoEvento = "criado" | "editado" | "publicado";
type Evento = { id: string; tipo: TipoEvento; acao: string; quando: string; projeto: UserProject };

const eventosDoSite = (projetos: UserProject[]): Evento[] => {
  const eventos: Evento[] = [];
  for (const projeto of projetos) {
    eventos.push({ id: `${projeto.id}-criado`, tipo: "criado", acao: "Rascunho criado", quando: projeto.created_at, projeto });
    if (foiEditado(projeto) && projeto.last_edited_at) {
      eventos.push({ id: `${projeto.id}-editado`, tipo: "editado", acao: "Site atualizado", quando: projeto.last_edited_at, projeto });
    }
    if (projeto.published_at) {
      eventos.push({ id: `${projeto.id}-publicado`, tipo: "publicado", acao: "Site publicado", quando: projeto.published_at, projeto });
    }
  }
  return eventos.sort((a, b) => new Date(b.quando).getTime() - new Date(a.quando).getTime());
};

// Ícone cheio e colorido do tipo de trabalho, como os ícones de arquivo da referência.
const ICONE_DO_EVENTO: Record<TipoEvento, { Icone: ElementType; cor: string }> = {
  criado: { Icone: FilePlus2, cor: "#16A34A" },
  editado: { Icone: PenLine, cor: "#F97316" },
  publicado: { Icone: Globe, cor: "#2563EB" },
};

// Etapa do site: 1 criado, 2 editado, 3 no ar.
const etapaDoSite = (projeto: UserProject) => {
  if (projeto.status === "publicado") return { etapa: 3, agente: agenteFolha, falta: "No ar" };
  return foiEditado(projeto) ? { etapa: 2, agente: agenteCubo, falta: "Falta publicar" } : { etapa: 1, agente: agenteLua, falta: "Falta personalizar" };
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

type Entrada = Record<string, unknown>;

const SOMBRA = { boxShadow: "0 1px 2px rgba(16,24,40,0.04)" };

// Quadradinho colorido com ícone branco (arquivos e pedidos da referência).
const IconeCheio = ({ Icone, cor }: { Icone: ElementType; cor: string }) => (
  <span className="grid h-4 w-4 shrink-0 place-items-center rounded-[4px] text-white" style={{ background: cor }}>
    <Icone aria-hidden="true" className="h-[10px] w-[10px]" strokeWidth={2.4} />
  </span>
);

// Cartão com título, contagem e link à direita ("Needs your approval  3 ... See all").
const Painel = ({
  titulo,
  contagem,
  acao,
  entrada,
  className = "",
  children,
}: {
  className?: string;
  titulo: string;
  contagem?: number;
  acao?: { rotulo: string; onClick: () => void };
  entrada: Entrada;
  children: ReactNode;
}) => (
  <motion.section {...entrada} aria-label={titulo} className={`flex flex-col rounded-[14px] border border-[#E7E7EA] bg-white ${className}`} style={SOMBRA}>
    <header className="flex items-center justify-between gap-3 px-4 pb-2 pt-4">
      <h2 className="m-0 flex items-center gap-2 text-[14px] font-semibold tracking-[-0.005em] text-[#18181B]">
        {titulo}
        {contagem !== undefined ? (
          <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#F0F0F2] px-1.5 text-[11px] font-medium text-[#52525B]">{contagem}</span>
        ) : null}
      </h2>
      {acao ? (
        <button
          type="button"
          onClick={acao.onClick}
          className="velo-proj-link text-[12.5px] font-medium text-[#3F3F46]"
          style={{ background: "transparent", boxShadow: "none", padding: 0 }}
        >
          {acao.rotulo}
        </button>
      ) : null}
    </header>
    {children}
  </motion.section>
);

const Carregando = ({ quantas = 3 }: { quantas?: number }) => (
  <div aria-hidden="true" className="pb-1">
    {Array.from({ length: quantas }, (_, i) => (
      <div key={i} className="flex items-center gap-3 border-t border-[#F0F0F2] px-4 py-3 first:border-t-0">
        <span className="h-5 w-5 shrink-0 animate-pulse rounded-full bg-[#F1F3F6]" />
        <span className="flex-1 space-y-1.5">
          <span className="block h-2.5 w-36 animate-pulse rounded-full bg-[#F1F3F6]" />
          <span className="block h-2 w-24 animate-pulse rounded-full bg-[#F5F6F8]" />
        </span>
      </div>
    ))}
  </div>
);

const ProjetosPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const reduzir = !!useReducedMotion();
  const [verTodosPendentes, setVerTodosPendentes] = useState(false);
  const [verTodaAtividade, setVerTodaAtividade] = useState(false);
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
  const carregando = projetosDaLoja.isLoading;

  const projetos = useMemo(() => {
    const lista = [...(projetosDaLoja.data ?? [])];
    lista.sort((a, b) => new Date(quandoMexeu(b)).getTime() - new Date(quandoMexeu(a)).getTime());
    return lista;
  }, [projetosDaLoja.data]);

  const rascunhos = projetos.filter((p) => p.status !== "publicado").sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const eventos = eventosDoSite(projetos);
  const mudancasDaSemana = eventos.filter((e) => Date.now() - new Date(e.quando).getTime() < SEMANA_MS);

  const criarProjeto = () => navigate("/dashboard/minha-loja", { state: { abrirCriacao: true } });
  const abrirEditor = (projeto: UserProject) =>
    navigate(`/minha-loja/editor/${projeto.id}`, { state: { projectId: projeto.id, sourceId: projeto.source_id } });

  const entrada = (atraso: number): Entrada =>
    reduzir
      ? { initial: false }
      : {
          initial: { opacity: 0, y: 6 },
          animate: { opacity: 1, y: 0 },
          transition: { delay: atraso, duration: 0.35, ease: [0.22, 1, 0.36, 1] },
        };

  const cardsDosAgentes: { titulo: string; texto: string; imagem: string; fundo: string; acao: () => void }[] = [
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

  // No lugar de "Your agents": seis atalhos, cada um com um agente e um selo.
  const atalhos: { titulo: string; selo: string; imagem: string; acao: () => void }[] = [
    { titulo: "Novo site", selo: "Criar", imagem: agenteLua, acao: criarProjeto },
    { titulo: "Modelos", selo: "Visual", imagem: agenteCubo, acao: () => navigate("/dashboard/modelos") },
    { titulo: "Página IA", selo: "Vender", imagem: agenteFolha, acao: () => navigate("/dashboard/paginas-com-ia/criar") },
    { titulo: "Catálogo", selo: "Produtos", imagem: agenteConcha, acao: () => navigate("/dashboard/catalogo") },
    { titulo: "Publicações", selo: "Anúncios", imagem: agenteSino, acao: () => navigate("/dashboard/publicacoes") },
    { titulo: "Afiliados", selo: "Indicar", imagem: agenteEstrela, acao: () => navigate("/dashboard/comissoes") },
  ];

  const resumo = carregando
    ? "Carregando seus projetos…"
    : projetos.length === 0
      ? "Você ainda não tem projetos. Crie o primeiro e os agentes cuidam do resto."
      : `${rascunhos.length === 0 ? "Todos os sites estão no ar." : rascunhos.length === 1 ? "1 site espera você publicar." : `${rascunhos.length} sites esperam você publicar.`} ${
          mudancasDaSemana.length === 0
            ? "Nenhuma mudança nos últimos 7 dias."
            : `Os agentes fizeram ${mudancasDaSemana.length} ${mudancasDaSemana.length === 1 ? "mudança" : "mudanças"} nesta semana.`
        }`;

  return (
    <main className="velo-proj-root velo-fonte-inter flex shrink-0 flex-col overflow-auto bg-[#F6F6F7] text-[#18181B] -m-5 min-h-[calc(100%+2.5rem)] sm:-m-6 sm:min-h-[calc(100%+3rem)] lg:-m-7 lg:min-h-[calc(100%+3.5rem)]">
      <style>{PAGINA_CSS}</style>

      <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col px-6 pb-6 pt-6">
        {/* Data, saudação e resumo. */}
        <motion.div {...entrada(0)}>
          <p className="m-0 text-[12px] text-[#71717A]">{hojePorExtenso()}</p>
          <h1 className="m-0 mt-1.5 text-[26px] font-semibold leading-8 tracking-[-0.025em]">
            {saudacao()}
            {primeiroNome ? `, ${primeiroNome}` : ""}
          </h1>
          <p className="m-0 mt-1.5 text-[13px] text-[#71717A]">{resumo}</p>
        </motion.div>

        {/* Três cards com os agentes (atalhos principais). */}
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          {cardsDosAgentes.map((card, i) => (
            <motion.button
              key={card.titulo}
              type="button"
              onClick={card.acao}
              {...entrada(0.04 + i * 0.04)}
              className="velo-proj-card-agente flex min-h-[104px] overflow-hidden rounded-[14px] border border-[#E7E7EA] bg-white text-left"
              style={SOMBRA}
            >
              <span className="grid w-[100px] shrink-0 place-items-center border-r border-[#EDEDF0] bg-[#FAFAFB]">
                <span
                  className="grid h-[68px] w-[68px] place-items-center overflow-hidden rounded-full"
                  style={{ background: card.fundo, boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.7), 0 4px 10px -4px rgba(16,24,40,0.15)" }}
                >
                  <img src={card.imagem} alt="" aria-hidden="true" draggable={false} className="velo-proj-card-agente-img h-11 w-11 select-none object-contain" />
                </span>
              </span>
              <span className="flex min-w-0 flex-1 flex-col justify-center px-4 py-3">
                <span className="text-[15px] font-semibold leading-5 tracking-[-0.01em] text-[#18181B]">{card.titulo}</span>
                <span className="mt-1 text-[13px] leading-[19px] text-[#71717A]">{card.texto}</span>
              </span>
            </motion.button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-4">
            {/* "Needs your approval": rascunhos esperando publicação. */}
            <Painel
              titulo="Precisa de você"
              contagem={carregando ? undefined : rascunhos.length}
              acao={rascunhos.length > 3 ? { rotulo: verTodosPendentes ? "Ver menos" : "Ver todos", onClick: () => setVerTodosPendentes((v) => !v) } : undefined}
              entrada={entrada(0.16)}
            >
              {carregando ? (
                <Carregando quantas={2} />
              ) : rascunhos.length === 0 ? (
                <p className="m-0 px-4 pb-4 pt-1 text-[12.5px] text-[#71717A]">
                  {projetos.length === 0 ? "Nada por aqui ainda. Crie um projeto para começar." : "Nada esperando você: todos os sites estão no ar."}
                </p>
              ) : (
                <ul className="m-0 list-none p-0 pb-1">
                  {(verTodosPendentes ? rascunhos : rascunhos.slice(0, 3)).map((projeto) => {
                    const { agente, falta } = etapaDoSite(projeto);
                    const ehLoja = projeto.tipo_projeto === "loja_completa";
                    return (
                      <li key={projeto.id} className="flex items-center gap-3 border-t border-[#F0F0F2] px-4 py-3 first:border-t-0">
                        <IconeCheio Icone={FileText} cor={ehLoja ? "#2563EB" : "#EC4899"} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] font-medium text-[#18181B]">
                            Publicar {ehLoja ? "a loja" : "a página"} {projeto.nome}
                          </span>
                          <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] text-[#8A8A93]">
                            <img src={agente} alt="" aria-hidden="true" draggable={false} className="h-3 w-3 shrink-0 object-contain" />
                            <span className="truncate">
                              {falta} · {dataCurta(projeto.created_at)}
                            </span>
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => abrirEditor(projeto)}
                          className="velo-proj-contorno h-7 shrink-0 rounded-full border border-[#E4E4E7] px-3 text-[12px] font-medium text-[#27272A]"
                          style={{ background: "#FFFFFF", boxShadow: "none" }}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => abrirEditor(projeto)}
                          className="velo-proj-azul h-7 shrink-0 rounded-full px-3 text-[12px] font-medium text-white"
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

            {/* "Running now": a etapa real de cada site. */}
            <Painel
              titulo="Em andamento"
              contagem={carregando ? undefined : projetos.length}
              acao={{ rotulo: "Ver projetos", onClick: () => navigate("/dashboard/minha-loja") }}
              entrada={entrada(0.2)}
              className="flex-1"
            >
              {carregando ? (
                <Carregando />
              ) : projetosDaLoja.isError ? (
                <p className="m-0 px-4 pb-4 pt-1 text-[12.5px] text-[#71717A]">Não foi possível carregar seus projetos agora.</p>
              ) : projetos.length === 0 ? (
                <div className="flex items-center justify-between gap-3 px-4 pb-4 pt-1">
                  <p className="m-0 text-[12.5px] text-[#71717A]">Nenhum site em andamento.</p>
                  <button
                    type="button"
                    onClick={criarProjeto}
                    className="velo-proj-azul h-7 shrink-0 rounded-full px-3 text-[12px] font-medium text-white"
                    style={{ background: "#2563EB", boxShadow: "none" }}
                  >
                    Criar projeto
                  </button>
                </div>
              ) : (
                <ul className="m-0 list-none p-0 pb-1">
                  {projetos.map((projeto) => {
                    const { etapa, agente, falta } = etapaDoSite(projeto);
                    const slug = etapa === 3 ? slugDoProjeto(projeto) : null;
                    return (
                      <li key={projeto.id} className="border-t border-[#F0F0F2] first:border-t-0">
                        <button
                          type="button"
                          onClick={() => abrirEditor(projeto)}
                          className="velo-proj-linha flex w-full items-center gap-3 px-4 py-3 text-left"
                          style={{ background: "transparent", boxShadow: "none" }}
                        >
                          <img src={agente} alt="" aria-hidden="true" draggable={false} className="h-[22px] w-[22px] shrink-0 select-none object-contain" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13.5px] font-medium text-[#18181B]">{projeto.nome}</span>
                            <span className="mt-0.5 block truncate text-[11px] text-[#8A8A93]">
                              {TIPO[projeto.tipo_projeto] ?? "Projeto"} · Etapa {etapa} de 3{slug ? ` · /loja/${slug}` : ""}
                            </span>
                          </span>
                          <span className="flex w-[84px] shrink-0 flex-col items-end">
                            <span
                              className="h-1 w-full overflow-hidden rounded-full bg-[#E9EAEE]"
                              role="progressbar"
                              aria-valuemin={0}
                              aria-valuemax={3}
                              aria-valuenow={etapa}
                              aria-label={`Etapa ${etapa} de 3`}
                            >
                              <motion.span
                                className="block h-full rounded-full bg-[#2563EB]"
                                initial={reduzir ? false : { width: 0 }}
                                animate={{ width: `${(etapa / 3) * 100}%` }}
                                transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
                              />
                            </span>
                            <span className="mt-1.5 text-[10.5px] text-[#8A8A93]">{falta}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Painel>
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            {/* "Recent files": o trabalho mais recente nos sites. */}
            <Painel
              titulo="Atividade recente"
              acao={eventos.length > 4 ? { rotulo: verTodaAtividade ? "Ver menos" : "Ver tudo", onClick: () => setVerTodaAtividade((v) => !v) } : undefined}
              entrada={entrada(0.18)}
            >
              {carregando ? (
                <Carregando quantas={4} />
              ) : eventos.length === 0 ? (
                <p className="m-0 px-4 pb-4 pt-1 text-[12.5px] text-[#71717A]">Nenhuma atividade no site ainda.</p>
              ) : (
                <ul className="m-0 list-none p-0 pb-1">
                  {eventos.slice(0, verTodaAtividade ? 20 : 4).map((evento) => {
                    const icone = ICONE_DO_EVENTO[evento.tipo];
                    return (
                      <li key={evento.id} className="border-t border-[#F0F0F2] first:border-t-0">
                        <button
                          type="button"
                          onClick={() => abrirEditor(evento.projeto)}
                          className="velo-proj-linha flex w-full items-center gap-3 px-4 py-3 text-left"
                          style={{ background: "transparent", boxShadow: "none" }}
                        >
                          <IconeCheio Icone={icone.Icone} cor={icone.cor} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13.5px] font-medium text-[#18181B]">{evento.projeto.nome}</span>
                            <span className="mt-0.5 block truncate text-[11px] text-[#8A8A93]">
                              {evento.acao} · {tempoRelativo(evento.quando)}
                            </span>
                          </span>
                          <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[#A1A1AA]" strokeWidth={2} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Painel>

            {/* "Your agents": atalhos com os agentes. */}
            <Painel titulo="Atalhos" contagem={atalhos.length} entrada={entrada(0.22)} className="flex-1">
              <div className="grid grid-cols-3 gap-2 px-3 pb-3 pt-1.5">
                {atalhos.map((atalho) => (
                  <button
                    key={atalho.titulo}
                    type="button"
                    onClick={atalho.acao}
                    className="velo-proj-bloco flex min-w-0 flex-col items-start rounded-[10px] p-2.5 text-left"
                    style={{ background: "#F4F4F5", boxShadow: "none" }}
                  >
                    <img src={atalho.imagem} alt="" aria-hidden="true" draggable={false} className="h-[22px] w-[22px] select-none object-contain" />
                    <span className="mt-2 w-full truncate text-[12.5px] font-medium text-[#18181B]">{atalho.titulo}</span>
                    <span className="mt-1.5 inline-flex h-[18px] items-center gap-1 rounded-full bg-[#E3EDFF] px-1.5 text-[10.5px] font-medium text-[#2563EB]">
                      <span aria-hidden="true" className="h-[5px] w-[5px] rounded-full bg-[#2563EB]" />
                      {atalho.selo}
                    </span>
                  </button>
                ))}
              </div>
            </Painel>
          </div>
        </div>
      </div>
    </main>
  );
};

export default ProjetosPage;
