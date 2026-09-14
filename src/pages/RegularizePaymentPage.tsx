import { useState } from "react";
import { AlertTriangle, Loader2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useAccountSuspension } from "@/hooks/useAccountSuspension";
import { startValidaPayCheckout, type VelloPlanId } from "@/lib/validapayCheckout";
import { toast } from "sonner";

const WHATSAPP_URL =
  "https://wa.me/5547999286334?text=" +
  encodeURIComponent("Olá! Recebi o aviso de regularização de pagamento e quero enviar meu comprovante.");

const PLAN_LABEL: Record<string, string> = {
  base: "Base",
  pro: "Pro",
  business: "Business",
};

const RegularizePaymentPage = () => {
  const { signOut } = useAuth();
  const { plan, status, loading } = useAccountSuspension();
  const [paying, setPaying] = useState(false);

  const planId = (plan && plan in PLAN_LABEL ? plan : "base") as VelloPlanId;

  const handlePay = async () => {
    setPaying(true);
    const result = await startValidaPayCheckout(planId, "monthly");
    if (!result.ok) {
      toast.error(result.error ?? "Não foi possível abrir o pagamento.");
      setPaying(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-12">
      <section className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 shadow-sm">
        <span className="inline-flex items-center gap-2 rounded-full bg-destructive/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-destructive">
          <AlertTriangle className="h-3.5 w-3.5" />
          Ação necessária
        </span>

        <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground">
          Regularize seu pagamento para continuar
        </h1>

        <div className="mt-4 space-y-3 rounded-xl bg-muted/60 p-4 text-sm leading-relaxed text-muted-foreground">
          <p>
            Identificamos uma falha técnica no nosso sistema de pagamentos que ativou sua
            assinatura sem confirmar o pagamento. O erro foi nosso, e estamos resolvendo com
            total transparência.
          </p>
          <p>
            Seu acesso ao plano <strong className="text-foreground">{PLAN_LABEL[planId]}</strong>{" "}
            está pausado até a confirmação do pagamento. Nenhum dado, loja ou publicação sua foi
            apagado — tudo volta assim que o pagamento for confirmado.
          </p>
          {status === "cancelled_unpaid" && (
            <p className="text-destructive">
              O prazo de 24 horas terminou e a assinatura foi cancelada. Você pode reativar
              pagando agora.
            </p>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <Button size="lg" onClick={handlePay} disabled={paying || loading}>
            {paying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Pagar e reativar minha conta
          </Button>

          <Button asChild variant="outline" size="lg">
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="mr-2 h-4 w-4" />
              Já paguei — enviar comprovante no WhatsApp
            </a>
          </Button>
        </div>

        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-6 w-full text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          Sair da conta
        </button>
      </section>
    </main>
  );
};

export default RegularizePaymentPage;
