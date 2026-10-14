import AtlasAvatarIcon from "@/components/dashboard/AtlasAvatarIcon";

/*
 * O Atlas "de atendente": o mesmo ícone, com um headset por cima. Marca o
 * suporte feito pela equipe, para não ser confundido com o Atlas que
 * conversa sozinho (a IA).
 */
const AtlasSupportIcon = ({ size = 32, className = "" }: { size?: number; className?: string }) => (
  <span
    aria-hidden="true"
    className={`relative inline-grid shrink-0 place-items-center ${className}`}
    style={{ width: size, height: size }}
  >
    <AtlasAvatarIcon size={size * 0.86} animated={false} />
    <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
      {/* arco por cima da cabeça */}
      <path d="M13 54 C9 4 91 4 87 54" fill="none" stroke="#0f172a" strokeWidth="7" strokeLinecap="round" />
      <path d="M17 40 C22 16 78 16 83 40" fill="none" stroke="#ffffff" strokeOpacity="0.28" strokeWidth="2" strokeLinecap="round" />
      {/* conchas */}
      <rect x="2" y="42" width="17" height="26" rx="7" fill="#0f172a" />
      <rect x="81" y="42" width="17" height="26" rx="7" fill="#0f172a" />
      <rect x="6" y="47" width="5" height="15" rx="2.5" fill="#ffffff" fillOpacity="0.22" />
      <rect x="89" y="47" width="5" height="15" rx="2.5" fill="#ffffff" fillOpacity="0.22" />
      {/* microfone */}
      <path d="M86 66 C86 80 76 84 62 84" fill="none" stroke="#0f172a" strokeWidth="4.5" strokeLinecap="round" />
      <rect x="51" y="79" width="13" height="9" rx="4.5" fill="#0f172a" />
    </svg>
  </span>
);

export default AtlasSupportIcon;
