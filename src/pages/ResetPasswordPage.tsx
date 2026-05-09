import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { VeloLogo } from "@/components/VeloLogo";

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const prepareRecoverySession = async () => {
      try {
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const code = new URLSearchParams(window.location.search).get("code");

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
          window.history.replaceState({}, document.title, window.location.pathname);
        } else if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          window.history.replaceState({}, document.title, window.location.pathname);
        } else {
          const { data } = await supabase.auth.getSession();
          if (!data.session) {
            toast.error("Link de recuperação inválido ou expirado.");
          }
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Não foi possível validar o link.");
      } finally {
        if (!cancelled) setSessionReady(true);
      }
    };

    void prepareRecoverySession();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (password.length < 8) {
      toast.error("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("As senhas não conferem.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Senha atualizada com sucesso.");
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black px-4 py-10">
      <div className="absolute left-1/2 top-1/2 h-[720px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white opacity-[0.05] blur-[100px]" />

      <div className="relative z-10 w-full max-w-[440px] rounded-[28px] border border-white/[0.08] bg-[#111] px-8 py-10 shadow-[0_32px_80px_rgba(0,0,0,0.5)] sm:px-10">
        <div className="mb-8">
          <VeloLogo size="lg" variant="light" />
        </div>

        <h1 className="font-['Manrope'] text-[1.55rem] font-bold tracking-[-0.02em] text-white">
          Redefinir senha
        </h1>
        <p className="mt-2 font-['Manrope'] text-[13px] leading-6 text-white/45">
          Crie uma nova senha para acessar sua conta Velo.
        </p>

        <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-3">
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
              placeholder="Nova senha"
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-[13px] pr-11 font-['Manrope'] text-[13px] text-white outline-none transition placeholder:text-white/25 focus:border-white/20 focus:bg-white/[0.07]"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/25 transition hover:text-white/50"
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>

          <input
            type={showPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            minLength={8}
            placeholder="Confirmar nova senha"
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-[13px] font-['Manrope'] text-[13px] text-white outline-none transition placeholder:text-white/25 focus:border-white/20 focus:bg-white/[0.07]"
          />

          <button
            type="submit"
            disabled={loading || !sessionReady}
            className="btn-primary btn-primary--md mt-2 w-full disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading || !sessionReady ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={15} className="animate-spin" />
                Aguarde...
              </span>
            ) : (
              "Atualizar senha"
            )}
          </button>
        </form>

        <Link
          to="/login"
          className="mt-6 block text-center font-['Manrope'] text-[12px] font-semibold text-white/55 transition hover:text-white"
        >
          Voltar ao login
        </Link>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
