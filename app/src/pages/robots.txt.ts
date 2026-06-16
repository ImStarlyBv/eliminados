import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  const siteUrl = site?.href?.replace(/\/$/, '') || process.env.SITE_URL || 'https://eliminados.online';

  const body = `User-agent: *
Allow: /

Sitemap: ${siteUrl}/sitemap.xml
Sitemap: ${siteUrl}/news-sitemap.xml
Sitemap: ${siteUrl}/rss.xml
Sitemap: ${siteUrl}/feed.rss
`;

  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
