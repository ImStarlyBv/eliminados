/**
 * IndexNow — instant URL submission for Bing, Yandex, Seznam, Naver, etc.
 * (Google does NOT participate in IndexNow.)
 *
 * The key is public by design: it must also be served as a plain-text file at
 * https://<host>/<key>.txt containing exactly this key, which proves we own
 * the host. See src/pages/<key>.txt.ts.
 */
export const INDEXNOW_KEY = 'fc89902c49b3da15eb804afd1e5a93b9';

/**
 * Submit one or more URLs to IndexNow. Fire-and-forget; never throws.
 * All URLs must belong to the same host.
 */
export async function submitIndexNow(urls: string[]): Promise<void> {
  if (!urls.length) return;

  const siteUrl = (process.env.SITE_URL || 'https://eliminados.online').replace(/\/$/, '');
  const host = new URL(siteUrl).hostname;

  const body = JSON.stringify({
    host,
    key: INDEXNOW_KEY,
    keyLocation: `${siteUrl}/${INDEXNOW_KEY}.txt`,
    urlList: urls,
  });

  try {
    const res = await fetch('https://api.indexnow.org/IndexNow', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
      body,
    });
    console.log(`[indexnow] ${res.status} — ${urls.length} URL(s) submitted`);
  } catch (e) {
    console.error('[indexnow] ERROR:', e instanceof Error ? e.message : String(e));
  }
}
