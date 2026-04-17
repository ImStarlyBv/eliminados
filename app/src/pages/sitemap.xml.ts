import type { APIRoute } from 'astro';

/**
 * Dynamic sitemap.xml — grows as articles are added.
 * Includes all published articles + category + tag pages.
 *
 * In production this queries the DB; for now it returns
 * the static pages + a hook for article rows.
 */
export const GET: APIRoute = async ({ site }) => {
  const siteUrl =
    site?.href?.replace(/\/$/, '') ||
    process.env.SITE_URL ||
    'https://eliminados.online';

  // --- Static pages ---
  const staticPages = [
    { loc: '/', priority: '1.0', changefreq: 'hourly' },
    { loc: '/farandula/', priority: '0.8', changefreq: 'daily' },
    { loc: '/reality/', priority: '0.8', changefreq: 'daily' },
    { loc: '/musica/', priority: '0.8', changefreq: 'daily' },
    { loc: '/deportes/', priority: '0.8', changefreq: 'daily' },
    { loc: '/viral/', priority: '0.8', changefreq: 'daily' },
    { loc: '/tv/', priority: '0.8', changefreq: 'daily' },
    { loc: '/opinion/', priority: '0.7', changefreq: 'daily' },
  ];

  // --- Dynamic articles from DB ---
  // TODO: Replace with real Drizzle query when DB is connected:
  //   const publishedArticles = await db.select()
  //     .from(articles)
  //     .where(eq(articles.status, 'published'))
  //     .orderBy(desc(articles.publishedAt));
  let articleEntries: { loc: string; lastmod: string; priority: string }[] = [];

  try {
    // Attempt to load from DB (will fail gracefully if not connected)
    const { db } = await import('@/lib/db');
    const { articles } = await import('@/db/schema');
    const { eq, desc } = await import('drizzle-orm');

    const publishedArticles = await db
      .select({
        slug: articles.slug,
        updatedAt: articles.updatedAt,
        publishedAt: articles.publishedAt,
      })
      .from(articles)
      .where(eq(articles.status, 'published'))
      .orderBy(desc(articles.publishedAt));

    articleEntries = publishedArticles.map((a) => ({
      loc: `/${a.slug}`,
      lastmod: (a.updatedAt || a.publishedAt || new Date()).toISOString(),
      priority: '0.9',
    }));
  } catch {
    // DB not connected yet — sitemap will only have static pages
  }

  // --- Build XML ---
  const urls = [
    ...staticPages.map(
      (p) => `  <url>
    <loc>${siteUrl}${p.loc}</loc>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`
    ),
    ...articleEntries.map(
      (a) => `  <url>
    <loc>${siteUrl}${a.loc}</loc>
    <lastmod>${a.lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${a.priority}</priority>
  </url>`
    ),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
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
