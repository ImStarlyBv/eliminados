import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

export default defineConfig({
  output: 'server',
  adapter: node({
    mode: 'standalone',
  }),
  server: {
    host: process.env.HOST || '0.0.0.0',
    port: parseInt(process.env.PORT || '4321'),
  },
  site: process.env.SITE_URL || 'http://localhost:4321',
  vite: {
    resolve: {
      alias: {
        '@': '/src',
      },
    },
  },
});
