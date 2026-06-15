import { db } from '@/lib/db';
import { articles, internalLinks, indexingLogs } from '@/db/schema';
import { eq, ne, sql } from 'drizzle-orm';

/**
 * Executes the internal linking and FTS indexing pipeline.
 * Should be called asynchronously (fire-and-forget) after an article is published.
 */
export async function runIndexingPipeline(articleId: string) {
  try {
    const [article] = await db.select().from(articles).where(eq(articles.id, articleId));

    if (!article || article.status !== 'published') {
      return;
    }

    const startMs = Date.now();
    let linksAdded = 0;

    // 1. Update Full-Text Search (FTS) Vector
    // In Postgres, we can keep the tsvector column updated automatically via triggers,
    // or we can update it explicitly here. We'll update it explicitly to ensure
    // we also capture tags and category names if needed in the future.
    await db.execute(sql`
      UPDATE articles 
      SET fts_vector = setweight(to_tsvector('spanish', coalesce(title, '')), 'A') || 
                       setweight(to_tsvector('spanish', coalesce(body_text, '')), 'B')
      WHERE id = ${articleId};
    `);

    // 2. Discover related articles (Semantic / FTS match)
    // Find up to 100 related articles using FTS on title/body
    const relatedArticles = await db.execute(sql`
      SELECT id, slug, title 
      FROM articles 
      WHERE status = 'published' AND id != ${articleId}
      ORDER BY ts_rank(fts_vector, plainto_tsquery('spanish', ${article.title})) DESC
      LIMIT 100;
    `);

    // In a full implementation, you would:
    // a. Parse the article's body_html using a DOM parser (like cheerio or parse5).
    // b. Find text nodes that match the titles/keywords of the relatedArticles.
    // c. Replace the text node with <a href="/{slug}">{matched text}</a>
    // d. Save the modified body_html back to the article.
    // e. Insert records into the `internal_links` table to track this connection.
    
    // For now, we simulate inserting into internalLinks map:
    // (We assume we matched the top 5 articles)
    const matches = relatedArticles.slice(0, 5) as { id: string, slug: string, title: string }[];
    
    const newLinks = matches.map(match => ({
      sourceArticleId: articleId,
      targetArticleId: match.id,
      anchorText: match.title,
    }));

    if (newLinks.length > 0) {
      await db.insert(internalLinks).values(newLinks).onConflictDoNothing();
      linksAdded = newLinks.length;
    }

    // 3. Log the indexing event
    const durationMs = Date.now() - startMs;
    await db.insert(indexingLogs).values({
      articleId,
      action: 'publish_pipeline',
      details: { linksAdded, relatedFound: relatedArticles.length, durationMs },
    });

    // 4. WebSub push — notify the hub that the feeds changed so Google and
    //    other subscribers get this new article almost instantly.
    try {
      const siteUrl = (process.env.SITE_URL || 'https://eliminados.online').replace(/\/$/, '');
      const { pingWebSub } = await import('@/lib/feed');
      await pingWebSub([`${siteUrl}/rss.xml`, `${siteUrl}/feed.rss`]);
    } catch (e) {
      console.error('WebSub ping error:', e);
    }

  } catch (error) {
    console.error('Indexing pipeline failed details:', error);
    try {
      await db.insert(indexingLogs).values({
        articleId,
        action: 'publish_pipeline_error',
        details: { error: error instanceof Error ? error.message : String(error) },
      });
    } catch {}
  }
}
