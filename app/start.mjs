import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { reslugLegacyArticles } from './scripts/reslug-articles.mjs';

const url = process.env.DATABASE_URL;

if (!url) {
  console.error('[start] DATABASE_URL not set — skipping migrations');
} else {
  const sql = postgres(url, { max: 1 });
  const db = drizzle(sql);
  try {
    console.log('[start] Running drizzle migrations...');
    await migrate(db, { migrationsFolder: './migrations' });
    console.log('[start] Migrations applied.');
  } catch (e) {
    console.error('[start] Migration error:', e);
    await sql.end({ timeout: 5 });
    process.exit(1);
  }

  // One-shot, idempotent: migrate any legacy (.html / dated) article URLs to
  // human-readable `category/slug`. No-op once everything is clean, so it's
  // safe on every boot. Never fatal — a re-slug failure must not block startup.
  try {
    const changed = await reslugLegacyArticles(sql, { apply: true });
    if (changed.length > 0) {
      console.log(`[start] Re-slug: migrated ${changed.length} legacy URL(s):`);
      for (const c of changed) console.log(`[start]   ${c.oldSlug} -> ${c.newSlug}`);
    } else {
      console.log('[start] Re-slug: no legacy URLs to migrate.');
    }
  } catch (e) {
    console.error('[start] Re-slug skipped (non-fatal):', e);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

await import('./dist/server/entry.mjs');
