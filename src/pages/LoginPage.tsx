import { type FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ArrowLeft, Eye, EyeOff, Loader2, Mail } from "lucide-react";
import { VeloLogo } from "@/components/VeloLogo";

const showcaseTabs = ["Pesquisa de produtos", "Listagens com IA", "Publicação automática", "Marketplace", "Análises"];
const trustedBrands = ["Mercado Livre", "CJ", "Shopee", "Mercado Pago"];

const LoginPage = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);

  if (!authLoading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setLoading(false);
      toast.error(
        error.message === "Invalid login credentials"
          ? "Email ou senha incorretos. Tente novamente."
          : error.message
      );
    }
  };

  const handleReset = async (event: FormEvent) => {
    event.preventDefault();
    const cleanEmail = email.trim();

    if (!cleanEmail) {
      toast.error("Digite seu email");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Email de recuperação enviado! Verifique sua caixa de entrada.");
    setResetMode(false);
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });

    if (error) {
      setGoogleLoading(false);
      toast.error(error.message);
    }
  };

  return (
    <main className="min-h-screen bg-white text-[#1e2030] [font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe_UI',sans-serif]">
      <div className="grid min-h-screen lg:grid-cols-2">
        <section className="relative hidden min-h-screen overflow-hidden bg-black text-white lg:block">
          <img
            src="https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=1500&q=85"
            alt="Operação digital automatizada"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.36),rgba(0,0,0,0.18)),linear-gradient(180deg,rgba(0,0,0,0.12),rgba(0,0,0,0.72))]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_42%,rgba(255,255,255,0.12),transparent_34%)]" />

          <div className="relative z-10 flex h-full flex-col justify-between px-11 py-10 xl:px-14">
            <nav className="flex items-center gap-8 text-[18px] font-medium text-white/76">
              {showcaseTabs.map((tab, index) => (
                <span
                  key={tab}
                  className={index === 1 ? "border-b-2 border-white pb-3 text-white" : "pb-3"}
                >
                  {tab}
                </span>
              ))}
            </nav>

            <div className="max-w-[620px] pb-10">
              <h1 className="text-[56px] font-semibold leading-[0.98] tracking-[-0.045em] text-white xl:text-[66px]">
                Produtos prontos para vender em segundos
              </h1>
              <p className="mt-5 max-w-[590px] text-[22px] font-normal leading-[1.35] tracking-[-0.02em] text-white/88">
                Encontre oportunidades, gere anúncios com IA e publique nos marketplaces sem depender de planilhas.
              </p>
            </div>
          </div>
        </section>

        <section className="relative flex min-h-screen flex-col bg-white px-6 py-6 sm:px-10 lg:px-14">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-black/10 bg-white px-4 text-[14px] font-medium text-black/62 transition hover:border-black/18 hover:bg-black/[0.03] hover:text-black"
            >
              <ArrowLeft size={17} />
              Voltar
            </button>
            <VeloLogo size="sm" variant="dark" />
          </div>

          <div className="flex flex-1 items-center justify-center py-12">
            <div className="w-full max-w-[458px]">
              {googleLoading ? (
                <div className="text-center">
                  <h1 className="text-[29px] font-semibold tracking-[-0.035em] text-[#252638]">
                    Entrando com Google
                  </h1>
                  <div className="mx-auto mt-12 grid h-14 w-14 place-items-center rounded-full border border-black/12">
                    <Loader2 className="h-8 w-8 animate-spin text-black" />
                  </div>
                  <button
                    type="button"
                    onClick={() => setGoogleLoading(false)}
                    className="mt-11 h-[70px] w-full rounded-full bg-black text-[20px] font-semibold tracking-[-0.02em] text-white transition hover:bg-black/82"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-10">
                    <h1 className="text-[42px] font-semibold leading-none tracking-[-0.055em] text-[#252638]">
                      {resetMode ? "Recuperar senha" : "Entrar na Velo"}
                    </h1>
                    <p className="mt-4 text-[17px] leading-[1.5] tracking-[-0.015em] text-[#777987]">
                      {resetMode
                        ? "Digite seu email para receber um link seguro de redefinição."
                        : "Acesse seu painel para continuar sua operação de vendas."}
                    </p>
                  </div>

                  <form onSubmit={resetMode ? handleReset : handleLogin} className="space-y-4">
                    <label className="block">
                      <span className="mb-2 block text-[13px] font-semibold text-[#2c2d3b]">Email</span>
                      <div className="relative">
                        <input
                          type="email"
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                          required
                          placeholder="voce@email.com"
                          className="h-14 w-full rounded-2xl border border-[#dfe2ea] bg-[#f7f8fb] px-5 pr-12 text-[15px] font-medium text-[#1f2130] outline-none transition placeholder:text-[#9ca2b2] focus:border-black/45 focus:bg-white"
                        />
                        <Mail className="absolute right-5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#a3a8b5]" />
                      </div>
                    </label>

                    {!resetMode && (
                      <label className="block">
                        <span className="mb-2 block text-[13px] font-semibold text-[#2c2d3b]">Senha</span>
                        <div className="relative">
                          <input
                            type={showPw ? "text" : "password"}
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            required
                            placeholder="Sua senha"
                            className="h-14 w-full rounded-2xl border border-[#dfe2ea] bg-[#f7f8fb] px-5 pr-12 text-[15px] font-medium text-[#1f2130] outline-none transition placeholder:text-[#9ca2b2] focus:border-black/45 focus:bg-white"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPw((current) => !current)}
                            className="absolute right-5 top-1/2 -translate-y-1/2 text-[#a3a8b5] transition hover:text-black"
                            aria-label={showPw ? "Ocultar senha" : "Mostrar senha"}
                          >
                            {showPw ? <EyeOff size={20} /> : <Eye size={20} />}
                          </button>
                        </div>
                      </label>
                    )}

                    {!resetMode && (
                      <div className="flex items-center justify-between pt-1">
                        <button
                          type="button"
                          onClick={() => setRemember((current) => !current)}
                          className="flex items-center gap-2 text-[14px] font-medium text-[#777987]"
                        >
                          <span className={`grid h-5 w-5 place-items-center rounded-full border ${remember ? "border-black bg-black" : "border-[#cdd2dc] bg-white"}`}>
                            {remember && <span className="h-2 w-2 rounded-full bg-white" />}
                          </span>
                          Lembrar de mim
                        </button>
                        <button
                          type="button"
                          onClick={() => setResetMode(true)}
                          className="text-[14px] font-semibold text-[#252638] transition hover:text-black/62"
                        >
                          Esqueceu a senha?
                        </button>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      className="mt-4 h-[62px] w-full rounded-full bg-black text-[18px] font-semibold tracking-[-0.02em] text-white transition hover:bg-black/82 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {loading ? "Aguarde..." : resetMode ? "Enviar link" : "Login"}
                    </button>
                  </form>

                  {!resetMode && (
                    <>
                      <div className="my-8 flex items-center gap-5">
                        <div className="h-px flex-1 bg-[#e5e7ee]" />
                        <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#b1b5c1]">ou</span>
                        <div className="h-px flex-1 bg-[#e5e7ee]" />
                      </div>

                      <button
                        type="button"
                        onClick={handleGoogleLogin}
                        className="flex h-[58px] w-full items-center justify-center gap-3 rounded-2xl border border-[#dfe2ea] bg-white text-[15px] font-semibold text-[#252638] shadow-[0_10px_30px_rgba(22,24,35,0.04)] transition hover:border-black/18 hover:bg-[#fafafa]"
                      >
                        <GoogleIcon />
                        Entrar com Google
                      </button>

                      <p className="mt-8 text-center text-[15px] text-[#7c808e]">
                        Ainda não tem conta?{" "}
                        <Link to="/auth" className="font-semibold text-black underline-offset-4 hover:underline">
                          Criar conta
                        </Link>
                      </p>
                    </>
                  )}

                  {resetMode && (
                    <button
                      type="button"
                      onClick={() => setResetMode(false)}
                      className="mt-7 w-full text-center text-[15px] font-semibold text-[#252638] transition hover:text-black/62"
                    >
                      Voltar para login
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="pb-6 text-center lg:text-left">
            <p className="text-[16px] text-[#b5b8c2]">Usado por operações conectadas a</p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-8 text-[24px] font-semibold tracking-[-0.05em] text-[#d4d6dd] lg:justify-start">
              {trustedBrands.map((brand) => (
                <span key={brand}>{brand}</span>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

export default LoginPage;