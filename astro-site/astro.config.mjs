// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // GitHub Pages will serve at /<repo>/ automatically.
  // For custom domain: set site: 'https://yourdomain.dev'
  site: 'https://OWNER.github.io',

  vite: {
    plugins: [tailwindcss()],
  },

  build: {
    assets: 'assets',
  },
});
