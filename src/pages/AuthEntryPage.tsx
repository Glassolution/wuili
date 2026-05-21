import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Mail, UserRound } from "lucide-react";
import { toast } from "sonner";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { VeloLogo } from "@/components/VeloLogo";

const enter = {
  initial: { opacity: 0, y: 14, filter: "blur(6px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
};

const smooth = { duration: 0.72, ease: [0.22, 1, 0.36, 1] as const };

const AuthEntryPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [emailFormOpen, setEmailFormOpen] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string }>({});
  const initialEmail = useMemo(() => {
    const stateEmail = (location.state as { email?: string } | null)?.email?.trim();
    if (stateEmail) return stateEmail;
    const queryEmail = searchParams.get("email")?.trim();
    if (queryEmail) return queryEmail;
    return window.localStorage.getItem("velo_auth_email") ?? "";
  }, [location.state, searchParams]);
  const [form, setForm] = useState({
    name: "",
    email: initialEmail,
    password: "",
  });

  useEffect(() => {
    if (initialEmail) {
      setForm((current) => ({ ...current, email: initialEmail }));
      setEmailFormOpen(true);
    }
  }, [initialEmail]);

  if (!authLoading && user) return <Navigate to="/dashboard" replace />;

  const handleGoogle = async () => {
    setGoogleLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/setup`,
    });
    if (result.error) {
      setGoogleLoading(false);
      return;
    }
    if (result.redirected) return;
    navigate("/setup", { replace: true });
  };

  const validateForm = () => {
    const nextErrors: typeof errors = {};
    const cleanEmail = form.email.trim();

    if (!form.name.trim()) nextErrors.name = "Digite seu nome completo.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      nextErrors.email = "Digite um e-mail válido.";
    }
    if (form.password.length < 8) {
      nextErrors.password = "A senha precisa ter pelo menos 8 caracteres.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleEmailSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateForm()) return;

    setEmailLoading(true);
    const cleanEmail = form.email.trim();
    window.localStorage.setItem("velo_auth_email", cleanEmail);

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password: form.password,
      options: {
        data: { full_name: form.name.trim() },
        emailRedirectTo: `${window.location.origin}/setup`,
      },
    });

    if (error) {
      setEmailLoading(false);
      toast.error(
        error.message === "User already registered"
          ? "Este e-mail já possui conta. Entre para continuar."
          : error.message
      );
      return;
    }

    if (!data.session) {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: form.password,
      });

      if (signInError) {
        setEmailLoading(false);
        toast.info("Conta criada. Verifique seu e-mail para concluir o acesso.");
        return;
      }
    }

    if (data.user) {
      await supabase.from("profiles").upsert(
        {
          user_id: data.user.id,
          display_name: form.name.trim(),
        },
        { onConflict: "user_id" }
      );
    }

    toast.success("Conta criada. Vamos configurar sua Velo.");
    navigate("/setup", { replace: true });
  };

  const updateForm = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    if (errors[field as keyof typeof errors]) {
      setErrors((current) => ({ ...current, [field]: undefined }));
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#020706] text-white antialiased [font-family:'Helvetica_Neue',Helvetica,-apple-system,BlinkMacSystemFont,'SF_Pro_Display','SF_Pro_Text',Arial,sans-serif]">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.1, ease: "easeOut" }}
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(25,72,64,0.24),transparent_44%),radial-gradient(circle_at_50%_12%,rgba(255,255,255,0.04),transparent_26%),#020706]"
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.26)_58%,rgba(0,0,0,0.72)_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.04] [background-image:radial-gradient(circle,rgba(255,255,255,0.8)_0.7px,transparent_0.7px)] [background-size:5px_5px]" />

      <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-8">
        <motion.div {...enter} transition={{ ...smooth, delay: 0.12 }}>
          <Link to="/" className="opacity-95">
            <VeloLogo size="md" variant="light" />
          </Link>
        </motion.div>
      </header>

      <section className="relative z-10 flex min-h-[calc(100vh-82px)] items-center justify-center px-5 pb-16">
        <motion.div
          {...enter}
          transition={{ ...smooth, delay: 0.24 }}
          className="w-full max-w-[420px] rounded-[22px] border border-white/[0.075] bg-white/[0.035] p-7 shadow-[0_34px_90px_rgba(0,0,0,0.42)] backdrop-blur-xl sm:p-8"
        >
          <motion.p
            {...enter}
            transition={{ ...smooth, delay: 0.34 }}
            className="text-[11px] font-[500] uppercase tracking-[0.16em] text-white/36"
          >
            Entrada
          </motion.p>
          <motion.h1
            {...enter}
            transition={{ ...smooth, delay: 0.44 }}
            className="mt-4 text-[34px] font-[420] leading-[1.02] tracking-[-0.05em] text-white"
          >
            Entre na Velo
          </motion.h1>
          <motion.p
            {...enter}
            transition={{ ...smooth, delay: 0.54 }}
            className="mt-3 text-[15px] font-[350] leading-[1.55] text-white/52"
          >
            Descubra produtos e comece sua operação.
          </motion.p>

          <div className="mt-8 space-y-3">
            <motion.button
              {...enter}
              transition={{ ...smooth, delay: 0.66 }}
              type="button"
              onClick={handleGoogle}
              disabled={googleLoading}
              className="flex h-12 w-full items-center justify-center gap-3 rounded-full border border-white/[0.11] bg-white text-[14px] font-[430] tracking-[-0.01em] text-[#111] transition hover:bg-white/92 disabled:opacity-60"
            >
              {googleLoading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <GoogleIcon />
              )}
              Continuar com Google
            </motion.button>
            <motion.button
              {...enter}
              transition={{ ...smooth, delay: 0.78 }}
              type="button"
              onClick={() => setEmailFormOpen((open) => !open)}
              aria-expanded={emailFormOpen}
              className="flex h-12 w-full items-center justify-center gap-3 rounded-full border border-white/[0.09] bg-white/[0.055] text-[14px] font-[400] tracking-[-0.01em] text-white/78 transition hover:border-white/[0.18] hover:bg-white/[0.085] hover:text-white"
            >
              <Mail size={17} strokeWidth={1.8} />
              Continuar com e-mail
            </motion.button>
          </div>

          <AnimatePresence initial={false}>
            {emailFormOpen && (
              <motion.form
                key="email-form"
                initial={{ opacity: 0, height: 0, y: -6, filter: "blur(6px)" }}
                animate={{ opacity: 1, height: "auto", y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, height: 0, y: -6, filter: "blur(6px)" }}
                transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
                onSubmit={handleEmailSubmit}
                className="overflow-hidden"
              >
                <div className="mt-5 space-y-3">
                  <AuthInput
                    icon={<UserRound size={16} strokeWidth={1.7} />}
                    value={form.name}
                    onChange={(value) => updateForm("name", value)}
                    placeholder="Nome completo"
                    autoComplete="name"
                    error={errors.name}
                  />
                  <AuthInput
                    icon={<Mail size={16} strokeWidth={1.7} />}
                    value={form.email}
                    onChange={(value) => updateForm("email", value)}
                    placeholder="E-mail"
                    autoComplete="email"
                    type="email"
                    error={errors.email}
                  />
                  <AuthInput
                    value={form.password}
                    onChange={(value) => updateForm("password", value)}
                    placeholder="Senha"
                    autoComplete="new-password"
                    type="password"
                    error={errors.password}
                  />

                  <motion.button
                    type="submit"
                    disabled={emailLoading}
                    className="mt-1 flex h-12 w-full items-center justify-center rounded-full bg-white text-[14px] font-[460] tracking-[-0.01em] text-[#101010] transition hover:bg-white/92 disabled:opacity-60"
                    whileTap={{ scale: 0.985 }}
                  >
                    {emailLoading ? <Loader2 size={18} className="animate-spin" /> : "Criar conta"}
                  </motion.button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          <motion.p
            {...enter}
            transition={{ ...smooth, delay: 0.9 }}
            className="mt-7 text-center text-[13px] font-[350] text-white/42"
          >
            Já possui conta?{" "}
            <Link to="/login" className="text-white/82 transition hover:text-white">
              Entrar
            </Link>
          </motion.p>
        </motion.div>
      </section>
    </main>
  );
};

type AuthInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete: string;
  type?: string;
  icon?: ReactNode;
  error?: string;
};

const AuthInput = ({ value, onChange, placeholder, autoComplete, type = "text", icon, error }: AuthInputProps) => (
  <label className="block">
    <div className="relative">
      {icon && <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/34">{icon}</div>}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={`h-12 w-full rounded-full border bg-white/[0.055] px-4 text-[14px] font-[360] tracking-[-0.01em] text-white outline-none transition placeholder:text-white/28 focus:bg-white/[0.075] ${
          icon ? "pl-11" : ""
        } ${error ? "border-red-300/45" : "border-white/[0.09] focus:border-white/[0.2]"}`}
      />
    </div>
    {error && <span className="mt-1.5 block px-4 text-[12px] font-[350] text-red-200/78">{error}</span>}
  </label>
);

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35 26.7 36 24 36c-5.2 0-9.6-3.3-11.2-8l-6.5 5C9.6 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.7l6.2 5.2c-.4.4 6.6-4.8 6.6-14.9 0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);

export default AuthEntryPage;
