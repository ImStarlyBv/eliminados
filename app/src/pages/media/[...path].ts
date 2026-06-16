import type { APIRoute } from 'astro';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * Serves runtime-uploaded media from the mounted volume (public/media,
 * mapped to ./media in docker-compose). The Astro Node standalone server
 * only serves build-time static assets from dist/client, so files written
 * by POST /api/media at runtime are not otherwise web-accessible. This SSR
 * route streams them instead.
 *
 * On-the-fly optimization: when a `?w=` width is requested, the image is
 * resized and transcoded to AVIF/WebP (per the client's Accept header) using
 * sharp, then cached on disk under public/media/.cache so each variant is
 * only computed once. Originals can be 3 MB PNGs displayed at 665px; this is
 * the single biggest LCP win for the site.
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

// Formats we are willing to transcode (raster photos). SVG/GIF pass through.
const OPTIMIZABLE = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);

// Allowed output widths — clamp arbitrary `?w=` values to a fixed ladder so
// the on-disk cache can't be flooded with thousands of distinct sizes.
const WIDTH_LADDER = [320, 480, 640, 800, 1080, 1440, 1920];

function clampWidth(raw: string | null): number | null {
  if (!raw) return null;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return WIDTH_LADDER.find((w) => w >= n) ?? WIDTH_LADDER[WIDTH_LADDER.length - 1];
}

function pickFormat(accept: string): 'avif' | 'webp' | null {
  if (accept.includes('image/avif')) return 'avif';
  if (accept.includes('image/webp')) return 'webp';
  return null; // keep original raster format
}

export const GET: APIRoute = async ({ params, request }) => {
  const rel = params.path || '';
  if (rel.includes('..')) {
    return new Response('Not Found', { status: 404 });
  }

  const root = path.join(process.cwd(), 'public', 'media');
  const full = path.join(root, rel);
  if (!full.startsWith(root)) {
    return new Response('Not Found', { status: 404 });
  }

  const ext = path.extname(full).toLowerCase();

  try {
    const url = new URL(request.url);
    const width = clampWidth(url.searchParams.get('w'));
    const accept = request.headers.get('Accept') || '';
    const format = pickFormat(accept);

    // Fast path: no resize requested or not an optimizable raster → stream raw.
    if (!width || !OPTIMIZABLE.has(ext)) {
      const data = await fs.readFile(full);
      return new Response(new Uint8Array(data), {
        status: 200,
        headers: {
          'Content-Type': TYPES[ext] || 'application/octet-stream',
          'Cache-Control': 'public, max-age=31536000, immutable',
          Vary: 'Accept',
        },
      });
    }

    const outFmt = format ?? (ext === '.png' ? 'webp' : 'jpeg');
    const outExt = outFmt === 'jpeg' ? 'jpg' : outFmt;

    // Cache key derived from source path + width + format.
    const key = crypto
      .createHash('sha1')
      .update(`${rel}|${width}|${outFmt}`)
      .digest('hex');
    const cacheDir = path.join(root, '.cache');
    const cachePath = path.join(cacheDir, `${key}.${outExt}`);

    let out: Buffer;
    try {
      out = await fs.readFile(cachePath);
    } catch {
      const { default: sharp } = await import('sharp');
      const pipeline = sharp(full, { failOn: 'none' }).rotate().resize({
        width,
        withoutEnlargement: true,
      });
      if (outFmt === 'avif') pipeline.avif({ quality: 50 });
      else if (outFmt === 'webp') pipeline.webp({ quality: 72 });
      else pipeline.jpeg({ quality: 78, mozjpeg: true });
      out = await pipeline.toBuffer();
      await fs.mkdir(cacheDir, { recursive: true });
      await fs.writeFile(cachePath, out).catch(() => {});
    }

    return new Response(new Uint8Array(out), {
      status: 200,
      headers: {
        'Content-Type': TYPES[`.${outExt}`] || 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable',
        Vary: 'Accept',
      },
    });
  } catch {
    // On any optimization failure, fall back to the raw original if it exists.
    try {
      const data = await fs.readFile(full);
      return new Response(new Uint8Array(data), {
        status: 200,
        headers: {
          'Content-Type': TYPES[ext] || 'application/octet-stream',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    } catch {
      return new Response('Not Found', { status: 404 });
    }
  }
};
