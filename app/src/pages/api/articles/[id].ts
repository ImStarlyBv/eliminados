import type { APIRoute } from 'astro';

/**
 * PATCH /api/articles/:id — Update an article
 * Protected by API_TOKEN header.
 */
export const PATCH: APIRoute = async ({ request, params }) => {
  const apiToken = import.meta.env.API_TOKEN || process.env.API_TOKEN;

  // Auth check
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || authHeader !== `Bearer ${apiToken}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { id } = params;
  
  if (!id) {
     return new Response(JSON.stringify({ error: 'Missing article ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();

    // Validate SEO constraints if fields are updated
    const errors: string[] = [];
    if (body.title && (body.title.length < 48 || body.title.length > 60)) {
      errors.push(`Title must be 48–60 chars (got ${body.title.length})`);
    }
    if (body.meta_description && (body.meta_description.length < 150 || body.meta_description.length > 160)) {
      errors.push(
        `Meta description must be 150–160 chars (got ${body.meta_description.length})`
      );
    }
    if (body.body_html) {
      if (!/<h1[\s>]/i.test(body.body_html)) {
        errors.push('Body HTML must contain at least one <h1>');
      }
      if (/<script/i.test(body.body_html)) {
        errors.push('Body HTML must not contain <script> tags');
      }
    }

    if (errors.length > 0) {
      return new Response(
        JSON.stringify({ error: 'Validation failed', details: errors }),
        { status: 422, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // TODO: DB update via Drizzle

    return new Response(
      JSON.stringify({
        id,
        message: 'Article updated successfully (placeholder)',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

/**
 * DELETE /api/articles/:id — Delete an article
 * Protected by API_TOKEN header.
 */
export const DELETE: APIRoute = async ({ request, params }) => {
  const apiToken = import.meta.env.API_TOKEN || process.env.API_TOKEN;

  // Auth check
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || authHeader !== `Bearer ${apiToken}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { id } = params;

  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing article ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // TODO: DB delete via Drizzle

  return new Response(
    JSON.stringify({
      id,
      message: 'Article deleted successfully (placeholder)',
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};
