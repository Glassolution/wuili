import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ChevronLeft, ChevronRight, X, Rocket } from "lucide-react";

const STEPS = [
  { title: "Este é seu dashboard", body: "Aqui você tem visão de tudo — pedidos, vendas, catálogo e ferramentas." },
  { title: "Sua página publicada", body: "A landing que você acabou de criar já está no ar e pode ser compartilhada." },
  { title: "Catálogo completo", body: "500+ produtos do seu nicho, prontos pra virar novas páginas ou anúncios." },
  { title: "Criar mais páginas", body: "Não precisa parar em uma. Crie quantas landings quiser, cada uma com um produto." },
  { title: "Publique no Mercado Livre", body: "Em 1 clique você espelha suas páginas como anúncios no ML." },
  { title: "Acompanhe pedidos", body: "Todo pedido que chegar aparece aqui, com status de envio e fulfillment." },
  { title: "Financeiro em tempo real", body: "Veja receita, comissões e saldo. Saque quando quiser." },
  { title: "Suporte quando precisar", body: "Nosso time responde dúvidas em até 4h úteis. Fale com a gente na área de ajuda." },
  { title: "Pronto pra vender! 🚀", body: "É só isso. Você já tem tudo pra começar. Boas vendas!" },
];

export default function TutorialOverlay() {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await (supabase as any).from("profiles").select("tutorial_completed").eq("user_id", user.id).maybeSingle();
      if (data && data.tutorial_completed === false) setVisible(true);
    })();
  }, [user]);

  const finish = async () => {
    setVisible(false);
    if (user) await (supabase as any).from("profiles").update({ tutorial_completed: true }).eq("user_id", user.id);
  };

  if (!visible) return null;
  const s = STEPS[step];

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 grid place-items-center px-6">
      <div className="max-w-md w-full rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 grid place-items-center text-white">
            <Rocket size={18} />
          </div>
          <button onClick={finish} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>
        <h3 className="mt-4 text-xl font-bold">{s.title}</h3>
        <p className="mt-2 text-sm text-slate-500">{s.body}</p>

        <div className="mt-6 flex items-center justify-between">
          <span className="text-xs text-slate-400">Passo {step + 1} de {STEPS.length}</span>
          <div className="flex gap-1">
            {STEPS.map((_, i) => (
              <div key={i} className={`h-1.5 w-4 rounded-full ${i <= step ? "bg-blue-600" : "bg-slate-200"}`} />
            ))}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <button onClick={finish} className="text-sm text-slate-500 hover:text-slate-800">Pular tour</button>
          <div className="flex gap-2">
            {step > 0 && (
              <button onClick={() => setStep(step - 1)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50">
                <ChevronLeft size={16} />
              </button>
            )}
            <button
              onClick={() => step === STEPS.length - 1 ? finish() : setStep(step + 1)}
              className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-semibold hover:bg-slate-800 flex items-center gap-1"
            >
              {step === STEPS.length - 1 ? "Concluir" : "Próximo"}
              {step < STEPS.length - 1 && <ChevronRight size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
