import { Link } from "react-router-dom";

const WuilliLogo = () => (
  <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
    <rect width="30" height="30" rx="8" fill="#7C3AED" />
    <path d="M15 7.5L21 11.25V18.75L15 22.5L9 18.75V11.25L15 7.5Z" fill="white" />
  </svg>
);

const Navbar = () => (
  <nav className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-between px-6 md:px-[52px] py-[18px] bg-[rgba(250,250,250,0.82)] backdrop-blur-[20px] border-b border-[rgba(0,0,0,0.07)]">
    <Link to="/" className="flex items-center gap-[10px] no-underline">
      <WuilliLogo />
      <span className="font-['Sora'] font-bold text-[1.2rem] text-[#0A0A0A] tracking-[-0.035em]">velo</span>
    </Link>
    <ul className="hidden md:flex items-center gap-[34px] list-none">
      <li><a href="#como-funciona" className="text-[0.875rem] font-normal text-[#6B6B6B] no-underline hover:text-[#0A0A0A] transition-colors">Como funciona</a></li>
      <li><a href="#planos" className="text-[0.875rem] font-normal text-[#6B6B6B] no-underline hover:text-[#0A0A0A] transition-colors">Planos</a></li>
      <li><a href="#depoimentos" className="text-[0.875rem] font-normal text-[#6B6B6B] no-underline hover:text-[#0A0A0A] transition-colors">Resultados</a></li>
    </ul>
    <div className="flex items-center gap-[10px]">
      <button className="text-[0.875rem] font-medium text-[#0A0A0A] bg-transparent border-none cursor-pointer px-4 py-2 rounded-full hover:bg-[#F4F4F4] transition-colors font-['DM_Sans']">Entrar</button>
      <button className="text-[0.875rem] font-medium text-white bg-[#7C3AED] border-none cursor-pointer px-[22px] py-[10px] rounded-full hover:bg-[#9F67FF] hover:-translate-y-[1px] transition-all shadow-[0_4px_16px_rgba(124,58,237,0.22)] font-['DM_Sans']">Começar grátis</button>
    </div>
  </nav>
);

export default Navbar;
