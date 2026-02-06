import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'WebRoutines',
    description: 'Daily website routines from a persistent side panel.',
    permissions: ['storage', 'tabGroups', 'unlimitedStorage'],
    host_permissions: ['<all_urls>'],
    options_ui: {
      page: 'options.html',
      open_in_tab: true,
    },
    action: {
      default_title: 'WebRoutines Controls',
    },
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
