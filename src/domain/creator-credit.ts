/** Optional truthful credit. A link can never stand in for a creator's name. */
export function validCreatorCredit(name: unknown, url: unknown): boolean {
  if (name != null && (typeof name !== 'string' || !name.trim() || name.length > 300)) return false;
  if (url == null) return true;
  if (name == null || typeof url !== 'string' || url.length > 2000 || !/^https?:\/\/[^\s]+$/i.test(url)) return false;
  try { const parsed = new URL(url); return !!parsed.hostname && ['http:', 'https:'].includes(parsed.protocol); }
  catch { return false; }
}

/** Read the historical contract without rewriting immutable credits. Older
 * writers accepted HTTP(S) prefixes alone. Rendering can omit an unusable link. */
export function validStoredCreatorCredit(name: unknown, url: unknown): boolean {
  if (name != null && (typeof name !== 'string' || !name.trim() || name.length > 300)) return false;
  return url == null || (name != null && typeof url === 'string' && url.length <= 2000 && /^https?:\/\//i.test(url));
}
