import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Check, Search, Boxes, Store, ShoppingBag, Music2, Globe } from "lucide-react";
import { toast } from "sonner";
import { VeloLogo } from "@/components/VeloLogo";

const GOALS = [
  { id: "encontrar_produtos", label: "Encontrar produtos para vender", icon: Search },
  { id: "dropshipping", label: "Dropshipping", icon: Boxes },
  { id: "mercado_livre", label: "Mercado Livre", icon: Store },
  { id: "shopee", label: "Shopee", icon: ShoppingBag },
  { id: "tiktok_shop", label: "TikTok Shop", icon: Music2 },
  { id: "ecommerce_proprio", label: "Ecommerce próprio", icon: Globe },
];

const SetupPage = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [lojaNome, setLojaNome] = useState("");
  const [saving, setSaving] = useState(false);

  if (!authLoading && !user) return <Navigate to="/cadastro" replace />;

  const toggle = (id: string) => {
    setSelected((curr) => (curr.includes(id) ? curr.filter((x) => x !== id) : [...curr, id]));
  };

  const handleContinue = () => {
    if (selected.length === 0) {
      toast.error("Escolha pelo menos uma opção.");
      return;
    }
    setStep(2);
  };

  const handleFinish = async () => {
    if (!user) return;
    setSaving(true);
    const primary = selected[0] ?? null;
    const { error } = await supabase
      .from("profiles")
      .update({
        objetivo: primary,
        loja_nome: lojaNome.trim() || null,
        onboarding_completed: true,
      })
      .eq("user_id", user.id);
    setSaving(false);

    if (error) {
      toast.error("Não foi possível salvar. Tente novamente.");
      return;
    }
    toast.success("Tudo pronto!");
    navigate("/dashboard", { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] font-['Manrope'] text-white">
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <VeloLogo size="md" variant="light" />
        <button
          onClick={handleFinish}
          className="text-[13px] font-medium text-white/50 transition hover:text-white"
        >
          Fazer isso depois
        </button>
      </header>

      <main className="mx-auto flex min-h-[calc(100vh-80px)] max-w-[720px] flex-col items-center justify-center px-6 pb-20">
        <div className="mb-10 text-center">
          <h1 className="font-['Sora'] text-[34px] font-semibold leading-tight tracking-[-0.02em] sm:text-[40px]">
            Vamos começar
          </h1>
          <p className="mt-2 text-[14.5px] text-white/55">
            Algumas informações para personalizar sua experiência.
          </p>
        </div>

        <div className="w-full rounded-[20px] border border-white/[0.07] bg-white/[0.02] p-8 backdrop-blur-md sm:p-10">
          {step === 1 ? (
            <>
              <h2 className="text-[15px] font-semibold text-white">O que você deseja fazer?</h2>
              <p className="mt-1 text-[13px] text-white/45">Selecione uma ou mais opções.</p>

              <div className="mt-6 flex flex-wrap gap-2.5">
                {GOALS.map(({ id, label, icon: Icon }) => {
                  const isOn = selected.includes(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggle(id)}
                      className={`group inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-[13.5px] font-medium transition ${
                        isOn
                          ? "border-white bg-white text-[#0a0a0c]"
                          : "border-white/12 bg-white/[0.03] text-white/75 hover:border-white/30 hover:bg-white/[0.06] hover:text-white"
                      }`}
                    >
                      {isOn ? <Check size={14} strokeWidth={3} /> : <Icon size={14} />}
                      {label}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={handleContinue}
                className="mt-10 flex h-12 w-full items-center justify-center rounded-xl bg-white text-[14px] font-medium text-[#0a0a0c] transition hover:bg-white/90"
              >
                Continuar
              </button>
            </>
          ) : (
            <>
              <h2 className="text-[15px] font-semibold text-white">Qual será o nome da sua loja?</h2>
              <p className="mt-1 text-[13px] text-white/45">Você pode mudar isso depois.</p>

              <input
                type="text"
                autoFocus
                value={lojaNome}
                onChange={(e) => setLojaNome(e.target.value)}
                placeholder="Minha loja (opcional)"
                className="mt-6 h-12 w-full rounded-xl border border-white/12 bg-white/[0.03] px-4 text-[14px] text-white outline-none transition placeholder:text-white/30 focus:border-white/30"
              />

              <div className="mt-8 flex items-center justify-between gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="text-[13px] text-white/55 transition hover:text-white"
                >
                  Voltar
                </button>
                <button
                  onClick={handleFinish}
                  disabled={saving}
                  className="flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-8 text-[14px] font-medium text-[#0a0a0c] transition hover:bg-white/90 disabled:opacity-60"
                >
                  {saving ? <Loader2 size={18} className="animate-spin" /> : "Concluir"}
                </button>
              </div>
            </>
          )}
        </div>

        <p className="mt-8 text-[12px] text-white/35">Etapa {step} de 2</p>
      </main>
    </div>
  );
};

export default SetupPage;
