import type { APIRoute } from 'astro';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * POST /api/media — Upload media files
 * Protected by API_TOKEN header.
 */
export const POST: APIRoute = async ({ request }) => {
  const apiToken = import.meta.env.API_TOKEN || process.env.API_TOKEN;

  // Auth check
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || authHeader !== `Bearer ${apiToken}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided in form data' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { createId } = await import('@paralleldrive/cuid2');
    
    // Read the file data
    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = path.extname(file.name) || '.jpg';
    
    // Date-based directory (e.g. /media/2026/04/)
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    
    // We assume the volume is mounted at ./media locally and /app/public/media in Docker
    // (As defined in docker-compose.yml)
    const mediaDirRoot = 'public/media';
    const relativeTargetDir = `${year}/${month}`;
    const targetDir = path.join(process.cwd(), mediaDirRoot, relativeTargetDir);
    
    // Ensure directory exists
    await fs.mkdir(targetDir, { recursive: true });
    
    // Generate filename and save
    const filename = `${createId()}${ext}`;
    const targetPath = path.join(targetDir, filename);
    await fs.writeFile(targetPath, buffer);
    
    // The public URL to the file. Prefer SITE_URL env (set in docker-compose)
    // and normalize to avoid a malformed base like "https:/host".
    const rawSite =
      process.env.SITE_URL || import.meta.env.SITE || 'https://eliminados.online';
    const siteUrl = rawSite.replace(/\/+$/, '').replace(/^(https?:)\/?\/?/, '$1//');
    const publicUrl = `${siteUrl}/media/${relativeTargetDir}/${filename}`;

    return new Response(
      JSON.stringify({
        success: true,
        url: publicUrl,
        filename,
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Upload failed', details: errorMsg }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
