export const FIRST_IMAGE_RETRY_DELAY_MS = 5 * 60_000;
export const SECOND_IMAGE_RETRY_DELAY_MS = 24 * 60 * 60_000;

/** Credit exhaustion is not a visual/inconclusive attempt; other failures count once. */
export function imageFailureRetry(currentAttempts: number, creditFailure: boolean, now = Date.now()) {
  const attempts = creditFailure ? Math.max(0, Math.min(currentAttempts, 2)) : Math.max(1, Math.min(currentAttempts + 1, 2));
  const delay = creditFailure || attempts === 1 ? FIRST_IMAGE_RETRY_DELAY_MS : SECOND_IMAGE_RETRY_DELAY_MS;
  return { attempts, retryAfter: new Date(now + delay).toISOString() };
}
