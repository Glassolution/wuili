// Início do painel no celular: saudação, números reais de venda, ações e pedidos
// recentes, no desenho de painel de loja.
//
// A grade de produtos saiu daqui: buscar e escolher produto é na tela do catálogo.
// Por isso este componente não baixa mais o catálogo — só o que o topo mostra.
//
// O componente é autossuficiente, sem depender do estado do desktop
// (DashboardHomePage cuida só do desktop).
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowDown, ArrowUp, ArrowUpRight, Banknote, ChevronRight, Folder, Link2, Plus, ReceiptText, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/lib/profileContext";
import { listCollectionsWithSummaries, type CollectionSummary } from "@/lib/collectionsApi";
import { veloToast } from "@/components/ui/velo-toast";
import { primeiroNomeSaudacao } from "@/lib/nomeDeExibicao";
import { lerRespostasDoQuiz } from "@/lib/perfilDoQuiz";
import { produtoJaEscolhido } from "@/lib/primeiroProduto";
import MLConnectPrepareModal from "@/components/dashboard/MLConnectPrepareModal";
import NotificacoesPopover from "@/components/dashboard/NotificacoesPopover";
import { startMercadoLivreOAuth } from "@/lib/mercadoLivreOAuth";
import { trackMobileHomeEvent } from "@/lib/mobileHomeTracking";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);

const formatInteger = (value: number) => new Intl.NumberFormat("pt-BR").format(value);

/*
  Resumo de vendas do topo da home. Mesma regra da tela de Resultados: pedido
  cancelado, reembolsado ou devolvido não conta como venda — nem na receita, nem
  no lucro. A contagem de pedidos inclui todos, como lá.
*/
type PedidoRecente = {
  id: string;
  titulo: string;
  imagem: string | null;
  valor: number;
  status: string;
  data: string | null;
  plataforma: string;
  /** Número curto para exibir; o completo fica na tela de Pedidos. */
  numero: string;
  rastreio: string | null;
};

type ResumoVendas = {
  receita: number;
  /** Soma só dos pedidos com custo registrado; null quando nenhum tem custo. */
  lucro: number | null;
  /** Quantos pedidos válidos entraram no lucro e quantos ficaram de fora. */
  lucroPedidosComCusto: number;
  lucroPedidosSemCusto: number;
  pedidos: number;
  /** Variação contra o período anterior; null quando não há base para comparar. */
  receitaVariacao: number | null;
  lucroVariacao: number | null;
  pedidosVariacao: number | null;
  /** "vs mês passado" quando a janela é calendário; senão "vs período anterior". */
  variacaoRotulo: string;
  recentes: PedidoRecente[];
};

type LinhaPedido = Pick<
  Database["public"]["Tables"]["orders"]["Row"],
  "id" | "product_title" | "product_image" | "total_amount" | "sale_price" | "quantity" | "status" | "profit" | "cost_price" | "created_at" | "ordered_at" | "platform" | "ml_order_id" | "external_order_id" | "tracking_code"
>;

const STATUS_ANULADOS = ["cancelled", "canceled", "refunded", "returned"];

const STATUS_PEDIDO: Record<string, { rotulo: string; classe: string }> = {
  pending: { rotulo: "Pendente", classe: "bg-[#FEF3C7] text-[#B45309]" },
  unpaid: { rotulo: "Não pago", classe: "bg-[#FEE2E2] text-[#B91C1C]" },
  paid: { rotulo: "Pago", classe: "bg-[#DCFCE7] text-[#15803D]" },
  approved: { rotulo: "Pago", classe: "bg-[#DCFCE7] text-[#15803D]" },
  shipped: { rotulo: "Enviado", classe: "bg-[#DBEAFE] text-[#1D4ED8]" },
  in_transit: { rotulo: "Em trânsito", classe: "bg-[#DBEAFE] text-[#1D4ED8]" },
  in_process: { rotulo: "Processando", classe: "bg-[#DBEAFE] text-[#1D4ED8]" },
  processing: { rotulo: "Processando", classe: "bg-[#DBEAFE] text-[#1D4ED8]" },
  delivered: { rotulo: "Entregue", classe: "bg-[#DCFCE7] text-[#15803D]" },
  completed: { rotulo: "Concluído", classe: "bg-[#DCFCE7] text-[#15803D]" },
  cancelled: { rotulo: "Cancelado", classe: "bg-[#FEE2E2] text-[#B91C1C]" },
  canceled: { rotulo: "Cancelado", classe: "bg-[#FEE2E2] text-[#B91C1C]" },
  refunded: { rotulo: "Reembolsado", classe: "bg-[#F1F5F9] text-[#475569]" },
  returned: { rotulo: "Devolvido", classe: "bg-[#F1F5F9] text-[#475569]" },
};

// `logo` aparece no lugar do ponto colorido quando a plataforma tem uma. Para o
// Mercado Livre é o PNG oficial: o fundo branco dele some na pílula branca, e o
// SVG desenhado à mão (mercado-livre-handshake.svg) vira borrão nesse tamanho.
const PLATAFORMAS: Record<string, { rotulo: string; cor: string; logo?: string }> = {
  mercadolivre: { rotulo: "Mercado Livre", cor: "#FFD100", logo: "/brand/mercado-livre.png" },
  mercado_livre: { rotulo: "Mercado Livre", cor: "#FFD100", logo: "/brand/mercado-livre.png" },
  shopee: { rotulo: "Shopee", cor: "#EE4D2D" },
  tiktok: { rotulo: "TikTok Shop", cor: "#111111" },
  tiktok_shop: { rotulo: "TikTok Shop", cor: "#111111" },
  shopify: { rotulo: "Shopify", cor: "#5E8E3E" },
};

const valorDoPedido = (pedido: LinhaPedido) => Number(pedido.total_amount ?? pedido.sale_price * pedido.quantity) || 0;

/*
  Lucro só existe quando o pedido tem lucro gravado ou custo do produto. Venda
  vinda do Mercado Livre de anúncio que não saiu do catálogo Velo não tem custo:
  antes ela entrava como zero e puxava o "Lucro estimado" para baixo. Agora
  devolve null e fica de fora da conta.
*/
const lucroDoPedido = (pedido: LinhaPedido): number | null => {
  if (pedido.profit !== null && pedido.profit !== undefined) return Number(pedido.profit) || 0;
  if (pedido.cost_price === null || pedido.cost_price === undefined) return null;
  return (Number(pedido.sale_price) - Number(pedido.cost_price)) * (pedido.quantity || 1);
};

const dataDoPedido = (pedido: LinhaPedido) => {
  const bruto = pedido.ordered_at || pedido.created_at;
  if (!bruto) return null;
  const data = new Date(bruto);
  return Number.isNaN(data.getTime()) ? null : data;
};

const variacao = (atual: number, anterior: number) => (anterior > 0 ? ((atual - anterior) / anterior) * 100 : null);

const MS_DIA = 24 * 60 * 60 * 1000;

/*
  Tendência recente sobre o total acumulado dos cards: este mês vs o mês
  passado, ou os últimos 30 dias vs os 30 anteriores. Sem base imediata a
  UI cai em "desde o início" — comparar julho com junho em setembro
  produzia −100% / +100% que não descrevem o mês corrente.
*/
const janelasDeComparacao = (linhas: LinhaPedido[]) => {
  const vazio = { atual: [] as LinhaPedido[], anterior: [] as LinhaPedido[], rotulo: "vs mês passado" };
  const agora = new Date();
  const inicioMesAtual = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const inicioMesPassado = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);
  const desteMes: LinhaPedido[] = [];
  const doMesPassado: LinhaPedido[] = [];
  const ultimos30: LinhaPedido[] = [];
  const anteriores30: LinhaPedido[] = [];
  const corte30 = new Date(agora.getTime() - 30 * MS_DIA);
  const corte60 = new Date(agora.getTime() - 60 * MS_DIA);

  for (const pedido of linhas) {
    const data = dataDoPedido(pedido);
    if (!data) continue;
    if (data >= inicioMesAtual) desteMes.push(pedido);
    else if (data >= inicioMesPassado && data < inicioMesAtual) doMesPassado.push(pedido);
    if (data >= corte30) ultimos30.push(pedido);
    else if (data >= corte60) anteriores30.push(pedido);
  }

  if (desteMes.length > 0 && doMesPassado.length > 0) {
    return { atual: desteMes, anterior: doMesPassado, rotulo: "vs mês passado" };
  }
  if (ultimos30.length > 0 && anteriores30.length > 0) {
    return { atual: ultimos30, anterior: anteriores30, rotulo: "vs período anterior" };
  }
  return vazio;
};

const montarResumoVendas = (linhas: LinhaPedido[]): ResumoVendas => {
  const validos = linhas.filter((pedido) => !STATUS_ANULADOS.includes(String(pedido.status ?? "").toLowerCase()));
  const soma = (lista: LinhaPedido[], fn: (p: LinhaPedido) => number) => lista.reduce((total, p) => total + fn(p), 0);
  const janela = janelasDeComparacao(linhas);
  const validosAtual = janela.atual.filter((pedido) => !STATUS_ANULADOS.includes(String(pedido.status ?? "").toLowerCase()));
  const validosAnterior = janela.anterior.filter((pedido) => !STATUS_ANULADOS.includes(String(pedido.status ?? "").toLowerCase()));

  const comCusto = (lista: LinhaPedido[]) => lista.filter((pedido) => lucroDoPedido(pedido) !== null);
  const somaLucro = (lista: LinhaPedido[]) => soma(comCusto(lista), (pedido) => lucroDoPedido(pedido) ?? 0);
  const validosComCusto = comCusto(validos);

  return {
    receita: soma(validos, valorDoPedido),
    lucro: validosComCusto.length > 0 ? somaLucro(validos) : null,
    lucroPedidosComCusto: validosComCusto.length,
    lucroPedidosSemCusto: validos.length - validosComCusto.length,
    pedidos: linhas.length,
    receitaVariacao: variacao(soma(validosAtual, valorDoPedido), soma(validosAnterior, valorDoPedido)),
    lucroVariacao: comCusto(validosAtual).length > 0 ? variacao(somaLucro(validosAtual), somaLucro(validosAnterior)) : null,
    pedidosVariacao: variacao(janela.atual.length, janela.anterior.length),
    variacaoRotulo: janela.rotulo,
    recentes: linhas.slice(0, 3).map((pedido) => ({
      id: pedido.id,
      titulo: pedido.product_title,
      imagem: pedido.product_image,
      valor: valorDoPedido(pedido),
      status: String(pedido.status ?? "").toLowerCase(),
      data: pedido.ordered_at || pedido.created_at,
      plataforma: String(pedido.platform ?? "").toLowerCase(),
      numero: String(pedido.ml_order_id || pedido.external_order_id || pedido.id).slice(-6),
      rastreio: pedido.tracking_code?.trim() || null,
    })),
  };
};

const Variacao = ({
  valor,
  rotulo,
  claro = false,
}: {
  valor: number | null;
  rotulo: string;
  claro?: boolean;
}) => {
  const legenda = claro ? "text-white/55" : "text-[#8A8A8A]";
  if (valor === null) {
    return <span className={`text-[12px] leading-none ${legenda}`}>desde o início</span>;
  }
  const subiu = valor >= 0;
  const cor = subiu ? (claro ? "text-[#86EFB3]" : "text-[#1F9D55]") : claro ? "text-[#FCA5A5]" : "text-[#D92D20]";
  const percentual = (
    <span className={`inline-flex items-center gap-0.5 font-medium tabular-nums ${cor}`}>
      {subiu ? <ArrowUp className="h-3 w-3" strokeWidth={2.5} /> : <ArrowDown className="h-3 w-3" strokeWidth={2.5} />}
      {subiu ? "+" : "−"}
      {Math.abs(Math.round(valor))}%
    </span>
  );
  if (claro) {
    return (
      <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12px] leading-none">
        {percentual}
        <span className={legenda}>{rotulo}</span>
      </span>
    );
  }
  return (
    <span className="flex flex-col items-start gap-1 text-[12px] leading-none">
      {percentual}
      <span className={legenda}>{rotulo}</span>
    </span>
  );
};

const badgesDoPedido = (pedido: PedidoRecente) => {
  const status = STATUS_PEDIDO[pedido.status] ?? { rotulo: pedido.status || "—", classe: "bg-[#F1F5F9] text-[#475569]" };
  const badges = [status];
  const novo = pedido.data ? Date.now() - new Date(pedido.data).getTime() < MS_DIA : false;
  if (novo) badges.push({ rotulo: "Novo", classe: "bg-[#FEF3C7] text-[#B45309]" });
  const esperaRastreio = ["paid", "approved", "shipped", "in_transit", "processing", "in_process"].includes(pedido.status);
  if (esperaRastreio && !pedido.rastreio) {
    badges.push({ rotulo: "Sem rastreio", classe: "bg-[#F1F5F9] text-[#475569]" });
  }
  return badges;
};

const MobileAliVeloHome = ({
  collections,
  onCreateCollection,
  userId,
  mlConnected,
  hasPublication,
  nome,
  foto,
  resumo,
}: {
  collections: CollectionSummary[];
  onCreateCollection: () => void;
  userId?: string;
  mlConnected: boolean;
  hasPublication: boolean;
  nome: string;
  foto: string | null;
  /** null enquanto carrega. */
  resumo: ResumoVendas | null;
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isBeginner = !hasPublication;
  const [prepareOpen, setPrepareOpen] = useState(false);

  useEffect(() => {
    trackMobileHomeEvent(userId, "home_view", { detail: isBeginner ? "primeiro_anuncio" : "home_normal" });
  }, [isBeginner, userId]);


  if (location.pathname === "/colecoes") {
    return (
      <section className="min-h-screen bg-[#F4F4F2] px-4 pb-24 pt-5 md:hidden">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[12px] font-bold uppercase text-black/40">Organização</p>
            <h1 className="mt-1 text-[30px] font-black tracking-[-0.06em] text-[#111111]">Coleções</h1>
            <p className="mt-1 text-[13px] font-medium text-black/50">
              {collections.length} coleção{collections.length === 1 ? "" : "ões"}
            </p>
          </div>
          <button
            type="button"
            onClick={onCreateCollection}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-[#111111] px-4 text-[12px] font-bold text-white"
          >
            <Plus className="h-4 w-4" />
            Nova
          </button>
        </div>

        <div className="mt-6 grid gap-3">
          {collections.length > 0 ? (
            collections.map((collection) => (
              <button
                key={collection.id}
                type="button"
                onClick={() => navigate(`/dashboard/catalogo?collectionId=${encodeURIComponent(collection.id)}&collectionName=${encodeURIComponent(collection.name)}`)}
                className="flex min-h-[112px] items-center gap-4 rounded-[18px] bg-white p-4 text-left shadow-[0_1px_0_rgba(0,0,0,0.06)]"
              >
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[14px] bg-[#F1F1F1] text-[#111111]">
                  <Folder className="h-6 w-6" strokeWidth={1.8} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[17px] font-black tracking-[-0.04em] text-[#111111]">{collection.name}</span>
                  <span className="mt-1 block text-[12px] font-semibold text-black/45">{collection.productCount} produtos</span>
                </span>
                <span className="text-[22px] text-black/35">›</span>
              </button>
            ))
          ) : (
            <button
              type="button"
              onClick={onCreateCollection}
              className="rounded-[18px] border-2 border-dashed border-black/10 bg-white px-6 py-12 text-center"
            >
              <Folder className="mx-auto h-8 w-8 text-black/30" />
              <span className="mt-3 block text-[15px] font-bold text-[#111111]">Crie sua primeira coleção</span>
              <span className="mt-1 block text-[12px] text-black/45">Organize produtos para importar depois.</span>
            </button>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="md:hidden animate-fade-in">
      <div className="min-h-screen w-full overflow-x-hidden bg-white pb-6 text-[#111111] [font-family:'Inter_Variable',Inter,ui-sans-serif,system-ui,sans-serif]">
        {/*
          Topo no desenho de painel: marca e atalhos, saudação, números reais de venda,
          ações em lista e pedidos recentes. O catálogo continua logo abaixo.
        */}
        <header className="flex items-center justify-between px-5 pt-4">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="flex h-10 w-10 items-center justify-center transition-transform active:scale-95"
            aria-label="Velo"
          >
            <img src="/logo.png" alt="" aria-hidden="true" className="h-9 w-9 object-contain" />
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate("/dashboard/minha-conta")}
              aria-label="Minha conta"
              className="relative h-10 w-10 overflow-hidden rounded-full bg-[#EBEBEB] text-[14px] font-medium text-[#1A1A1A] ring-1 ring-black/[0.08] transition-transform active:scale-95"
            >
              {foto ? (
                <img src={foto} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="grid h-full w-full place-items-center">{nome ? nome[0].toUpperCase() : "V"}</span>
              )}
            </button>
            <NotificacoesPopover variante="redondo" />
          </div>
        </header>

        <p className="velo-fonte-inter px-5 pt-3.5 text-[28px] font-medium leading-[1.2] tracking-[-0.03em] text-[#1A1A1A]">
          {nome ? `Olá, ${nome}` : "Olá"} <span aria-hidden="true">👋</span>
        </p>

        {/* Cartões no desenho de referência: número grande em tabular, variação embaixo. */}
        <div className="velo-fonte-inter grid grid-cols-2 gap-2.5 px-5 pt-5">
          {[
            { rotulo: "Lucro estimado", icone: Banknote, valor: resumo ? formatCurrency(resumo.lucro) : "—", variacao: resumo?.lucroVariacao ?? null },
            { rotulo: "Pedidos", icone: ReceiptText, valor: resumo ? formatInteger(resumo.pedidos) : "—", variacao: resumo?.pedidosVariacao ?? null },
          ].map(({ rotulo, icone: Icone, valor, variacao: v }) => (
            <div key={rotulo} className="rounded-[18px] bg-[#F5F5F5] px-3.5 py-4">
              <p className="flex items-center gap-1.5 text-[13px] font-normal text-[#6B6B6B]">
                <Icone className="h-3.5 w-3.5 shrink-0 text-[#1A1A1A]" strokeWidth={1.6} />
                {rotulo}
              </p>
              <p className={`mt-3.5 text-[clamp(20px,5.6vw,26px)] font-medium leading-none tracking-[-0.035em] tabular-nums text-[#1A1A1A] ${resumo ? "" : "animate-pulse"}`}>
                {valor}
              </p>
              <div className="mt-2.5 min-h-[28px]">
                {resumo ? <Variacao valor={v} rotulo={resumo.variacaoRotulo} /> : <span className="text-[12px] text-[#8A8A8A]">carregando</span>}
              </div>
            </div>
          ))}
        </div>

        {/* data-velo-flat-buttons: sem o relevo global dos botões sólidos (index.css) — o cartão é chapado. */}
        <div data-velo-flat-buttons className="velo-fonte-inter px-5 pt-2.5">
          <button
            type="button"
            onClick={() => navigate("/dashboard/resultados")}
            className="block w-full rounded-[18px] bg-[#1E3A8A] px-4 py-5 text-left text-white transition-transform active:scale-[0.99]"
          >
            <p className="text-[13px] font-normal text-white/80">Receita total</p>
            <div className="mt-3.5 flex flex-wrap items-end gap-x-2.5 gap-y-1.5">
              <span className={`text-[clamp(24px,7vw,28px)] font-medium leading-none tracking-[-0.035em] tabular-nums ${resumo ? "" : "animate-pulse"}`}>
                {resumo ? formatCurrency(resumo.receita) : "—"}
              </span>
              {resumo ? <Variacao valor={resumo.receitaVariacao} rotulo={resumo.variacaoRotulo} claro /> : null}
            </div>
          </button>
        </div>

        {/* Separadores finos (4px), como na referência: agrupam sem cortar a tela em blocos. */}
        <div className="mt-3.5 h-1 bg-[#F2F3F5] shadow-[inset_0_1px_0_rgba(0,0,0,0.04)]" />

        {/*
          Ações em lista, sempre quatro linhas (a troca Conectar/Publicações está no
          próprio array).
        */}
        <div className="velo-fonte-inter divide-y divide-black/[0.06] px-5" aria-label="Ações">
          {[
            { key: "choose_product", icone: Plus, rotulo: "Escolher um produto", acao: () => navigate("/dashboard/catalogo") },
            // Sempre 4 linhas. Sem o Mercado Livre conectado não dá para publicar, então
            // "Minhas publicações" cede o lugar para "Conectar" — e volta quando a conta conecta.
            mlConnected
              ? { key: "publicacoes", icone: Upload, rotulo: "Minhas publicações", acao: () => navigate("/dashboard/publicacoes") }
              : { key: "connect_ml", icone: Link2, rotulo: "Conectar o Mercado Livre", acao: () => setPrepareOpen(true) },
            { key: "orders", icone: ReceiptText, rotulo: "Ver pedidos", acao: () => navigate("/dashboard/pedidos") },
            { key: "balance", icone: ArrowUpRight, rotulo: "Ver saldo", acao: () => navigate("/dashboard/saldos") },
          ].map((item) => {
            const Icone = item.icone;
            const passo = ["choose_product", "connect_ml"].includes(item.key);
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  trackMobileHomeEvent(userId, passo ? "checklist_clicked" : "shortcut_clicked", { detail: item.key });
                  item.acao();
                }}
                className="flex min-h-[56px] w-full items-center gap-3 py-1.5 text-left"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#F5F5F5] text-[#1A1A1A]">
                  <Icone className="h-[15px] w-[15px]" strokeWidth={1.6} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-normal text-[#1A1A1A]">{item.rotulo}</span>
                </span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#333333]" strokeWidth={1.8} />
              </button>
            );
          })}
        </div>

        <div className="h-1 bg-[#F2F3F5] shadow-[inset_0_1px_0_rgba(0,0,0,0.04)]" />

        {/*
          Pedidos recentes em linhas, sem moldura, no desenho de referência: plataforma e
          status em cima, número do pedido e valor embaixo, uma linha fina entre eles.
        */}
        <section className="velo-fonte-inter px-5 pb-6 pt-4" aria-labelledby="pedidos-recentes">
          <div className="flex items-center justify-between">
            <h2 id="pedidos-recentes" className="text-[17px] font-medium tracking-[-0.02em] text-[#1A1A1A]">Pedidos recentes</h2>
            <button type="button" onClick={() => navigate("/dashboard/pedidos")} className="text-[14px] font-medium text-[#2563EB]">
              Ver todos
            </button>
          </div>

          {!resumo ? (
            <div className="mt-3 h-[92px] animate-pulse rounded-[16px] bg-[#F5F5F5]" />
          ) : resumo.recentes.length > 0 ? (
            <div className="mt-1 divide-y divide-black/[0.06]">
              {resumo.recentes.map((pedido) => {
                const plataforma: { rotulo: string; cor: string; logo?: string } = PLATAFORMAS[pedido.plataforma] ?? { rotulo: pedido.plataforma || "Loja", cor: "#9CA3AF" };
                const badges = badgesDoPedido(pedido);
                return (
                  <button
                    key={pedido.id}
                    type="button"
                    onClick={() => navigate("/dashboard/pedidos")}
                    className="block w-full py-4 text-left transition-opacity active:opacity-60"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-black/[0.1] px-2 py-[3px] text-[12px] text-[#333333]">
                        {plataforma.logo ? (
                          <img src={plataforma.logo} alt="" aria-hidden="true" width={200} height={200} className="-my-1 -ml-0.5 h-5 w-5 shrink-0 object-contain" />
                        ) : (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: plataforma.cor }} />
                        )}
                        <span className="truncate">{plataforma.rotulo}</span>
                      </span>
                      <span className="flex max-w-[58%] flex-wrap items-center justify-end gap-1">
                        {badges.map((badge) => (
                          <span key={badge.rotulo} className={`rounded-[6px] px-1.5 py-[3px] text-[11.5px] font-medium leading-none ${badge.classe}`}>
                            {badge.rotulo}
                          </span>
                        ))}
                      </span>
                    </div>
                    <div className="mt-2.5 flex items-baseline justify-between gap-3">
                      <span className="truncate text-[16px] font-medium tracking-[-0.02em] text-[#1A1A1A]">Pedido #{pedido.numero}</span>
                      <span className="shrink-0 text-[16px] font-medium tabular-nums tracking-[-0.02em] text-[#1A1A1A]">{formatCurrency(pedido.valor)}</span>
                    </div>
                    <p className="mt-1 truncate text-[13px] leading-snug text-[#8A8A8A]">
                      {pedido.titulo}
                      {pedido.data
                        ? ` · ${new Date(pedido.data).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`
                        : ""}
                    </p>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-3 py-1">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#F5F5F5] text-[#1A1A1A]">
                <ReceiptText className="h-4 w-4" strokeWidth={1.6} />
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] text-[#1A1A1A]">Nenhum pedido ainda</span>
                <span className="block text-[12.5px] text-[#8A8A8A]">Quando alguém comprar um anúncio seu, ele aparece aqui.</span>
              </span>
            </div>
          )}
        </section>

        <MLConnectPrepareModal
          open={prepareOpen}
          onClose={() => setPrepareOpen(false)}
          onConfirm={() => {
            setPrepareOpen(false);
            trackMobileHomeEvent(userId, "ml_connect_open", { detail: "home_checklist" });
            void startMercadoLivreOAuth({ novaAba: false }).catch(() =>
              veloToast.error("Não foi possível abrir o Mercado Livre agora. Tente de novo em instantes."),
            );
          }}
        />
      </div>
    </section>
  );
};

/**
 * Casca que alimenta o Início no celular: pedidos (para os números e os pedidos
 * recentes), conexão com o Mercado Livre, publicações e coleções (a rota
 * /colecoes reaproveita este componente).
 */
const MobileHome = () => {
  const { user } = useAuth();
  const { nome: nomeDoPerfil, foto } = useProfile();
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [mlConnected, setMlConnected] = useState(false);
  const [hasPublication, setHasPublication] = useState(false);
  const [resumo, setResumo] = useState<ResumoVendas | null>(null);
  const completedSteps = useRef(new Set<string>());

  const quizAnswers = useMemo(() => lerRespostasDoQuiz(user), [user]);
  const choseProduct = user?.id ? produtoJaEscolhido(user.id) : false;

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    void Promise.all([
      supabase.from("user_integrations").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("platform", "mercadolivre").not("access_token", "is", null),
      supabase.from("user_publications").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    ]).then(([integration, publication]) => {
      if (!active) return;
      setMlConnected((integration.count ?? 0) > 0);
      setHasPublication((publication.count ?? 0) > 0);
    });
    return () => { active = false; };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    void supabase
      .from("orders")
      .select("id,product_title,product_image,total_amount,sale_price,quantity,status,profit,cost_price,created_at,ordered_at,platform,ml_order_id,external_order_id,tracking_code")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!active) return;
        // Sem pedidos ou com falha na consulta, o painel mostra zero em vez de travar em "carregando".
        setResumo(montarResumoVendas(error ? [] : ((data ?? []) as LinhaPedido[])));
      });
    return () => { active = false; };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const states = { choose_product: choseProduct, connect_ml: mlConnected, publish: hasPublication };
    Object.entries(states).forEach(([step, done]) => {
      if (done && !completedSteps.current.has(step)) {
        completedSteps.current.add(step);
        trackMobileHomeEvent(user.id, "checklist_completed", { detail: step });
      }
    });
  }, [choseProduct, hasPublication, mlConnected, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    let isMounted = true;
    void (async () => {
      try {
        const rows = await listCollectionsWithSummaries(user.id);
        if (isMounted) setCollections(rows);
      } catch {
        if (isMounted) setCollections([]);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  return (
    <MobileAliVeloHome
      collections={collections}
      onCreateCollection={() => veloToast.info("Crie coleções pelo computador por enquanto.")}
      userId={user?.id}
      mlConnected={mlConnected}
      hasPublication={hasPublication}
      nome={primeiroNomeSaudacao(
        quizAnswers.nome,
        user?.user_metadata?.given_name as string | undefined,
        nomeDoPerfil,
        user?.user_metadata?.full_name as string | undefined,
        user?.user_metadata?.name as string | undefined,
        ...((user?.identities ?? []).flatMap((identidade) => {
          const data = (identidade.identity_data ?? {}) as {
            given_name?: string;
            name?: string;
            full_name?: string;
          };
          return [data.given_name, data.name, data.full_name];
        })),
      )}
      foto={foto}
      resumo={resumo}
    />
  );
};

export default MobileHome;
