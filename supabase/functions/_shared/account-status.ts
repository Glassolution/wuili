// Guarda de acesso: contas em regularização (ou canceladas por falta de
// pagamento) ficam pausadas — sem publicar, sem sincronizar pedidos.
// O cadastro e o histórico permanecem intactos.

export const SUSPENDED_STATUSES = ["pending_regularization", "cancelled_unpaid"];

// deno-lint-ignore no-explicit-any -- cliente Supabase tipado em runtime
export async function isAccountSuspended(admin: any, userId: string): Promise<boolean> {
  if (!userId) return false;
  const { data } = await admin
    .from("subscriptions")
    .select("id")
    .eq("user_id", userId)
    .in("status", SUSPENDED_STATUSES)
    .limit(1);
  if (!data?.length) return false;

  // Pagou a regularização (ou assinou de novo): assinatura ativa libera a conta.
  const { data: active } = await admin
    .from("subscriptions")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1);
  return !active?.length;
}
