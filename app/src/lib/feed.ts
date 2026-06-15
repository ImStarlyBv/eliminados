/**
 * Shared RSS feed builder — used by both /rss.xml and /feed.rss.
 * Pulls the 50 most recent published articles from the DB.
 *
 * SEO notes:
 *  - lastBuildDate reflects the most recent article (RSS 2.0 spec: "the last
 *    time the content of the channel changed"), NOT the request time.
 *  - Full article HTML is shipped via <content:encoded> so crawlers/aggregators
 *    get the whole article, not just the meta description.
 *  - A WebSub (PubSubHubbub) hub is declared so the feed can be pushed to
 *    subscribers (incl. Google) for near-instant indexing. See pingWebSub().
 */

/** Public WebSub hub used for instant-indexing pushes. */
export const WEBSUB_HUB = 'https://pubsubhubbub.appspot.com/';

export interface FeedItem {
  title: string;
  link: string;
  description: string;
  content: string;
  pubDate: string;
  category: string;
}

export async function getFeedItems(siteUrl: string): Promise<FeedItem[]> {
  try {
    const { db } = await import('@/lib/db');
    const { articles } = await import('@/db/schema');
    const { eq, desc } = await import('drizzle-orm');

    const rows = await db
      .select({
        slug: articles.slug,
        title: articles.title,
        metaDescription: articles.metaDescription,
        bodyHtml: articles.bodyHtml,
        publishedAt: articles.publishedAt,
      })
      .from(articles)
      .where(eq(articles.status, 'published'))
      .orderBy(desc(articles.publishedAt))
      .limit(50);

    return rows.map((a) => ({
      title: a.title,
      link: `${siteUrl}/${a.slug}`,
      description: a.metaDescription,
      content: a.bodyHtml || a.metaDescription,
      pubDate: (a.publishedAt || new Date()).toUTCString(),
      category: 'Entretenimiento',
    }));
  } catch {
    // DB not connected — empty feed
    return [];
  }
}

export function buildRssXml(
  siteUrl: string,
  items: FeedItem[],
  selfPath = '/rss.xml'
): string {
  // lastBuildDate / channel pubDate = most recent article (items are desc).
  const lastChanged = items[0]?.pubDate || new Date().toUTCString();

  const rssItems = items.map(
    (item) => `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${item.link}</link>
      <description>${escapeXml(item.description)}</description>
      <content:encoded>${cdata(item.content)}</content:encoded>
      <pubDate>${item.pubDate}</pubDate>
      <category>${item.category}</category>
      <guid isPermaLink="true">${item.link}</guid>
    </item>`
  );

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:atom="http://www.w3.org/2005/Atom"
     xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>ELIMINADOS — El Pulso del Entretenimiento</title>
    <link>${siteUrl}</link>
    <description>Noticias de entretenimiento, farándula, reality shows, música urbana y lo más viral de República Dominicana.</description>
    <language>es</language>
    <pubDate>${lastChanged}</pubDate>
    <lastBuildDate>${lastChanged}</lastBuildDate>
    <generator>ELIMINADOS</generator>
    <atom:link href="${siteUrl}${selfPath}" rel="self" type="application/rss+xml"/>
    <atom:link href="${WEBSUB_HUB}" rel="hub"/>
${rssItems.join('\n')}
  </channel>
</rss>`;
}

export function rssResponse(xml: string, maxAge = 300): Response {
  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': `public, max-age=${maxAge}`,
    },
  });
}

/**
 * Notify the WebSub hub that the given feed URLs changed, so subscribers
 * (including Google) get pushed the update for near-instant indexing.
 * Fire-and-forget: failures are logged, never thrown.
 */
export async function pingWebSub(feedUrls: string[]): Promise<void> {
  await Promise.all(
    feedUrls.map(async (feedUrl) => {
      try {
        const body = new URLSearchParams({
          'hub.mode': 'publish',
          'hub.url': feedUrl,
        });
        await fetch(WEBSUB_HUB, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        });
      } catch (e) {
        console.error('WebSub ping failed for', feedUrl, e);
      }
    })
  );
}

/** Wrap a string in CDATA, escaping any nested `]]>` sequences. */
function cdata(str: string): string {
  return `<![CDATA[${str.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;
}

export function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
