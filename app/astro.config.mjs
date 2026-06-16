import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

export default defineConfig({
  output: 'server',
  adapter: node({
    mode: 'standalone',
  }),
  // Write endpoints (/api/media, /api/articles) are Bearer-token protected,
  // not cookie/session based. Astro's CSRF origin check only applies to form
  // POSTs and was blocking multipart uploads to /api/media with 403
  // "Cross-site POST form submissions are forbidden". Disable it for this
  // headless ingestion API.
  security: {
    checkOrigin: false,
  },
  server: {
    host: process.env.HOST || '0.0.0.0',
    port: parseInt(process.env.PORT || '4321'),
  },
  site: process.env.SITE_URL || 'https://eliminados.online',
  vite: {
    resolve: {
      alias: {
        '@': '/src',
      },
    },
  },
});
