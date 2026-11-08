import { createHmac, timingSafeEqual } from 'node:crypto';

/** Agent Studio's limit: a request whose timestamp is further than this from now is rejected. */
export const MAX_SKEW_S = 300;

/**
 * Checks an X-Studio-Signature header: `t=<unix seconds>,v1=<hex>`, where
 * v1 = HMAC-SHA256(signing secret, `${t}.${METHOD}.${pathWithQuery}.${rawBody}`).
 * Each Studio tool has its own signing secret, shown once when the tool is created (or rotated).
 */
export function verifySignature(
  secret: string,
  header: string | undefined,
  method: string,
  pathWithQuery: string,
  rawBody: string,
  nowS = Math.floor(Date.now() / 1000),
): boolean {
  if (!header) return false;
  const parts = new Map(header.split(',').map((p) => p.split('=', 2) as [string, string]));
  const t = Number(parts.get('t'));
  const v1 = parts.get('v1');
  if (!Number.isInteger(t) || !v1 || Math.abs(nowS - t) > MAX_SKEW_S) return false;
  const want = createHmac('sha256', secret).update(`${t}.${method}.${pathWithQuery}.${rawBody}`).digest();
  const got = Buffer.from(v1, 'hex');
  return got.length === want.length && timingSafeEqual(got, want);
}
