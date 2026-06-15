import {
  pgTable,
  text,
  timestamp,
  integer,
  pgEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// --- Enums ---
export const articleStatusEnum = pgEnum('article_status', ['draft', 'published']);

// --- Authors ---
export const authors = pgTable('authors', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  bio: text('bio'),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// --- Categories ---
export const categories = pgTable('categories', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
});

// --- Tags ---
export const tags = pgTable('tags', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
});

// --- Articles ---
export const articles = pgTable(
  'articles',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull().unique(),
    title: text('title').notNull(),
    h1: text('h1').notNull(),
    metaDescription: text('meta_description').notNull(),
    ogImage: text('og_image'),
    bodyHtml: text('body_html').notNull(),
    bodyText: text('body_text').notNull(),
    wordCount: integer('word_count').notNull().default(0),
    lang: text('lang').notNull().default('es'),
    publishedAt: timestamp('published_at'),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    authorId: text('author_id').references(() => authors.id),
    categoryId: text('category_id').references(() => categories.id),
    status: articleStatusEnum('status').notNull().default('draft'),
    // Full-text search vector — populated via trigger/on-write
    searchVector: text('search_vector'),
  },
  (table) => [
    uniqueIndex('articles_slug_idx').on(table.slug),
    index('articles_status_published_idx').on(table.status, table.publishedAt),
    index('articles_category_idx').on(table.categoryId),
  ]
);

// --- Article ↔ Tag join ---
export const articleTags = pgTable(
  'article_tags',
  {
    articleId: text('article_id')
      .notNull()
      .references(() => articles.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (table) => [
    index('article_tags_article_idx').on(table.articleId),
    index('article_tags_tag_idx').on(table.tagId),
  ]
);

// --- Internal Links (materialized for audit) ---
export const internalLinks = pgTable(
  'internal_links',
  {
    id: text('id').primaryKey(),
    sourceArticleId: text('source_article_id')
      .notNull()
      .references(() => articles.id, { onDelete: 'cascade' }),
    targetArticleId: text('target_article_id')
      .notNull()
      .references(() => articles.id, { onDelete: 'cascade' }),
    anchorText: text('anchor_text').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('internal_links_source_idx').on(table.sourceArticleId),
    index('internal_links_target_idx').on(table.targetArticleId),
  ]
);

// --- Indexing Log ---
export const indexingLogs = pgTable('indexing_logs', {
  id: text('id').primaryKey(),
  articleId: text('article_id').references(() => articles.id),
  action: text('action').notNull(),
  details: text('details'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// --- Suggested Topics (seeded from competitor scrape) ---
export const suggestedTopics = pgTable('suggested_topics', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  slug: text('slug').notNull(),
  source: text('source'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// --- Relations ---
export const authorsRelations = relations(authors, ({ many }) => ({
  articles: many(articles),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  articles: many(articles),
}));

export const articlesRelations = relations(articles, ({ one, many }) => ({
  author: one(authors, {
    fields: [articles.authorId],
    references: [authors.id],
  }),
  category: one(categories, {
    fields: [articles.categoryId],
    references: [categories.id],
  }),
  articleTags: many(articleTags),
  outboundLinks: many(internalLinks, { relationName: 'sourceLinks' }),
  inboundLinks: many(internalLinks, { relationName: 'targetLinks' }),
}));

export const articleTagsRelations = relations(articleTags, ({ one }) => ({
  article: one(articles, {
    fields: [articleTags.articleId],
    references: [articles.id],
  }),
  tag: one(tags, {
    fields: [articleTags.tagId],
    references: [tags.id],
  }),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  articleTags: many(articleTags),
}));

export const internalLinksRelations = relations(internalLinks, ({ one }) => ({
  source: one(articles, {
    fields: [internalLinks.sourceArticleId],
    references: [articles.id],
    relationName: 'sourceLinks',
  }),
  target: one(articles, {
    fields: [internalLinks.targetArticleId],
    references: [articles.id],
    relationName: 'targetLinks',
  }),
}));
