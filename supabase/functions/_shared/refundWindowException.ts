import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { hasRefundWindowException } from "./refundPolicy.ts";

export async function verifyRefundWindowException(admin: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data.user || !hasRefundWindowException(userId, data.user.email, true)) return false;
  const { data: role, error: roleError } = await admin.from("user_roles")
    .select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  return !roleError && hasRefundWindowException(userId, data.user.email, role?.role === "admin");
}