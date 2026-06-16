import type { APIRoute } from 'astro';
import { createId } from '@paralleldrive/cuid2';
import { eq } from 'drizzle-orm';
import { resolveUniqueSlug } from '@/lib/seo';

const SITE_URL = process.env.SITE_URL || import.meta.env.SITE_URL || 'https://eliminados.online';

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
    .replace(/-$/, '');
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function wordCount(text: string): number {
  return text ? text.split(/\s+/).filter(Boolean).length : 0;
}

export const POST: APIRoute = async ({ request }) => {
  const apiToken = import.meta.env.API_TOKEN || process.env.API_TOKEN;

  const authHeader = request.headers.get('Authorization');
  if (!authHeader || authHeader !== `Bearer ${apiToken}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const required = ['title', 'meta_description', 'category_slug', 'body_html'];
  const missing = required.filter((f) => !body[f]);
  if (missing.length > 0) {
    return new Response(
      JSON.stringify({ error: `Missing fields: ${missing.join(', ')}` }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const errors: string[] = [];
  if (body.title.length < 48 || body.title.length > 60) {
    errors.push(`Title must be 48–60 chars (got ${body.title.length})`);
  }
  if (body.meta_description.length < 150 || body.meta_description.length > 160) {
    errors.push(
      `Meta description must be 150–160 chars (got ${body.meta_description.length})`
    );
  }
  if (!/<h1[\s>]/i.test(body.body_html)) {
    errors.push('Body HTML must contain at least one <h1>');
  }
  if (/<script/i.test(body.body_html)) {
    errors.push('Body HTML must not contain <script> tags');
  }

  if (errors.length > 0) {
    return new Response(
      JSON.stringify({ error: 'Validation failed', details: errors }),
      { status: 422, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const articleId = createId();
  const now = new Date();
  const baseSlug = slugify(body.title) || articleId.slice(0, 12);
  // Human-readable slug: `<category>/<title-slug>` — no date dir, no random
  // hash, no `.html`. Uniqueness is resolved against the DB below (collisions
  // get a readable `-2`/`-3` suffix instead of a hash).
  const desiredSlug = `${slugify(body.category_slug)}/${baseSlug}`;
  let articleSlug = desiredSlug;

  const bodyText = htmlToText(body.body_html);
  const wc = wordCount(bodyText);
  const status: 'draft' | 'published' =
    body.status === 'draft' ? 'draft' : 'published';

  try {
    const { db } = await import('@/lib/db');
    const { articles, categories, authors, tags, articleTags } = await import(
      '@/db/schema'
    );

    // Resolve slug uniqueness against existing rows (replaces the old hash).
    articleSlug = await resolveUniqueSlug(desiredSlug, async (candidate) => {
      const [hit] = await db
        .select({ id: articles.id })
        .from(articles)
        .where(eq(articles.slug, candidate))
        .limit(1);
      return !!hit;
    });

    let categoryId: string | null = null;
    const [cat] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, body.category_slug))
      .limit(1);
    if (cat) categoryId = cat.id;

    let authorId: string | null = null;
    if (body.author_slug) {
      const [au] = await db
        .select({ id: authors.id })
        .from(authors)
        .where(eq(authors.slug, body.author_slug))
        .limit(1);
      if (au) authorId = au.id;
    }

    await db.insert(articles).values({
      id: articleId,
      slug: articleSlug,
      title: body.title,
      h1: body.h1 || body.title,
      metaDescription: body.meta_description,
      ogImage: body.og_image ?? null,
      bodyHtml: body.body_html,
      bodyText,
      wordCount: wc,
      lang: body.lang || 'es',
      publishedAt: status === 'published' ? now : null,
      authorId,
      categoryId,
      status,
    });

    // --- Tags: upsert each tag, then link via article_tags ---
    if (Array.isArray(body.tags) && body.tags.length > 0) {
      const seen = new Set<string>();
      for (const raw of body.tags) {
        if (typeof raw !== 'string') continue;
        const name = raw.trim();
        if (!name) continue;
        const tagSlug = slugify(name);
        if (!tagSlug || seen.has(tagSlug)) continue;
        seen.add(tagSlug);

        let [tag] = await db
          .select({ id: tags.id })
          .from(tags)
          .where(eq(tags.slug, tagSlug))
          .limit(1);

        if (!tag) {
          const tagId = createId();
          await db
            .insert(tags)
            .values({ id: tagId, slug: tagSlug, name })
            .onConflictDoNothing({ target: tags.slug });
          [tag] = await db
            .select({ id: tags.id })
            .from(tags)
            .where(eq(tags.slug, tagSlug))
            .limit(1);
        }

        if (tag) {
          await db
            .insert(articleTags)
            .values({ articleId, tagId: tag.id })
            .onConflictDoNothing();
        }
      }
    }

    import('@/lib/indexing')
      .then(({ runIndexingPipeline }) => {
        runIndexingPipeline(articleId).catch((e) =>
          console.error('Indexing pipeline error:', e)
        );
      })
      .catch((e) => console.error('Indexing import error:', e));
  } catch (dbError) {
    console.error('DB insert failed:', dbError);
    return new Response(
      JSON.stringify({
        error: 'Database error',
        detail: dbError instanceof Error ? dbError.message : String(dbError),
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({
      id: articleId,
      slug: articleSlug,
      url: `${SITE_URL}/${articleSlug}`,
      status,
    }),
    { status: 201, headers: { 'Content-Type': 'application/json' } }
  );
};

export const GET: APIRoute = async () => {
  try {
    const { db } = await import('@/lib/db');
    const { articles } = await import('@/db/schema');
    const rows = await db
      .select({
        id: articles.id,
        slug: articles.slug,
        title: articles.title,
        publishedAt: articles.publishedAt,
        status: articles.status,
      })
      .from(articles)
      .limit(50);
    return new Response(JSON.stringify({ articles: rows }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({
        articles: [],
        error: e instanceof Error ? e.message : String(e),
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
