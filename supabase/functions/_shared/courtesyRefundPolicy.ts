export type CourtesyInput = {
  subscription_id?: string; charge_id?: string; user_id?: string; amount?: number;
  reason?: string; dry_run?: boolean;
  confirmation?: { user_id?: string; amount?: number; reason?: string };
};

export function courtesyConfirmationMatches(body: CourtesyInput): boolean {
  return Boolean(body.subscription_id && body.charge_id && body.user_id && body.reason?.trim() &&
    Number(body.amount) > 0 && body.confirmation?.user_id === body.user_id &&
    body.confirmation?.amount === body.amount && body.confirmation?.reason === body.reason);
}