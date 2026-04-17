import type { APIRoute } from 'astro';

/**
 * Google News Sitemap — only articles from the last 48 hours.
 * Required for Google News Top Stories eligibility.
 * https://developers.google.com/search/docs/crawling-indexing/sitemaps/news-sitemap
 */
export const GET: APIRoute = async ({ site }) => {
  const siteUrl =
    site?.href?.replace(/\/$/, '') ||
    process.env.SITE_URL ||
    'https://eliminados.online';

  let newsEntries: {
    loc: string;
    title: string;
    publishedAt: string;
    keywords?: string;
  }[] = [];

  try {
    const { db } = await import('@/lib/db');
    const { articles } = await import('@/db/schema');
    const { eq, desc, gte, and } = await import('drizzle-orm');

    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48h ago

    const recentArticles = await db
      .select({
        slug: articles.slug,
        title: articles.title,
        publishedAt: articles.publishedAt,
      })
      .from(articles)
      .where(
        and(
          eq(articles.status, 'published'),
          gte(articles.publishedAt, cutoff)
        )
      )
      .orderBy(desc(articles.publishedAt));

    newsEntries = recentArticles.map((a) => ({
      loc: `/${a.slug}`,
      title: a.title,
      publishedAt: (a.publishedAt || new Date()).toISOString(),
    }));
  } catch {
    // DB not connected — empty news sitemap
  }

  const urls = newsEntries.map(
    (entry) => `  <url>
    <loc>${siteUrl}${entry.loc}</loc>
    <news:news>
      <news:publication>
        <news:name>ELIMINADOS</news:name>
        <news:language>es</news:language>
      </news:publication>
      <news:publication_date>${entry.publishedAt}</news:publication_date>
      <news:title>${escapeXml(entry.title)}</news:title>
    </news:news>
  </url>`
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urls.join('\n')}
</urlset>`;

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=60',
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
