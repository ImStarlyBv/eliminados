import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

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
    process.exit(1);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

await import('./dist/server/entry.mjs');
