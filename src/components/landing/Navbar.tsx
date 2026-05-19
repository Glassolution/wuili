import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { VeloLogo } from "@/components/VeloLogo";

type NavbarProps = {
  transparentAtTop?: boolean;
};

const navItems = [
  { label: "Home", href: "#" },
  { label: "Produto", href: "#produto" },
  { label: "Soluções", href: "#solucoes" },
  { label: "Preços", href: "#numeros" },
  { label: "Blog", href: "#footer" },
];

const Navbar = ({ transparentAtTop = false }: NavbarProps) => {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!transparentAtTop) return;

    const onScroll = () => setScrolled(window.scrollY > 18);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, [transparentAtTop]);

  const isTransparent = transparentAtTop && !scrolled;

  return (
    <nav
      className={`sticky top-0 z-50 flex w-full flex-wrap items-center justify-between gap-5 px-6 py-5 md:px-8 lg:px-10 transition-colors duration-300 ${
        isTransparent ? "bg-transparent" : "bg-white"
      }`}
    >
      <Link to="/" className="flex items-center no-underline">
        <VeloLogo size="md" variant="dark" />
      </Link>

      <ul className="hidden items-center gap-10 lg:flex">
        {navItems.map((item) => (
          <li key={item.label} className="list-none">
            <a
              href={item.href}
              className="text-[16px] font-medium tracking-[-0.02em] text-[#56637a] transition-colors hover:text-[#121b4f]"
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-3">
        <div className="hidden rounded-full bg-[#f0f9eb] p-1 md:flex md:items-center md:gap-1">
          <span className="rounded-full bg-[#f0f9eb] px-4 py-2 text-[13px] font-semibold text-[#2d6a2d]">Varejista</span>
          <span className="rounded-full px-4 py-2 text-[13px] font-medium text-[#2d6a2d]">Fornecedor</span>
        </div>

        <button
          type="button"
          onClick={() => navigate("/cadastro")}
          className="inline-flex h-12 items-center justify-center rounded-full bg-[#101f5c] px-6 text-[14px] font-semibold text-white shadow-[0_10px_22px_rgba(16,31,92,0.24)] transition-transform hover:-translate-y-0.5"
        >
          Criar conta
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
