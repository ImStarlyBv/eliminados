import type { APIRoute } from 'astro';

/**
 * RSS feed — site-wide, most recent 50 articles.
 * Cheap traffic, easy discoverability.
 */
export const GET: APIRoute = async ({ site }) => {
  const siteUrl =
    site?.href?.replace(/\/$/, '') ||
    process.env.SITE_URL ||
    'https://eliminados.online';

  let items: { title: string; link: string; description: string; pubDate: string; category: string }[] = [];

  try {
    const { db } = await import('@/lib/db');
    const { articles, categories } = await import('@/db/schema');
    const { eq, desc } = await import('drizzle-orm');

    const publishedArticles = await db
      .select({
        slug: articles.slug,
        title: articles.title,
        metaDescription: articles.metaDescription,
        publishedAt: articles.publishedAt,
        categoryId: articles.categoryId,
      })
      .from(articles)
      .where(eq(articles.status, 'published'))
      .orderBy(desc(articles.publishedAt))
      .limit(50);

    items = publishedArticles.map((a) => ({
      title: a.title,
      link: `${siteUrl}/${a.slug}`,
      description: a.metaDescription,
      pubDate: (a.publishedAt || new Date()).toUTCString(),
      category: 'Entretenimiento',
    }));
  } catch {
    // DB not connected — empty feed
  }

  const rssItems = items.map(
    (item) => `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${item.link}</link>
      <description>${escapeXml(item.description)}</description>
      <pubDate>${item.pubDate}</pubDate>
      <category>${item.category}</category>
      <guid isPermaLink="true">${item.link}</guid>
    </item>`
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>ELIMINADOS — El Pulso del Entretenimiento</title>
    <link>${siteUrl}</link>
    <description>Noticias de entretenimiento, farándula, reality shows, música urbana y lo más viral de República Dominicana.</description>
    <language>es</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${siteUrl}/rss.xml" rel="self" type="application/rss+xml"/>
${rssItems.join('\n')}
  </channel>
</rss>`;

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
};

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
