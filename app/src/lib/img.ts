/**
 * Helpers for the on-the-fly image optimizer served by /media/[...path].ts.
 *
 * Uploaded images live at https://<site>/media/... and are served raw unless a
 * `?w=` width is requested, in which case the route resizes + transcodes to
 * AVIF/WebP. These helpers build the `?w=` URLs and a responsive `srcset`.
 *
 * They only rewrite same-site /media URLs; external images (e.g. Unsplash
 * author avatars) are returned untouched.
 */

// Must stay within the WIDTH_LADDER in media/[...path].ts.
const DEFAULT_WIDTHS = [320, 480, 640, 800, 1080, 1440];

function isOptimizable(url: string | undefined | null): url is string {
  return !!url && url.includes('/media/') && !/\.(svg|gif)(\?|$)/i.test(url);
}

/** Append a width param to a /media URL (no-op for external/non-optimizable). */
export function img(url: string | undefined | null, width: number): string {
  if (!isOptimizable(url)) return url ?? '';
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}w=${width}`;
}

/** Build a responsive srcset string for a /media URL. */
export function srcset(
  url: string | undefined | null,
  widths: number[] = DEFAULT_WIDTHS
): string | undefined {
  if (!isOptimizable(url)) return undefined;
  return widths.map((w) => `${img(url, w)} ${w}w`).join(', ');
}
