import { Link, useNavigate, useParams } from "react-router-dom";
import { Loader2, Menu, Search, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { useSalesPageData } from "./salesPageData";

/**
 * Tela · Login / Cadastro da loja pública (visão do cliente final).
 * Mesmo idioma visual do template AERO STEP.
 */
const SalesLoginPage = () => {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const { data, loading, error } = useSalesPageData(slug);
  const [mode, setMode] = useState<"login" | "signup">("login");

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f5f2ea]">
        <Loader2 className="animate-spin text-[#3d4a2a]" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f5f2ea] p-6 text-center">
        <div>
          <p className="text-lg font-semibold text-[#1a1a1a]">Página não encontrada</p>
          <p className="mt-2 text-sm text-[#1a1a1a]/60">{error ?? "Tente novamente mais tarde."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f2ea] text-[#1a1a1a]" style={{ fontFamily: '"Inter", system-ui, sans-serif' }}>
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1a1a1a]/8 px-6 py-5 md:px-10">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#3d4a2a] text-[11px] font-semibold text-[#f5f2ea]">
            {(data.brand || "L").slice(0, 1).toUpperCase()}
          </span>
          <Link to={`/loja/${slug}`} className="text-[15px] font-semibold tracking-tight text-[#1a1a1a]">
            {(data.brand || "loja").toLowerCase()}
          </Link>
        </div>
        <nav className="hidden items-center gap-8 text-[13px] font-medium text-[#1a1a1a]/75 md:flex">
          <Link to={`/loja/${slug}`} className="hover:text-[#3d4a2a]">Loja</Link>
          <Link to={`/loja/${slug}/catalogo`} className="hover:text-[#3d4a2a]">Catálogo</Link>
          <a href="#" className="hover:text-[#3d4a2a]">Sobre</a>
          <a href="#" className="hover:text-[#3d4a2a]">Contato</a>
        </nav>
        <div className="flex items-center gap-3 text-[#1a1a1a]/75">
          <button aria-label="Buscar" className="hover:text-[#3d4a2a]"><Search size={18} /></button>
          <Link to={`/loja/${slug}/carrinho`} className="inline-flex items-center gap-2 rounded-full bg-[#3d4a2a] px-4 py-2 text-[12px] font-semibold text-[#f5f2ea]">
            <ShoppingBag size={14} strokeWidth={2} />
            Carrinho
          </Link>
          <button aria-label="Menu" className="hover:text-[#3d4a2a] md:hidden"><Menu size={20} /></button>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1100px] gap-10 px-6 py-14 md:grid-cols-2 md:px-10 md:py-20">
        <section className="flex flex-col justify-center">
          <span className="inline-flex w-fit items-center rounded-full bg-white/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#3d4a2a]">
            Sua conta
          </span>
          <h1 className="mt-4 text-[40px] font-bold leading-[1.05] tracking-tight text-[#1a1a1a] sm:text-[52px]" style={{ fontFamily: '"Fraunces", "Playfair Display", serif' }}>
            {mode === "login" ? "Bem-vindo de volta." : "Crie sua conta."}
          </h1>
          <p className="mt-4 max-w-md text-[14px] leading-relaxed text-[#1a1a1a]/65">
            {mode === "login"
              ? "Acesse seus pedidos, favoritos e endereços salvos. Compra rápida em poucos cliques."
              : "Cadastre-se para acompanhar pedidos, salvar produtos favoritos e receber ofertas exclusivas."}
          </p>

          <div className="mt-8 hidden gap-6 text-[13px] text-[#1a1a1a]/65 md:flex">
            <div>
              <p className="text-[24px] font-bold text-[#1a3c2a]" style={{ fontFamily: '"Fraunces", "Playfair Display", serif' }}>+10k</p>
              <p>clientes satisfeitos</p>
            </div>
            <div>
              <p className="text-[24px] font-bold text-[#1a3c2a]" style={{ fontFamily: '"Fraunces", "Playfair Display", serif' }}>4.9</p>
              <p>avaliação média</p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-[#1a1a1a]/8 bg-white/85 p-8 shadow-[0_20px_60px_-40px_rgba(26,60,42,0.35)]">
          <div className="flex rounded-full bg-[#1a1a1a]/5 p-1 text-[12px] font-semibold uppercase tracking-[0.18em]">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`flex-1 rounded-full py-2 transition ${mode === "login" ? "bg-[#1a3c2a] text-[#f5f2ea]" : "text-[#1a1a1a]/55"}`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`flex-1 rounded-full py-2 transition ${mode === "signup" ? "bg-[#1a3c2a] text-[#f5f2ea]" : "text-[#1a1a1a]/55"}`}
            >
              Cadastrar
            </button>
          </div>

          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              navigate(`/loja/${slug}/conta`);
            }}
          >
            {mode === "signup" ? (
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1a1a1a]/60">Nome</span>
                <input type="text" required className="mt-1 w-full rounded-lg border border-[#1a1a1a]/15 bg-white px-3 py-2.5 text-[14px] outline-none focus:border-[#3d4a2a]" placeholder="Seu nome" />
              </label>
            ) : null}
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1a1a1a]/60">E-mail</span>
              <input type="email" required className="mt-1 w-full rounded-lg border border-[#1a1a1a]/15 bg-white px-3 py-2.5 text-[14px] outline-none focus:border-[#3d4a2a]" placeholder="voce@email.com" />
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1a1a1a]/60">Senha</span>
              <input type="password" required className="mt-1 w-full rounded-lg border border-[#1a1a1a]/15 bg-white px-3 py-2.5 text-[14px] outline-none focus:border-[#3d4a2a]" placeholder="••••••••" />
            </label>

            {mode === "login" ? (
              <div className="flex items-center justify-between text-[12px] text-[#1a1a1a]/60">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="h-3.5 w-3.5 accent-[#c8a24a]" defaultChecked />
                  Lembrar-me
                </label>
                <a href="#" className="font-semibold text-[#3d4a2a] hover:text-[#1a3c2a]">Esqueci a senha</a>
              </div>
            ) : null}

            <button
              type="submit"
              className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-full bg-[#c8a24a] text-[12.5px] font-bold uppercase tracking-[0.16em] text-[#1a3c2a] transition hover:bg-[#b8922e]"
            >
              {mode === "login" ? "Entrar na conta" : "Criar conta"}
            </button>
          </form>

          <div className="mt-6 flex items-center gap-3 text-[11px] uppercase tracking-[0.2em] text-[#1a1a1a]/35">
            <span className="h-px flex-1 bg-[#1a1a1a]/10" />
            ou
            <span className="h-px flex-1 bg-[#1a1a1a]/10" />
          </div>
          <button
            type="button"
            className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-[#1a1a1a]/15 bg-white text-[13px] font-semibold text-[#1a1a1a] hover:border-[#1a1a1a]/30"
          >
            Continuar com Google
          </button>
        </section>
      </main>
    </div>
  );
};

export default SalesLoginPage;
