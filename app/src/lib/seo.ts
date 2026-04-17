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

/** Generate a dated slug: /yyyymmdd/keyword-slug_shortid.html */
export function generateArticleSlug(
  title: string,
  date: Date,
  shortId: string
): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}${mm}${dd}`;

  const slug = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
    .replace(/-$/, '');

  return `${dateStr}/${slug}_${shortId}.html`;
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
