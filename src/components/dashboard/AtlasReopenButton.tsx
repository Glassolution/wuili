import { useAtlasChat } from "@/contexts/AtlasChatContext";
import AtlasAvatarIcon from "@/components/dashboard/AtlasAvatarIcon";

/**
 * Reabre o painel do Atlas depois de fechado.
 *
 * Só aparece quando existe conversa para retomar: sem isso o botão ficaria
 * flutuando na tela de quem nunca abriu o assistente.
 */
const AtlasReopenButton = () => {
  const { aberto, mensagens, abrir } = useAtlasChat();

  if (aberto || mensagens.length === 0) return null;

  return (
    <button
      type="button"
      onClick={abrir}
      className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-[#0A0A0A] px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_10px_30px_rgba(10,10,10,0.28)] transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/40"
      aria-label="Reabrir o Atlas"
    >
      <AtlasAvatarIcon size={16} />
      Atlas
    </button>
  );
};

export default AtlasReopenButton;
