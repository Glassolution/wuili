import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Loader2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { veloToast } from "@/components/ui/velo-toast";
import { SHOPIFY_OFFER_URL } from "@/lib/shopifyConnect";
import { Button } from "@/components/ui/button";
import ShopifyBagIcon from "@/components/icons/ShopifyBagIcon";

type ShopifyConnection = {
  shop_domain: string;
  created_at: string;
};

// Banners enviados pelo time (public/). Os nomes têm espaço, então precisam de encode.
const BANNER_LOJA_IA = encodeURI("/banner shopify 1.png");
const BANNER_OFERTA = encodeURI("/shopifyu banner 2.png");

const ADD_STORE_ROUTE = "/dashboard/integracoes/adicionar";

const cardShell =
  "rounded-[16px] border border-[#EDEDED] bg-white p-2.5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] dark:border-zinc-800 dark:bg-zinc-900";

const IntegracoesPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [connection, setConnection] = useState<ShopifyConnection | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("shopify_connections" as any)
      .select("shop_domain, created_at")
      .eq("user_id", user.id)
      .maybeSingle();
    setConnection((data as ShopifyConnection | null) ?? null);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Retorno do OAuth da Shopify (?shopify=conectado|erro).
  useEffect(() => {
    const status = searchParams.get("shopify");
    if (!status) return;
    if (status === "conectado") {
      veloToast.success("Loja Shopify conectada!");
      load();
    } else if (status === "erro") {
      veloToast.error("Falha ao conectar a Shopify. Tente novamente.");
    }
    setSearchParams(
      (prev) => {
        prev.delete("shopify");
        return prev;
      },
      { replace: true }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleDisconnect = async () => {
    if (!user) return;
    const { error } = await supabase
      .from("shopify_connections" as any)
      .delete()
      .eq("user_id", user.id);
    if (error) {
      veloToast.error("Não foi possível desconectar");
      return;
    }
    setConnection(null);
    veloToast.success("Loja Shopify desconectada");
  };

  const goToAddStore = () => navigate(ADD_STORE_ROUTE);

  return (
    <div className="mx-auto w-full max-w-[1180px]">
      {/* Topo: voltar + título + adicionar loja */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Voltar"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] text-[#1C1C1E] transition hover:bg-black/[0.05] dark:text-white dark:hover:bg-white/10"
          >
            <ArrowLeft size={19} />
          </button>
          <h1 className="truncate text-[21px] font-semibold tracking-[-0.015em] text-[#1C1C1E] dark:text-white">
            Lojas Shopify
          </h1>
        </div>
        <Button type="button" variant="pilot" onClick={goToAddStore} className="shrink-0">
          <Plus size={15} /> Adicionar loja
        </Button>
      </div>

      {/* Card principal: estado da conexão */}
      <div className={cardShell}>
        <div className="rounded-[12px] bg-[#F6F7F9] px-6 py-14 text-center dark:bg-zinc-950">
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-[12px] bg-white text-[#1C1C1E] shadow-[0_1px_3px_rgba(0,0,0,0.08)] dark:bg-zinc-900 dark:text-white">
            <ShopifyBagIcon size={24} />
          </span>

          {loading ? (
            <p className="flex items-center justify-center gap-2 text-[13px] text-[#8A8A8A]">
              <Loader2 size={14} className="animate-spin" /> Verificando suas lojas...
            </p>
          ) : connection ? (
            <>
              <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-[#1C1C1E] dark:text-white">
                {connection.shop_domain}
              </h2>
              <p className="mx-auto mt-1.5 flex max-w-[520px] items-center justify-center gap-1.5 text-[13px] text-[#8A8A8A] dark:text-zinc-400">
                <CheckCircle2 size={14} className="text-[#1C1C1E] dark:text-white" /> Loja conectada e pronta para
                receber seus produtos.
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
                <Button type="button" variant="pilot" onClick={goToAddStore}>
                  <Plus size={15} /> Conectar outra loja
                </Button>
                <Button type="button" variant="pilotLight" onClick={handleDisconnect}>
                  Desconectar
                </Button>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-[#1C1C1E] dark:text-white">
                Nenhuma loja Shopify conectada
              </h2>
              <p className="mx-auto mt-1.5 max-w-[520px] text-[13px] text-[#8A8A8A] dark:text-zinc-400">
                Você ainda não conectou nenhuma loja Shopify. Comece agora e veja como é simples!
              </p>
              <Button type="button" variant="pilotLight" onClick={goToAddStore} className="mt-5">
                Conectar loja Shopify
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Card de ofertas com os banners */}
      <div className={`${cardShell} mt-3.5`}>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="flex flex-col rounded-[12px] border border-[#F0F0F0] p-5 dark:border-zinc-800">
            <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-[#1C1C1E] dark:text-white">
              Loja Shopify grátis com IA
            </h3>
            <p className="mt-1 text-[12.5px] leading-[1.5] text-[#8A8A8A] dark:text-zinc-400">
              Loja pronta, criada por IA, com mais de 30 produtos validados.
            </p>
            <Button
              type="button"
              variant="pilot"
              onClick={() => navigate("/dashboard/minha-loja")}
              className="mt-4 self-start"
            >
              Criar minha loja grátis
            </Button>
            <img
              src={BANNER_LOJA_IA}
              alt="Prévia de lojas Shopify criadas com IA"
              loading="lazy"
              className="mt-4 w-full rounded-[10px] object-cover"
            />
          </div>

          <div className="flex flex-col rounded-[12px] border border-[#F0F0F0] p-5 dark:border-zinc-800">
            <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-[#1C1C1E] dark:text-white">
              Shopify por R$5,00
            </h3>
            <p className="mt-1 text-[12.5px] leading-[1.5] text-[#8A8A8A] dark:text-zinc-400">
              Assine pelo teste gratuito e garanta seus primeiros meses por apenas R$5,00.
            </p>
            {/* asChild: mesmo botão do design system, renderizado como link. */}
            <Button asChild variant="pilot" className="mt-4 self-start">
              <a href={SHOPIFY_OFFER_URL} target="_blank" rel="noopener noreferrer">
                Garantir oferta
              </a>
            </Button>
            <img
              src={BANNER_OFERTA}
              alt="Oferta: Shopify por apenas R$5,00"
              loading="lazy"
              className="mt-4 w-full rounded-[10px] object-cover"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntegracoesPage;
