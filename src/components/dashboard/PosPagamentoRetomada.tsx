import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { veloToast } from "@/components/ui/velo-toast";
import { useAuth } from "@/contexts/AuthContext";
import { usePlan } from "@/hooks/usePlan";
import { trackMobileHomeEvent } from "@/lib/mobileHomeTracking";
import { lerContextoDePlanos, limparContextoDePlanos } from "@/lib/planosCheckoutContexto";

/**
 * Depois do pagamento, leva a pessoa de volta ao anúncio que ela estava
 * preparando.
 *
 * Como o checkout é hospedado fora da Velo, o retorno pode cair em qualquer
 * página do painel. Por isso a verificação mora aqui: se existe um anúncio
 * guardado e o plano já está ativo, avisamos e voltamos para o produto.
 */
const PosPagamentoRetomada = () => {
  const { user } = useAuth();
  const { plan, status, loading } = usePlan();
  const navigate = useNavigate();
  const location = useLocation();
  const jaTratado = useRef(false);

  useEffect(() => {
    if (!user || loading || jaTratado.current) return;
    const pago = status === "active" && plan !== "gratis";
    if (!pago) return;

    const contexto = lerContextoDePlanos();
    if (!contexto) return;
    // Na própria página de planos deixamos a pessoa continuar lendo.
    if (location.pathname.startsWith("/dashboard/planos")) return;
    if (location.pathname.startsWith(`/dashboard/catalogo/${contexto.productId}`)) {
      limparContextoDePlanos();
      return;
    }

    jaTratado.current = true;
    trackMobileHomeEvent(user.id, "plans_return_after_payment", { productId: contexto.productId });
    limparContextoDePlanos();
    veloToast.success("Plano ativo. Vamos publicar seu anúncio.");
    navigate(`/dashboard/catalogo/${contexto.productId}`);
  }, [loading, location.pathname, navigate, plan, status, user]);

  return null;
};

export default PosPagamentoRetomada;
