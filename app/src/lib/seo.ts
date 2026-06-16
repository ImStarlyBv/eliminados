/**
 * SEO helper — generates all meta tags for a page.
 * Used by BaseLayout to inject structured data into <head>.
 */

export interface SeoData {
  title: string;
  description: string;
  canonicalUrl: string;
  ogImage?: string;
  type?: 'website' | 'article';
  publishedAt?: string;
  updatedAt?: string;
  authorName?: string;
  section?: string;
  tags?: string[];
  /** When true, emit <meta name="robots" content="noindex, follow"> */
  noindex?: boolean;
}

export function buildJsonLd(data: {
  type: 'NewsArticle' | 'WebSite';
  title: string;
  description: string;
  url: string;
  image?: string;
  publishedAt?: string;
  updatedAt?: string;
  authorName?: string;
  section?: string;
  siteName: string;
  siteUrl: string;
  breadcrumbs?: { name: string; url: string }[];
}) {
  const scripts: object[] = [];

  // Organization (site-wide)
  scripts.push({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: data.siteName,
    url: data.siteUrl,
    logo: `${data.siteUrl}/logo.png`,
  });

  // BreadcrumbList
  if (data.breadcrumbs && data.breadcrumbs.length > 0) {
    scripts.push({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: data.breadcrumbs.map((b, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: b.name,
        item: b.url,
      })),
    });
  }

  // NewsArticle
  if (data.type === 'NewsArticle') {
    scripts.push({
      '@context': 'https://schema.org',
      '@type': 'NewsArticle',
      headline: data.title,
      description: data.description,
      image: data.image || `${data.siteUrl}/og-default.jpg`,
      datePublished: data.publishedAt,
      dateModified: data.updatedAt || data.publishedAt,
      author: {
        '@type': 'Person',
        name: data.authorName || 'Redacción ELIMINADOS',
      },
      publisher: {
        '@type': 'Organization',
        name: data.siteName,
        logo: {
          '@type': 'ImageObject',
          url: `${data.siteUrl}/logo.png`,
        },
      },
      mainEntityOfPage: data.url,
      articleSection: data.section,
    });
  }

  return scripts;
}

/**
 * Slugify a string: lowercase, accent-stripped, hyphenated, capped at 60 chars.
 * Shared by both the article-slug builder and tag/category slugs.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
    .replace(/-$/, '');
}

/**
 * Human-readable article slug: `<category>/<title-slug>`.
 *
 * No date directory, no random hash, no `.html` extension \u2014 just the section
 * folder plus a keyword-rich slug (e.g. `reality/la-isla-de-alofoke-...`).
 * Uniqueness is NOT guaranteed here; the caller resolves collisions via
 * {@link resolveUniqueSlug} backed by the DB unique constraint on
 * `articles.slug`.
 */
export function generateArticleSlug(title: string, categorySlug: string): string {
  return `${categorySlug}/${slugify(title)}`;
}

/**
 * Resolve a unique slug. Returns `desired` if free; otherwise appends a short,
 * readable numeric suffix to the final path segment (`...-rd-2`, `...-rd-3`, \u2026)
 * \u2014 replacing the old random-hash de-duplicator with something shareable.
 *
 * `exists` is an async predicate (typically a DB lookup) returning whether a
 * slug is already taken.
 */
export async function resolveUniqueSlug(
  desired: string,
  exists: (slug: string) => Promise<boolean>
): Promise<string> {
  if (!(await exists(desired))) return desired;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${desired}-${n}`;
    if (!(await exists(candidate))) return candidate;
  }
  // Pathologically unlikely \u2014 fall back to a timestamp suffix.
  return `${desired}-${Date.now()}`;
}

/** Strip HTML tags to get plain text for word count / FTS */
export function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Count words in a text */
export function countWords(text: string): number {
  return text
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}

/** Validate article fields per SEO spec */
export function validateArticle(data: {
  title: string;
  metaDescription: string;
  bodyHtml: string;
}): string[] {
  const errors: string[] = [];

  if (data.title.length < 48 || data.title.length > 60) {
    errors.push(`Title must be 48–60 chars (got ${data.title.length})`);
  }
  if (data.metaDescription.length < 150 || data.metaDescription.length > 160) {
    errors.push(
      `Meta description must be 150–160 chars (got ${data.metaDescription.length})`
    );
  }
  if (!/<h1[\s>]/i.test(data.bodyHtml)) {
    errors.push('Body HTML must contain at least one <h1>');
  }
  if (/<script/i.test(data.bodyHtml)) {
    errors.push('Body HTML must not contain <script> tags');
  }

  return errors;
}
