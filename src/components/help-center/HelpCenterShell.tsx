import { useEffect, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Globe } from "lucide-react";
import { ChatCircleDots } from "@phosphor-icons/react";
import { VeloLogo } from "@/components/VeloLogo";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Casca das páginas da Central de Ajuda (/ajuda e /ajuda/reembolso): cabeçalho,
 * área central e botão flutuante de suporte. Fica fora de todos os menus do
 * app e não vai para buscadores: além da meta tag daqui, o vercel.json manda o
 * cabeçalho X-Robots-Tag em /ajuda.
 *
 * Os links daqui para o app (Entrar, suporte) são permitidos; o que não pode
 * existir é link do app para cá.
 */
export const SUPPORT_PATH = "/dashboard/configuracoes?tab=Suporte";

export function useSupportLink() {
  const { user } = useAuth();
  return user ? SUPPORT_PATH : `/login?next=${encodeURIComponent(SUPPORT_PATH)}`;
}

export default function HelpCenterShell({
  title = "Central de Ajuda · Velo",
  showSupportButton = true,
  children,
}: {
  title?: string;
  showSupportButton?: boolean;
  children: ReactNode;
}) {
  const { user } = useAuth();
  const { pathname, hash } = useLocation();
  const supportTo = useSupportLink();

  useEffect(() => {
    const previousTitle = document.title;
    document.title = title;

    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex, nofollow";
    document.head.appendChild(robots);

    return () => {
      document.title = previousTitle;
      robots.remove();
    };
  }, [title]);

  const loginTo = `/login?next=${encodeURIComponent(pathname + hash)}`;

  return (
    <div className="flex min-h-screen flex-col bg-white font-['Inter',system-ui,sans-serif] text-[#0D0D0D] antialiased">
      <header className="mx-auto flex w-full max-w-[1080px] items-center justify-between px-5 pt-6 sm:px-8 sm:pt-9">
        <Link to="/ajuda" aria-label="Central de Ajuda da Velo — início" className="flex items-center">
          <VeloLogo size="sm" />
        </Link>
        <div className="flex items-center gap-4 sm:gap-5">
          {/* Só existe a versão em português; o selo repete o visual de idioma sem virar um seletor falso. */}
          <span className="hidden h-8 items-center gap-1.5 rounded-full bg-[#F3F3F3] px-3 text-[13px] text-[#0D0D0D] sm:inline-flex">
            <Globe size={15} strokeWidth={1.8} aria-hidden="true" />
            Português
          </span>
          {user ? (
            <Link to="/dashboard" className="text-[14.5px] text-[#0D0D0D] hover:text-[#2563EB]">
              Ir para a Velo
            </Link>
          ) : (
            <Link to={loginTo} className="text-[14.5px] text-[#0D0D0D] hover:text-[#2563EB]">
              Entrar
            </Link>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1080px] flex-1 px-5 pb-24 pt-6 sm:px-8 sm:pt-10">{children}</main>

      {showSupportButton ? (
        <Link
          to={supportTo}
          aria-label="Falar com o suporte"
          className="fixed bottom-5 right-5 z-40 grid size-12 place-items-center rounded-full bg-[#2563EB] text-white shadow-[0_6px_18px_rgba(37,99,235,0.35)] transition hover:bg-[#1D4ED8] sm:bottom-6 sm:right-6"
        >
          <ChatCircleDots size={24} weight="fill" aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}
