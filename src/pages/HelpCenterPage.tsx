import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Globe, MessageCircle } from "lucide-react";
import { VeloLogo } from "@/components/VeloLogo";
import HelpCenterView from "@/components/help-center/HelpCenterView";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Central de Ajuda (/ajuda). Fica fora de todos os menus do app: só chega
 * aqui quem tem o link (enviado pelo suporte). Também não deve ir para
 * buscadores: além desta meta tag, o vercel.json manda o cabeçalho
 * X-Robots-Tag em /ajuda.
 *
 * Os links daqui para o app (Entrar, suporte) são permitidos; o que não pode
 * existir é link do app para cá.
 */
const SUPPORT_PATH = "/dashboard/configuracoes?tab=Suporte";

const HelpCenterPage = () => {
  const { user } = useAuth();
  const { pathname, hash } = useLocation();

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Central de Ajuda · Velo";

    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex, nofollow";
    document.head.appendChild(robots);

    return () => {
      document.title = previousTitle;
      robots.remove();
    };
  }, []);

  const loginTo = `/login?next=${encodeURIComponent(pathname + hash)}`;
  const supportTo = user ? SUPPORT_PATH : `/login?next=${encodeURIComponent(SUPPORT_PATH)}`;

  return (
    <div className="flex min-h-screen flex-col bg-white font-['Inter',system-ui,sans-serif] text-[#0D0D0D] antialiased">
      <header className="mx-auto flex w-full max-w-[1420px] items-center justify-between px-5 pt-7 sm:px-10 sm:pt-10">
        <Link to="/ajuda" aria-label="Central de Ajuda da Velo — início" className="flex items-center">
          <VeloLogo size="md" />
        </Link>
        <div className="flex items-center gap-5 sm:gap-7">
          {/* Só existe a versão em português; o selo repete o visual de idioma sem virar um seletor falso. */}
          <span className="hidden h-10 items-center gap-2 rounded-full bg-[#F3F3F3] px-4 text-[15px] text-[#0D0D0D] sm:inline-flex">
            <Globe size={17} strokeWidth={1.8} aria-hidden="true" />
            Português
          </span>
          {user ? (
            <Link to="/dashboard" className="text-[16px] text-[#0D0D0D] hover:opacity-70">
              Ir para a Velo
            </Link>
          ) : (
            <Link to={loginTo} className="text-[16px] text-[#0D0D0D] hover:opacity-70">
              Entrar
            </Link>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1420px] flex-1 px-5 pb-28 pt-8 sm:px-10 sm:pt-12">
        <HelpCenterView basePath="/ajuda" supportPath={supportTo} />
      </main>

      <Link
        to={supportTo}
        aria-label="Falar com o suporte"
        className="fixed bottom-5 right-5 z-40 grid size-14 place-items-center rounded-full bg-[#0D0D0D] text-white shadow-[0_6px_20px_rgba(0,0,0,0.22)] transition hover:scale-105 sm:bottom-7 sm:right-7"
      >
        <MessageCircle size={24} strokeWidth={1.9} aria-hidden="true" />
      </Link>
    </div>
  );
};

export default HelpCenterPage;
