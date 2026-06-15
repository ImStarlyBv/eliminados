import type { APIRoute } from 'astro';

/**
 * Dynamic sitemap.xml — grows as articles are added.
 * Includes all published articles + the home and category pages.
 *
 * The home page and each category page carry a <lastmod> derived from the
 * most recent published article (globally / per category), so their lastmod
 * advances every time a new article is inserted.
 */
export const GET: APIRoute = async ({ site }) => {
  const siteUrl =
    site?.href?.replace(/\/$/, '') ||
    process.env.SITE_URL ||
    'https://eliminados.online';

  // --- Static pages (loc + the category slug they list, if any) ---
  const staticPages: {
    loc: string;
    priority: string;
    changefreq: string;
    cat?: string;
  }[] = [
    { loc: '/', priority: '1.0', changefreq: 'hourly' },
    { loc: '/farandula/', priority: '0.8', changefreq: 'daily', cat: 'farandula' },
    { loc: '/reality/', priority: '0.8', changefreq: 'daily', cat: 'reality' },
    { loc: '/musica/', priority: '0.8', changefreq: 'daily', cat: 'musica' },
    { loc: '/deportes/', priority: '0.8', changefreq: 'daily', cat: 'deportes' },
    { loc: '/viral/', priority: '0.8', changefreq: 'daily', cat: 'viral' },
    { loc: '/tv/', priority: '0.8', changefreq: 'daily', cat: 'tv' },
    { loc: '/opinion/', priority: '0.7', changefreq: 'daily', cat: 'opinion' },
  ];

  // --- Dynamic articles from DB ---
  let articleEntries: { loc: string; lastmod: string; priority: string }[] = [];
  let tagEntries: { loc: string; lastmod: string; priority: string }[] = [];
  let globalLastmod: Date | null = null;
  const categoryLastmod: Record<string, Date> = {};

  try {
    const { db } = await import('@/lib/db');
    const { articles, categories, tags, articleTags } = await import(
      '@/db/schema'
    );
    const { eq, desc } = await import('drizzle-orm');

    const publishedArticles = await db
      .select({
        slug: articles.slug,
        updatedAt: articles.updatedAt,
        publishedAt: articles.publishedAt,
        categorySlug: categories.slug,
      })
      .from(articles)
      .leftJoin(categories, eq(articles.categoryId, categories.id))
      .where(eq(articles.status, 'published'))
      .orderBy(desc(articles.publishedAt));

    for (const a of publishedArticles) {
      const lm = a.updatedAt || a.publishedAt || new Date();
      if (!globalLastmod || lm > globalLastmod) globalLastmod = lm;
      if (a.categorySlug) {
        const cur = categoryLastmod[a.categorySlug];
        if (!cur || lm > cur) categoryLastmod[a.categorySlug] = lm;
      }
    }

    articleEntries = publishedArticles.map((a) => ({
      loc: `/${a.slug}`,
      lastmod: (a.updatedAt || a.publishedAt || new Date()).toISOString(),
      priority: '0.9',
    }));

    // Tag (section) pages that have at least one published article.
    // Trailing slash matches the tag page canonical to avoid duplicates.
    const taggedRows = await db
      .select({
        tagSlug: tags.slug,
        updatedAt: articles.updatedAt,
        publishedAt: articles.publishedAt,
      })
      .from(tags)
      .innerJoin(articleTags, eq(articleTags.tagId, tags.id))
      .innerJoin(articles, eq(articleTags.articleId, articles.id))
      .where(eq(articles.status, 'published'));

    const tagLastmod: Record<string, Date> = {};
    for (const t of taggedRows) {
      const lm = t.updatedAt || t.publishedAt || new Date();
      const cur = tagLastmod[t.tagSlug];
      if (!cur || lm > cur) tagLastmod[t.tagSlug] = lm;
    }

    tagEntries = Object.entries(tagLastmod).map(([slug, lm]) => ({
      loc: `/tag/${slug}/`,
      lastmod: lm.toISOString(),
      priority: '0.7',
    }));
  } catch {
    // DB not connected yet — sitemap will only have static pages
  }

  // --- Build XML ---
  const urls = [
    ...staticPages.map((p) => {
      // Home uses the global lastmod; category pages use their own.
      const lm =
        p.loc === '/'
          ? globalLastmod
          : p.cat
          ? categoryLastmod[p.cat]
          : null;
      const lastmodTag = lm ? `\n    <lastmod>${lm.toISOString()}</lastmod>` : '';
      return `  <url>
    <loc>${siteUrl}${p.loc}</loc>${lastmodTag}
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`;
    }),
    ...tagEntries.map(
      (t) => `  <url>
    <loc>${siteUrl}${t.loc}</loc>
    <lastmod>${t.lastmod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>${t.priority}</priority>
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
