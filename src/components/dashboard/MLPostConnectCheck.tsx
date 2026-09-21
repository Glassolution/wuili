import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { lerStatusVendedorMl } from "@/lib/mlConexao";
import { trackMobileHomeEvent } from "@/lib/mobileHomeTracking";
import MLAccountVerificationModal from "@/components/dashboard/MLAccountVerificationModal";
import MlMissingInfoModal from "@/components/dashboard/MlMissingInfoModal";

/**
 * Verifica se a conta recém-conectada do Mercado Livre pode vender.
 *
 * Antes isso só acontecia no clique em publicar — depois da tela de planos —,
 * então dava para assinar e só então descobrir que a conta estava bloqueada.
 * Aqui a checagem roda assim que o OAuth volta (`?ml_connected=true`), antes
 * de qualquer cobrança. Falha de rede não bloqueia ninguém: sem resposta clara
 * o fluxo segue como antes.
 */
const MLPostConnectCheck = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [codigos, setCodigos] = useState<string[] | null>(null);
  const jaVerificado = useRef(false);

  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(location.search);
    if (params.get("ml_connected") !== "true" || jaVerificado.current) return;
    jaVerificado.current = true;

    let ativo = true;
    void (async () => {
      const status = await lerStatusVendedorMl();
      if (!ativo) return;
      if (status.apta === true) {
        trackMobileHomeEvent(user.id, "ml_seller_ready", { detail: "pos_conexao" });
        return;
      }
      if (status.apta === false) {
        trackMobileHomeEvent(user.id, "ml_seller_not_ready", { detail: status.codigos.join(",") || "sem_codigo" });
        // Com códigos do ML mostramos exatamente o que falta; sem eles, o tutorial.
        if (status.codigos.length) setCodigos(status.codigos);
        else setTutorialOpen(true);
      }
    })();

    return () => {
      ativo = false;
    };
  }, [location.search, user]);

  return (
    <>
      <MLAccountVerificationModal
        open={tutorialOpen}
        onClose={() => setTutorialOpen(false)}
        onFinish={() => setTutorialOpen(false)}
        onVerified={() => setTutorialOpen(false)}
      />
      <MlMissingInfoModal
        open={codigos !== null}
        sellerCodes={codigos ?? []}
        onClose={() => setCodigos(null)}
      />
    </>
  );
};

export default MLPostConnectCheck;
