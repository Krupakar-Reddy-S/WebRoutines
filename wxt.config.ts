import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'WebRoutines',
    description: 'Daily website routines from a persistent side panel.',
    permissions: ['storage', 'tabGroups', 'unlimitedStorage'],
    action: {
      default_title: 'WebRoutines Controls',
    },
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
