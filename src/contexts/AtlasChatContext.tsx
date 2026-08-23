import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { veloToast } from "@/components/ui/velo-toast";
import { atlasThreadsQueryKey } from "@/lib/atlasHistory";
import { lerRetornoMl, limparRetornoMl } from "@/lib/mlOauthRetorno";
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
/**
 * Publica direto do chat: o frontend abre o modal de publicação (título, preço,
 * estoque) por cima da conversa, em vez de mandar o usuário para o catálogo.
 */
export type AtlasPublishMlAction = {
  type: "publish_ml";
  label: string;
  product_id: string;
  variant?: "primary";
};

export type AtlasAction =
  | AtlasNavigationAction
  | AtlasProductCardAction
  | AtlasQuickReplyAction
  | AtlasConnectMlAction
  | AtlasPublishMlAction
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
  // Sem este caso, a ação de publicar era descartada aqui e o passo 5 chegava
  // ao usuário só com o atalho para o catálogo — nunca com o botão que publica.
  if (c.type === "publish_ml") return typeof c.label === "string" && typeof c.product_id === "string";
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
  /** Nicho confirmado no guia; a vitrine cruza ele com o perfil do cadastro. */
  nichoDaVitrine: NichoDaVitrine | null;
  /**
   * Mostra a vitrine de produtos do guia dentro da conversa.
   *
   * Durante o guia, "Abrir Catálogo" mostra uma seleção feita a partir do quiz
   * de cadastro em vez de largar o iniciante na grade inteira do catálogo. A
   * seleção entra como uma mensagem do Atlas, com o carrossel embutido.
   */
  mostrarVitrineNoChat: (nicho?: NichoDaVitrine | null) => void;
  /**
   * O Mercado Livre recusou a publicação por conta de vendedor inativa.
   *
   * O Atlas assume a explicação na conversa, em vez de a pessoa levar um modal
   * de tutorial na cara sem entender o que aconteceu nem o que fazer.
   */
  avisarContaDeVendedorBloqueada: () => void;
  abrir: () => void;
  abrirLateral: () => void;
  fechar: () => void;
  novaConversa: () => void;
  enviar: (
    texto: string,
    produtoDoCatalogo?: ProdutoDoGuia,
    contextoDaPagina?: { rota: string; nome: string; proximoPasso?: string | null },
  ) => Promise<void>;
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

/**
 * Conta de vendedor não ativada no Mercado Livre.
 *
 * Os requisitos são os mesmos do tutorial de verificação
 * (`MLAccountVerificationModal`): modo vendedor, dados pessoais, endereço de
 * retirada e Mercado Envios. Estão escritos aqui de forma explícita porque é
 * onde a publicação trava na prática — em especial o endereço, que o Mercado
 * Livre exige completo, com CEP e número.
 */
const MENSAGEM_CONTA_DE_VENDEDOR = `Opa, segura aí — o Mercado Livre recusou a publicação. 🛑

O motivo não é o seu produto: é a sua **conta de vendedor**, que ainda não está ativa. O Mercado Livre exige isso de toda conta antes de aceitar anúncio publicado por integração, mesmo de quem já compra por lá há anos.

São quatro coisas pra resolver na conta, e leva uns 5 minutos:

1. **Ativar o modo vendedor** — o botão "Vender" fica no topo da página do Mercado Livre.
2. **Seus dados** — CPF (ou CNPJ) e um documento de identidade com foto.
3. **Endereço completo** — CEP, número e complemento. É o endereço de retirada, de onde o produto sai.
4. **Aceitar o Mercado Envios** — sem isso o anúncio não sobe.

[Abrir a área de vender do Mercado Livre](https://www.mercadolivre.com.br/vender)

Abre numa aba nova e preenche tudo, sem pular campo — se faltar um item, o Mercado Livre continua recusando. Quando terminar, volta aqui: seu anúncio continua montado do jeito que você deixou, é só tocar em publicar de novo.

Travou em alguma etapa? Me conta qual que eu te explico.`;

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
  const [nichoDaVitrine, setNichoDaVitrine] = useState<NichoDaVitrine | null>(null);
  const [quota, setQuota] = useState<AtlasQuota | null>(null);
  const [fogosAtivos, setFogosAtivos] = useState(false);
  // Pergunta automática a enviar assim que a navegação por botão do Atlas concluir.
  const [perguntaPendente, setPerguntaPendente] = useState<{ rota: string } | null>(null);

  /**
   * Coloca a vitrine na conversa como uma fala do Atlas.
   *
   * A mensagem é local: não vai para o banco porque não é conteúdo gerado, é a
   * mesma seleção que o carrossel refaz a partir do perfil sempre que a
   * conversa é reaberta. Se a última fala já traz uma vitrine, não empilha
   * outra — o usuário clicaria duas vezes e veria dois carrosséis iguais.
   */
  const mostrarVitrineNoChat = useCallback((nichoNovo?: NichoDaVitrine | null) => {
    if (nichoNovo !== undefined) setNichoDaVitrine(nichoNovo);
    // Sem nicho explícito vale o último confirmado na conversa: é o caso de
    // quem clica em "Abrir Catálogo" depois do passo 1.
    const nicho = nichoNovo ?? nichoDaVitrine;
    setMensagens((atual) => {
      const ultima = atual[atual.length - 1];
      const jaTemVitrine =
        ultima?.role === "assistant" &&
        getMessageActions(ultima).some((acao) => acao.type === "open_showcase");
      if (jaTemVitrine) return atual;

      const vitrine: AtlasOpenShowcaseAction = {
        type: "open_showcase",
        label: "Escolher meu produto",
        ...(nicho ? { niche: nicho } : {}),
      };
      return [
        ...atual,
        {
          id: `local-vitrine-${Date.now()}`,
          role: "assistant",
          content:
            "Separei do catálogo o que mais combina com o que você me contou no cadastro. Escolhe um produto pra gente seguir.",
          created_at: new Date().toISOString(),
          product_data: { actions: [vitrine] },
        },
      ];
    });
  }, [nichoDaVitrine]);

  /**
   * Explicação da conta de vendedor bloqueada, na voz do Atlas.
   *
   * O texto é fixo, não sai do modelo: são requisitos concretos do Mercado
   * Livre, e uma resposta gerada poderia inventar etapa que não existe ou
   * esquecer o CEP — que é justamente onde a publicação costuma travar.
   */
  const avisarContaDeVendedorBloqueada = useCallback(() => {
    setMensagens((atual) => {
      const ultima = atual[atual.length - 1];
      // Tocar em publicar de novo não empilha o mesmo aviso outra vez.
      if (ultima?.role === "assistant" && ultima.id.startsWith("local-vendedor")) return atual;

      return [
        ...atual,
        {
          id: `local-vendedor-${Date.now()}`,
          role: "assistant",
          content: MENSAGEM_CONTA_DE_VENDEDOR,
          created_at: new Date().toISOString(),
          product_data: {
            actions: [
              { type: "quick_reply", label: "Já ativei, e agora?", message: "Já ativei minha conta de vendedor no Mercado Livre" },
              { type: "quick_reply", label: "Travei numa etapa", message: "Travei na ativação da conta de vendedor do Mercado Livre, pode me ajudar?" },
            ],
          },
        },
      ];
    });
  }, []);

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
            pageContext: contextoDaPagina ?? paginaAtual,
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
          // O carrossel é renderizado pela própria ação da mensagem. Aqui só
          // guardamos o nicho confirmado, para o caso de o usuário pedir a
          // vitrine outra vez mais adiante na conversa.
          const pedidoDeVitrine = acoes.find(
            (acao): acao is AtlasOpenShowcaseAction => acao.type === "open_showcase",
          );
          if (pedidoDeVitrine) setNichoDaVitrine(pedidoDeVitrine.niche ?? null);
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
   * Navegação disparada por link interno ou por botão "ir para a página" do
   * Atlas.
   *
   * A thread é adotada pelo contexto antes de navegar (quem estava no chat em
   * tela cheia não perde a conversa), o painel abre em modo lateral e uma
   * pergunta entra no chat como se fosse do usuário ("Estou na página de
   * Catálogo, e agora?"). O envio real acontece no efeito abaixo, para o Atlas
   * responder já com o contexto da página de destino.
   */
  const navegarPorLink = useCallback(
    async (rota: string) => {
      const daPaginaCheia = location.pathname.match(/^\/dashboard\/atlas\/([^/]+)$/)?.[1] ?? null;
      if (daPaginaCheia && daPaginaCheia !== threadId) {
        await abrirConversa(daPaginaCheia);
      }

      setAberto(true);
      setRotaDeAbertura("__atlas_lateral__");
      navigate(rota);
      setPerguntaPendente({ rota });
    },
    [abrirConversa, location.pathname, navigate, threadId],
  );

  // Dispara a pergunta automática depois da navegação, com uma closure fresca
  // de `enviar` (histórico e thread já atualizados).
  useEffect(() => {
    if (!perguntaPendente || enviando || carregandoConversa) return;
    const { rota } = perguntaPendente;
    setPerguntaPendente(null);
    const semQuery = rota.split("?")[0];
    void enviar(perguntaDaPagina(semQuery), undefined, {
      rota,
      nome: descreverPagina(semQuery).nome,
      proximoPasso: proximoPassoDaPagina(semQuery),
    });
  }, [carregandoConversa, enviando, enviar, perguntaPendente]);


  const aoApagarConversa = useCallback(
    (id: string) => {
      if (id === threadId) novaConversa();
    },
    [novaConversa, threadId],
  );

  /**
   * Volta do OAuth do Mercado Livre feito a partir do chat.
   *
   * A conexão acontece na mesma aba, então o estado em memória se perde: aqui
   * reabrimos a mesma conversa, voltamos para a rota de origem e avisamos o
   * Atlas de que a conta já está conectada, para o guia seguir do ponto certo.
   */
  const [retornoDoMl, setRetornoDoMl] = useState<{ threadId?: string | null; conectado: boolean } | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    const retorno = lerRetornoMl();
    if (!retorno || retorno.origem !== "atlas") return;

    const params = new URLSearchParams(window.location.search);
    const conectado = params.get("ml_connected") === "true";
    const falhou = Boolean(params.get("ml_error"));
    if (!conectado && !falhou) return;

    limparRetornoMl();
    void (async () => {
      if (retorno.threadId) await abrirConversa(retorno.threadId);
      setAberto(true);
      setRotaDeAbertura("__atlas_lateral__");
      if (retorno.rota) navigate(retorno.rota, { replace: true });
      if (!conectado) {
        veloToast.error("Não deu certo conectar o Mercado Livre. Tente de novo pelo botão do chat.");
        return;
      }
      setRetornoDoMl({ threadId: retorno.threadId, conectado: true });
    })();
    // Só na volta do OAuth (uma vez por carregamento).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (!retornoDoMl?.conectado || enviando || carregandoConversa) return;
    setRetornoDoMl(null);
    void enviar("Conectei minha conta do Mercado Livre. Podemos continuar?");
  }, [retornoDoMl, enviando, carregandoConversa, enviar]);


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
      nichoDaVitrine,
      mostrarVitrineNoChat,
      avisarContaDeVendedorBloqueada,
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
      produtoSelecionado, selecionarProduto, nichoDaVitrine, mostrarVitrineNoChat,
      avisarContaDeVendedorBloqueada, abrir, abrirLateral, fechar, novaConversa, enviar, abrirConversa, navegarPorLink, aoApagarConversa,
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
  const { guiaAtivo, mostrarVitrineNoChat, navegarPorLink } = useAtlasChat();

  return useCallback(
    async (rota: string) => {
      if (guiaAtivo && ehRotaDoCatalogo(rota)) {
        mostrarVitrineNoChat();
        return;
      }
      // Navega preservando a conversa e já pergunta pelo usuário o que fazer
      // na página de destino.
      await navegarPorLink(rota);
    },
    [guiaAtivo, mostrarVitrineNoChat, navegarPorLink],
  );
};
