const Footer = () => (
  <footer className="relative z-[1] border-t border-[rgba(0,0,0,0.07)] px-6 md:px-[52px] py-10 flex flex-col md:flex-row items-center justify-between gap-6">
    <div className="flex items-center gap-[9px]">
      <svg width="24" height="24" viewBox="0 0 30 30" fill="none">
        <rect width="30" height="30" rx="8" fill="#7C3AED" />
        <path d="M15 7.5L21 11.25V18.75L15 22.5L9 18.75V11.25L15 7.5Z" fill="white" />
      </svg>
      <span className="font-['Sora'] font-bold text-base text-[#0A0A0A] tracking-[-0.035em]">wuilli</span>
    </div>
    <span className="text-[0.8125rem] text-[#6B6B6B]">© 2025 Wuilli. Todos os direitos reservados.</span>
    <div className="flex gap-7">
      <a href="#" className="text-[0.8125rem] text-[#6B6B6B] no-underline hover:text-[#0A0A0A] transition-colors">Termos</a>
      <a href="#" className="text-[0.8125rem] text-[#6B6B6B] no-underline hover:text-[#0A0A0A] transition-colors">Privacidade</a>
      <a href="#" className="text-[0.8125rem] text-[#6B6B6B] no-underline hover:text-[#0A0A0A] transition-colors">Contato</a>
    </div>
  </footer>
);

export default Footer;
