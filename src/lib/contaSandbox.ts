import { useAuth } from "@/contexts/AuthContext";
import { isAdminEmail } from "@/lib/adminAccess";
import { useSandboxMode } from "@/lib/sandboxMode";

/**
 * A pessoa está usando a conta Sandbox (modo sandbox ligado por um admin)?
 * É a mesma regra da barra do topo e do modal de planos: compra sem cobrança real.
 */
export const useContaSandbox = () => {
  const { user, role } = useAuth();
  const [sandboxLigado] = useSandboxMode(user?.id ?? user?.email ?? null);
  const papelNoCadastro =
    (user?.app_metadata?.role as string | undefined) ?? (user?.user_metadata?.role as string | undefined) ?? null;
  return sandboxLigado && (role === "admin" || papelNoCadastro === "admin" || isAdminEmail(user?.email));
};
