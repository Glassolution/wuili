import { Link } from "react-router-dom";
import { VeloLogo } from "@/components/VeloLogo";

const Navbar = () => (
  <nav className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-between px-6 md:px-[52px] py-[18px] bg-[rgba(250,250,250,0.82)] backdrop-blur-[20px] border-b border-[rgba(0,0,0,0.07)]">
    <Link to="/" className="flex items-center no-underline">
      <VeloLogo size="md" variant="dark" />
    </Link>
    <ul className="hidden md:flex items-center gap-[34px] list-none">
      <li><a href="#como-funciona" className="text-[0.875rem] font-normal text-[#6B6B6B] no-underline hover:text-[#0A0A0A] transition-colors">Como funciona</a></li>
      <li><a href="#planos" className="text-[0.875rem] font-normal text-[#6B6B6B] no-underline hover:text-[#0A0A0A] transition-colors">Planos</a></li>
      <li><a href="#depoimentos" className="text-[0.875rem] font-normal text-[#6B6B6B] no-underline hover:text-[#0A0A0A] transition-colors">Resultados</a></li>
    </ul>
    <div className="flex items-center gap-[8px]">
      <Link to="/login" className="px-4 py-2 rounded-[100px] text-[13px] font-[400] text-[#737373] transition-all duration-[120ms] hover:text-[#0A0A0A] hover:bg-[#F5F5F5]">Entrar</Link>
      <Link to="/cadastro" className="btn-primary btn-primary--md">
        Começar grátis
      </Link>
    </div>
  </nav>
);

export default Navbar;
