import { Link } from "react-router-dom";
import { VeloLogo } from "@/components/VeloLogo";

const Footer = () => (
  <footer id="footer" className="px-6 pb-12 pt-8 md:px-10 lg:px-14 lg:pb-16">
    <div className="mx-auto flex max-w-[1240px] flex-col gap-8 rounded-[30px] bg-[#0f1d57] px-8 py-10 text-white shadow-[0_30px_70px_rgba(10,20,59,0.28)] md:flex-row md:items-center md:justify-between md:px-10">
      <div>
        <VeloLogo size="md" variant="light" />
        <p className="mt-4 max-w-[380px] text-[15px] leading-7 text-white/65">
          Uma plataforma para transformar catálogo, marketplace e operação em uma loja pronta para vender.
        </p>
      </div>

      <nav className="flex flex-wrap gap-x-8 gap-y-3 text-[14px] text-white/75">
        <Link to="/login" className="transition-colors hover:text-white">
          Entrar
        </Link>
        <Link to="/login" className="transition-colors hover:text-white">
          Começar grátis
        </Link>
        <a href="#produto" className="transition-colors hover:text-white">
          Produto
        </a>
        <a href="#solucoes" className="transition-colors hover:text-white">
          Soluções
        </a>
        <Link to="/politica-de-privacidade" className="transition-colors hover:text-white">
          Política de Privacidade
        </Link>
        <Link to="/termos-de-servico" className="transition-colors hover:text-white">
          Termos de Serviço
        </Link>
      </nav>

      <div className="text-[13px] text-white/45">© 2026 Velo. Todos os direitos reservados.</div>
    </div>
  </footer>
);

export default Footer;
