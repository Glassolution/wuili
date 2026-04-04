import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const WuilliLogo = () => (
  <svg width="56" height="56" viewBox="0 0 30 30" fill="none">
    <rect width="30" height="30" rx="8" fill="#7C3AED" />
    <path d="M15 7.5L21 11.25V18.75L15 22.5L9 18.75V11.25L15 7.5Z" fill="white" />
  </svg>
);

const LoginPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message === "Invalid login credentials"
        ? "Email ou senha incorretos. Tente novamente."
        : error.message);
    } else {
      navigate("/dashboard", { replace: true });
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { toast.error("Digite seu email"); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Email de recuperação enviado! Verifique sua caixa de entrada.");
    setResetMode(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <WuilliLogo />
          <h1 className="mt-4 text-xl font-bold text-gray-900">
            {resetMode ? "Recuperar senha" : "Entrar na Wuilli"}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {resetMode
              ? "Digite seu email para receber o link de recuperação"
              : "Acesse sua conta para continuar"}
          </p>
        </div>

        <form onSubmit={resetMode ? handleReset : handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 transition-all"
              placeholder="seu@email.com"
            />
          </div>

          {!resetMode && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20 transition-all"
                placeholder="••••••••"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#7C3AED] py-3 text-sm font-semibold text-white hover:bg-[#6D28D9] transition-colors disabled:opacity-50"
          >
            {loading ? "Aguarde..." : resetMode ? "Enviar link" : "Entrar"}
          </button>
        </form>

        <div className="mt-6 text-center space-y-2">
          {!resetMode ? (
            <>
              <button
                onClick={() => setResetMode(true)}
                className="text-sm text-[#7C3AED] hover:underline"
              >
                Esqueci minha senha
              </button>
              <p className="text-sm text-gray-500">
                Não tem conta?{" "}
                <Link to="/cadastro" className="text-[#7C3AED] font-semibold hover:underline">
                  Criar conta
                </Link>
              </p>
            </>
          ) : (
            <button
              onClick={() => setResetMode(false)}
              className="text-sm text-[#7C3AED] hover:underline"
            >
              Voltar para login
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
