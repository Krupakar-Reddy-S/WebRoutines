import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  react: {
    vite: {
      babel: {
        plugins: ['babel-plugin-react-compiler'],
      },
    },
  },
  manifest: {
    name: 'WebRoutines',
    description: 'Daily website routines from a persistent side panel.',
    permissions: ['storage', 'tabGroups', 'unlimitedStorage', 'favicon'],
    host_permissions: ['<all_urls>'],
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'; img-src 'self' data: https://www.google.com https://*.gstatic.com;",
    },
    options_ui: {
      page: 'options.html',
      open_in_tab: true,
    },
    action: {
      default_title: 'WebRoutines Controls',
    },
    commands: {
      'navigate-previous-step': {
        suggested_key: {
          default: 'Alt+Shift+Left',
        },
        description: 'Move to the previous step in the focused runner',
      },
      'navigate-next-step': {
        suggested_key: {
          default: 'Alt+Shift+Right',
        },
        description: 'Move to the next step in the focused runner',
      },
    },
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
