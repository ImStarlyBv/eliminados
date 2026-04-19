# Placeholder Audit — eliminados/app/src/pages

Snapshot of where the frontend still serves static/hardcoded content instead of querying the DB.

## Status

All five pages identified in the original audit now read from the `articles` / `categories` / `tags` / `authors` tables. The "all links lead to the same article" symptom was resolved in Task 10, and the surrounding index / category / tag / autor views were wired up in Task 11.

## Schema refresher

Article lookup key is the stored `articles.slug` column, which already contains the full `YYYYMMDD/<base>_<cuid>.html` path (see `src/db/schema.ts:45` and `src/pages/api/articles.ts:99`). So `${date}/${slug}` from `Astro.params` matches `articles.slug` one-to-one.

DB client: `import { db } from '@/lib/db'` + `import * as schema from '@/db/schema'`. Pattern used in `src/pages/api/articles.ts:107` and now across all frontend routes.

## Page state

| Path | Before | After |
|---|---|---|
| `src/pages/[date]/[slug].astro` | **BLOCKING** — hardcoded article | Queries `articles` by `slug = ${date}/${slug}` joined against `authors`, `categories`, `article_tags`. 404 when missing or not published. *(Task 10)* |
| `src/pages/index.astro` | Hardcoded `heroArticle`, `trendingItems`, `farandulaCards`, `realityCards` | Single `latest` query (20 most recent published, joined with category + author) drives hero + trending. Category queries `'farandula'` (3) and `'reality'` (4) feed those sections. Hero is conditionally rendered when no articles exist. `trendingTags` remains static (out of scope). *(Task 11)* |
| `src/pages/[category].astro` | Hardcoded `categoryMap` + `placeholderCards` | Resolves category via `categories.slug`, redirects to `/` when unknown, queries `articles` by `categoryId`. Empty-state block renders when category has zero published articles. *(Task 11)* |
| `src/pages/tag/[slug].astro` | Empty state only, no query | Resolves tag via `tags.slug`, joins `article_tags` → `articles`. Empty state preserved for unknown tag or zero matches. *(Task 11)* |
| `src/pages/autor/[slug].astro` | Empty state only, no query | Resolves author via `authors.slug`, 404 when unknown, queries `articles` by `authorId`. Bio + avatar render from the `authors` row when present. *(Task 11)* |

## Notes / follow-ups

- ~~**Trending tags (`index.astro`)**: still a static array of 7 hashtag strings.~~ **Done.** Replaced with a `tags` query joined via `article_tags` → `articles` (status = 'published'), grouped by tag, ordered by `count(articles.id)` desc, limit 7. Emits `{ label, href }` pairs so the chip URL uses the stored `tags.slug` directly instead of a lossy `toLowerCase` transform. Section is conditionally rendered when there are no tags, so the heading no longer shows alone on a fresh DB.
- **Hero styling**: the former "Planeta Alofoke 2" coloured-span highlight was dropped — the hero title now renders verbatim. Reintroduce via a per-article "highlight phrase" field if we need that accent back. *(Still pending — requires a new `articles` column; out of scope for this pass.)*
- **Time/word formatting (`index.astro`)**: `timeAgoEs` and `readTimeEs` live inline in the page. Move to `src/lib/` if another page starts needing them. *(Still inline — only `index.astro` uses them. Deferred per the conditional.)*
- ~~**Default assets**: fallback image/avatar URLs are hardcoded Unsplash links at the top of `index.astro`, `[category].astro`, `tag/[slug].astro`, `autor/[slug].astro`.~~ **Done.** Centralised in `src/lib/defaults.ts` (`DEFAULT_IMAGE`, `DEFAULT_AVATAR`). All four pages now import from there.
- ~~**Category pages hitting 404**: `[category].astro` currently `Astro.redirect('/')` when the slug is unknown.~~ **Done.** Swapped for `return new Response('Not Found', { status: 404 })` — matches the behaviour already in `autor/[slug].astro` and gives proper SEO signal for unknown category slugs.

## References

- `src/pages/api/articles.ts:92–143` — POST insert pattern and slug shape (`${dateStr}/${baseSlug}_${articleId}.html`).
- `src/lib/db.ts:32` — exported `db` instance.
- `src/db/schema.ts:41–68` — `articles` table columns consumed by the queries above: `slug`, `title`, `h1`, `metaDescription`, `ogImage`, `bodyHtml`, `publishedAt`, `updatedAt`, `authorId`, `categoryId`, `status`, `wordCount`.
