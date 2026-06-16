import type { APIRoute } from 'astro';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Serves runtime-uploaded media from the mounted volume (public/media,
 * mapped to ./media in docker-compose). The Astro Node standalone server
 * only serves build-time static assets from dist/client, so files written
 * by POST /api/media at runtime are not otherwise web-accessible. This SSR
 * route streams them instead.
 */
const TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
};

export const GET: APIRoute = async ({ params }) => {
  const rel = params.path || '';
  if (rel.includes('..')) {
    return new Response('Not Found', { status: 404 });
  }

  const root = path.join(process.cwd(), 'public', 'media');
  const full = path.join(root, rel);
  if (!full.startsWith(root)) {
    return new Response('Not Found', { status: 404 });
  }

  try {
    const data = await fs.readFile(full);
    const ext = path.extname(full).toLowerCase();
    const type = TYPES[ext] || 'application/octet-stream';
    return new Response(new Uint8Array(data), {
      status: 200,
      headers: {
        'Content-Type': type,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new Response('Not Found', { status: 404 });
  }
};
