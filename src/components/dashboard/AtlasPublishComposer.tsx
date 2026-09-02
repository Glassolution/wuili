import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  ExternalLink,
  Loader2,
  PencilLine,
  Rocket,
  Sparkles,
} from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { useAtlasChat } from "@/contexts/AtlasChatContext";
import { supabase } from "@/integrations/supabase/client";
import { veloToast } from "@/components/ui/velo-toast";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useUpgradeModal } from "@/components/PlansUpgradeModal";
import { startMercadoLivreOAuth } from "@/lib/mercadoLivreOAuth";
import { salvarRetornoMl } from "@/lib/mlOauthRetorno";
import MlMissingInfoModal from "@/components/dashboard/MlMissingInfoModal";
import {
  getActiveStore,
  getStorePublishedCount,
  incrementStorePublishedCount,
} from "@/components/dashboard/FirstStoreOnboarding";
import {
  ErroDePublicacao,
  MAX_TITULO_ML,
  MULTIPLICADOR_SUGERIDO,
  gerarDescricaoComIa,
  inferProductBrand,
  inferStickerAlbumName,
  isStickerAlbumProduct,
  montarAtributosMl,
  primeiraImagemDoProduto,
  publicarNoMercadoLivre,
  type ProdutoDoCatalogo,
} from "@/lib/publicacaoMercadoLivre";

/**
 * Publicação no Mercado Livre conduzida dentro da conversa do Atlas.
 *
 * Antes o botão do chat abria o modal do catálogo por cima da conversa: a
 * pessoa saía do fio do guia justamente no passo final. Aqui o Atlas pergunta o
 * que precisa em etapas — título e lucro, depois a descrição, depois a revisão
 * — e publica de dentro do chat. As regras de publicação são as mesmas do
 * catálogo, importadas de `@/lib/publicacaoMercadoLivre`.
 */

type Props = {
  produtoId: string;
  /** Rótulo que veio do Atlas; usado no botão final. */
  label?: string;
  /** No painel lateral (~400px) tudo empilha em vez de dividir em duas colunas. */
  compacto?: boolean;
};

type Etapa = "carregando" | "specs" | "descricao" | "revisao" | "publicado";

const formatarBRL = (valor: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);

const Campo = ({
  rotulo,
  children,
  dica,
}: {
  rotulo: string;
  children: React.ReactNode;
  dica?: string;
}) => (
  <label className="block">
    <span className="mb-1 block text-[11.5px] font-semibold text-[#4B4B46]">{rotulo}</span>
    {children}
    {dica ? <span className="mt-1 block text-[10.5px] text-[#9A9A94]">{dica}</span> : null}
  </label>
);

const entrada =
  "w-full rounded-[10px] border border-black/[0.10] bg-white px-2.5 py-2 text-[12.5px] text-[#111111] outline-none transition-colors focus:border-[#2563EB]/50";

const AtlasPublishComposer = ({ produtoId, label, compacto = false }: Props) => {
  const { user } = useAuth();
  const planLimits = usePlanLimits();
  const upgradeModal = useUpgradeModal();
  // Quem explica a conta de vendedor bloqueada é o Atlas, na conversa — antes
  // era um modal de tutorial que aparecia sem contexto nenhum.
  const { avisarContaDeVendedorBloqueada } = useAtlasChat();

  const [produto, setProduto] = useState<ProdutoDoCatalogo | null>(null);
  const [etapa, setEtapa] = useState<Etapa>("carregando");
  const [erroDeCarga, setErroDeCarga] = useState<string | null>(null);
  const [conectadoAoMl, setConectadoAoMl] = useState<boolean | null>(null);

  const [titulo, setTitulo] = useState("");
  const [multiplicador, setMultiplicador] = useState(MULTIPLICADOR_SUGERIDO);
  const [preco, setPreco] = useState(0);
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [nomeDoAlbum, setNomeDoAlbum] = useState("");

  const [descricao, setDescricao] = useState("");
  // null = ainda não respondeu quem escreve a descrição.
  const [quemEscreve, setQuemEscreve] = useState<"atlas" | "usuario" | null>(null);
  const [gerandoDescricao, setGerandoDescricao] = useState(false);

  const [publicando, setPublicando] = useState(false);
  const [conectando, setConectando] = useState(false);
  const [verificandoVendedor, setVerificandoVendedor] = useState(false);
  // Conta de vendedor recusada pelo ML: trava o botão e explica na conversa.
  const [contaBloqueada, setContaBloqueada] = useState(false);
  // Códigos crus do ML (ex.: "address_pending") — alimentam o modal que diz
  // exatamente o que falta no cadastro da conta.
  const [mlMissingCodes, setMlMissingCodes] = useState<string[] | null>(null);
  const [resultado, setResultado] = useState<{ permalink: string; item_id: string } | null>(null);

  const publicandoRef = useRef(false);

  // Carrega o produto e o estado da conexão com o Mercado Livre.
  useEffect(() => {
    let ativo = true;
    if (!produtoId) {
      setErroDeCarga("Não consegui identificar o produto. Escolha o produto de novo com o Atlas.");
      setEtapa("specs");
      return;
    }

    void (async () => {
      try {
        const [{ data, error }, integracao] = await Promise.all([
          supabase.from("catalog_products").select("*").eq("id", produtoId).maybeSingle(),
          user?.id
            ? supabase
                .from("user_integrations")
                .select("access_token")
                .eq("user_id", user.id)
                .eq("platform", "mercadolivre")
                .maybeSingle()
            : Promise.resolve({ data: null }),
        ]);
        if (!ativo) return;
        if (error) throw new Error(error.message);
        if (!data) throw new Error("Produto não encontrado no catálogo.");

        const carregado = data as unknown as ProdutoDoCatalogo;
        const tituloCurto = carregado.title.slice(0, MAX_TITULO_ML);
        setProduto(carregado);
        setTitulo(tituloCurto);
        setPreco(Math.round((carregado.cost_price ?? 0) * MULTIPLICADOR_SUGERIDO * 100) / 100);
        setMarca(inferProductBrand(carregado, tituloCurto));
        setModelo((carregado.model ?? "").trim());
        setNomeDoAlbum(inferStickerAlbumName(carregado, tituloCurto));
        setMlMissingCodes(null);
        setConectadoAoMl(Boolean((integracao.data as { access_token?: string } | null)?.access_token));
        setEtapa("specs");
      } catch (e) {
        if (!ativo) return;
        setErroDeCarga(e instanceof Error ? e.message : "Não consegui carregar o produto agora.");
        setEtapa("specs");
      }
    })();

    return () => {
      ativo = false;
    };
  }, [produtoId, user?.id]);

  const custo = produto?.cost_price ?? 0;
  const estoque = produto?.stock_quantity ?? 0;
  const lucro = useMemo(() => Math.round((preco - custo) * 100) / 100, [preco, custo]);
  const margem = useMemo(
    () => (preco > 0 ? Math.round(((preco - custo) / preco) * 100) : 0),
    [preco, custo],
  );
  const exigeAtributosDeAlbum = isStickerAlbumProduct(produto, titulo);
  const imagem = produto ? primeiraImagemDoProduto(produto.images) : null;

  const aplicarMultiplicador = (valor: number) => {
    setMultiplicador(valor);
    setPreco(Math.round(custo * valor * 100) / 100);
  };

  const aplicarPreco = (texto: string) => {
    const numero = Number(texto.replace(",", "."));
    if (texto === "" || Number.isNaN(numero)) {
      setPreco(0);
      return;
    }
    setPreco(numero);
    if (custo > 0) setMultiplicador(Math.min(Math.max(numero / custo, 1.5), 5));
  };

  const conectarMercadoLivre = async () => {
    if (conectando) return;
    setConectando(true);
    try {
      salvarRetornoMl({ origem: "atlas", rota: `${window.location.pathname}${window.location.search}`, threadId: null });
      await startMercadoLivreOAuth({ novaAba: false });
    } catch (e) {
      veloToast.error(e instanceof Error ? e.message : "Não foi possível abrir a conexão com o Mercado Livre");
    } finally {
      setConectando(false);
    }
  };

  const gerarDescricao = async () => {
    if (!produto || gerandoDescricao) return;
    setQuemEscreve("atlas");
    setGerandoDescricao(true);
    try {
      const texto = await gerarDescricaoComIa({ titulo, categoria: produto.category, preco });
      setDescricao(texto);
    } catch (e) {
      veloToast.error(e instanceof Error ? e.message : "Erro ao gerar descrição");
      setQuemEscreve(null);
    } finally {
      setGerandoDescricao(false);
    }
  };

  /** Mesmas travas do modal do catálogo, na ordem em que o usuário as resolve. */
  const validar = (): boolean => {
    if (!produto) return veloToast.error("Produto não carregado"), false;
    if (!titulo.trim()) return veloToast.error("Preencha o título"), false;
    if (titulo.length > MAX_TITULO_ML) return veloToast.error(`Máximo ${MAX_TITULO_ML} caracteres`), false;
    if (preco <= 0) return veloToast.error("Defina um preço válido"), false;
    if (preco <= custo) return veloToast.error("O preço tem que ser maior que o custo"), false;
    if (estoque <= 0) return veloToast.error("Produto sem estoque"), false;
    if (!conectadoAoMl) return veloToast.error("Conecte sua conta do Mercado Livre"), false;
    if (!marca.trim()) return veloToast.error("Informe a marca (use 'Genérica' se não houver)"), false;
    if (exigeAtributosDeAlbum && !nomeDoAlbum.trim()) return veloToast.error("Informe o nome do álbum"), false;
    return true;
  };

  const publicar = useCallback(async () => {
    if (publicandoRef.current || !produto) return;
    if (!validar()) return;

    if (planLimits.loading) {
      veloToast.info("Verificando seu plano...");
      return;
    }
    if (!planLimits.canPublishProducts) {
      upgradeModal.open();
      return;
    }

    // Descarta motivos de uma tentativa anterior antes de consultar o ML novamente.
    setMlMissingCodes(null);

    // Limite de produtos da loja Velo ativa, quando existe uma.
    const loja = getActiveStore();
    if (loja) {
      const publicados = getStorePublishedCount(loja.id);
      const limite = loja.productLimit ?? 30;
      if (publicados >= limite) {
        veloToast.error(`Limite de ${limite} produtos atingido nesta loja`);
        return;
      }
    }

    // A conta pode ter sido ajustada desde a última tentativa: revalidamos com
    // o Mercado Livre na hora, em vez de confiar num estado antigo.
    setVerificandoVendedor(true);
    try {
      const { data } = await supabase.functions.invoke("ml-seller-status");
      if (data?.connected && data?.canList === false) {
        setContaBloqueada(true);
        setMlMissingCodes(Array.isArray(data?.codes) ? data.codes : []);
        avisarContaDeVendedorBloqueada();
        return;
      }
    } catch {
      // Sem resposta do ML, seguimos: a própria publicação devolve
      // ML_SELLER_CANNOT_LIST se a conta não estiver apta.
    } finally {
      setVerificandoVendedor(false);
    }

    publicandoRef.current = true;
    setPublicando(true);
    // Não exibimos toast de carregamento: o composer já comunica o estado.
    const toastId = `ml-publish-${Date.now()}`;
    try {
      const dados = await publicarNoMercadoLivre({
        produto,
        titulo,
        preco,
        descricao,
        marca,
        modelo,
        atributos: montarAtributosMl({
          marca,
          modelo,
          nomeDoAlbum,
          exigeAtributosDeAlbum,
        }),
        estoque,
      });

      setMlMissingCodes(null);
      setResultado(dados);
      setEtapa("publicado");
      if (loja) incrementStorePublishedCount(loja.id);
      void planLimits.refreshUsage();
      if (dados.parcial) {
        veloToast.warning(dados.mensagem ?? "Algumas variações não foram publicadas.", { id: toastId });
      } else {
        veloToast.success(dados.mensagem ?? "Produto publicado com sucesso", { id: toastId });
      }
    } catch (erro) {
      const codigo = erro instanceof ErroDePublicacao ? erro.codigo : undefined;
      if (codigo === "ML_SELLER_CANNOT_LIST") {
        veloToast.dismiss(toastId);
        setContaBloqueada(true);
        setMlMissingCodes(erro instanceof ErroDePublicacao ? (erro.sellerCodes ?? []) : []);
        avisarContaDeVendedorBloqueada();
        return;
      }
      if (codigo === "CATEGORY_REQUIRES_MANUAL" || codigo === "CATEGORY_LOW_CONFIDENCE") {
        veloToast.error(
          "Não consegui publicar este produto no Mercado Livre agora. Vamos tentar com outro produto.",
          { id: toastId },
        );
        return;
      }
      veloToast.error(erro instanceof Error ? erro.message : "Erro ao publicar", { id: toastId });
    } finally {
      publicandoRef.current = false;
      setPublicando(false);
    }
    // `validar` depende de quase todo o estado do formulário; listar tudo aqui
    // só recriaria a função a cada tecla digitada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    descricao, estoque, exigeAtributosDeAlbum, marca, modelo, nomeDoAlbum, planLimits, preco, produto,
    titulo, upgradeModal,
  ]);

  if (etapa === "carregando") {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-2xl border border-black/[0.07] bg-white p-4 text-[12.5px] text-[#6B6B66]">
        <Loader2 className="h-4 w-4 animate-spin text-[#2563EB]" />
        Abrindo a publicação do produto…
      </div>
    );
  }

  if (erroDeCarga) {
    return (
      <div className="mt-3 flex items-start gap-2 rounded-2xl border border-rose-200/70 bg-rose-50/70 p-4">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
        <p className="text-[12.5px] text-rose-700">{erroDeCarga}</p>
      </div>
    );
  }

  // ── Publicado ─────────────────────────────────────────────────────────────
  if (etapa === "publicado" && resultado) {
    return (
      <div className="mt-3 rounded-2xl border border-emerald-200/70 bg-emerald-50/60 p-4">
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-600 text-white">
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          </span>
          <p className="text-[13px] font-bold text-emerald-900">Anúncio publicado no Mercado Livre</p>
        </div>
        <p className="mt-1.5 text-[12px] leading-[17px] text-emerald-800">
          <strong>{titulo}</strong> está no ar por {formatarBRL(preco)} — {formatarBRL(lucro)} de lucro por venda.
        </p>
        {resultado.permalink && (
          <a
            href={resultado.permalink}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-700 px-3 py-1.5 text-[11.5px] font-semibold text-white transition-colors hover:bg-emerald-800"
          >
            Ver anúncio no Mercado Livre
            <ExternalLink className="h-3 w-3" strokeWidth={2.4} />
          </a>
        )}
      </div>
    );
  }

  const semEstoque = estoque <= 0;

  return (
    <>
      <section className="mt-3 overflow-hidden rounded-2xl border border-black/[0.07] bg-white">
        {/* Cabeçalho com a ficha do produto: o que está sendo publicado fica
            visível em todas as etapas. */}
        <header className="flex items-center gap-2.5 border-b border-black/[0.05] bg-[#FBFBFA] px-3.5 py-2.5">
          <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-white">
            {imagem ? (
              <img src={imagem} alt="" referrerPolicy="no-referrer" className="h-full w-full object-contain p-1" />
            ) : (
              <Rocket className="h-4 w-4 text-[#8A8A8A]" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-bold text-[#111111]">{produto?.title}</p>
            {/* O valor do custo em cinza-sobre-cinza passava batido. Ele é a
                referência do preço inteiro, então ganha peso de texto. */}
            <p className="text-[10.5px] text-[#8A8A8A]">
              Custo <strong className="font-semibold text-[#4B4B46]">{formatarBRL(custo)}</strong> · {estoque} em
              estoque
            </p>
          </div>
        </header>

        <div className="p-3.5">
          {/* ── Etapa 1: título, preço e lucro ─────────────────────────── */}
          {etapa === "specs" && (
            <div className="flex flex-col gap-3">
              <Campo rotulo="Título do anúncio" dica={`${titulo.length}/${MAX_TITULO_ML} — use as palavras que o comprador digita na busca`}>
                <input
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value.slice(0, MAX_TITULO_ML))}
                  className={entrada}
                  placeholder="Ex.: Fone Bluetooth TWS com Case de Carga"
                />
              </Campo>

              <div className={compacto ? "flex flex-col gap-3" : "grid grid-cols-2 gap-3"}>
                {/* O custo aparece colado no campo de preço porque é aqui que
                    a pessoa decide o número: saber que paga X ao fornecedor é o
                    que dá sentido ao preço que ela está digitando. */}
                <Campo rotulo="Preço de venda" dica={`Você paga ${formatarBRL(custo)} ao fornecedor`}>
                  <input
                    value={preco === 0 ? "" : String(preco)}
                    onChange={(e) => aplicarPreco(e.target.value)}
                    inputMode="decimal"
                    className={entrada}
                    placeholder="0,00"
                  />
                </Campo>
                {/* O lucro é o número que a pessoa realmente quer ver: fica ao
                    lado do preço, não escondido numa linha de resumo. A conta
                    vem junto para o valor não parecer que saiu do nada. */}
                <div className="rounded-[10px] bg-[#F4F7FF] px-2.5 py-2">
                  <span className="block text-[11.5px] font-semibold text-[#4B4B46]">Seu lucro por venda</span>
                  <span className={`text-[15px] font-bold ${lucro > 0 ? "text-[#1D4ED8]" : "text-rose-600"}`}>
                    {formatarBRL(lucro)}
                  </span>
                  <span className="ml-1.5 text-[11px] text-[#8A8A8A]">{margem}% de margem</span>
                  <span className="mt-0.5 block text-[10.5px] text-[#8A8A8A]">
                    {formatarBRL(preco)} − {formatarBRL(custo)} de custo
                  </span>
                </div>
              </div>

              <div>
                <input
                  type="range"
                  min={1.5}
                  max={5}
                  step={0.1}
                  value={multiplicador}
                  onChange={(e) => aplicarMultiplicador(Number(e.target.value))}
                  className="w-full accent-[#2563EB]"
                  aria-label="Multiplicador sobre o custo"
                />
                <p className="text-[10.5px] text-[#9A9A94]">
                  {multiplicador.toFixed(1).replace(".", ",")}x o custo — a Velo sugere{" "}
                  {MULTIPLICADOR_SUGERIDO.toString().replace(".", ",")}x
                </p>
              </div>

              <div className={compacto ? "flex flex-col gap-3" : "grid grid-cols-2 gap-3"}>
                <Campo rotulo="Marca" dica="O Mercado Livre exige. Use 'Genérica' se não houver.">
                  <input value={marca} onChange={(e) => setMarca(e.target.value)} className={entrada} />
                </Campo>
                <Campo rotulo="Modelo (opcional)">
                  <input value={modelo} onChange={(e) => setModelo(e.target.value)} className={entrada} />
                </Campo>
              </div>

              {exigeAtributosDeAlbum && (
                <Campo rotulo="Nome do álbum" dica="Obrigatório para figurinhas.">
                  <input value={nomeDoAlbum} onChange={(e) => setNomeDoAlbum(e.target.value)} className={entrada} />
                </Campo>
              )}

              {semEstoque && (
                <p className="rounded-[10px] bg-rose-50 px-2.5 py-2 text-[11.5px] text-rose-700">
                  Este produto está sem estoque no catálogo e não pode ser publicado agora.
                </p>
              )}

              {conectadoAoMl === false && (
                <div className="rounded-[10px] bg-[#FFF7ED] px-2.5 py-2">
                  <p className="text-[11.5px] text-[#9A3412]">
                    Sua conta do Mercado Livre ainda não está conectada. Sua senha nunca passa pela Velo.
                  </p>
                  <button
                    type="button"
                    onClick={() => void conectarMercadoLivre()}
                    disabled={conectando}
                    className="mt-2 inline-flex items-center rounded-full bg-[#2563EB] px-3 py-1.5 text-[11.5px] font-semibold text-white transition-colors hover:bg-[#1D4ED8] disabled:cursor-wait disabled:opacity-60"
                  >
                    {conectando ? "Abrindo o Mercado Livre…" : "Conectar Mercado Livre"}
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => setEtapa("descricao")}
                disabled={!titulo.trim() || preco <= custo || semEstoque}
                className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#2563EB] px-3.5 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Agora a descrição
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.4} />
              </button>
            </div>
          )}

          {/* ── Etapa 2: descrição ─────────────────────────────────────── */}
          {etapa === "descricao" && (
            <div className="flex flex-col gap-3">
              <p className="text-[12.5px] leading-[18px] text-[#4B4B46]">
                Quer que eu escreva a descrição do anúncio pra você, ou prefere escrever?
              </p>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void gerarDescricao()}
                  disabled={gerandoDescricao}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors disabled:cursor-wait disabled:opacity-60 ${
                    quemEscreve === "atlas"
                      ? "bg-[#2563EB] text-white"
                      : "border !border-[#D8E4FB] bg-[#F0F5FF] text-[#1D4ED8] hover:bg-[#E4EDFF]"
                  }`}
                >
                  {gerandoDescricao ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" strokeWidth={2.2} />
                  )}
                  {gerandoDescricao ? "Escrevendo…" : "Escreve pra mim"}
                </button>
                <button
                  type="button"
                  onClick={() => setQuemEscreve("usuario")}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                    quemEscreve === "usuario"
                      ? "bg-[#2563EB] text-white"
                      : "border !border-[#DCE3F0] bg-white text-[#1E3A8A] hover:bg-[#F5F8FF]"
                  }`}
                >
                  <PencilLine className="h-3.5 w-3.5" strokeWidth={2.2} />
                  Eu escrevo
                </button>
              </div>

              {(quemEscreve === "usuario" || descricao) && (
                <Campo
                  rotulo="Descrição"
                  dica={
                    quemEscreve === "atlas"
                      ? "Escrevi essa versão — pode editar à vontade antes de publicar."
                      : "Conte o que o produto resolve, para quem serve e por que vale a pena."
                  }
                >
                  <textarea
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    rows={compacto ? 6 : 8}
                    className={`${entrada} resize-y leading-[18px]`}
                    placeholder="Descrição do anúncio…"
                  />
                </Campo>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEtapa("revisao")}
                  disabled={gerandoDescricao}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#2563EB] px-3.5 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-[#1D4ED8] disabled:opacity-40"
                >
                  Revisar antes de publicar
                  <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.4} />
                </button>
                <button
                  type="button"
                  onClick={() => setEtapa("specs")}
                  className="text-[11.5px] font-semibold text-[#8A8A8A] hover:text-[#111111]"
                >
                  Voltar
                </button>
                {!descricao && (
                  <span className="text-[10.5px] text-[#9A9A94]">
                    Sem descrição eu publico com um texto curto padrão.
                  </span>
                )}
              </div>
            </div>
          )}

          {/* ── Etapa 3: revisão e publicação ──────────────────────────── */}
          {etapa === "revisao" && (
            <div className="flex flex-col gap-3">
              <dl className="divide-y divide-black/[0.05] overflow-hidden rounded-[10px] border border-black/[0.06]">
                {[
                  ["Título", titulo],
                  ["Custo do produto", formatarBRL(custo)],
                  ["Preço de venda", formatarBRL(preco)],
                  ["Seu lucro", `${formatarBRL(lucro)} · ${margem}% de margem`],
                  ["Marca", marca || "—"],
                  ["Estoque no anúncio", String(Math.min(estoque, 10))],
                  ["Descrição", descricao ? `${descricao.slice(0, 90)}…` : "Texto curto padrão"],
                ].map(([rotulo, valor]) => (
                  <div key={rotulo} className="flex items-start justify-between gap-3 px-2.5 py-2">
                    <dt className="shrink-0 text-[11.5px] text-[#8A8A8A]">{rotulo}</dt>
                    <dd className="text-right text-[11.5px] font-semibold text-[#111111]">{valor}</dd>
                  </div>
                ))}
              </dl>

              {/* A explicação completa fica na fala do Atlas, logo abaixo. Aqui
                  vai só o suficiente para o botão não parecer que falhou à toa —
                  e ele continua ativo, para tentar de novo depois de resolver. */}
              {contaBloqueada && (
                <p className="rounded-[10px] bg-[#FFF7ED] px-2.5 py-2 text-[11.5px] leading-[16px] text-[#9A3412]">
                  O Mercado Livre recusou: sua conta de vendedor ainda não está ativa. Te expliquei o passo a passo
                  aqui embaixo — quando terminar lá, é só tocar em publicar de novo.
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void publicar()}
                  disabled={publicando || verificandoVendedor || conectadoAoMl === false}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#2563EB] px-4 py-2 text-[12.5px] font-bold text-white transition-colors hover:bg-[#1D4ED8] disabled:cursor-wait disabled:opacity-60"
                >
                  {publicando || verificandoVendedor ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Rocket className="h-4 w-4" strokeWidth={2.2} />
                  )}
                  {publicando
                    ? "Publicando…"
                    : verificandoVendedor
                      ? "Conferindo sua conta…"
                      : (label ?? "Publicar no Mercado Livre")}
                </button>
                <button
                  type="button"
                  onClick={() => setEtapa("descricao")}
                  disabled={publicando}
                  className="text-[11.5px] font-semibold text-[#8A8A8A] hover:text-[#111111] disabled:opacity-40"
                >
                  Voltar
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <MlMissingInfoModal
        open={mlMissingCodes !== null}
        sellerCodes={mlMissingCodes ?? []}
        onClose={() => setMlMissingCodes(null)}
      />
    </>
  );
};

export default AtlasPublishComposer;
