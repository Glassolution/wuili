import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { publicationFailurePolicy, IMAGE_QUEUE_MESSAGE } from './saved-publication-images.ts';
import { GatewayError } from 'npm:@lovable.dev/ai-gateway@0.1.11';
export async function imageCallAllowed(db: SupabaseClient, background: boolean): Promise<boolean> {
  const { data, error } = await db.rpc('publication_image_gate', { p_background: background });
  if (error) throw new Error(`Não foi possível conferir disponibilidade da IA: ${error.message}`);
  return data === true;
}
export async function recordImageFailure(db: SupabaseClient, error: unknown) {
  const gateway = error instanceof GatewayError ? error : undefined;
  const kind = publicationFailurePolicy(gateway?.httpStatus, gateway?.remote?.type);
  const message = gateway?.recovery?.message ?? (error instanceof Error ? error.message : 'Falha na conferência de fotos');
  const { error: writeError } = await db.rpc('publication_image_pause', {
    p_kind: kind, p_message: message.slice(0, 500), p_delay_seconds: kind === 'rate' ? Math.max(300, gateway?.retryAfter ?? 0) : 300,
  });
  if (writeError) throw new Error(`Não foi possível preservar pausa de IA: ${writeError.message}`);
}
export async function recordImageSuccess(db: SupabaseClient) {
  const { error } = await db.rpc('publication_image_resume_after_success');
  if (error) throw new Error(`Não foi possível concluir a conferência de IA: ${error.message}`);
}
export async function queueImagePublication(db: SupabaseClient, userId: string, product: Record<string, unknown>, limit: number | null, monthlyLimit: number | null) {
  const { data, error } = await db.rpc('enqueue_image_publication', {
    p_user_id: userId, p_product_id: String(product.id ?? ''), p_title: String(product.title ?? ''),
    p_payload: { product }, p_active_limit: limit, p_monthly_limit: monthlyLimit,
  });
  if (error) throw new Error(error.message);
  return { queued: true, pending_publication_id: data, message: IMAGE_QUEUE_MESSAGE };
}