import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const AliExpressCallbackPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const called = useRef(false);

  useEffect(() => {
    if (called.current) return;
    called.current = true;

    const code = searchParams.get("code");

    if (!code) {
      navigate("/dashboard?error=aliexpress_auth_failed", { replace: true });
      return;
    }

    const exchange = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          navigate("/login", { replace: true });
          return;
        }

        const { error } = await supabase.functions.invoke("aliexpress-callback", {
          body: { code },
        });

        if (error) throw error;

        navigate("/dashboard", { replace: true });
      } catch {
        navigate("/dashboard?error=aliexpress_auth_failed", { replace: true });
      }
    };

    exchange();
  }, [searchParams, navigate]);

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Conectando ao AliExpress...</p>
      </div>
    </div>
  );
};

export default AliExpressCallbackPage;
