import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, ChevronDown, CreditCard, HelpCircle, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { VELO_PLAN_PRICES } from "@/lib/planPricing";
import { startValidaPayCheckout, type VelloPlanId } from "@/lib/validapayCheckout";
import { trackMobileHomeEvent } from "@/lib/mobileHomeTracking";
import { lerContextoDePlanos } from "@/lib/planosCheckoutContexto";

type PlanoId = Extract<VelloPlanId, "base" | "pro">;

const formatBRL = (valor: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);

const PLANOS: Array<{
  id: PlanoId;
  nome: string;
  preco: number;
  resumo: string;
  recomendado?: boolean;
  itens: string[];
}> = [
  {
    id: "base",
    nome: "Base",
    preco: VELO_PLAN_PRICES.base.monthly,
    resumo: "Para colocar seus primeiros anúncios no ar.",
    recomendado: true,
    itens: [
      "Até 50 anúncios no Mercado Livre por mês",
      "Título e descrição prontos com ajuda da Velo",
      "1 página de vendas por mês e 20 imagens de produto",
      "Suporte por e-mail",
    ],
  },
  {
    id: "pro",
    nome: "Pro",
    preco: VELO_PLAN_PRICES.pro.monthly,
    resumo: "Para quem já vende e quer publicar muito mais, sem fazer na mão.",
    itens: [
      "Até 300 anúncios por mês, com publicação em lote",
      "Preço e estoque atualizados sozinhos",
      "10 páginas de vendas, 100 imagens e 10 vídeos por mês",
      "Suporte com prioridade",
    ],
  },
];

const PERGUNTAS: Array<{ pergunta: string; resposta: string }> = [
  {
    pergunta: "Ainda não tenho conta de vendedor no Mercado Livre. Posso assinar?",
    resposta:
      "Pode. Depois do pagamento mostramos o passo a passo para liberar sua conta e seu anúncio fica guardado. Assim que a conta for liberada, ele sobe sozinho e avisamos você.",
  },
  {
    pergunta: "E se eu não vender nada?",
    resposta:
      "A Velo prepara e publica seus anúncios, mas não garante vendas: isso depende do produto, do preço e da concorrência. Por isso o plano é mensal e você pode cancelar quando quiser.",
  },
  {
    pergunta: "Como eu cancelo?",
    resposta:
      "Em Configurações, na área de assinatura, com poucos toques. Nos primeiros 7 dias após o pagamento você também pode pedir reembolso: a análise leva até 48 horas e, se aprovado, o valor volta pelo mesmo meio de pagamento. Ao cancelar, seus anúncios publicados pela Velo saem do ar.",
  },
  {
    pergunta: "Quais formas de pagamento vocês aceitam?",
    resposta: "Pix e cartão de crédito, em um ambiente de pagamento seguro. A cobrança é mensal.",
  },
  {
    pergunta: "Como eu recebo o dinheiro das vendas?",
    resposta:
      "O dinheiro da venda cai na sua conta do Mercado Livre, conforme as regras e os prazos do próprio Mercado Livre. A Velo não fica com nenhuma parte da sua venda.",
  },
];

const PlanosPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const contexto = useMemo(() => lerContextoDePlanos(), []);
  const [planoEscolhido, setPlanoEscolhido] = useState<PlanoId>("base");
  const [enviando, setEnviando] = useState<PlanoId | null>(null);
  const [assinantes, setAssinantes] = useState<number | null>(null);
  const [perguntaAberta, setPerguntaAberta] = useState<number | null>(null);
  const abertoEm = useRef(Date.now());
  const rolagemMaxima = useRef(0);

  const planoAtual = PLANOS.find((plano) => plano.id === planoEscolhido) ?? PLANOS[0];

  useEffect(() => {
    abertoEm.current = Date.now();
    trackMobileHomeEvent(user?.id, "plans_open", {
      productId: contexto?.productId,
      detail: contexto ? "pagina_pos_revisao" : "pagina_direta",
    });
    void supabase
      .rpc("rpc_active_subscribers_count")
      .then(({ data, error }) => {
        if (!error && typeof data === "number") setAssinantes(data);
      });

    const aoRolar = () => {
      const total = document.body.scrollHeight - window.innerHeight;
      if (total <= 0) return;
      const percentual = Math.min(100, Math.round(((window.scrollY || 0) / total) * 100));
      if (percentual > rolagemMaxima.current) rolagemMaxima.current = percentual;
    };
    window.addEventListener("scroll", aoRolar, { passive: true });

    return () => {
      window.removeEventListener("scroll", aoRolar);
      trackMobileHomeEvent(user?.id, "plans_exit", {
        productId: contexto?.productId,
        detail: `scroll_${rolagemMaxima.current}`,
        elapsedMs: Date.now() - abertoEm.current,
      });
      trackMobileHomeEvent(user?.id, "plans_scroll", {
        productId: contexto?.productId,
        detail: String(rolagemMaxima.current),
      });
    };
    // Medimos uma vez por visita à página.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const escolherPlano = (id: PlanoId) => {
    setPlanoEscolhido(id);
    trackMobileHomeEvent(user?.id, "plans_plan_selected", { productId: contexto?.productId, detail: id });
  };

  const assinar = async () => {
    if (enviando) return;
    setEnviando(planoEscolhido);
    trackMobileHomeEvent(user?.id, "plan_checkout_clicked", {
      productId: contexto?.productId,
      detail: `pagina_planos:${planoEscolhido}:monthly`,
    });
    try {
      const resultado = await startValidaPayCheckout(planoEscolhido, "monthly");
      if (resultado.ok) return;
      setEnviando(null);
      toast.error(resultado.error ?? "Não foi possível abrir o pagamento. Tente de novo.");
    } catch {
      setEnviando(null);
      toast.error("Não foi possível abrir o pagamento. Tente de novo.");
    }
  };

  const voltar = () => {
    trackMobileHomeEvent(user?.id, "plans_back_to_review", { productId: contexto?.productId });
    if (contexto?.productId) navigate(`/dashboard/catalogo/${contexto.productId}`);
    else navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-[#F6F8FC] pb-[124px]">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-[#E5EAF2] bg-white px-4 py-3">
        <button
          type="button"
          onClick={voltar}
          aria-label="Voltar para a revisão do anúncio"
          className="grid h-11 w-11 place-items-center rounded-full bg-[#F1F4F9] text-[#0A0A0A]"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="min-w-0">
          <p className="text-[16px] font-semibold text-[#0A0A0A]">Escolha seu plano</p>
          <p className="text-[13px] text-[#5B6474]">Seu anúncio já está guardado.</p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[720px] px-4 py-5 text-[#0A0A0A]">
        {contexto ? (
          <section className="rounded-2xl border border-[#E5EAF2] bg-white p-4">
            <p className="text-[13px] font-semibold text-[#5B6474]">Seu anúncio pronto para publicar</p>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-xl bg-[#F1F4F9]">
                {contexto.image ? (
                  <img src={contexto.image} alt="" loading="lazy" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="min-w-0">
                <p className="line-clamp-2 text-[15px] font-semibold leading-snug">{contexto.title}</p>
                <p className="mt-1 text-[14px] text-[#5B6474]">
                  Preço de venda <strong className="text-[#0A0A0A]">{formatBRL(contexto.sellPrice)}</strong>
                </p>
                <p className="text-[14px] text-[#5B6474]">
                  Sobra bruta estimada <strong className="text-[#0A0A0A]">{formatBRL(contexto.profit)}</strong>
                </p>
              </div>
            </div>
            <p className="mt-3 text-[13px] leading-5 text-[#5B6474]">
              A sobra estimada é o preço de venda menos o custo do produto. Dela ainda saem a comissão e a taxa
              fixa do Mercado Livre, o frete e os impostos, quando houver.
            </p>
          </section>
        ) : null}

        <section className="mt-5 rounded-2xl border border-[#E5EAF2] bg-white p-4">
          <h2 className="text-[18px] font-semibold">Quanto custa e o que você ganha</h2>
          <p className="mt-2 text-[15px] leading-6 text-[#3F4757]">
            O plano {planoAtual.nome} custa {formatBRL(planoAtual.preco)} por mês.
            {contexto && contexto.profit > 0 ? (
              <>
                {" "}
                Pelo preço que você definiu, cada venda deste produto deixa cerca de{" "}
                {formatBRL(contexto.profit)} antes das taxas do Mercado Livre.
              </>
            ) : null}{" "}
            Não prometemos vendas: o resultado depende do produto, do preço e da concorrência.
          </p>
        </section>

        <section className="mt-5 rounded-2xl border border-[#E5EAF2] bg-white p-4">
          <h2 className="text-[18px] font-semibold">Quem já usa a Velo</h2>
          <p className="mt-2 text-[15px] leading-6 text-[#3F4757]">
            {assinantes === null
              ? "Carregando o número de assinantes…"
              : `${assinantes.toLocaleString("pt-BR")} pessoas têm um plano ativo na Velo hoje.`}
          </p>
          {/* ESPAÇO RESERVADO: depoimentos e resultados reais, com autorização de quem enviou.
              Nada aqui pode ser inventado — só entra conteúdo verificado. */}
          <div className="mt-3 rounded-xl border border-dashed border-[#C8D2E2] bg-[#F8FAFD] p-3 text-[13px] leading-5 text-[#5B6474]">
            Espaço reservado para depoimentos reais de clientes. Ainda não publicamos nenhum porque só
            colocamos aqui histórias verificadas e autorizadas.
          </div>
        </section>

        <section className="mt-5 rounded-2xl border border-[#E5EAF2] bg-white p-4">
          <h2 className="text-[18px] font-semibold">O que acontece depois de pagar</h2>
          <ol className="mt-3 space-y-3 text-[15px] leading-6 text-[#3F4757]">
            {[
              "Você volta para o seu anúncio, já do jeito que preparou.",
              "Se sua conta do Mercado Livre já puder vender, o anúncio vai ao ar. Se não puder, mostramos o passo a passo e ajudamos você.",
              "Com o anúncio no ar, você acompanha as vendas e os pedidos pela Velo.",
            ].map((passo, indice) => (
              <li key={passo} className="flex gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#EEF4FF] text-[13px] font-semibold text-[#1D4ED8]">
                  {indice + 1}
                </span>
                <span>{passo}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-5">
          <h2 className="px-1 text-[18px] font-semibold">Escolha o plano</h2>
          <div className="mt-3 space-y-3">
            {PLANOS.map((plano) => {
              const selecionado = plano.id === planoEscolhido;
              return (
                <button
                  key={plano.id}
                  type="button"
                  onClick={() => escolherPlano(plano.id)}
                  aria-pressed={selecionado}
                  className={`w-full rounded-2xl border bg-white p-4 text-left transition ${
                    selecionado ? "border-[#2563EB] ring-2 ring-[#2563EB]/20" : "border-[#E5EAF2]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[17px] font-semibold">Plano {plano.nome}</span>
                        {plano.recomendado ? (
                          <span className="rounded-full bg-[#EEF4FF] px-2.5 py-1 text-[12px] font-semibold text-[#1D4ED8]">
                            Recomendado para começar
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-[14px] leading-5 text-[#5B6474]">{plano.resumo}</p>
                    </div>
                    <span className="shrink-0 text-right text-[16px] font-semibold">
                      {formatBRL(plano.preco)}
                      <span className="block text-[12px] font-normal text-[#5B6474]">por mês</span>
                    </span>
                  </div>
                  <ul className="mt-3 space-y-2 text-[14px] leading-5 text-[#3F4757]">
                    {plano.itens.map((item) => (
                      <li key={item} className="flex gap-2">
                        <Check size={16} className="mt-[3px] shrink-0 text-[#16A34A]" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-5 rounded-2xl border border-[#E5EAF2] bg-white p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck size={20} className="mt-[2px] shrink-0 text-[#16A34A]" />
            <div className="text-[15px] leading-6 text-[#3F4757]">
              <p className="font-semibold text-[#0A0A0A]">Sem pegadinha</p>
              <p className="mt-1">
                Você cancela quando quiser, em Configurações. Nos primeiros 7 dias pode pedir reembolso, com
                análise em até 48 horas. Ao cancelar, os anúncios publicados pela Velo saem do ar.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-2xl border border-[#E5EAF2] bg-white">
          <h2 className="px-4 pt-4 text-[18px] font-semibold">Dúvidas comuns</h2>
          <div className="mt-2 divide-y divide-[#EEF1F6]">
            {PERGUNTAS.map((item, indice) => {
              const aberta = perguntaAberta === indice;
              return (
                <div key={item.pergunta}>
                  <button
                    type="button"
                    onClick={() => {
                      setPerguntaAberta(aberta ? null : indice);
                      if (!aberta) {
                        trackMobileHomeEvent(user?.id, "plans_faq_opened", {
                          productId: contexto?.productId,
                          detail: item.pergunta.slice(0, 60),
                        });
                      }
                    }}
                    aria-expanded={aberta}
                    className="flex min-h-[56px] w-full items-center justify-between gap-3 px-4 py-3 text-left text-[15px] font-medium"
                  >
                    <span>{item.pergunta}</span>
                    <ChevronDown size={18} className={`shrink-0 transition-transform ${aberta ? "rotate-180" : ""}`} />
                  </button>
                  {aberta ? (
                    <p className="px-4 pb-4 text-[15px] leading-6 text-[#3F4757]">{item.resposta}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-5 rounded-2xl border border-[#E5EAF2] bg-white p-4">
          <div className="flex items-center gap-2 text-[15px] font-semibold">
            <CreditCard size={18} className="text-[#2563EB]" />
            Pagamento por Pix ou cartão de crédito
          </div>
          <p className="mt-2 text-[15px] leading-6 text-[#3F4757]">
            O pagamento acontece em ambiente seguro. Se tiver qualquer dúvida, fale com uma pessoa da nossa
            equipe antes de pagar.
          </p>
          <a
            href="/dashboard/suporte"
            className="mt-3 inline-flex min-h-[48px] items-center gap-2 rounded-full border border-[#D5DEEC] px-4 text-[15px] font-semibold text-[#0A0A0A]"
          >
            <HelpCircle size={18} />
            Falar com o suporte
          </a>
        </section>
      </main>

      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t border-[#E5EAF2] bg-white px-4 pt-3"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto w-full max-w-[720px]">
          <button
            type="button"
            onClick={() => void assinar()}
            disabled={enviando !== null}
            className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-full bg-[#2563EB] px-5 text-[16px] font-semibold text-white disabled:opacity-60"
          >
            {enviando ? <Loader2 size={18} className="animate-spin" /> : null}
            Assinar o {planoAtual.nome} — {formatBRL(planoAtual.preco)}/mês
          </button>
          <p className="mt-2 text-center text-[13px] text-[#5B6474]">
            Cobrança mensal. Cancele quando quiser.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PlanosPage;
