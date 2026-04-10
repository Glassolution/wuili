import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import BrandMark from "@/components/brand/BrandMark";

const LoginPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);

  const handleLogin = async (e: FormEvent) => {
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

  const handleReset = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { toast.error("Digite seu email"); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Email de recuperacao enviado! Verifique sua caixa de entrada.");
    setResetMode(false);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(117,90,255,0.24),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(100,247,255,0.14),transparent_24%)]" />
      <div className="absolute inset-0 panel-grid opacity-25" />
      <div className="card-wuili-elevated relative z-10 w-full max-w-[1040px] overflow-hidden">
        <div className="grid min-h-[680px] lg:grid-cols-[0.9fr_1.1fr]">
          <div className="hidden border-r border-white/10 bg-[linear-gradient(160deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-10 lg:flex lg:flex-col lg:justify-between">
            <div>
              <BrandMark size="lg" showWordmark />
              <div className="mt-10 label-upper">Access node</div>
              <h2 className="mt-4 text-4xl leading-tight">Entre no centro de comando da sua operacao.</h2>
              <p className="mt-5 max-w-md text-sm leading-7 text-slate-300">
                A nova identidade visual transforma a entrada do produto em uma experiencia premium e confiante.
              </p>
            </div>
            <div className="rounded-[28px] border border-white/10 bg-black/20 p-6">
              <p className="text-sm leading-7 text-slate-300">
                Publicacoes, catalogos, pagamentos e assistencia por IA reunidos em um unico painel luminoso.
              </p>
            </div>
          </div>

          <div className="relative flex items-center justify-center px-6 py-10 sm:px-10">
            <div className="w-full max-w-sm">
              <div className="mb-8 flex flex-col items-center text-center">
                <BrandMark size="lg" />
                <h1 className="mt-5 text-3xl text-white">
                  {resetMode ? "Recuperar senha" : "Entrar na Wuilli"}
                </h1>
                <p className="mt-2 text-sm text-slate-300">
                  {resetMode
                    ? "Digite seu email para receber o link de recuperacao"
                    : "Acesse sua conta para continuar"}
                </p>
              </div>

              <form onSubmit={resetMode ? handleReset : handleLogin} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-200">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-slate-500 focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/10"
                    placeholder="seu@email.com"
                  />
                </div>

                {!resetMode && (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-200">Senha</label>
                    <input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-slate-500 focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-300/10"
                      placeholder="••••••••"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="glow-ring w-full rounded-2xl bg-cyan-300 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-105 disabled:opacity-50"
                >
                  {loading ? "Aguarde..." : resetMode ? "Enviar link" : "Entrar"}
                </button>
              </form>

              <div className="mt-6 space-y-2 text-center">
                {!resetMode ? (
                  <>
                    <button
                      onClick={() => setResetMode(true)}
                      className="text-sm text-cyan-200 hover:text-white"
                    >
                      Esqueci minha senha
                    </button>
                    <p className="text-sm text-slate-400">
                      Nao tem conta?{' '}
                      <Link to="/cadastro" className="font-semibold text-cyan-200 hover:text-white">
                        Criar conta
                      </Link>
                    </p>
                  </>
                ) : (
                  <button
                    onClick={() => setResetMode(false)}
                    className="text-sm text-cyan-200 hover:text-white"
                  >
                    Voltar para login
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

