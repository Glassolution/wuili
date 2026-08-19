import { useState } from "react";
import { Loader2, Rocket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { veloToast } from "@/components/ui/velo-toast";
import ImportProductModal, { type CatalogProduct } from "@/components/dashboard/ImportProductModal";

/**
 * Botão "Publicar no Mercado Livre" do chat do Atlas.
 *
 * Antes esse botão só navegava para o catálogo e o usuário achava que nada
 * acontecia. Agora ele carrega o produto e abre o MESMO modal de publicação
 * (título, preço, estoque, revisão) por cima da conversa — o usuário confirma
 * e publica sem sair do chat.
 */
type Props = {
  produtoId: string;
  label: string;
  className?: string;
};

const AtlasPublishMlButton = ({ produtoId, label, className }: Props) => {
  const [carregando, setCarregando] = useState(false);
  const [produto, setProduto] = useState<CatalogProduct | null>(null);
  const [aberto, setAberto] = useState(false);

  const abrir = async () => {
    if (carregando) return;
    if (produto) {
      setAberto(true);
      return;
    }
    if (!produtoId) {
      veloToast.error("Não consegui identificar o produto. Escolha o produto de novo no catálogo.");
      return;
    }
    setCarregando(true);
    try {
      const { data, error } = await supabase
        .from("catalog_products")
        .select("*")
        .eq("id", produtoId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error("Produto não encontrado no catálogo.");
      setProduto(data as unknown as CatalogProduct);
      setAberto(true);
    } catch (e) {
      veloToast.error(e instanceof Error ? e.message : "Não consegui abrir a publicação agora.");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void abrir()}
        disabled={carregando}
        className={
          className ??
          "inline-flex w-fit max-w-full items-center gap-2 rounded-full bg-[#2563EB] px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-[#1D4ED8] disabled:cursor-wait disabled:opacity-60"
        }
      >
        {carregando ? (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
        ) : (
          <Rocket className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
        )}
        <span className="truncate">{carregando ? "Abrindo publicação…" : label}</span>
      </button>

      <ImportProductModal open={aberto} onClose={() => setAberto(false)} product={produto} />
    </>
  );
};

export default AtlasPublishMlButton;
