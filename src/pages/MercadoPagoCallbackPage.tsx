import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PUBLIC_APP_URL } from "@/lib/constants";

const MercadoPagoCallbackPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const called = useRef(false);
  const [message, setMessage] = useState("Conectando ao Mercado Pago...");

  useEffect(() => {
    if (called.current) return;
    called.current = true;

    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error || !code) {
      navigate("/dashboard/integracoes?mp_error=1", { replace: true });
      return;
    }

    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          navigate("/login", { replace: true });
          return;
        }

        const redirectUri = `${PUBLIC_APP_URL}/mercadopago/callback`;
        const { error: fnErr } = await supabase.functions.invoke("connect-mercadopago-seller", {
          body: { code, redirect_uri: redirectUri },
        });
        if (fnErr) throw fnErr;

        setMessage("Conta conectada! Redirecionando...");
        navigate("/dashboard/integracoes?mp_success=1", { replace: true });
      } catch (err) {
        console.error("[MP callback] erro:", err);
        navigate("/dashboard/integracoes?mp_error=1", { replace: true });
      }
    })();
  }, [searchParams, navigate]);

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
};

export default MercadoPagoCallbackPage;
