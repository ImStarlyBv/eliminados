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

export const db = drizzle(queryClient, { schema });
export { schema };
