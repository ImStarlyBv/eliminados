import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@/db/schema';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

// Connection pool for queries
const queryClient = postgres(connectionString, {
  max: 10,
  idle_timeout: 30,
});

// Setup LISTEN/NOTIFY for cache invalidation
export async function listenForCacheInvalidation(callback: (payload: string) => void) {
  // Use a dedicated connection for LISTEN
  const listenClient = postgres(connectionString, { max: 1 });
  try {
    await listenClient.listen('content_cache_invalidated', (payload) => {
      console.log('Received Postgres NOTIFY for cache invalidation:', payload);
      callback(payload);
    });
    console.log('Listening for content_cache_invalidated events...');
  } catch (error) {
    console.error('Failed to start LISTENER:', error);
  }
}

export const db = drizzle(queryClient, { schema });
export { schema };
