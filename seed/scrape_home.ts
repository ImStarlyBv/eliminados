import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { categories, tags, authors, suggestedTopics } from '../app/src/db/schema';

// This script simulates pulling data from the ninja-seo MCP or the deultimominuto.net payload.
// Ideally, you'd integrate the MCP client here, fetch the `ninja_analyze` result, and parse
// out the topic map.

async function runSeed() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set in .env');
    process.exit(1);
  }

  console.log('Connecting to database...');
  const pool = postgres(connectionString, { max: 1 });
  const db = drizzle(pool);

  try {
    console.log('Seeding categories...');
    await db.insert(categories).values([
      { slug: 'farandula', name: 'Farándula', description: 'Chismes y noticias de la farándula.' },
      { slug: 'reality', name: 'Reality', description: 'Cobertura de realities como Planeta Alofoke.' },
      { slug: 'musica', name: 'Música', description: 'Noticias de música urbana.' },
      { slug: 'deportes', name: 'Deportes', description: 'Noticias del deporte.' },
      { slug: 'viral', name: 'Viral', description: 'Lo más viral del internet.' }
    ]).onConflictDoNothing();

    console.log('Seeding tags...');
    await db.insert(tags).values([
      { slug: 'planetaalofoke', name: 'PlanetaAlofoke' },
      { slug: 'alofoke', name: 'Alofoke' },
      { slug: 'elalfa', name: 'ElAlfa' },
      { slug: 'pamela-infante', name: 'Pamela Infante' },
      { slug: 'laura-sahar', name: 'Laura Sahar' }
    ]).onConflictDoNothing();

    console.log('Seeding authors...');
    await db.insert(authors).values([
      { 
        slug: 'redaccion-eliminados', 
        name: 'Redacción ELIMINADOS', 
        bio: 'Equipo editorial oficial de ELIMINADOS.',
        avatarUrl: 'https://images.unsplash.com/photo-1542204165-65bf26472b9b?w=200&h=200&fit=crop'
      }
    ]).onConflictDoNothing();

    console.log('Seeding suggested topics (Simulating output from ninja-seo)...');
    const scrapedTopics = [
      { keyword: 'Yailin La Mas Viral', volumeScore: 90, sourceUrl: 'https://deultimominuto.net' },
      { keyword: 'Premios Soberano 2024', volumeScore: 85, sourceUrl: 'https://deultimominuto.net' },
      { keyword: 'Alofoke Radio Show', volumeScore: 95, sourceUrl: 'https://deultimominuto.net' }
    ];

    await db.insert(suggestedTopics).values(scrapedTopics).onConflictDoNothing();

    console.log('Seed completed successfully!');
  } catch (err) {
    console.error('Failed to seed:', err);
  } finally {
    await pool.end();
  }
}

runSeed();
