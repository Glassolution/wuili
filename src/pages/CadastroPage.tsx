import { useState } from "react";
import { useNavigate, Link, Navigate, useLocation, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { VeloLogo } from "@/components/VeloLogo";
import { motion } from "framer-motion";

const duplicateEmailMessage = "Esse email já está cadastrado. Faça login.";

function isDuplicateEmailAuthError(error: { message?: string; code?: string } | null): boolean {
  const m = error?.message?.toLowerCase() ?? "";
  const c = error?.code?.toLowerCase() ?? "";
  return c === "user_already_exists" || m.includes("already registered") || m.includes("already been registered") || m.includes("email already");
}

const CadastroPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isOfferStep = searchParams.get("offer") === "1";
  const { user, loading: authLoading } = useAuth();

  const initialEmail = (location.state as { email?: string } | null)?.email ?? "";
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState(initialEmail);
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const enter = {
    initial: { opacity: 0, y: 14, filter: "blur(6px)" },
    animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  };
  const smooth = { duration: 0.68, ease: [0.22, 1, 0.36, 1] as const };

  if (!authLoading && user && !isOfferStep) {
    return <Navigate to="/setup" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText(null);

    if (user) {
      navigate("/dashboard", { replace: true });
      return;
    }

    if (nome.trim().length < 2) return setErrorText("Informe seu nome completo.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setErrorText("Email inválido.");
    if (senha.length < 8) return setErrorText("A senha precisa ter pelo menos 8 caracteres.");

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.toLowerCase().trim(),
      password: senha,
      options: { data: { full_name: nome.trim() }, emailRedirectTo: window.location.origin },
    });
    setLoading(false);

    if (error) {
      setErrorText(isDuplicateEmailAuthError(error) ? duplicateEmailMessage : error.message);
      return;
    }

    if (data.user) {
      await supabase.from("profiles").update({ display_name: nome.trim() }).eq("user_id", data.user.id);
    }

    toast.success("Conta criada!");
    navigate("/dashboard", { replace: true });
  };

  const handleGoogle = async () => {
    setErrorText(null);
    setGoogleLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/setup`,
    });
    if (result.error) {
      setGoogleLoading(false);
      setErrorText("Não foi possível entrar com o Google. Tente novamente.");
      return;
    }
    if (result.redirected) return;
    navigate("/setup", { replace: true });
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#020706] text-white antialiased [font-family:'Helvetica_Neue',Helvetica,-apple-system,BlinkMacSystemFont,'SF_Pro_Display','SF_Pro_Text',Arial,sans-serif]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(20,60,55,0.2),transparent_43%),radial-gradient(circle_at_50%_18%,rgba(255,255,255,0.035),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.025),transparent_32%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.22)_58%,rgba(0,0,0,0.68)_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.045] [background-image:radial-gradient(circle,rgba(255,255,255,0.7)_0.7px,transparent_0.7px)] [background-size:5px_5px]" />

      <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-8">
        <motion.div {...enter} transition={{ ...smooth, delay: 0.04 }}>
          <Link to="/" className="opacity-95">
            <VeloLogo size="md" variant="light" />
          </Link>
        </motion.div>
        <motion.div {...enter} transition={{ ...smooth, delay: 0.12 }}>
          <Link
            to="/login"
            className="rounded-full border border-white/[0.09] bg-white/[0.045] px-3.5 py-1.5 text-[12px] font-[400] text-white/55 shadow-[0_8px_24px_rgba(0,0,0,0.16)] transition hover:border-white/[0.16] hover:bg-white/[0.075] hover:text-white/80"
          >
            Pular
          </Link>
        </motion.div>
      </header>

      <main className="relative z-10 flex min-h-[calc(100vh-76px)] items-start justify-center px-4 pb-12 pt-8 sm:items-center sm:pb-16 sm:pt-0">
        <motion.div
          {...enter}
          transition={{ ...smooth, delay: 0.18 }}
          className="grid w-full max-w-[900px] grid-cols-1 overflow-hidden rounded-[16px] border border-white/[0.075] bg-white/[0.025] shadow-[0_34px_90px_rgba(0,0,0,0.44)] backdrop-blur-xl md:grid-cols-[0.48fr_0.52fr]"
        >
          <section className="relative flex min-h-[420px] flex-col justify-between overflow-hidden bg-[linear-gradient(145deg,rgba(255,255,255,0.065),rgba(255,255,255,0.025)_42%,rgba(10,22,19,0.34))] p-8 sm:p-10 lg:p-12">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.06),transparent_34%)]" />
            <div className="relative">
              <motion.p
                {...enter}
                transition={{ ...smooth, delay: 0.3 }}
                className="mb-5 text-[11px] font-[500] uppercase tracking-[0.16em] text-white/36"
              >
                Velo Start
              </motion.p>
              <motion.h1
                {...enter}
                transition={{ ...smooth, delay: 0.4 }}
                className="max-w-[360px] text-[33px] font-[420] leading-[1.06] tracking-[-0.045em] text-white sm:text-[38px]"
              >
                Comece hoje,
                <br />
                continue por R$ 149,90
              </motion.h1>
              <motion.p
                {...enter}
                transition={{ ...smooth, delay: 0.5 }}
                className="mt-5 max-w-[340px] text-[14px] font-[350] leading-[1.55] text-white/54"
              >
                2 meses inclusos na primeira assinatura.
              </motion.p>
            </div>

            <div className="relative mt-10">
              <motion.p
                {...enter}
                transition={{ ...smooth, delay: 0.58 }}
                className="mb-5 max-w-[300px] text-[13px] font-[350] leading-relaxed text-white/42"
              >
                Oferta de entrada para novos usuários da Velo.
              </motion.p>
              <motion.div
                {...enter}
                transition={{ ...smooth, delay: 0.66 }}
                className="flex flex-col divide-y divide-white/[0.075] text-[14px] font-[360]"
              >
                <Row label="Hoje" value="Acesso imediato" />
                <Row label="Primeiros 2 meses" value="Inclusos na assinatura" />
                <Row label="Sempre" value="Cancele quando quiser" />
              </motion.div>
            </div>
          </section>

          <section className="flex flex-col justify-center bg-[#fbfaf7] p-7 text-[#151515] sm:p-9 lg:p-10">
            {user ? (
              <div className="mx-auto flex w-full max-w-[360px] flex-col items-center text-center">
                <motion.p
                  {...enter}
                  transition={{ ...smooth, delay: 0.76 }}
                  className="text-[11px] font-[500] uppercase tracking-[0.16em] text-[#151515]/35"
                >
                  Próximo passo
                </motion.p>
                <motion.h2
                  {...enter}
                  transition={{ ...smooth, delay: 0.86 }}
                  className="mt-4 text-[30px] font-[420] leading-[1.05] tracking-[-0.05em] text-[#151515]"
                >
                  Ative sua operação.
                </motion.h2>
                <motion.p
                  {...enter}
                  transition={{ ...smooth, delay: 0.96 }}
                  className="mt-4 text-[14px] font-[350] leading-[1.55] text-[#151515]/48"
                >
                  Sua configuração inicial está pronta. Finalize a assinatura para liberar o painel completo da Velo.
                </motion.p>
                <motion.button
                  {...enter}
                  transition={{ ...smooth, delay: 1.08 }}
                  type="button"
                  onClick={() => navigate("/checkout?plan=pro", { replace: true })}
                  className="mt-8 flex h-11 w-full items-center justify-center rounded-full bg-[#151515] text-[14px] font-[420] tracking-[-0.01em] text-white shadow-[0_10px_24px_rgba(0,0,0,0.14)] transition hover:bg-black"
                >
                  Ir para pagamento
                </motion.button>
                <motion.button
                  {...enter}
                  transition={{ ...smooth, delay: 1.16 }}
                  type="button"
                  onClick={() => navigate("/dashboard", { replace: true })}
                  className="mt-4 text-[13px] font-[360] text-[#151515]/42 transition hover:text-[#151515]/70"
                >
                  Entrar no dashboard depois
                </motion.button>
              </div>
            ) : (
              <>
                <motion.button
                  {...enter}
                  transition={{ ...smooth, delay: 0.76 }}
                  type="button"
                  onClick={handleGoogle}
                  disabled={googleLoading || loading}
                  className="flex h-11 w-full items-center justify-center gap-2.5 rounded-full border border-black/[0.115] bg-white text-[14px] font-[380] tracking-[-0.01em] text-[#151515] shadow-[0_1px_0_rgba(0,0,0,0.02)] transition hover:border-black/20 hover:bg-[#f7f6f2] disabled:opacity-60"
                >
                  {googleLoading ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 48 48">
                      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
                      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35 26.7 36 24 36c-5.2 0-9.6-3.3-11.2-8l-6.5 5C9.6 39.6 16.2 44 24 44z" />
                      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.7l6.2 5.2c-.4.4 6.6-4.8 6.6-14.9 0-1.3-.1-2.4-.4-3.5z" />
                    </svg>
                  )}
                  Continuar com Google
                </motion.button>

                <motion.div
                  {...enter}
                  transition={{ ...smooth, delay: 0.84 }}
                  className="my-6 flex items-center gap-3 text-[12px] font-[350] text-[#151515]/35"
                >
                  <span className="h-px flex-1 bg-black/[0.08]" />
                  ou
                  <span className="h-px flex-1 bg-black/[0.08]" />
                </motion.div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                  <motion.div {...enter} transition={{ ...smooth, delay: 0.92 }}>
                    <Input value={nome} onChange={setNome} placeholder="Nome completo" autoComplete="name" />
                  </motion.div>
                  <motion.div {...enter} transition={{ ...smooth, delay: 1.0 }}>
                    <Input value={email} onChange={setEmail} placeholder="E-mail" type="email" autoComplete="email" />
                  </motion.div>
                  <motion.div {...enter} transition={{ ...smooth, delay: 1.08 }}>
                    <Input value={senha} onChange={setSenha} placeholder="Senha" type="password" autoComplete="new-password" />
                  </motion.div>

                  {errorText && (
                    <p className="rounded-md bg-red-50 px-3 py-2 text-[13px] text-red-600">{errorText}</p>
                  )}

                  <motion.button
                    {...enter}
                    transition={{ ...smooth, delay: 1.16 }}
                    type="submit"
                    disabled={loading}
                    className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#151515] text-[14px] font-[420] tracking-[-0.01em] text-white shadow-[0_10px_24px_rgba(0,0,0,0.14)] transition hover:bg-black disabled:opacity-60"
                  >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : "Criar conta"}
                  </motion.button>

                  <motion.p
                    {...enter}
                    transition={{ ...smooth, delay: 1.24 }}
                    className="mt-5 text-center text-[12px] font-[350] leading-relaxed text-[#151515]/48"
                  >
                    Ao continuar, você concorda com os Termos e a
                    <br />
                    Política de Privacidade.
                  </motion.p>
                </form>
              </>
            )}
          </section>
        </motion.div>
      </main>
    </div>
  );
};

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
    <span className="text-white/48">{label}</span>
    <span className="max-w-[180px] text-right text-white/82">{value}</span>
  </div>
);

const Input = ({
  value,
  onChange,
  placeholder,
  type = "text",
  autoComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
  autoComplete?: string;
}) => (
  <input
    type={type}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    autoComplete={autoComplete}
    className="h-11 w-full rounded-full border border-black/[0.115] bg-white px-4 text-[14px] font-[350] tracking-[-0.006em] text-[#1a1a1a] outline-none transition placeholder:text-[#1a1a1a]/42 focus:border-black/35 focus:ring-4 focus:ring-black/[0.045]"
  />
);

export default CadastroPage;
