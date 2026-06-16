/**
 * Re-slug legacy articles to human-readable URLs.
 *
 *   OLD: /20260616/la-isla-...-de-rd_s8csh0sy5h3str9f88p3hmqo.html
 *   NEW: /reality/la-isla-...-de-rd
 *
 * A legacy slug ends in `.html` or starts with an 8-digit date dir
 * (`yyyymmdd/`). Each becomes `<category-slug>/<title-slug>`; collisions get a
 * readable `-2`/`-3` suffix. `updated_at` is bumped so the sitemap lastmod
 * advances and Google re-crawls. NO 301s are written — per the rollout
 * decision, old URLs simply 404 and the clean URLs are (re)submitted to GSC.
 *
 * Runs two ways:
 *  - Automatically on every container boot via start.mjs (apply mode).
 *    Idempotent: once all slugs are clean it's a no-op (a single SELECT).
 *  - Manually as a CLI (handy for a dry-run preview):
 *      node scripts/reslug-articles.mjs            # dry-run, prints the plan
 *      node scripts/reslug-articles.mjs --apply    # writes the changes
 */
import postgres from 'postgres';
import { pathToFileURL } from 'node:url';

/** Same logic as slugify() in src/lib/seo.ts — keep in sync. */
function slugify(input) {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
    .replace(/-$/, '');
}

const isLegacy = (slug) => slug.endsWith('.html') || /^\d{8}\//.test(slug);

/**
 * Compute (and optionally apply) the re-slug plan against an existing postgres
 * connection. Idempotent — only legacy slugs are touched.
 * @param {import('postgres').Sql} sql
 * @param {{ apply?: boolean }} [opts]
 * @returns {Promise<Array<{id: string, oldSlug: string, newSlug: string}>>}
 */
export async function reslugLegacyArticles(sql, { apply = false } = {}) {
  const rows = await sql`
    SELECT a.id, a.slug, a.title, c.slug AS category_slug
    FROM articles a
    LEFT JOIN categories c ON a.category_id = c.id
    ORDER BY a.published_at ASC NULLS LAST
  `;

  // Slugs that already look clean are reserved up front so we never collide.
  const taken = new Set(rows.filter((r) => !isLegacy(r.slug)).map((r) => r.slug));

  const plan = [];
  for (const r of rows) {
    if (!isLegacy(r.slug)) continue;

    const category = r.category_slug || 'noticias';
    if (!r.category_slug) {
      console.warn(`[reslug] ${r.id} has no category — falling back to "noticias/"`);
    }

    const base = `${category}/${slugify(r.title)}`;
    let candidate = base;
    for (let n = 2; taken.has(candidate); n++) candidate = `${base}-${n}`;
    taken.add(candidate);

    plan.push({ id: r.id, oldSlug: r.slug, newSlug: candidate });
  }

  if (apply) {
    for (const p of plan) {
      await sql`UPDATE articles SET slug = ${p.newSlug}, updated_at = now() WHERE id = ${p.id}`;
    }
  }

  return plan;
}

// --- CLI entry point (only when run directly, not when imported) ---
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const APPLY = process.argv.includes('--apply');
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is required (export it before running).');
    process.exit(1);
  }

  const sql = postgres(connectionString, { max: 1 });
  try {
    const plan = await reslugLegacyArticles(sql, { apply: APPLY });
    if (plan.length === 0) {
      console.log('No legacy slugs found — nothing to migrate.');
    } else {
      console.log(`${plan.length} article(s) to re-slug:\n`);
      for (const p of plan) console.log(`  ${p.oldSlug}\n  -> ${p.newSlug}\n`);
      console.log(
        APPLY
          ? `Applied ${plan.length} update(s).`
          : 'Dry-run only. Re-run with --apply to write these changes.'
      );
    }
  } finally {
    await sql.end();
  }
}
