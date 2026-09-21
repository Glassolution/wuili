import { useEffect, useRef } from "react";
import { tentarPublicarPendentesAgora } from "@/lib/publicacaoPendente";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { lerStatusVendedorMl } from "@/lib/mlConexao";
import { trackMobileHomeEvent } from "@/lib/mobileHomeTracking";

/**
 * Verifica em segundo plano se a conta recém-conectada do Mercado Livre pode
 * vender.
 *
 * Por decisão de produto, o pagamento vem antes da ativação da conta de
 * vendedor: aqui NÃO abrimos modal nem interrompemos ninguém. A checagem serve
 * só para medir e para o app adaptar as mensagens depois. A ajuda com texto e
 * vídeo aparece depois do pagamento, na hora de publicar.
 */
const MLPostConnectCheck = () => {
  const { user } = useAuth();
  const location = useLocation();
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
        // Se havia anúncio esperando a conta ser liberada, ele sobe agora.
        void tentarPublicarPendentesAgora();
        return;
      }
      if (status.apta === false) {
        trackMobileHomeEvent(user.id, "ml_seller_not_ready", {
          detail: `pos_conexao:${status.codigos.join(",") || "sem_codigo"}`,
        });
      }
    })();

    return () => {
      ativo = false;
    };
  }, [location.search, user]);

  return null;
};

export default MLPostConnectCheck;
