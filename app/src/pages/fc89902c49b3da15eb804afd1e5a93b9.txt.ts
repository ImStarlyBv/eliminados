import type { APIRoute } from 'astro';
import { INDEXNOW_KEY } from '@/lib/indexnow';

/**
 * IndexNow ownership-verification key file, served at
 * /fc89902c49b3da15eb804afd1e5a93b9.txt — must contain exactly the key.
 */
export const GET: APIRoute = () =>
  new Response(INDEXNOW_KEY, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
