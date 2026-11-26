import { FormEvent, KeyboardEvent as ReactKeyboardEvent, ReactNode, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { ImagemResponsiva } from "@/components/landing/ImagemResponsiva";
import { LogoVelo, VitrineChamada, VitrineExemplos } from "@/components/landing/VitrineExemplos";
import { guardarIdeiaDaLanding } from "@/lib/ideiaDaLanding";
import { tiktokCliqueCadastro } from "@/lib/tiktokPixel";
import { metaVeloCliqueCadastro } from "@/lib/veloMetaPixel";
import mascoteSentado from "@/assets/mascote/sentado.webp";

/*
  Landing da Velo (rota "/"), no modelo da base44.com (nov/2026).

  Mensagem: qualquer pessoa pode vender online com a Velo — criando a própria loja
  ou publicando no Mercado Livre (onde estão os lojistas atuais). Uma página só,
  responsiva: a mesma estrutura serve celular e desktop.

  Regras que continuam valendo (CLAUDE.md §11):
  - nada de número, depoimento ou resultado inventado;
  - nenhuma promessa de ganho;
  - nada de "grátis" nos botões (não existe plano gratuito);
  - nada de dado pessoal na URL: o Pixel da Meta manda a URL inteira. Por isso a
    ideia digitada no hero vai para o cadastro por estado de navegação e
    sessionStorage, nunca por query string.
*/

const FONTE_TITULO = "[font-family:'Inter_Tight','Inter',ui-sans-serif,system-ui,sans-serif]";
const TITULO = `${FONTE_TITULO} font-semibold tracking-[-0.042em] sm:tracking-[-0.055em] text-[#16181D]`;

/*
  Números informados pela operação em 17/11/2026 (mesmos da landing anterior):
  - lojistas: piso. Se o banco (rpc_landing_stats) passar disso, vale o banco,
    arredondado para baixo em 50.
  - vendas: soma do que os lojistas da Velo vendem por mês. Não é promessa de
    ganho para quem entra; atualize aqui quando o número mudar.
*/
const LOJISTAS_ATIVOS_PISO = 1250;
const VENDAS_MES_LOJISTAS = "R$ 300 mil+";

type Canal = "loja" | "mercado-livre" | "pagina" | "imagens" | "catalogo";

const CANAIS: { id: Canal; rotulo: string; inicio: string }[] = [
  { id: "loja", rotulo: "Loja online", inicio: "Quero criar minha loja online para vender " },
  { id: "mercado-livre", rotulo: "Mercado Livre", inicio: "Quero vender no Mercado Livre " },
  { id: "pagina", rotulo: "Página de vendas", inicio: "Quero uma página de vendas para " },
  { id: "imagens", rotulo: "Imagens com IA", inicio: "Quero criar imagens com IA para " },
  { id: "catalogo", rotulo: "Sem estoque", inicio: "Quero achar um produto sem estoque no nicho de " },
];

// Exemplos que o campo do hero vai "digitando" enquanto a pessoa não escreve nada.
const EXEMPLOS_DIGITADOS = [
  "Quero criar uma loja online de moda fitness",
  "Quero vender acessórios para pet no Mercado Livre",
  "Quero uma página de vendas para um fone bluetooth",
  "Quero vender produtos de beleza sem ter estoque",
];

/*
  Menu do topo no modelo da Base44: itens com seta abrem um painel ao passar o
  mouse (ou ao clicar, no toque/teclado), itens sem seta rolam até a seção, e um
  destaque em azul entre quadradinhos (lá é "Superagents", aqui é o Atlas).
  Todos os destinos existem nesta página ou no app: nada de âncora morta.
*/
type ItemPainel = { titulo: string; texto: string; alvo?: string; href?: string };
type ItemMenu = { rotulo: string; alvo?: string; painel?: ItemPainel[] };

const MENU: ItemMenu[] = [
  {
    rotulo: "Produto",
    painel: [
      { titulo: "Loja online", texto: "Sua loja com seu nome e seu link, a partir de modelos prontos.", alvo: "formas-de-vender" },
      { titulo: "Mercado Livre", texto: "Publique anúncios com título, descrição e fotos já montados.", alvo: "formas-de-vender" },
      { titulo: "Catálogo Velo", texto: "Produtos de fornecedores brasileiros, sem estoque.", alvo: "recursos" },
      { titulo: "Páginas e imagens com IA", texto: "Gere a página de vendas e variações de imagem do produto.", alvo: "recursos" },
    ],
  },
  {
    rotulo: "Para quem",
    painel: [
      { titulo: "Quem está começando", texto: "Da ideia à primeira venda, passo a passo.", alvo: "como-funciona" },
      { titulo: "Quem já vende no Mercado Livre", texto: "Catálogo, anúncios e pedidos no mesmo painel.", alvo: "formas-de-vender" },
      { titulo: "Quem quer a própria loja", texto: "Um canal seu, para divulgar onde quiser.", alvo: "formas-de-vender" },
    ],
  },
  {
    rotulo: "Ajuda",
    painel: [
      { titulo: "Central de Ajuda", texto: "Tutoriais e respostas sobre a plataforma.", href: "/ajuda" },
      { titulo: "Perguntas frequentes", texto: "Estoque, loja própria, Mercado Livre e mais.", alvo: "perguntas-frequentes" },
    ],
  },
  { rotulo: "Como funciona", alvo: "como-funciona" },
  { rotulo: "Recursos", alvo: "recursos" },
];

// Menu do celular: lista simples, sem painéis.
const MENU_CELULAR = [
  { rotulo: "Loja online", alvo: "formas-de-vender" },
  { rotulo: "Mercado Livre", alvo: "formas-de-vender" },
  { rotulo: "Como funciona", alvo: "como-funciona" },
  { rotulo: "Atlas IA", alvo: "atlas" },
  { rotulo: "Recursos", alvo: "recursos" },
  { rotulo: "Perguntas", alvo: "perguntas-frequentes" },
];

/* Linhas da seção "formas de vender": cada uma abre um texto curto. Só recursos que existem no produto. */
const FORMAS = [
  {
    titulo: "Sua loja, com seu nome e seu link",
    texto: "Escolha um modelo pronto, coloque os produtos do catálogo e ajuste textos, cores e fotos no editor, sem código. Depois é só divulgar no Instagram, WhatsApp, TikTok ou em anúncios.",
  },
  {
    titulo: "Anúncios prontos no Mercado Livre",
    texto: "Conecte sua conta do Mercado Livre e publique direto da Velo. O anúncio sai com título, descrição e fotos já montados, e você revisa antes de publicar.",
  },
  {
    titulo: "Fornecedores brasileiros, sem estoque",
    texto: "O catálogo Velo mostra o custo no fornecedor, o preço sugerido e a margem de cada produto. Você só paga o fornecedor quando sai uma venda.",
  },
  {
    titulo: "Páginas e imagens criadas com IA",
    texto: "Gere a página de vendas a partir do produto do catálogo e crie variações de imagem para testar seus anúncios e criativos.",
  },
  {
    titulo: "Pedidos e envios num só painel",
    texto: "Quando sai uma venda, você confirma o pedido com o fornecedor pelo painel e ele faz o envio. Tudo o que foi publicado e vendido fica no mesmo lugar.",
  },
  {
    titulo: "O Atlas te ajuda a decidir",
    texto: "Não sabe o que vender? O Atlas, a IA da Velo, sugere um produto do catálogo com o motivo e diz qual é o próximo passo.",
  },
];

/* Itens do bloco do Atlas. Só o que o Atlas faz hoje (conferido no painel). */
const ATLAS_ITENS = [
  {
    titulo: "Sugestão de produto",
    texto: "Diga o nicho e o Atlas indica um produto específico do catálogo, com o motivo da escolha.",
  },
  {
    titulo: "Preço e margem",
    texto: "Ele mostra o custo no fornecedor e ajuda a definir o preço de venda antes de você publicar.",
  },
  {
    titulo: "Próximo passo",
    texto: "Depois da sugestão, o Atlas diz o que fazer em seguida e leva você direto ao catálogo.",
  },
  {
    titulo: "Dúvidas no caminho",
    texto: "Pergunte sobre a sua loja, o Mercado Livre ou o painel, do jeito que você falaria com alguém.",
  },
];

const PASSOS = [
  {
    numero: "01",
    titulo: "Sua ideia",
    texto: "Escreva do seu jeito o que quer vender: o nicho, o produto ou só a ideia. Se ainda não sabe, o Atlas, a IA da Velo, sugere por onde começar.",
    botao: "Escrever minha ideia",
  },
  {
    numero: "02",
    titulo: "Seu produto",
    texto: "Escolha no catálogo de fornecedores brasileiros, com custo e margem à vista. A Velo monta a loja, a página ou o anúncio com título, descrição e fotos.",
    botao: "Ver os recursos",
  },
  {
    numero: "03",
    titulo: "Sua venda",
    texto: "Publique na sua loja, no Mercado Livre ou nos dois. Quando sair uma venda, você confirma o pedido pelo painel e o fornecedor faz o envio.",
    botao: "Começar agora",
  },
];

const RECURSOS = [
  { titulo: "Catálogo Velo", texto: "Produtos de fornecedores brasileiros, com custo, preço sugerido e margem.", icone: "catalogo" },
  { titulo: "Loja própria", texto: "Sua loja com seu nome e seu link, a partir de modelos prontos para editar.", icone: "loja" },
  { titulo: "Atlas", texto: "A IA da Velo ajuda a escolher produto, preço e o próximo passo.", icone: "atlas" },
  { titulo: "Páginas com IA", texto: "Gere a página de vendas a partir do produto do catálogo.", icone: "pagina" },
  { titulo: "Imagens com IA", texto: "Crie variações de imagem para testar anúncios e criativos.", icone: "imagem" },
  { titulo: "Pedidos num só painel", texto: "Veja o que foi publicado em cada canal e acompanhe cada pedido.", icone: "pedidos" },
];

const FAQ = [
  {
    pergunta: "Preciso ter estoque para vender com a Velo?",
    resposta: "Não. Os produtos vêm de fornecedores brasileiros do catálogo Velo. Quando sai uma venda, você confirma o pedido com o fornecedor pelo painel e ele faz o envio.",
  },
  {
    pergunta: "Consigo criar minha própria loja sem saber programar?",
    resposta: "Sim. Você escolhe um modelo e os produtos, a Velo monta a loja e você ajusta textos, cores e fotos no editor. Não precisa escrever código.",
  },
  {
    pergunta: "Já vendo no Mercado Livre. A Velo continua servindo para mim?",
    resposta: "Sim. O Mercado Livre continua sendo um canal da Velo: você conecta sua conta e publica o anúncio direto da plataforma, com título, descrição e fotos já montados. Se quiser, também pode ter sua loja própria.",
  },
  {
    pergunta: "Posso vender na minha loja e no Mercado Livre ao mesmo tempo?",
    resposta: "Pode. O mesmo produto do catálogo pode ir para a sua loja e para o seu Mercado Livre, e os pedidos ficam no mesmo painel.",
  },
  {
    pergunta: "A Velo é para quem está começando?",
    resposta: "Sim. A experiência foi pensada para quem está montando a primeira operação online: passos claros, decisões simples e o Atlas para tirar dúvidas no caminho.",
  },
];

function VeloLogo() {
  return (
    <span className="flex items-center gap-2">
      <ImagemResponsiva
        base="logo"
        larguras={[96]}
        original="/logo.png"
        sizes="30px"
        alt=""
        prioritaria
        width={30}
        height={30}
        className="block h-[30px] w-[30px] shrink-0 object-contain"
      />
      <span className={`${FONTE_TITULO} text-[23px] font-semibold leading-none tracking-[-0.06em] text-[#16181D]`}>Velo</span>
    </span>
  );
}

/*
  Ícones dos atalhos do campo do hero: todos cheios e na mesma cor, como os da
  Base44 (App, Dashboard, Website…).
*/
function IconeAtalho({ canal }: { canal: Canal }) {
  const props = { className: "h-[15px] w-[15px] shrink-0 text-[#4F6BED]", viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": true };
  switch (canal) {
    case "loja":
      return (
        <svg {...props}>
          <path d="M2 2.5h12l1 3.2a2.1 2.1 0 0 1-3.9 1.2 2.1 2.1 0 0 1-3.6 0 2.1 2.1 0 0 1-3.6 0A2.1 2.1 0 0 1 1 5.7L2 2.5Z" />
          <path d="M2.5 9.2c.9.3 1.9.2 2.7-.3.7.4 1.4.6 2.2.6h1.2c.8 0 1.5-.2 2.2-.6.8.5 1.8.6 2.7.3V14H9.6v-3.2H6.4V14H2.5V9.2Z" />
        </svg>
      );
    case "mercado-livre":
      return (
        <svg {...props}>
          <path d="M8.6 1.5H14a.5.5 0 0 1 .5.5v5.4a1 1 0 0 1-.3.7l-6.1 6.1a1 1 0 0 1-1.4 0L2 9.5a1 1 0 0 1 0-1.4l6.1-6.1a1 1 0 0 1 .5-.5Zm2.9 4.3a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6Z" />
        </svg>
      );
    case "pagina":
      return (
        <svg {...props}>
          <path d="M3.5 1.5h6l3 3v9a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1Zm1.5 6v1.3h6V7.5H5Zm0 2.8v1.3h4v-1.3H5Z" />
        </svg>
      );
    case "imagens":
      return (
        <svg {...props}>
          <path d="M2.5 2h11A1.5 1.5 0 0 1 15 3.5v9a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 12.5v-9A1.5 1.5 0 0 1 2.5 2Zm3 5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm-2.5 5h10l-3.2-4.3-2.6 3.1-1.6-1.6L3 12Z" />
        </svg>
      );
    default:
      return (
        <svg {...props}>
          <rect x="1.5" y="1.5" width="5.6" height="5.6" rx="1" />
          <rect x="8.9" y="1.5" width="5.6" height="5.6" rx="1" />
          <rect x="1.5" y="8.9" width="5.6" height="5.6" rx="1" />
          <rect x="8.9" y="8.9" width="5.6" height="5.6" rx="1" />
        </svg>
      );
  }
}

function IconeRecurso({ nome }: { nome: string }) {
  const props = { className: "h-5 w-5", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  switch (nome) {
    case "catalogo":
      return <svg {...props}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>;
    case "loja":
      return <svg {...props}><path d="M4 10v9a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-9" /><path d="M3 6.5 4.5 4h15L21 6.5V8a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0V6.5Z" /><path d="M10 20v-5h4v5" /></svg>;
    case "atlas":
      return <svg {...props}><path d="M12 3a7 7 0 0 1 7 7c0 3.9-3.1 7-7 7H6l-2 3V10a7 7 0 0 1 8-7Z" /><path d="M9 10h.01M15 10h.01" strokeWidth="2.4" /></svg>;
    case "pagina":
      return <svg {...props}><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>;
    case "imagem":
      return <svg {...props}><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="m21 16-5-5-9 9" /></svg>;
    default:
      return <svg {...props}><path d="M3 7h18M3 12h18M3 17h12" /></svg>;
  }
}

function Secao({ id, children, className = "" }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={`scroll-mt-20 px-4 sm:px-8 ${className}`}>
      <div className="mx-auto max-w-[1200px]">{children}</div>
    </section>
  );
}

/* Digita e apaga os exemplos no placeholder do campo do hero. Parado se a pessoa já escreveu algo. */
function usePlaceholderDigitado(ativo: boolean) {
  const [texto, setTexto] = useState("");
  useEffect(() => {
    if (!ativo) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setTexto(EXEMPLOS_DIGITADOS[0]);
      return;
    }
    let indice = 0;
    let letras = 0;
    let apagando = false;
    let timer: number;
    const passo = () => {
      const alvo = EXEMPLOS_DIGITADOS[indice];
      if (!apagando) {
        letras += 1;
        setTexto(alvo.slice(0, letras));
        if (letras >= alvo.length) {
          apagando = true;
          timer = window.setTimeout(passo, 1800);
          return;
        }
        timer = window.setTimeout(passo, 42);
        return;
      }
      letras -= 2;
      setTexto(alvo.slice(0, Math.max(letras, 0)));
      if (letras <= 0) {
        apagando = false;
        letras = 0;
        indice = (indice + 1) % EXEMPLOS_DIGITADOS.length;
        timer = window.setTimeout(passo, 350);
        return;
      }
      timer = window.setTimeout(passo, 18);
    };
    timer = window.setTimeout(passo, 600);
    return () => window.clearTimeout(timer);
  }, [ativo]);
  return texto;
}

/*
  Microfone do campo do hero: ditado por voz em português com a Web Speech API do
  próprio navegador (Chrome, Edge, Safari). Nada sai para servidor da Velo. Onde o
  navegador não tem a API (Firefox), o botão simplesmente não aparece.
*/
type Reconhecimento = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type ConstrutorReconhecimento = new () => Reconhecimento;

function useDitado(aoOuvir: (texto: string) => void) {
  const [disponivel, setDisponivel] = useState(false);
  const [ouvindo, setOuvindo] = useState(false);
  const reconhecimento = useRef<Reconhecimento | null>(null);
  const callback = useRef(aoOuvir);
  callback.current = aoOuvir;

  useEffect(() => {
    const janela = window as unknown as { SpeechRecognition?: ConstrutorReconhecimento; webkitSpeechRecognition?: ConstrutorReconhecimento };
    setDisponivel(Boolean(janela.SpeechRecognition || janela.webkitSpeechRecognition));
    return () => reconhecimento.current?.stop();
  }, []);

  const alternar = () => {
    if (ouvindo) {
      reconhecimento.current?.stop();
      return;
    }
    const janela = window as unknown as { SpeechRecognition?: ConstrutorReconhecimento; webkitSpeechRecognition?: ConstrutorReconhecimento };
    const Construtor = janela.SpeechRecognition || janela.webkitSpeechRecognition;
    if (!Construtor) return;
    const rec = new Construtor();
    rec.lang = "pt-BR";
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (event) => {
      const texto = Array.from(event.results, (resultado) => resultado[0]?.transcript ?? "").join(" ").trim();
      if (texto) callback.current(texto);
    };
    rec.onend = () => setOuvindo(false);
    rec.onerror = () => setOuvindo(false);
    reconhecimento.current = rec;
    try {
      rec.start();
      setOuvindo(true);
    } catch {
      setOuvindo(false);
    }
  };

  return { disponivel, ouvindo, alternar };
}

export default function Index() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [ideia, setIdeia] = useState("");
  const [canal, setCanal] = useState<Canal>("loja");
  const [menuCanalAberto, setMenuCanalAberto] = useState(false);
  const [menuIdeiasAberto, setMenuIdeiasAberto] = useState(false);
  const menuIdeiasRef = useRef<HTMLDivElement>(null);
  const { disponivel: ditadoDisponivel, ouvindo, alternar: alternarDitado } = useDitado((texto) =>
    setIdeia((atual) => (atual.trim() ? `${atual.trimEnd()} ${texto}` : texto)),
  );
  const [menuAberto, setMenuAberto] = useState(false);
  const [headerSolido, setHeaderSolido] = useState(false);
  const [faqAberta, setFaqAberta] = useState(0);
  const [formaAberta, setFormaAberta] = useState<number | null>(null);
  const [assinantesAtivos, setAssinantesAtivos] = useState<number | null>(null);
  const campoRef = useRef<HTMLTextAreaElement>(null);
  const menuCanalRef = useRef<HTMLDivElement>(null);
  const [painelAberto, setPainelAberto] = useState<string | null>(null);
  const timerPainel = useRef<number>();
  const placeholder = usePlaceholderDigitado(ideia.length === 0);

  const logado = !authLoading && Boolean(user);
  const authTarget = logado ? "/dashboard" : "/login";
  const signupTarget = logado ? "/dashboard" : "/login?novo=1";
  const canalAtual = CANAIS.find((item) => item.id === canal) ?? CANAIS[0];

  /*
    Funil da landing (só números agregados, nada de dado pessoal). Os nomes dos
    eventos são os mesmos da landing anterior, para o painel do funil continuar
    comparando com o histórico.
  */
  const registrarEvento = async (evento: string) => {
    try {
      let visitor = window.localStorage.getItem("velo_visitor_id");
      if (!visitor) {
        visitor = crypto.randomUUID();
        window.localStorage.setItem("velo_visitor_id", visitor);
      }
      const params = new URLSearchParams(window.location.search);
      const ua = navigator.userAgent || "";
      const interno = /Instagram|FBAN|FBAV|FB_IAB|Messenger|musical_ly|Bytedance|TikTok|Trill/i.test(ua);
      let origem = params.get("utm_source") || params.get("ref") || null;
      if (!origem && document.referrer) {
        try { origem = new URL(document.referrer).hostname.replace(/^www\./, ""); } catch { origem = null; }
      }
      if (!origem && interno) origem = "rede-social";
      await supabase.rpc("rpc_landing_track", {
        p_event: evento,
        p_visitor_id: visitor,
        p_device: window.innerWidth < 640 ? "mobile" : "desktop",
        p_referrer: document.referrer || null,
        p_origem: origem ?? "direto",
        p_utm_medium: params.get("utm_medium"),
        p_utm_campaign: params.get("utm_campaign"),
        p_browser: interno ? "interno" : "normal",
      });
    } catch {
      /* medição nunca pode quebrar a página */
    }
  };

  // Logado, o botão só leva ao painel: contar como clique de cadastro inflaria o funil.
  const registrarCliqueCadastro = (evento: string) => {
    if (user) return;
    void registrarEvento(evento);
    tiktokCliqueCadastro(evento);
    metaVeloCliqueCadastro(evento);
  };

  useEffect(() => {
    void registrarEvento("landing_view");
    supabase.rpc("rpc_landing_stats").then(({ data }) => {
      const total = (data as { assinantes_ativos?: number } | null)?.assinantes_ativos;
      if (typeof total === "number") setAssinantesAtivos(total);
    });
  }, []);

  useEffect(() => {
    const aoRolar = () => setHeaderSolido(window.scrollY > 12);
    aoRolar();
    window.addEventListener("scroll", aoRolar, { passive: true });
    return () => window.removeEventListener("scroll", aoRolar);
  }, []);

  /*
    index.css força `scroll-behavior: auto` no html, o que anula o "smooth" pedido
    por JS. A landing liga a propriedade enquanto está montada e restaura ao sair.
  */
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = document.documentElement;
    const anterior = root.style.scrollBehavior;
    root.style.scrollBehavior = "smooth";
    return () => {
      root.style.scrollBehavior = anterior;
    };
  }, []);

  // Fecha os menus do campo (canal e ideias) ao clicar fora ou apertar Esc.
  useEffect(() => {
    if (!menuCanalAberto && !menuIdeiasAberto) return;
    const aoClicar = (event: MouseEvent) => {
      const alvo = event.target as Node;
      if (!menuCanalRef.current?.contains(alvo)) setMenuCanalAberto(false);
      if (!menuIdeiasRef.current?.contains(alvo)) setMenuIdeiasAberto(false);
    };
    const aoTeclar = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMenuCanalAberto(false);
      setMenuIdeiasAberto(false);
    };
    document.addEventListener("mousedown", aoClicar);
    window.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("mousedown", aoClicar);
      window.removeEventListener("keydown", aoTeclar);
    };
  }, [menuCanalAberto, menuIdeiasAberto]);

  // Menu do celular aberto: a página atrás não rola.
  useEffect(() => {
    if (!menuAberto) return;
    document.body.style.overflow = "hidden";
    const aoTeclar = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuAberto(false);
    };
    window.addEventListener("keydown", aoTeclar);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", aoTeclar);
    };
  }, [menuAberto]);

  /*
    Atraso curto ao fechar o painel do menu: sem ele o painel some no vão entre o
    item e o cartão, e o mouse nunca chega lá.
  */
  const abrirPainel = (rotulo: string) => {
    window.clearTimeout(timerPainel.current);
    setPainelAberto(rotulo);
  };
  const fecharPainelDepois = () => {
    window.clearTimeout(timerPainel.current);
    timerPainel.current = window.setTimeout(() => setPainelAberto(null), 160);
  };

  useEffect(() => {
    if (!painelAberto) return;
    const aoTeclar = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPainelAberto(null);
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [painelAberto]);

  useEffect(() => () => window.clearTimeout(timerPainel.current), []);

  const irPara = (id: string) => {
    setMenuAberto(false);
    setPainelAberto(null);
    document.body.style.overflow = "";
    window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: "start" }), 0);
  };

  const escolherCanal = (novo: Canal) => {
    setCanal(novo);
    setMenuCanalAberto(false);
    const inicio = CANAIS.find((item) => item.id === novo)?.inicio ?? "";
    // Só preenche se o campo está vazio ou ainda é o começo de outro chip.
    if (!ideia.trim() || CANAIS.some((item) => item.inicio === ideia)) setIdeia(inicio);
    window.requestAnimationFrame(() => {
      const campo = campoRef.current;
      if (!campo) return;
      campo.focus();
      campo.setSelectionRange(campo.value.length, campo.value.length);
    });
  };

  const comecar = (evento: string) => {
    if (logado) {
      navigate("/dashboard");
      return;
    }
    registrarCliqueCadastro(evento);
    navigate(signupTarget);
  };

  /*
    A ideia do campo vai direto para o chat do Atlas, que a envia sozinho e já
    começa a montar ou a procurar produto (src/lib/ideiaDaLanding.ts). Quem não
    está logado passa antes pelo login/cadastro; a ideia espera no sessionStorage
    da aba, nunca na URL.
  */
  const enviarIdeia = (event?: FormEvent) => {
    event?.preventDefault();
    const texto = ideia.trim();
    if (texto) guardarIdeiaDaLanding(texto, canal);
    if (logado) {
      navigate("/dashboard");
      return;
    }
    registrarCliqueCadastro("cta_hero_signup_click");
    navigate(signupTarget, { state: texto ? { ideia: texto, canal } : undefined });
  };

  // Botão "Escrever minha ideia": volta ao topo e põe o cursor no campo do hero.
  const escreverIdeia = () => {
    window.scrollTo({ top: 0 });
    window.setTimeout(() => campoRef.current?.focus({ preventScroll: true }), 450);
  };

  const usarIdeiaPronta = (texto: string) => {
    setIdeia(texto);
    setMenuIdeiasAberto(false);
    window.requestAnimationFrame(() => {
      const campo = campoRef.current;
      if (!campo) return;
      campo.focus();
      campo.setSelectionRange(campo.value.length, campo.value.length);
    });
  };

  const aoTeclarNoCampo = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      enviarIdeia();
    }
  };

  const lojistasAtivos = Math.max(LOJISTAS_ATIVOS_PISO, assinantesAtivos !== null ? Math.floor(assinantesAtivos / 50) * 50 : 0);
  const NUMEROS = [
    { numero: `${lojistasAtivos.toLocaleString("pt-BR")}+`, rotulo: "lojistas assinantes da Velo" },
    { numero: VENDAS_MES_LOJISTAS, rotulo: "vendidos por mês pelos lojistas" },
    { numero: "100%", rotulo: "fornecedores nacionais" },
  ];

  return (
    // data-velo-flat-buttons: botões chapados, como na referência (sem o relevo global do index.css).
    <main data-velo-flat-buttons className="relative min-h-screen overflow-x-hidden bg-[#F0EEEC] font-sans text-[#16181D] [font-family:'Inter',ui-sans-serif,system-ui,sans-serif]">
      {/*
        Textura de tela (trama de linho) do fundo, no padrão da base44.com: pontinhos
        escuros nos cruzamentos dos fios, cor média #F0EEEC. Gerada por script, não é
        a imagem deles. O arquivo tem 476px e aparece a 238px, nítido em tela retina;
        são ~35 KB baixados pelo CSS, sem travar a primeira tela.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: "url(/landing/textura-fundo.webp?v=2)", backgroundSize: "238px 238px" }}
      />

      {/* ───────── Header (modelo Base44: largura toda, itens com seta e painel) ───────── */}
      <header
        onMouseLeave={fecharPainelDepois}
        style={headerSolido || menuAberto || painelAberto ? { backgroundImage: "url(/landing/textura-fundo.webp?v=2)", backgroundSize: "238px 238px" } : undefined}
        className={`fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow] duration-200 ${
          headerSolido || menuAberto || painelAberto ? "bg-[#F0EEEC]/95 shadow-[0_1px_0_rgba(22,24,29,0.08)] backdrop-blur-md" : "bg-transparent"
        }`}
      >
        <div className="flex h-[64px] items-center px-4 sm:h-[76px] sm:px-8 lg:px-9">
          <button type="button" onClick={() => window.scrollTo({ top: 0 })} aria-label="Velo, voltar ao topo" className="shrink-0">
            <VeloLogo />
          </button>

          <nav className="ml-10 hidden items-center gap-1 lg:flex" aria-label="Menu principal">
            {MENU.map((item) => {
              const aberto = painelAberto === item.rotulo;
              return (
                <div key={item.rotulo} className="relative" onMouseEnter={() => (item.painel ? abrirPainel(item.rotulo) : fecharPainelDepois())}>
                  <button
                    type="button"
                    aria-expanded={item.painel ? aberto : undefined}
                    aria-haspopup={item.painel ? "true" : undefined}
                    onClick={() => {
                      if (item.painel) {
                        setPainelAberto(aberto ? null : item.rotulo);
                        return;
                      }
                      if (item.alvo === "como-funciona") void registrarEvento("cta_how_it_works_click");
                      if (item.alvo) irPara(item.alvo);
                    }}
                    className={`flex h-10 items-center gap-1.5 rounded-[8px] px-3 text-[16px] tracking-[-0.01em] transition ${aberto ? "text-[#16181D]" : "text-[#2A2D34] hover:text-[#16181D]"}`}
                  >
                    {item.rotulo}
                    {item.painel && (
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true" className={`mt-px transition-transform duration-200 ${aberto ? "rotate-180" : ""}`}>
                        <path d="m2.5 4.5 3.5 3.5 3.5-3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>

                  {item.painel && aberto && (
                    <div className="absolute left-0 top-full pt-2" onMouseEnter={() => abrirPainel(item.rotulo)}>
                      <ul className="w-[340px] rounded-[14px] border border-[#16181D]/10 bg-white p-2 shadow-[0_18px_48px_-16px_rgba(22,24,29,0.28)]">
                        {item.painel.map((sub) => (
                          <li key={sub.titulo}>
                            <button
                              type="button"
                              onClick={() => {
                                setPainelAberto(null);
                                if (sub.href) navigate(sub.href);
                                else if (sub.alvo) irPara(sub.alvo);
                              }}
                              className="block w-full rounded-[10px] px-3.5 py-3 text-left transition hover:bg-[#F0EEEC]"
                            >
                              <span className="block text-[15px] font-medium text-[#16181D]">{sub.titulo}</span>
                              <span className="mt-0.5 block text-[13.5px] leading-[1.45] text-[#6B6F78]">{sub.texto}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Destaque em azul entre quadradinhos, como o "Superagents" da referência. */}
            <button
              type="button"
              onMouseEnter={fecharPainelDepois}
              onClick={() => irPara("atlas")}
              className="ml-4 flex h-10 items-center gap-2.5 px-2 text-[16px] font-medium tracking-[-0.01em] text-[#2563EB] transition hover:text-[#1E3A8A]"
            >
              <span aria-hidden="true" className="h-[5px] w-[5px] bg-current" />
              Atlas IA
              <span aria-hidden="true" className="h-[5px] w-[5px] bg-current" />
            </button>
          </nav>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-3">
            <button
              type="button"
              onClick={() => {
                if (!logado) void registrarEvento("cta_header_login_click");
                navigate(authTarget);
              }}
              className="hidden h-10 rounded-[8px] px-3 text-[16px] tracking-[-0.01em] text-[#2A2D34] transition hover:text-[#16181D] sm:block"
            >
              {logado ? "Painel" : "Entrar"}
            </button>
            <button
              type="button"
              onClick={() => comecar("cta_primary_click")}
              className="h-[38px] rounded-[8px] bg-[#2B2B2B] px-4 text-[15px] font-semibold tracking-[-0.01em] text-white transition hover:bg-[#16181D] sm:h-10"
            >
              {logado ? "Ir para o painel" : "Começar agora"}
            </button>
            <button
              type="button"
              aria-label={menuAberto ? "Fechar menu" : "Abrir menu"}
              aria-expanded={menuAberto}
              aria-controls="menu-landing"
              onClick={() => setMenuAberto((aberto) => !aberto)}
              className="grid h-10 w-10 place-items-center rounded-[8px] text-[#16181D] lg:hidden"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                {menuAberto ? (
                  <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                ) : (
                  <path d="M4 8h16M4 16h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {menuAberto && (
          <div id="menu-landing" className="h-[calc(100dvh-64px)] overflow-y-auto border-t border-[#16181D]/10 bg-[#F0EEEC] px-4 pb-8 pt-2 lg:hidden">
            {MENU_CELULAR.map((item) => (
              <button
                key={item.rotulo}
                type="button"
                onClick={() => irPara(item.alvo)}
                className={`${FONTE_TITULO} flex w-full items-center justify-between border-b border-[#16181D]/10 py-4 text-left text-[22px] font-medium tracking-[-0.03em] ${item.alvo === "atlas" ? "text-[#2563EB]" : ""}`}
              >
                {item.rotulo}
                <span aria-hidden="true" className="text-[#8A8F99]">→</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                if (!logado) void registrarEvento("cta_header_login_click");
                navigate(authTarget);
              }}
              className="mt-6 h-[52px] w-full rounded-[12px] border border-[#16181D]/15 bg-white text-[16px] font-medium"
            >
              {logado ? "Ir para o painel" : "Entrar"}
            </button>
          </div>
        )}
      </header>

      {/* ───────── Hero ───────── */}
      <section id="top" className="relative px-4 pt-[112px] sm:px-8 sm:pt-[150px] lg:pt-[170px]">
        <div className="mx-auto max-w-[1440px] text-center">
          <h1 className={`${TITULO} mx-auto max-w-[1300px] text-[clamp(46px,9.4vw,132px)] leading-[0.94]`}>
            Qualquer pessoa
            <br className="hidden sm:block" /> pode vender online
          </h1>
          <p className="mx-auto mt-6 max-w-[760px] text-[17px] leading-[1.5] tracking-[-0.01em] text-[#33363D] sm:mt-8 sm:text-[22px]">
            Crie sua própria loja ou venda no Mercado Livre com a Velo. Você conta o que quer vender e a gente monta o resto, sem precisar de estoque.
          </p>

          {/*
            Campo de ideia, cópia do "I want to build…" da Base44: bandeja cinza,
            caixa branca com "+" à esquerda e, à direita, o seletor de canal (no
            lugar do "Build"), o microfone e a seta. Atalhos embaixo, dentro da bandeja.
          */}
          <div className="mx-auto mt-9 max-w-[800px] rounded-[12px] bg-[#E6E4E0] p-[4px] text-left sm:mt-12">
            <form onSubmit={enviarIdeia} className="rounded-[9px] border border-[#DEDCD7] bg-white">
              <label htmlFor="ideia-landing" className="sr-only">O que você quer vender?</label>
              <textarea
                id="ideia-landing"
                ref={campoRef}
                value={ideia}
                onChange={(event) => setIdeia(event.target.value)}
                onKeyDown={aoTeclarNoCampo}
                rows={3}
                maxLength={280}
                placeholder={ouvindo ? "Pode falar, estou ouvindo…" : placeholder}
                className="block min-h-[100px] w-full resize-none rounded-t-[9px] bg-transparent px-5 pt-5 text-[16px] leading-[1.5] text-[#16181D] outline-none placeholder:text-[#76767A] sm:min-h-[104px] sm:px-[26px] sm:pt-[24px] sm:text-[17px]"
              />
              <div className="flex items-center gap-1 px-3 pb-3 sm:px-[14px]">
                <div ref={menuIdeiasRef} className="relative">
                  <button
                    type="button"
                    aria-label="Ideias para começar"
                    aria-haspopup="listbox"
                    aria-expanded={menuIdeiasAberto}
                    onClick={() => {
                      setMenuCanalAberto(false);
                      setMenuIdeiasAberto((aberto) => !aberto);
                    }}
                    className="grid h-9 w-9 place-items-center rounded-[8px] text-[#16181D] transition hover:bg-[#16181D]/[0.05]"
                  >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                      <path d="M10 3.5v13M3.5 10h13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  </button>
                  {menuIdeiasAberto && (
                    <ul role="listbox" aria-label="Ideias para começar" className="absolute left-0 top-[calc(100%+6px)] z-20 w-[300px] max-w-[calc(100vw-48px)] rounded-[12px] border border-[#16181D]/10 bg-white p-1.5 shadow-[0_16px_40px_-12px_rgba(22,24,29,0.3)]">
                      <li className="px-2.5 pb-1 pt-1.5 text-[12px] font-medium uppercase tracking-[0.08em] text-[#8A8F99]">Ideias para começar</li>
                      {EXEMPLOS_DIGITADOS.map((exemplo) => (
                        <li key={exemplo}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={false}
                            onClick={() => usarIdeiaPronta(exemplo)}
                            className="w-full rounded-[8px] px-2.5 py-2 text-left text-[14px] leading-[1.4] text-[#16181D] transition hover:bg-[#F0EEEC]"
                          >
                            {exemplo}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div ref={menuCanalRef} className="relative ml-auto">
                  <button
                    type="button"
                    aria-haspopup="listbox"
                    aria-expanded={menuCanalAberto}
                    onClick={() => {
                      setMenuIdeiasAberto(false);
                      setMenuCanalAberto((aberto) => !aberto);
                    }}
                    className="flex h-9 items-center gap-1.5 rounded-[8px] px-2.5 text-[16px] font-medium tracking-[-0.01em] text-[#16181D] transition hover:bg-[#16181D]/[0.05] sm:text-[17px]"
                  >
                    {canalAtual.rotulo}
                    <svg width="13" height="13" viewBox="0 0 12 12" fill="none" aria-hidden="true" className={`mt-px transition ${menuCanalAberto ? "rotate-180" : ""}`}>
                      <path d="m2.5 4.5 3.5 3.5 3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  {menuCanalAberto && (
                    <ul role="listbox" aria-label="Onde você quer vender" className="absolute right-0 top-[calc(100%+6px)] z-20 w-[230px] rounded-[12px] border border-[#16181D]/10 bg-white p-1.5 shadow-[0_16px_40px_-12px_rgba(22,24,29,0.3)]">
                      {CANAIS.map((item) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={item.id === canal}
                            onClick={() => escolherCanal(item.id)}
                            className={`flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-left text-[14px] transition hover:bg-[#F0EEEC] ${item.id === canal ? "bg-[#F0EEEC] font-medium" : ""}`}
                          >
                            <IconeAtalho canal={item.id} />
                            {item.rotulo}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {ditadoDisponivel && (
                  <button
                    type="button"
                    aria-label={ouvindo ? "Parar de ouvir" : "Falar a ideia"}
                    aria-pressed={ouvindo}
                    onClick={alternarDitado}
                    className={`grid h-9 w-9 place-items-center rounded-[8px] transition ${ouvindo ? "bg-[#2563EB]/10 text-[#2563EB]" : "text-[#16181D] hover:bg-[#16181D]/[0.05]"}`}
                  >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" className={ouvindo ? "animate-pulse" : ""}>
                      <rect x="7" y="2.5" width="6" height="10" rx="3" stroke="currentColor" strokeWidth="1.6" />
                      <path d="M4.5 9.5a5.5 5.5 0 0 0 11 0M10 15v2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  </button>
                )}

                <button
                  type="submit"
                  aria-label={logado ? "Ir para o painel" : "Começar com esta ideia"}
                  className="ml-1.5 grid h-10 w-10 place-items-center rounded-[8px] bg-[#2563EB] text-white transition hover:bg-[#1E3A8A]"
                >
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <path d="M6 14 14 6M7 6h7v7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </form>

            <div className="flex gap-2 overflow-x-auto px-[8px] pb-[6px] pt-[8px] [scrollbar-width:none] sm:flex-wrap [&::-webkit-scrollbar]:hidden">
              {CANAIS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => escolherCanal(item.id)}
                  className="flex h-[34px] shrink-0 items-center gap-2 rounded-[5px] bg-white px-[11px] text-[15px] tracking-[-0.01em] text-[#16181D] transition hover:bg-[#FAFAF8]"
                >
                  <IconeAtalho canal={item.id} />
                  {item.rotulo}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 pb-6 sm:mt-7 sm:pb-24">
          <VitrineExemplos />
        </div>
      </section>

      {/* ───────── Faixa de quem já vende ───────── */}
      <div className="relative border-y border-[#16181D]/10 bg-[#ECEBE6] px-4 py-5 sm:px-8">
        <p className="mx-auto max-w-[1200px] text-center text-[15px] leading-[1.5] text-[#33363D] sm:text-[16px]">
          <span className="font-semibold text-[#16181D]">Já vende no Mercado Livre com a Velo?</span> Continua tudo igual: catálogo, anúncios e pedidos. A loja própria é um canal a mais.
        </p>
      </div>

      {/* ───────── Duas formas de vender (modelo "The whole stack" da Base44) ───────── */}
      <section id="formas-de-vender" className="relative scroll-mt-20 px-4 py-20 sm:px-8 sm:py-28 lg:px-[90px] lg:py-32">
        <div className="mx-auto grid max-w-[1720px] gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] lg:gap-16">
          <div className="flex flex-col">
            <h2 className={`${TITULO} text-[clamp(40px,4.6vw,76px)] leading-[0.98]`}>
              Loja ou Mercado Livre.
              <br />
              Você escolhe.
            </h2>
            <p className="mt-6 max-w-[540px] text-[16px] leading-[1.55] text-[#2A2D34] sm:text-[18px]">
              Venda com produtos de fornecedores brasileiros, sem comprar estoque e sem montar nada do zero. Loja, anúncio e página já saem prontos da Velo.
            </p>

            {/* Colagem no lugar da engrenagem + foto + faixa laranja da referência. */}
            <div className="mt-12 flex h-[180px] w-full max-w-[500px] sm:h-[236px] lg:mt-28">
              <div
                className="grid aspect-square h-full place-items-center"
                style={{
                  backgroundColor: "#C3CEFA",
                  backgroundImage: "radial-gradient(rgba(43,84,238,0.18) 0.8px, transparent 1px)",
                  backgroundSize: "3px 3px",
                }}
              >
                <LogoVelo tamanho="58%" sizes="140px" />
              </div>
              <div className="relative h-full min-w-0 flex-1 overflow-hidden">
                <ImagemResponsiva
                  base="pessoa-02"
                  larguras={[640, 960]}
                  original="/pessoa%2002.webp"
                  alt="Mulher sorrindo olhando o celular"
                  sizes="(min-width: 640px) 260px, 50vw"
                  className="absolute inset-0 h-full w-full object-cover"
                  style={{ objectPosition: "68% 40%" }}
                />
              </div>
              <div className="h-full w-[20px] bg-[#FFE600]" aria-hidden="true" />
            </div>
          </div>

          <ul className="border-b-[1.5px] border-[#16181D] lg:border-b-0">
            {FORMAS.map((forma, indice) => {
              const aberta = formaAberta === indice;
              const ultima = indice === FORMAS.length - 1;
              return (
                <li key={forma.titulo} className={ultima ? "" : "border-b-[1.5px] border-[#16181D]"}>
                  <button
                    type="button"
                    aria-expanded={aberta}
                    onClick={() => setFormaAberta(aberta ? null : indice)}
                    className="group flex w-full items-center justify-between gap-6 py-5 text-left sm:py-7"
                  >
                    <span className={`${FONTE_TITULO} text-[24px] font-medium leading-[1.1] tracking-[-0.03em] text-[#16181D] sm:text-[clamp(28px,2.6vw,44px)]`}>
                      {forma.titulo}
                    </span>
                    <span
                      aria-hidden="true"
                      className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border-[2.5px] border-[#16181D] text-[#16181D] transition duration-200 group-hover:bg-[#16181D] group-hover:text-white sm:h-[54px] sm:w-[54px] sm:border-[3px] ${aberta ? "rotate-90 bg-[#16181D] text-white" : ""}`}
                    >
                      <svg viewBox="0 0 24 24" className="h-5 w-5 sm:h-6 sm:w-6" fill="none">
                        <path d="M5 12h13M13 6.5l5.5 5.5-5.5 5.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  </button>
                  {aberta && (
                    <p className="-mt-1 max-w-[640px] pb-6 pr-14 text-[16px] leading-[1.6] text-[#4A4F5A] sm:pb-8 sm:text-[18px]">{forma.texto}</p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* ───────── Como funciona (modelo "What will you build?" da Base44) ───────── */}
      <section id="como-funciona" className="relative scroll-mt-20 py-20 sm:py-28 lg:py-32">
        <div className="px-4 sm:px-8 lg:px-[90px]">
          <h2 className={`${TITULO} text-[clamp(40px,4.6vw,76px)] leading-[0.98]`}>Da ideia à primeira venda.</h2>
          <p className="mt-4 max-w-[960px] text-[17px] leading-[1.5] text-[#2A2D34] sm:mt-5 sm:text-[22px]">
            Três passos para vender online com a Velo, na sua loja, no Mercado Livre ou nos dois.
          </p>
        </div>

        {/* Cartões de ponta a ponta da tela, com a barra de cor no pé (laranja na referência, azul da Velo aqui).
            No hover o cartão inteiro vira azul, como na referência; o texto passa a branco para manter o contraste. */}
        <ol className="mt-12 grid gap-4 sm:mt-20 lg:grid-cols-3 lg:gap-5">
          {PASSOS.map((passo, indice) => (
            <li key={passo.titulo} className="group flex min-h-[340px] flex-col border-b-[10px] border-[#2563EB] bg-[#F8F7F4] px-5 pb-10 pt-6 transition-colors duration-300 hover:bg-[#2563EB] sm:min-h-[460px] sm:px-6 lg:min-h-[520px]">
              <div className="flex items-start justify-between gap-4">
                <h3 className={`${FONTE_TITULO} text-[40px] font-medium leading-[1] tracking-[-0.04em] text-[#16181D] transition-colors duration-300 group-hover:text-white sm:text-[52px]`}>{passo.titulo}</h3>
                <span className="[font-family:ui-monospace,'SF_Mono',Menlo,monospace] mt-2 text-[13px] text-[#8A8F99] transition-colors duration-300 group-hover:text-white/70">{passo.numero}</span>
              </div>
              <p className="mt-auto max-w-[520px] pt-16 text-[17px] leading-[1.5] text-[#2A2D34] transition-colors duration-300 group-hover:text-white sm:text-[20px]">{passo.texto}</p>
              <button
                type="button"
                onClick={() => {
                  if (indice === 0) {
                    escreverIdeia();
                    return;
                  }
                  if (indice === 1) {
                    irPara("recursos");
                    return;
                  }
                  comecar("cta_profit_signup_click");
                }}
                className="mt-8 h-[44px] w-fit rounded-[7px] bg-[#2B2B2B] px-5 text-[15px] font-medium text-white transition hover:bg-[#16181D]"
              >
                {indice === 2 && logado ? "Ir para o painel" : passo.botao}
              </button>
            </li>
          ))}
        </ol>
      </section>

      {/* ───────── Atlas (modelo "Beautiful by default" da Base44) ───────── */}
      <section id="atlas" className="relative scroll-mt-16 grid lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1fr)]">
        {/* Metade azul de ponta a ponta, com a trama do fundo por cima (versão transparente, mais marcada). */}
        <div className="relative overflow-hidden bg-[#2B54EE] px-6 py-16 sm:px-12 sm:py-24 lg:px-[90px] lg:py-32">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{ backgroundImage: "url(/landing/textura-trama.png?v=2)", backgroundSize: "238px 238px" }}
          />
          <div className="relative lg:sticky lg:top-32">
            <h2 className={`${FONTE_TITULO} text-[clamp(52px,6.6vw,124px)] font-semibold leading-[0.92] tracking-[-0.05em] text-[#F3F2EF]`}>
              Não sabe
              <br />
              o que vender?
              <br />
              Pergunte.
            </h2>
            <p className="mt-8 max-w-[600px] text-[18px] leading-[1.45] text-[#F3F2EF]/95 sm:text-[26px]">
              O Atlas, a IA da Velo, olha o catálogo com você e diz qual é o próximo passo, na sua loja ou no Mercado Livre.
            </p>
          </div>
        </div>

        <ul className="px-6 py-6 sm:px-12 lg:px-[90px] lg:py-16">
          {ATLAS_ITENS.map((item, indice) => (
            <li key={item.titulo} className={indice === ATLAS_ITENS.length - 1 ? "" : "border-b-[1.5px] border-[#16181D]"}>
              <button type="button" onClick={() => comecar("cta_profit_signup_click")} className="group block w-full py-10 text-left sm:py-14">
                <span className="flex items-center gap-3 sm:gap-4">
                  <span className={`${FONTE_TITULO} text-[28px] font-medium leading-[1.05] tracking-[-0.03em] text-[#16181D] sm:text-[clamp(32px,2.6vw,48px)]`}>
                    {item.titulo}
                  </span>
                  <span
                    aria-hidden="true"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full border-[2.5px] border-[#16181D] text-[#16181D] transition duration-200 group-hover:translate-x-1 group-hover:bg-[#16181D] group-hover:text-white sm:h-[52px] sm:w-[52px] sm:border-[3px]"
                  >
                    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] sm:h-6 sm:w-6" fill="none">
                      <path d="M5 12h13M13 6.5l5.5 5.5-5.5 5.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </span>
                <span className="mt-4 block max-w-[600px] text-[16px] leading-[1.5] text-[#2A2D34] sm:mt-5 sm:text-[21px]">{item.texto}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* ───────── Recursos (inspirado no "Built-in marketing tools" da Base44) ───────── */}
      <section id="recursos" className="relative scroll-mt-16 pt-20 sm:pt-28 lg:pt-32">
        <div className="px-4 sm:px-8 lg:px-[90px]">
          <p className="text-[17px] tracking-[-0.01em] text-[#2A2D34] sm:text-[24px]">Tudo o que vem depois de publicar</p>
          <h2 className={`${FONTE_TITULO} mt-4 max-w-[1100px] text-[30px] font-medium leading-[1.08] tracking-[-0.035em] text-[#16181D] sm:mt-5 sm:text-[clamp(36px,3vw,52px)]`}>
            A Velo não para no anúncio. Do produto ao pedido, tudo o que você precisa para vender fica no mesmo painel.
          </h2>
        </div>

        {/*
          Faixa de ponta a ponta com uma foto da landing bem desfocada (só a luz e as
          cores dela) e a trama do fundo por cima, para dar o granulado da referência.
          A foto é a menor versão (640px): desfocada, resolução não faz diferença.
        */}
        <div className="relative mt-12 overflow-hidden px-4 py-14 sm:mt-16 sm:px-8 sm:py-24">
          <div aria-hidden="true" className="absolute inset-0">
            <ImagemResponsiva
              base="pessoa-01"
              larguras={[640]}
              original="/pessoa%2001.webp"
              alt=""
              sizes="640px"
              className="h-full w-full scale-125 object-cover blur-[48px] saturate-[1.15]"
              style={{ objectPosition: "60% 45%" }}
            />
            <div className="absolute inset-0 bg-[#F0EEEC]/15" />
            <div
              className="absolute inset-0 opacity-60 mix-blend-multiply"
              style={{ backgroundImage: "url(/landing/textura-fundo.webp?v=2)", backgroundSize: "238px 238px" }}
            />
          </div>

          <ul className="relative mx-auto grid max-w-[1400px] gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
            {RECURSOS.map((recurso) => (
              <li key={recurso.titulo}>
                <button
                  type="button"
                  onClick={() => comecar("cta_profit_signup_click")}
                  className="group flex h-full min-h-[200px] w-full flex-col bg-[#F8F7F4] p-5 text-left transition-colors duration-200 hover:bg-white sm:min-h-[320px] sm:p-7"
                >
                  <span className="flex w-full items-start justify-between gap-4">
                    <span className={`${FONTE_TITULO} max-w-[260px] text-[28px] font-medium leading-[1.08] tracking-[-0.03em] text-[#16181D] sm:text-[32px]`}>
                      {recurso.titulo}
                    </span>
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-[#EEF4FF] text-[#2563EB]">
                      <IconeRecurso nome={recurso.icone} />
                    </span>
                  </span>
                  <span className="mt-auto block max-w-[360px] pt-6 text-[16px] sm:pt-10 leading-[1.5] text-[#2A2D34] sm:text-[18px]">{recurso.texto}</span>
                  <span
                    aria-hidden="true"
                    className="mt-5 grid h-[38px] w-[38px] place-items-center self-end sm:mt-8 rounded-full bg-[#16181D] text-white transition duration-200 group-hover:bg-[#2563EB]"
                  >
                    <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
                      <path d="M6 14 14 6M7 6h7v7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ───────── Números ───────── */}
      <section className="relative px-4 py-20 sm:px-8 sm:py-32 lg:px-[90px]">
        <div className="mx-auto grid max-w-[1720px] gap-8 border-y border-[#16181D]/10 py-10 sm:grid-cols-3 sm:gap-6 sm:py-14">
          {NUMEROS.map((item) => (
            <div key={item.rotulo} className="text-center sm:text-left">
              <p className={`${TITULO} text-[44px] leading-none sm:text-[60px]`}>{item.numero}</p>
              <p className="mt-3 text-[15px] text-[#4A4F5A]">{item.rotulo}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ───────── Perguntas (modelo "Frequently asked questions" da Base44) ───────── */}
      <section id="perguntas-frequentes" className="relative scroll-mt-20 px-4 pb-20 sm:px-8 sm:pb-32 lg:px-[90px]">
        <div className="mx-auto grid max-w-[1720px] gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] lg:gap-16">
          <div className="flex items-end justify-between gap-3 lg:flex-col lg:items-start lg:justify-start lg:gap-8">
            <h2 className={`${FONTE_TITULO} text-[clamp(40px,4.6vw,76px)] font-medium leading-[1.02] tracking-[-0.04em] text-[#16181D]`}>
              Perguntas
              <br />
              frequentes
            </h2>
            <img
              src={mascoteSentado}
              alt=""
              width={230}
              height={320}
              loading="lazy"
              className="pointer-events-none mr-2 h-auto w-14 shrink-0 select-none drop-shadow-[0_8px_8px_rgba(21,47,104,0.16)] sm:w-20 lg:ml-2 lg:w-28"
            />
          </div>
          <ul className="border-t-2 border-[#16181D]">
            {FAQ.map((item, indice) => {
              const aberta = faqAberta === indice;
              return (
                <li key={item.pergunta} className="border-b-2 border-[#16181D]">
                  <button
                    type="button"
                    aria-expanded={aberta}
                    onClick={() => setFaqAberta(aberta ? -1 : indice)}
                    className="group flex w-full items-center justify-between gap-6 py-6 text-left sm:py-9"
                  >
                    <span className={`${FONTE_TITULO} text-[21px] font-medium leading-[1.2] tracking-[-0.025em] text-[#16181D] sm:text-[clamp(24px,1.9vw,34px)]`}>
                      {item.pergunta}
                    </span>
                    <span
                      aria-hidden="true"
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-full border-[2.5px] border-[#16181D] text-[#16181D] transition duration-200 group-hover:bg-[#16181D] group-hover:text-white sm:h-11 sm:w-11"
                    >
                      <svg viewBox="0 0 24 24" className={`h-[18px] w-[18px] transition-transform duration-200 sm:h-5 sm:w-5 ${aberta ? "rotate-180" : ""}`} fill="none">
                        <path d="M12 5v13M6.5 12.5 12 18l5.5-5.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  </button>
                  {aberta && (
                    <p className="-mt-2 max-w-[740px] pb-8 pr-12 text-[16px] leading-[1.6] text-[#16181D] sm:-mt-3 sm:pb-11 sm:text-[17px]">{item.resposta}</p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* ───────── Chamada final (modelo "Go ahead. Build it yourself." da Base44) ───────── */}
      <section className="relative overflow-hidden bg-[#2B54EE] px-4 py-20 text-[#F3F2EF] sm:px-8 sm:py-24 lg:py-28">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{ backgroundImage: "url(/landing/textura-trama.png?v=2)", backgroundSize: "238px 238px" }}
        />
        <h2 className={`${FONTE_TITULO} relative mx-auto max-w-[1100px] text-center text-[clamp(44px,7vw,112px)] font-medium leading-[0.98] tracking-[-0.045em]`}>
          Pode começar.
          <br />
          O resto a gente monta.
        </h2>
        <div className="relative mt-5 sm:mt-8">
          <VitrineChamada />
        </div>
        <div className="relative mt-12 flex justify-center sm:mt-20">
          <button
            type="button"
            onClick={() => comecar("cta_final_signup_click")}
            className="group flex items-start gap-3 text-left sm:gap-5"
          >
            <span
              aria-hidden="true"
              className="mt-[0.35em] grid h-9 w-9 shrink-0 place-items-center rounded-full border-[2.5px] border-current transition duration-200 group-hover:bg-[#F3F2EF] group-hover:text-[#2B54EE] sm:h-14 sm:w-14 sm:border-[3.5px]"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 sm:h-7 sm:w-7" fill="none">
                <path d="M5 12h13M13 6.5l5.5 5.5-5.5 5.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span
              className={`${FONTE_TITULO} text-[clamp(44px,7vw,112px)] font-medium leading-[1.05] tracking-[-0.045em] underline decoration-[0.07em] underline-offset-[0.14em] transition group-hover:decoration-transparent`}
            >
              {logado ? "Ir para o painel" : "Começar agora"}
            </span>
          </button>
        </div>
      </section>

      {/* ───────── Rodapé (modelo da Base44: texto à esquerda, colunas à direita) ───────── */}
      <footer className="relative px-4 pb-10 pt-16 sm:px-8 sm:pt-24 lg:px-[90px]">
        <div className="mx-auto grid max-w-[1720px] gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:gap-16">
          <div>
            <VeloLogo />
            <p className="mt-6 max-w-[500px] text-[15px] leading-[1.6] text-[#16181D]">
              A Velo é a plataforma para qualquer pessoa vender online: na sua própria loja, no Mercado Livre ou nos dois. Você escolhe os produtos no catálogo de fornecedores brasileiros e a Velo monta a loja, as páginas e os anúncios.
            </p>
          </div>
          <nav aria-label="Rodapé" className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3">
            {[
              {
                titulo: "Produto",
                links: [
                  { rotulo: "Formas de vender", alvo: "formas-de-vender" },
                  { rotulo: "Como funciona", alvo: "como-funciona" },
                  { rotulo: "Atlas IA", alvo: "atlas" },
                  { rotulo: "Recursos", alvo: "recursos" },
                ],
              },
              {
                titulo: "Ajuda",
                links: [
                  { rotulo: "Central de Ajuda", href: "/ajuda" },
                  { rotulo: "Perguntas frequentes", alvo: "perguntas-frequentes" },
                  { rotulo: "Reembolso", href: "/ajuda/reembolso" },
                  { rotulo: "Entrar", href: "/login" },
                ],
              },
              {
                titulo: "Legal",
                links: [
                  { rotulo: "Termos de serviço", href: "/termos-de-servico" },
                  { rotulo: "Política de privacidade", href: "/politica-de-privacidade" },
                ],
              },
            ].map((coluna) => (
              <div key={coluna.titulo}>
                <p className="text-[15px] text-[#6B6F78]">{coluna.titulo}</p>
                <ul className="mt-4 space-y-1">
                  {coluna.links.map((link) => (
                    <li key={link.rotulo}>
                      {"href" in link ? (
                        <a href={link.href} className="inline-flex min-h-[32px] items-center text-[15px] text-[#16181D] transition hover:text-[#2563EB]">
                          {link.rotulo}
                        </a>
                      ) : (
                        <button type="button" onClick={() => irPara(link.alvo)} className="inline-flex min-h-[32px] items-center text-left text-[15px] text-[#16181D] transition hover:text-[#2563EB]">
                          {link.rotulo}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
        <p className="mx-auto mt-16 max-w-[1720px] text-[14px] text-[#16181D] sm:mt-24">© {new Date().getFullYear()} Velo. Apenas venda.</p>
      </footer>
    </main>
  );
}
