import type { APIRoute } from 'astro';

/**
 * POST /api/articles — Create a new article
 * Protected by API_TOKEN header.
 */
export const POST: APIRoute = async ({ request }) => {
  const apiToken = import.meta.env.API_TOKEN || process.env.API_TOKEN;

  // Auth check
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || authHeader !== `Bearer ${apiToken}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();

    // Validate required fields
    const required = ['title', 'meta_description', 'category_slug', 'body_html'];
    const missing = required.filter((f) => !body[f]);
    if (missing.length > 0) {
      return new Response(
        JSON.stringify({ error: `Missing fields: ${missing.join(', ')}` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate SEO constraints
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

    // TODO: In production, insert into DB via Drizzle
    // For now, return a mock successful response
    const mockId = Math.random().toString(36).substring(2, 10);
    const now = new Date();
    const siteUrl = import.meta.env.SITE || 'http://localhost:4321';

    // Generate slug
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}${mm}${dd}`;
    const slug = body.title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 60)
      .replace(/-$/, '');

    const articleSlug = `${dateStr}/${slug}_${mockId}.html`;

    return new Response(
      JSON.stringify({
        id: mockId,
        slug: articleSlug,
        url: `${siteUrl}/${articleSlug}`,
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

/**
 * GET /api/articles — List published articles (placeholder)
 */
export const GET: APIRoute = async () => {
  // TODO: Query DB for published articles
  return new Response(
    JSON.stringify({
      articles: [],
      message: 'Database not connected yet — this is a placeholder.',
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};
