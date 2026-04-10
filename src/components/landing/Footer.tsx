const Footer = () => (
  <footer className="relative z-[1] border-t border-white/[0.06] bg-[#0a0a0a] px-6 py-10 md:px-[52px]">
    <div className="mx-auto flex max-w-[1280px] flex-col items-center justify-between gap-6 md:flex-row">
      <div className="flex items-center gap-[9px]">
        <span className="font-['Sora'] text-base font-bold tracking-[-0.035em] text-white">wuilli</span>
      </div>
      <span className="text-[0.8125rem] text-white/30">© 2025 Wuilli. Todos os direitos reservados.</span>
      <div className="flex gap-7">
        <a href="#" className="text-[0.8125rem] text-white/30 no-underline transition-colors hover:text-white">Termos</a>
        <a href="#" className="text-[0.8125rem] text-white/30 no-underline transition-colors hover:text-white">Privacidade</a>
        <a href="#" className="text-[0.8125rem] text-white/30 no-underline transition-colors hover:text-white">Contato</a>
      </div>
    </div>
  </footer>
);

export default Footer;
