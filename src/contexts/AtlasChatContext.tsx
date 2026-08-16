import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { veloToast } from "@/components/ui/velo-toast";
import { atlasThreadsQueryKey } from "@/lib/atlasHistory";
import { AtlasFireworks } from "@/components/dashboard/AtlasFireworks";


/**
 * Estado do chat do Atlas, um nível acima das páginas.
 *
 * Antes tudo isso vivia dentro da DashboardHomePage, então qualquer navegação
 * desmontava o componente e levava junto a conversa e o progresso do guia — o
 * usuário clicava numa categoria e voltava do zero. Montado no layout, o chat
 * sobrevive à troca de rota e vira um painel fixo à direita.
 */

export type AtlasMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  product_data?: { actions?: AtlasAction[] } | null;
};

export type AtlasNavigationAction = {
  type: "navigation";
  label: string;
  route: string;
  reason?: string;
  variant?: "primary";
};

export type AtlasProductCardAction = {
  type: "product_card";
  product_id: string;
  reason?: string;
  product?: {
    id?: string;
    title?: string;
    image_url?: string | null;
    margin_percent?: number | null;
    suggested_price?: number | null;
    route?: string;
  };
};

export type AtlasQuickReplyAction = { type: "quick_reply"; label: string; message: string };
/** Nicho confirmado na conversa, usado para filtrar a vitrine. */
export type NichoDaVitrine = { id: string; label: string; catalogTerms: string[] };
/** Abre a vitrine de produtos do guia, já filtrada pelo nicho confirmado. */
export type AtlasOpenShowcaseAction = { type: "open_showcase"; label: string; niche?: NichoDaVitrine };
export type AtlasConnectMlAction = { type: "connect_ml"; label: string };

export type AtlasAction =
  | AtlasNavigationAction
  | AtlasProductCardAction
  | AtlasQuickReplyAction
  | AtlasConnectMlAction
  | AtlasOpenShowcaseAction;

/**
 * Saldo diário de mensagens do Atlas, devolvido pela função em toda resposta.
 * `limite: null` = plano sem teto (Business).
 */
export type AtlasQuota = {
  plano: string;
  limite: number | null;
  usadas: number;
  restantes: number | null;
  permitido: boolean;
};

type AtlasFunctionResponse = {
  message?: string;
  error?: string;
  actions?: AtlasAction[];
  quota?: AtlasQuota;
  quotaExcedida?: boolean;
};

const isAtlasQuota = (value: unknown): value is AtlasQuota => {
  if (!value || typeof value !== "object") return false;
  const q = value as Record<string, unknown>;
  return typeof q.plano === "string" && typeof q.usadas === "number";
};

const isAtlasAction = (action: unknown): action is AtlasAction => {
  if (!action || typeof action !== "object") return false;
  const c = action as Record<string, unknown>;
  if (c.type === "navigation") return typeof c.label === "string" && typeof c.route === "string";
  if (c.type === "product_card") return typeof c.product_id === "string";
  if (c.type === "quick_reply") return typeof c.label === "string" && typeof c.message === "string";
  if (c.type === "connect_ml") return typeof c.label === "string";
  if (c.type === "open_showcase") return typeof c.label === "string";
  return false;
};

export const normalizeAtlasActions = (value: unknown): AtlasAction[] =>
  Array.isArray(value) ? value.filter(isAtlasAction).slice(0, 12) : [];

export const getMessageActions = (message: AtlasMessage) =>
  normalizeAtlasActions(message.product_data?.actions);

/**
 * Nome legível da tela atual, enviado ao Atlas junto das mensagens.
 *
 * É o que permite ele continuar guiando "de acordo com o que a pessoa está
 * vendo" em vez de responder no vácuo depois de uma navegação.
 */
const descreverPagina = (pathname: string): { rota: string; nome: string } => {
  const mapa: Array<[RegExp, string]> = [
    [/^\/dashboard\/atlas\/[^/]+$/, "conversa específica com o Atlas"],
    [/^\/dashboard\/atlas/, "chat do Atlas"],
    [/^\/dashboard\/catalogo\/[^/]+$/, "detalhe de um produto do catálogo"],
    [/^\/dashboard\/catalogo/, "catálogo de produtos"],
    [/^\/dashboard\/produtos-ml/, "produtos do Mercado Livre"],
    [/^\/dashboard\/produtos$/, "produtos importados"],
    [/^\/dashboard\/publicacoes\/[^/]+$/, "detalhe de uma publicação"],
    [/^\/dashboard\/publicacoes/, "publicações"],
    [/^\/dashboard\/pedidos/, "pedidos"],
    [/^\/dashboard\/orders\/[^/]+$/, "detalhe de um pedido"],
    [/^\/dashboard\/saldos/, "saldos"],
    [/^\/dashboard\/transacoes/, "transações"],
    [/^\/dashboard\/comissoes/, "comissões"],
    [/^\/dashboard\/pagamentos/, "pagamentos"],
    [/^\/dashboard\/clientes/, "clientes"],
    [/^\/dashboard\/imagens-ia/, "geração de imagens com IA"],
    [/^\/dashboard\/tiktok/, "influencers de IA para TikTok"],
    [/^\/dashboard\/personagem-video/, "personagem de vídeo"],
    [/^\/dashboard\/integracoes\/adicionar/, "adicionar integração"],
    [/^\/dashboard\/integracoes/, "integrações"],
    [/^\/dashboard\/planos/, "planos"],
    [/^\/dashboard\/modelos/, "modelos de loja"],
    [/^\/dashboard\/paginas-com-ia/, "páginas com IA"],
    [/^\/dashboard\/produtos-em-alta/, "produtos em alta"],
    [/^\/dashboard\/resultados/, "resultados"],
    [/^\/dashboard\/mais/, "mais opções"],
    [/^\/dashboard\/criar-video/, "criação de vídeo"],
    [/^\/dashboard\/chat-fornecedores/, "chat com fornecedores"],
    [/^\/dashboard\/minha-loja/, "minha loja"],
    [/^\/dashboard\/configuracoes/, "configurações"],
    [/^\/dashboard\/?$/, "início do painel"],
  ];
  const encontrado = mapa.find(([padrao]) => padrao.test(pathname));
  return { rota: pathname, nome: encontrado?.[1] ?? "uma tela do painel" };
};

/** O guia se identifica pelo marcador "Passo N de 5" na última fala do Atlas. */
export const guiaEstaAtivo = (mensagens: AtlasMessage[]) => {
  const ultimaDoAtlas = [...mensagens].reverse().find((m) => m.role === "assistant");
  return /passo\s*[1-5]\s*de\s*5/i.test(ultimaDoAtlas?.content ?? "");
};

/**
 * Como o chat se apresenta.
 *
 * "centralizado" é o padrão: ocupa a área de conteúdo, como sempre foi.
 * "lateral" é a exceção e só acontece quando o usuário navega para outra página
 * com o chat aberto — aí a página de destino precisa do espaço à esquerda.
 */
export type ModoDoAtlas = "centralizado" | "lateral";

/** Produto escolhido no catálogo durante o guia. */
export type ProdutoDoGuia = {
  id: string;
  nome: string;
  categoria: string;
  preco: number;
  /** Foto do card, para o Atlas mostrar o produto e não um ícone genérico. */
  imagem?: string | null;
};

type AtlasChatContextValue = {
  aberto: boolean;
  modo: ModoDoAtlas;
  mensagens: AtlasMessage[];
  enviando: boolean;
  carregandoConversa: boolean;
  erro: string | null;
  threadId: string | null;
  guiaAtivo: boolean;
  paginaAtual: { rota: string; nome: string };
  /** Saldo de mensagens do dia; null enquanto nenhuma resposta chegou ainda. */
  quota: AtlasQuota | null;
  produtoSelecionado: ProdutoDoGuia | null;
  selecionarProduto: (produto: ProdutoDoGuia) => Promise<void>;
  /**
   * Vitrine de produtos do guia. Durante o guia, "Abrir Catálogo" mostra uma
   * seleção feita a partir do quiz de cadastro em vez de largar o iniciante na
   * grade inteira do catálogo.
   */
  vitrineAberta: boolean;
  /** Nicho confirmado no guia; a vitrine cruza ele com o perfil do cadastro. */
  nichoDaVitrine: NichoDaVitrine | null;
  abrirVitrine: (nicho?: NichoDaVitrine | null) => void;
  fecharVitrine: () => void;
  abrir: () => void;
  abrirLateral: () => void;
  fechar: () => void;
  novaConversa: () => void;
  enviar: (texto: string, produtoDoCatalogo?: ProdutoDoGuia) => Promise<void>;
  abrirConversa: (threadId: string) => Promise<void>;
  /** Navegação por link interno (#catalogo etc.) preservando a conversa. */
  navegarPorLink: (rota: string) => Promise<void>;
  aoApagarConversa: (threadId: string) => void;
};

const AtlasChatContext = createContext<AtlasChatContextValue | null>(null);

/** Easter egg: menção à Andrya no chat. Ignora acento, caixa e pontuação. */
const ehEasterEggAndrya = (texto: string) =>
  /\bandry?a\b/.test(
    texto
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase(),
  );

const MENSAGEM_ANDRYA =
  "Andrya 💚\n\nTem nome que muda o clima da conversa — esse é um deles. Alguém aí gosta MUITO dela, e dá pra sentir daqui.\n\nEntão vai um pouquinho de festa por conta da casa: Andrya, você é especial. 🎆";


/**
 * Próximo passo concreto de cada tela.
 *
 * Vai junto do `pageContext` para a IA responder algo específico da página em
 * que a pessoa acabou de chegar, em vez de um texto genérico reaproveitado.
 */
const PROXIMO_PASSO: Array<[RegExp, string]> = [
  [/^\/dashboard\/catalogo\/[^/]+/, "Ver preço, margem e fotos do produto e clicar em Importar produto."],
  [/^\/dashboard\/catalogo/, "Filtrar por categoria e preço, abrir um produto com boa margem e clicar em Importar produto."],
  [/^\/dashboard\/produtos-em-alta/, "Escolher entre os produtos com mais procura agora um que combine com o público dele e importar."],
  [/^\/dashboard\/paginas-com-ia/, "Clicar em Criar página, escolher o produto e revisar o texto de venda que a IA escreve."],
  [/^\/dashboard\/modelos/, "Escolher um template que combine com o produto e clicar em Usar este modelo."],
  [/^\/dashboard\/publicacoes/, "Conferir os anúncios, ver se algum está pausado e resolver o motivo apontado no card."],
  [/^\/dashboard\/produtos-ml/, "Conferir estoque e preço dos anúncios sincronizados do Mercado Livre."],
  [/^\/dashboard\/pedidos/, "Acompanhar as vendas e repassar cada pedido ao fornecedor pelo botão do card."],
  [/^\/dashboard\/imagens-ia/, "Enviar a foto do produto para a IA gerar versões prontas para o anúncio."],
  [/^\/dashboard\/tiktok/, "Criar um personagem de IA e gerar vídeos curtos para divulgar o produto."],
  [/^\/dashboard\/integracoes/, "Clicar em Conectar no Mercado Livre para autorizar a conta."],
  [/^\/dashboard\/pagamentos/, "Configurar como ele recebe para deixar o checkout ativo."],
  [/^\/dashboard\/planos/, "Comparar os planos e escolher o que cabe agora."],
  [/^\/dashboard\/saldos/, "Conferir o saldo disponível e o que ainda está a liberar."],
  [/^\/dashboard\/transacoes/, "Conferir entradas e saídas da conta por período."],
  [/^\/dashboard\/configuracoes/, "Ajustar dados e preferências e salvar no fim da tela."],
  [/^\/dashboard\/chat-fornecedores/, "Falar com o fornecedor sobre estoque, prazo e envio."],
  [/^\/dashboard\/resultados/, "Acompanhar visitas e vendas para saber onde investir mais."],
  [/^\/dashboard\/?$/, "Escolher o próximo passo a partir do início do painel."],
];

const proximoPassoDaPagina = (rota: string) =>
  PROXIMO_PASSO.find(([padrao]) => padrao.test(rota))?.[1] ?? null;

/** Nome curto da tela, do jeito que aparece no menu, para a pergunta automática. */
const NOME_CURTO: Array<[RegExp, string]> = [
  [/^\/dashboard\/catalogo\/[^/]+/, "Detalhe do Produto"],
  [/^\/dashboard\/catalogo/, "Catálogo"],
  [/^\/dashboard\/produtos-em-alta/, "Produtos em Alta"],
  [/^\/dashboard\/paginas-com-ia/, "Páginas com IA"],
  [/^\/dashboard\/modelos/, "Modelos de Loja"],
  [/^\/dashboard\/publicacoes/, "Publicações"],
  [/^\/dashboard\/produtos-ml/, "Produtos do Mercado Livre"],
  [/^\/dashboard\/produtos/, "Meus Produtos"],
  [/^\/dashboard\/pedidos/, "Pedidos"],
  [/^\/dashboard\/imagens-ia/, "Imagens com IA"],
  [/^\/dashboard\/tiktok/, "TikTok"],
  [/^\/dashboard\/integracoes/, "Integrações"],
  [/^\/dashboard\/pagamentos/, "Pagamentos"],
  [/^\/dashboard\/planos/, "Planos"],
  [/^\/dashboard\/saldos/, "Saldos"],
  [/^\/dashboard\/transacoes/, "Transações"],
  [/^\/dashboard\/comissoes/, "Comissões"],
  [/^\/dashboard\/clientes/, "Clientes"],
  [/^\/dashboard\/minha-loja/, "Minha Loja"],
  [/^\/dashboard\/configuracoes/, "Configurações"],
  [/^\/dashboard\/chat-fornecedores/, "Chat com Fornecedores"],
  [/^\/dashboard\/resultados/, "Resultados"],
  [/^\/dashboard\/?$/, "Início"],
];

export const nomeCurtoDaPagina = (rota: string) =>
  NOME_CURTO.find(([padrao]) => padrao.test(rota))?.[1] ?? descreverPagina(rota).nome;

/**
 * Pergunta que entra no chat como se o próprio usuário tivesse escrito, assim
 * que ele chega numa página por um botão do Atlas.
 */
const perguntaDaPagina = (rota: string) => `Estou na página de ${nomeCurtoDaPagina(rota)}, e agora?`;


export const AtlasChatProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();


  const sessaoRef = useRef(0);
  const [aberto, setAberto] = useState(false);
  // Rota em que o chat foi aberto. Enquanto o usuário continuar nela, o modo é
  // centralizado; sair dela é o que promove o chat a painel lateral.
  const [rotaDeAbertura, setRotaDeAbertura] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<AtlasMessage[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [carregandoConversa, setCarregandoConversa] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [produtoSelecionado, setProdutoSelecionado] = useState<ProdutoDoGuia | null>(null);
  const [vitrineAberta, setVitrineAberta] = useState(false);
  const [nichoDaVitrine, setNichoDaVitrine] = useState<NichoDaVitrine | null>(null);
  const [quota, setQuota] = useState<AtlasQuota | null>(null);
  const [fogosAtivos, setFogosAtivos] = useState(false);

  const abrirVitrine = useCallback((nicho?: NichoDaVitrine | null) => {
    if (nicho !== undefined) setNichoDaVitrine(nicho);
    setVitrineAberta(true);
  }, []);
  const fecharVitrine = useCallback(() => setVitrineAberta(false), []);

  const paginaAtual = useMemo(() => {
    const pagina = descreverPagina(location.pathname);
    return { ...pagina, rota: `${location.pathname}${location.search}` };
  }, [location.pathname, location.search]);
  const guiaAtivo = useMemo(() => guiaEstaAtivo(mensagens), [mensagens]);
  const modo: ModoDoAtlas =
    aberto && rotaDeAbertura !== null && rotaDeAbertura !== location.pathname && !location.pathname.startsWith("/dashboard/atlas")
      ? "lateral"
      : "centralizado";

  const fechar = useCallback(() => {
    setAberto(false);
    setRotaDeAbertura(null);
    setVitrineAberta(false);
  }, []);
  // Reabrir a partir da página atual volta ao modo padrão dela: reancorar a rota
  // evita o chat continuar lateral sem necessidade.
  const abrir = useCallback(() => {
    setRotaDeAbertura(location.pathname);
    setAberto(true);
  }, [location.pathname]);

  const abrirLateral = useCallback(() => {
    setRotaDeAbertura("__atlas_lateral__");
    setAberto(true);
  }, []);

  const novaConversa = useCallback(() => {
    sessaoRef.current += 1;
    setMensagens([]);
    setThreadId(null);
    setEnviando(false);
    setCarregandoConversa(false);
    setErro(null);
    setAberto(false);
    setRotaDeAbertura(null);
    setProdutoSelecionado(null);
    setVitrineAberta(false);
    setNichoDaVitrine(null);
  }, []);

  const enviar = useCallback(
    async (
      texto: string,
      produtoDoCatalogo?: ProdutoDoGuia,
      contextoDaPagina?: { rota: string; nome: string; proximoPasso?: string | null },
    ) => {
      const mensagem = texto.trim();
      if (!mensagem || enviando) return;
      if (!user?.id) {
        veloToast.error("Entre na sua conta para conversar com o Atlas");
        return;
      }

      const sessionId = sessaoRef.current;
      const anteriores = mensagens;
      const otimista: AtlasMessage = {
        id: `local-${Date.now()}`,
        role: "user",
        content: mensagem,
        created_at: new Date().toISOString(),
      };

      setAberto(true);
      setRotaDeAbertura((atual) => (aberto && atual ? atual : location.pathname));
      setErro(null);
      setMensagens((atual) => [...atual, otimista]);

      // Easter egg: some coisas não passam pelo modelo. Responde na hora,
      // solta os fogos por 10s e não gasta cota nem chamada de IA.
      if (ehEasterEggAndrya(mensagem)) {
        const resposta: AtlasMessage = {
          id: `local-egg-${Date.now()}`,
          role: "assistant",
          content: MENSAGEM_ANDRYA,
          created_at: new Date().toISOString(),
        };
        setMensagens((atual) => [...atual, resposta]);
        setFogosAtivos(true);
        window.setTimeout(() => setFogosAtivos(false), 10000);
        return;
      }

      setEnviando(true);


      try {
        let idDaThread = threadId;
        if (!idDaThread) {
          const { data, error } = await supabase
            .from("atlas_threads")
            .insert({ user_id: user.id, title: "Nova conversa" })
            .select("id")
            .single();
          if (error || !data) throw new Error(error?.message || "Não foi possível iniciar a conversa");
          idDaThread = (data as { id: string }).id;
          if (sessaoRef.current === sessionId) setThreadId(idDaThread);
        }

        const { error: erroUsuario } = await supabase
          .from("atlas_messages")
          .insert({ thread_id: idDaThread, user_id: user.id, role: "user", content: mensagem });
        if (erroUsuario) throw new Error(erroUsuario.message);

        const historico = [
          ...anteriores.map(({ role, content, product_data }) => ({ role, content, product_data })),
          { role: "user" as const, content: mensagem },
        ];

        const { data: resposta, error: erroAtlas } = await supabase.functions.invoke("atlas-chat", {
          // `pageContext` dá ao Atlas a noção de onde o usuário está agora.
          body: {
            messages: historico,
            pageContext: paginaAtual,
            // Vai como dado, não como texto para o modelo interpretar: o guia
            // precisa do id/preço exatos para montar os passos seguintes.
            ...(produtoDoCatalogo ? { produtoSelecionado: produtoDoCatalogo } : {}),
          },
        });

        const corpo = resposta as AtlasFunctionResponse | null;
        if (isAtlasQuota(corpo?.quota)) setQuota(corpo.quota);
        if (erroAtlas) {
          throw new Error(
            corpo?.error || erroAtlas.message || "Não consegui falar com o Atlas agora. Tente de novo em instantes.",
          );
        }
        const texto = corpo?.message;
        const acoes = normalizeAtlasActions(corpo?.actions);
        if (!texto) throw new Error(corpo?.error || "Não consegui gerar uma resposta agora");

        const { data: salva, error: erroSalvar } = await supabase
          .from("atlas_messages")
          .insert({
            thread_id: idDaThread,
            user_id: user.id,
            role: "assistant",
            content: texto,
            product_data: acoes.length > 0 ? { actions: acoes } : null,
          })
          .select("id, role, content, created_at, product_data")
          .single();
        if (erroSalvar || !salva) throw new Error(erroSalvar?.message || "Não foi possível salvar a resposta");

        const ehPrimeira = anteriores.every((item) => item.role !== "user");
        await supabase
          .from("atlas_threads")
          .update({
            ...(ehPrimeira ? { title: mensagem.length > 50 ? `${mensagem.slice(0, 50)}…` : mensagem } : {}),
            updated_at: new Date().toISOString(),
          })
          .eq("id", idDaThread);

        void queryClient.invalidateQueries({ queryKey: atlasThreadsQueryKey(user.id) });
        if (sessaoRef.current === sessionId) {
          setMensagens((atual) => [...atual, salva as AtlasMessage]);
          // O guia manda abrir a vitrine ao confirmar o nicho: o modal aparece
          // sozinho, sem depender de o usuário achar o botão na mensagem.
          const pedidoDeVitrine = acoes.find(
            (acao): acao is AtlasOpenShowcaseAction => acao.type === "open_showcase",
          );
          if (pedidoDeVitrine) {
            setNichoDaVitrine(pedidoDeVitrine.niche ?? null);
            setVitrineAberta(true);
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Não foi possível conversar com o Atlas";
        if (sessaoRef.current === sessionId) setErro(msg);
        veloToast.error(msg);
      } finally {
        if (sessaoRef.current === sessionId) setEnviando(false);
      }
    },
    [aberto, enviando, location.pathname, mensagens, paginaAtual, queryClient, threadId, user?.id],
  );

  /**
   * Escolha de produto feita no catálogo durante o guia.
   *
   * Guarda o produto (para o card ficar destacado se o usuário voltar à tela) e
   * manda a escolha ao Atlas com os dados estruturados, para ele seguir o guia
   * sem o usuário ter que descrever o produto no chat.
   */
  const selecionarProduto = useCallback(
    async (produto: ProdutoDoGuia) => {
      setProdutoSelecionado(produto);
      await enviar(`Escolhi este produto do catálogo: ${produto.nome}`, produto);
    },
    [enviar],
  );

  const abrirConversa = useCallback(
    async (id: string) => {
      if (!user?.id || id === threadId) return;
      sessaoRef.current += 1;
      const sessionId = sessaoRef.current;

      setAberto(true);
      setRotaDeAbertura(location.pathname);
      setErro(null);
      setMensagens([]);
      setEnviando(false);
      setThreadId(id);
      setCarregandoConversa(true);

      try {
        const { data, error } = await supabase
          .from("atlas_messages")
          .select("id, role, content, created_at, product_data")
          .eq("thread_id", id)
          .order("created_at", { ascending: true });
        if (error) throw new Error(error.message);
        if (sessaoRef.current !== sessionId) return;
        setMensagens((data as AtlasMessage[]) ?? []);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Não foi possível abrir esta conversa";
        if (sessaoRef.current === sessionId) setErro(msg);
        veloToast.error(msg);
      } finally {
        if (sessaoRef.current === sessionId) setCarregandoConversa(false);
      }
    },
    [location.pathname, threadId, user?.id],
  );

  /**
   * Navegação disparada por link interno (#catalogo e afins) dentro de uma
   * mensagem do Atlas.
   *
   * Antes o link só chamava `navigate`: quem estava no chat em tela cheia
   * perdia a conversa, porque a página tem estado próprio e o painel lateral
   * (que vive no layout) subia vazio. Aqui a thread é adotada pelo contexto
   * antes de navegar, o painel abre em modo lateral e o Atlas manda uma
   * mensagem de continuidade reconhecendo a página nova.
   */
  const navegarPorLink = useCallback(
    async (rota: string) => {
      const daPaginaCheia = location.pathname.match(/^\/dashboard\/atlas\/([^/]+)$/)?.[1] ?? null;
      if (daPaginaCheia && daPaginaCheia !== threadId) {
        await abrirConversa(daPaginaCheia);
      }
      const idAtual = daPaginaCheia ?? threadId;

      setAberto(true);
      setRotaDeAbertura("__atlas_lateral__");
      setVitrineAberta(false);
      navigate(rota);

      const texto = mensagemDeContinuidade(rota);
      const continuidade: AtlasMessage = {
        id: `local-nav-${Date.now()}`,
        role: "assistant",
        content: texto,
        created_at: new Date().toISOString(),
      };
      setMensagens((atual) => {
        const ultima = atual[atual.length - 1];
        if (ultima?.role === "assistant" && ultima.content === texto) return atual;
        return [...atual, continuidade];
      });

      if (idAtual && user?.id) {
        await supabase
          .from("atlas_messages")
          .insert({ thread_id: idAtual, user_id: user.id, role: "assistant", content: texto });
        await supabase.from("atlas_threads").update({ updated_at: new Date().toISOString() }).eq("id", idAtual);
      }
    },
    [abrirConversa, location.pathname, navigate, threadId, user?.id],
  );

  const aoApagarConversa = useCallback(
    (id: string) => {
      if (id === threadId) novaConversa();
    },
    [novaConversa, threadId],
  );


  const valor = useMemo<AtlasChatContextValue>(
    () => ({
      aberto,
      modo,
      mensagens,
      enviando,
      carregandoConversa,
      erro,
      threadId,
      guiaAtivo,
      paginaAtual,
      quota,
      produtoSelecionado,
      selecionarProduto,
      vitrineAberta,
      nichoDaVitrine,
      abrirVitrine,

      fecharVitrine,
      abrir,
      abrirLateral,
      fechar,
      novaConversa,
      enviar,
      abrirConversa,
      navegarPorLink,
      aoApagarConversa,
    }),
    [
      aberto, modo, mensagens, enviando, carregandoConversa, erro, threadId, guiaAtivo, paginaAtual, quota,
      produtoSelecionado, selecionarProduto, vitrineAberta, nichoDaVitrine, abrirVitrine, fecharVitrine,
      abrir, abrirLateral, fechar, novaConversa, enviar, abrirConversa, navegarPorLink, aoApagarConversa,
    ],
  );

  return (
    <AtlasChatContext.Provider value={valor}>
      {children}
      <AtlasFireworks ativo={fogosAtivos} />
    </AtlasChatContext.Provider>
  );

};

export const useAtlasChat = () => {
  const ctx = useContext(AtlasChatContext);
  if (!ctx) throw new Error("useAtlasChat precisa estar dentro de <AtlasChatProvider>");
  return ctx;
};

/**
 * Só o catálogo "cru" vira vitrine.
 *
 * Detalhe de produto e catálogo já filtrado por categoria continuam navegando:
 * nesses casos o usuário pediu uma tela específica, e trocá-la por uma seleção
 * automática seria ignorar a escolha dele.
 */
const ehRotaDoCatalogo = (rota: string) => /^\/dashboard\/catalogo\/?$/.test(rota);

/**
 * Navegação disparada pelos botões do Atlas.
 *
 * Existe para um caso só: durante o guia, "Abrir Catálogo" mostra a vitrine de
 * produtos escolhidos pelo perfil em vez de largar o iniciante na grade inteira.
 * Fora do guia, e para qualquer outra rota, navega normalmente.
 */
export const useAtlasNavegacao = () => {
  const navigate = useNavigate();
  const { guiaAtivo, abrirVitrine } = useAtlasChat();

  return useCallback(
    (rota: string) => {
      if (guiaAtivo && ehRotaDoCatalogo(rota)) {
        abrirVitrine();
        return;
      }
      navigate(rota);
    },
    [abrirVitrine, guiaAtivo, navigate],
  );
};
