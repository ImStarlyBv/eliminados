import type { APIRoute } from 'astro';
import { getFeedItems, buildRssXml, rssResponse } from '@/lib/feed';

/**
 * /feed.rss — alias of /rss.xml (identical content).
 * Provided because many readers/aggregators look for a `feed.rss` path.
 */
export const GET: APIRoute = async ({ site }) => {
  const siteUrl =
    site?.href?.replace(/\/$/, '') ||
    process.env.SITE_URL ||
    'https://eliminados.online';

  const items = await getFeedItems(siteUrl);
  return rssResponse(buildRssXml(siteUrl, items, '/feed.rss'));
};
