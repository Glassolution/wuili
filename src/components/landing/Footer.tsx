const Footer = () => (
  <footer className="relative z-[1] border-t border-white/[0.06] bg-[#060b18] px-6 py-10 md:px-[52px]">
    <div className="mx-auto flex max-w-[1280px] flex-col items-center justify-between gap-6 md:flex-row">
      <div className="flex items-center gap-[9px]">
        <span className="font-['Sora'] text-lg font-black tracking-[-0.04em] text-white">
          Velo
        </span>
      </div>

      <nav className="flex flex-wrap justify-center gap-6">
        {["Produto", "Preços", "Blog", "Termos", "Privacidade", "Contato"].map((item) => (
          <a
            key={item}
            href="#"
            className="text-[0.8125rem] text-white/30 no-underline transition-colors hover:text-white/80"
          >
            {item}
          </a>
        ))}
      </nav>

      <span className="text-[0.8125rem] text-white/25">
        © 2025 Velo. Todos os direitos reservados.
      </span>
    </div>
  </footer>
);

export default Footer;
