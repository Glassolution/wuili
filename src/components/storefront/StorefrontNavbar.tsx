import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Globe2, Heart, Search, ShoppingBag, UserCircle } from "lucide-react";

type StorefrontNavbarProps = {
  storeName: string;
  tagline?: string;
  activePage?: "store" | "catalog";
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  showNavigation?: boolean;
  logoImage?: string | null;
  className?: string;
};

const StorefrontNavbar = ({
  storeName,
  tagline = "Escolhas para você.",
  activePage = "store",
  searchValue,
  onSearchChange,
  showNavigation = true,
  logoImage,
  className = "",
}: StorefrontNavbarProps) => {
  const navigate = useNavigate();
  const [localSearch, setLocalSearch] = useState(searchValue ?? "");
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const query = searchValue ?? localSearch;
  const brandInitial = storeName.trim().charAt(0).toUpperCase() || "V";

  useEffect(() => {
    if (searchValue !== undefined) setLocalSearch(searchValue);
  }, [searchValue]);

  const updateSearch = (value: string) => {
    if (onSearchChange) onSearchChange(value);
    else setLocalSearch(value);
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = query.trim();
    const next = new URLSearchParams();
    if (trimmed) next.set("busca", trimmed);
    navigate(next.toString() ? `/catalogo?${next.toString()}` : "/catalogo");
    setMobileSearchOpen(false);
  };

  const navLinkClass = (page: "store" | "catalog") =>
    `transition ${activePage === page ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"}`;

  return (
    <header className={`border-b border-border bg-card text-card-foreground ${className}`}>
      <div className="relative mx-auto flex min-h-[68px] max-w-[1120px] items-center gap-4 px-5 py-3">
        <Link to="/minha-loja/editor" className="z-10 flex min-w-[150px] items-center gap-3">
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-border bg-background text-[13px] font-bold text-foreground">
            {logoImage ? (
              <img data-editor-type="image" data-editor-media-kind="logo" src={logoImage} alt={`Logo ${storeName}`} className="h-full w-full rounded-[9px] object-contain p-1" />
            ) : (
              <>
                <ShoppingBag size={20} strokeWidth={1.6} />
                <span className="absolute mt-1 text-[9px] leading-none">{brandInitial}</span>
              </>
            )}
          </span>
          <span className="min-w-0 leading-none">
            <strong className="block truncate text-[18px] font-semibold tracking-[-0.03em] text-foreground">{storeName}</strong>
            <span className="mt-1 block truncate text-[10px] font-medium text-muted-foreground">{tagline}</span>
          </span>
        </Link>

        <form
          onSubmit={submitSearch}
          className={`${mobileSearchOpen ? "absolute left-5 right-5 top-[76px] z-40 flex" : "hidden"} h-10 min-w-0 items-center overflow-hidden rounded-[10px] border border-input bg-background shadow-sm md:absolute md:left-1/2 md:top-1/2 md:z-0 md:flex md:w-[min(44vw,460px)] md:-translate-x-1/2 md:-translate-y-1/2`}
        >
          <label className="flex min-w-0 flex-1 items-center gap-2 px-3">
            <Search size={15} strokeWidth={1.7} className="shrink-0 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => updateSearch(event.target.value)}
              placeholder="Buscar produtos, marcas e mais..."
              className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
            />
          </label>
          <button
            type="submit"
            aria-label="Buscar"
            className="flex h-full w-11 shrink-0 items-center justify-center bg-[hsl(var(--store-accent-color))] text-[hsl(var(--store-accent-foreground))] transition hover:opacity-90"
          >
            <Search size={16} strokeWidth={1.8} />
          </button>
        </form>

        <div className="z-10 ml-auto flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setMobileSearchOpen((open) => !open)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-foreground md:hidden"
            aria-label="Abrir busca"
          >
            <Search size={16} />
          </button>
          <button type="button" className="hidden h-9 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold text-muted-foreground sm:inline-flex" title="Idioma fixo em português">
            PT <Globe2 size={14} strokeWidth={1.7} />
          </button>
          <button
            type="button"
            aria-disabled="true"
            title="Favoritos em breve"
            className="inline-flex h-9 items-center gap-2 rounded-full bg-[hsl(var(--store-accent-soft))] px-3 text-[12px] font-semibold text-[hsl(var(--store-accent-color))] opacity-80"
          >
            <span className="hidden sm:inline">Favoritos</span>
            <Heart size={15} strokeWidth={1.7} />
          </button>
          <button
            type="button"
            aria-disabled="true"
            title="Carrinho em breve"
            className="inline-flex h-9 items-center gap-2 rounded-full bg-[hsl(var(--store-accent-soft))] px-3 text-[12px] font-semibold text-[hsl(var(--store-accent-color))] opacity-80"
          >
            <span className="hidden sm:inline">Carrinho</span>
            <ShoppingBag size={15} strokeWidth={1.7} />
          </button>
          <button type="button" aria-label="Perfil" className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-muted-foreground">
            <UserCircle size={19} strokeWidth={1.55} />
          </button>
        </div>
      </div>

      {showNavigation ? (
        <nav className="mx-auto flex max-w-[1120px] items-center gap-6 border-t border-border px-5 py-2 text-[12px] font-medium">
          <Link to="/minha-loja/editor" className={navLinkClass("store")}>Loja</Link>
          <Link to="/catalogo" className={navLinkClass("catalog")}>Catálogo</Link>
        </nav>
      ) : null}
    </header>
  );
};

export default StorefrontNavbar;
