# ELIMINADOS — News Site

SEO-first, Docker-native, server-rendered Spanish-language news site built with
Astro 5, Drizzle ORM, and Postgres 16.

## Quick Start

```bash
cd app
npm install
npm run dev
```

## Deploy with Coolify

1. Push this repo to GitHub
2. In Coolify → New Resource → Docker Compose → point at this repo
3. Set environment variables (copy from `.env.example`)
4. Set domain and enable "Force HTTPS"
5. Deploy — Coolify runs `docker compose up -d --build`
6. After first deploy, run: `npx drizzle-kit migrate`

## Architecture

```
eliminados/
├── docker-compose.yml       # Coolify-ready: app + postgres
├── .env.example             # All required env vars documented
├── app/                     # Astro 5 (output: 'server', node adapter)
│   ├── src/
│   │   ├── pages/           # / , /api/articles , robots.txt
│   │   ├── components/      # Header, Footer, ArticleCard, TrendingSidebar
│   │   ├── layouts/         # BaseLayout (SEO meta, JSON-LD, design system)
│   │   ├── lib/             # db.ts, seo.ts
│   │   └── db/              # schema.ts (Drizzle)
│   ├── astro.config.mjs
│   ├── drizzle.config.ts
│   ├── Dockerfile           # Multi-stage: deps → build → runtime
│   └── package.json
└── seed/                    # Competitor scrape scripts
```

## Stack

| Layer          | Technology          |
|----------------|---------------------|
| Framework      | Astro 5 (SSR)       |
| DB             | PostgreSQL 16       |
| ORM            | Drizzle             |
| Hosting        | Coolify (Traefik)   |
| Client JS      | Zero (by design)    |

## SEO Targets

- Title: 48–60 chars, exact-match keyword
- Single H1 per page
- NewsArticle + BreadcrumbList JSON-LD
- Dated URL slugs: `/{yyyymmdd}/{slug}_{id}.html`
- Full server-rendered HTML (no client hydration)
- Target: SEO score ≥ 97, Lighthouse SEO = 100
