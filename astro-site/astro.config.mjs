// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://krupakar-reddy-s.github.io',
  base: '/WebRoutines',

  vite: {
    plugins: [tailwindcss()],
  },

  build: {
    assets: 'assets',
  },
});
