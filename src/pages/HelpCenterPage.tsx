import { useEffect } from "react";
import { Link } from "react-router-dom";
import { VeloLogo } from "@/components/VeloLogo";
import HelpCenterView from "@/components/help-center/HelpCenterView";

/**
 * Central de Ajuda pública (/ajuda). Não exige login: quem ainda não é cliente
 * também chega aqui por links do suporte, da landing e de buscadores.
 */
const HelpCenterPage = () => {
  useEffect(() => {
    const previous = document.title;
    document.title = "Central de Ajuda · Velo";
    return () => {
      document.title = previous;
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-white font-['Inter',system-ui,sans-serif] text-[#0F1117]">
      <header className="border-b border-[#E4E4E7]">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between px-4 sm:px-6">
          <Link to="/" aria-label="Velo — página inicial">
            <VeloLogo size="sm" />
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1240px] flex-1 px-4 pb-12 pt-6 sm:px-6 lg:pt-8">
        <HelpCenterView basePath="/ajuda" />
      </main>

      <footer className="border-t border-[#E4E4E7] py-6 text-center text-[13px] text-[#52525B]">
        © {new Date().getFullYear()} Velo. Todos os direitos reservados.
      </footer>
    </div>
  );
};

export default HelpCenterPage;
