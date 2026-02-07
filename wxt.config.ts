import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

const E2E_MANIFEST_KEY = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAv5baQZcM+y8zQ71Mo2UmFRaO6byyXIe15Ym79UY+v7dFUL2AZDv6KvD2mNMUWheX3wUu5zqC4Iv5PJLTeuReCuoheiwphPKfZbF0Uwm9hs0gxscolBWLbn60yvGODNm1K4ceHS3eULZNr5+RAvCwU2zg3sEYOEGF8zcc1P8TyJVx8xwbSa3d5JzM6/Q/TdseFtxSUdjy6IR1rrqHM+TRSx3ucdVfLJcbv6ZoGL9Qxf02H0OaHj7u+HrP8pkbl+X6LupCBVbZBrKh4CTWuetVdnRAEwJNfE6s3V2SRWAdsoSskcrFGTzLxd8IGKEl9bCQz70TSeqSP+w1Xafc4fqWywIDAQAB';

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
    ...(process.env.WEBROUTINES_E2E === '1' ? { key: E2E_MANIFEST_KEY } : {}),
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
