import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const PLAN_LABEL: Record<string, string> = {
  base: "Base",
  pro: "Pro",
  business: "Business",
};

/** Página de retorno do checkout: aguarda o webhook da ValidaPay ativar a assinatura. */
const SubscriptionConfirmedPage = () => {
  const [params] = useSearchParams();
  const { user } = useAuth();
  const plan = (params.get("plan") ?? "").toLowerCase();
  const [status, setStatus] = useState<"aguardando" | "ativo">("aguardando");

  useEffect(() => {
    if (!user) return;
    let active = true;
    let tries = 0;

    const check = async () => {
      const { data } = await supabase
        .from("subscriptions")
        .select("status, plan")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!active) return;
      if (data?.status === "active") {
        setStatus("ativo");
        return;
      }

      // Rede de segurança: se o webhook da ValidaPay atrasar, confirmamos o
      // pagamento direto no gateway em vez de esperar o cron de reconciliação.
      try {
        const { data: verified } = await supabase.functions.invoke("subscription-sync-self");
        if (!active) return;
        if (verified?.active) {
          setStatus("ativo");
          return;
        }
      } catch {
        // segue tentando no próximo ciclo
      }

      tries += 1;
      if (tries < 40) window.setTimeout(check, 3000);
    };


    check();
    return () => {
      active = false;
    };
  }, [user]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FAFAF8] px-6">
      <div className="w-full max-w-[460px] rounded-2xl border border-[#E8E8E4] bg-white p-8 text-center shadow-sm">
        {status === "ativo" ? (
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" aria-hidden />
        ) : (
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-[#0A0A0A]" aria-hidden />
        )}
        <h1 className="mt-5 text-[22px] font-bold tracking-[-0.015em] text-[#0A0A0A]">
          {status === "ativo" ? "Assinatura confirmada!" : "Confirmando seu pagamento..."}
        </h1>
        <p className="mt-2 text-[14px] leading-6 text-[#6B6B66]">
          {status === "ativo"
            ? `Seu plano ${PLAN_LABEL[plan] ?? ""} já está ativo. Bom trabalho e boas vendas!`
            : "Assim que o pagamento for compensado, seu plano é liberado automaticamente. Isso costuma levar poucos segundos."}
        </p>
        <Link
          to="/dashboard"
          className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#0A0A0A] text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
        >
          Ir para o painel
        </Link>
      </div>
    </main>
  );
};

export default SubscriptionConfirmedPage;
