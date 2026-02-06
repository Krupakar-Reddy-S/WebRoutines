# Building a modern Chrome extension in 2025: the definitive guide

**Manifest V3 is now the only option on Chrome, and WXT with React (or Preact) is the dominant toolchain for building production extensions.** The ecosystem has matured significantly—the sidePanel API enables persistent sidebar UIs, IndexedDB provides robust local storage shared across all extension contexts, and a "smart sidebar, thin service worker" architecture pattern handles most use cases elegantly. This guide covers every layer of the stack, from manifest configuration to cross-browser data sync, with concrete code patterns for building a routine website navigator extension.

---

## MV3 is mandatory and the ecosystem has stabilized

Manifest V2 was fully disabled in **Chrome 138 (July 2025)** for all users, with no re-enable toggle. Chrome 139 removed even the enterprise policy exemption. As of February 2026, **every Chrome extension must use MV3**—no exceptions.

The three most impactful MV3 changes are architectural. First, **service workers replace persistent background pages**: they're event-driven, terminate after ~30 seconds of inactivity, and have no DOM access (`document`, `window`, `localStorage` are all unavailable). Second, **DeclarativeNetRequest replaces blocking webRequest** for consumer extensions—request interception now uses pre-defined declarative rules evaluated by Chrome's engine rather than extension JavaScript. Third, **all code must be bundled**—remote code execution is banned, inline scripts are prohibited, and CSP requirements are stricter.

The remaining pain points are well-documented but manageable. Service workers can fail to register silently (a long-standing Chromium bug), `setTimeout`/`setInterval` are unreliable (use `chrome.alarms` instead), and `chrome.runtime.connect()` ports disconnect when the service worker goes inactive, requiring reconnection logic. For DOM access needs outside the service worker, the **Offscreen Documents API** provides a controlled escape hatch.

Firefox continues to support both MV2 and MV3 indefinitely, retaining the full blocking webRequest API. Edge and Brave consume Chrome extensions natively with minimal differences.

---

## WXT is the build tool to use, and Preact deserves serious consideration

The Chrome extension build tool landscape has a clear winner. **WXT** (~9,100 GitHub stars, actively maintained with daily commits) is Vite-powered, framework-agnostic, and provides the best developer experience: file-based entrypoint discovery auto-generates your manifest, HMR works across all extension contexts including service workers, and cross-browser builds (Chrome, Firefox, Edge, Safari) come free. It supports React, Vue, Svelte, and Solid out of the box.

**Plasmo** (~12,300 stars) has more historical popularity but is effectively in maintenance mode—its primary author stepped away, and it uses an outdated Parcel bundler that causes compatibility issues with modern packages like Tailwind CSS v4. Developers migrating from Plasmo to WXT report **bundle size reductions of 40–90%**. CRXJS Vite Plugin (~3,500 stars) is a lighter Vite plugin without framework-level features, suitable for experienced developers who want minimal abstraction.

| Tool | Bundler | Framework support | Status | Recommendation |
|------|---------|-------------------|--------|----------------|
| **WXT** | Vite | Agnostic | Very active | **Top choice** |
| **Plasmo** | Parcel | React-first | Maintenance mode | Avoid for new projects |
| **CRXJS** | Vite | Agnostic | New maintainers | Niche use |

For the UI framework choice, **React** (40–45KB gzipped) provides the richest ecosystem but carries meaningful overhead for extensions where popups are created/destroyed on every interaction and content scripts are injected into every page. **Preact** at **~3KB gzipped** offers 99% React API compatibility via `preact/compat`, making it the sweet spot for extension development—the 13× size reduction matters more here than in typical web apps. Use vanilla TypeScript for service workers (no UI framework needed) and for simple content scripts where minimal footprint is critical.

---

## The sidePanel API enables persistent sidebar experiences

The `chrome.sidePanel` API (Chrome 114+, MV3 only) is the correct approach for building sidebar UIs. A global side panel—declared with `"side_panel": { "default_path": "sidepanel.html" }` in the manifest—**persists across tab navigation without reloading**. The same HTML/JS instance stays alive as the user switches tabs, making it ideal for a navigation controller.

The critical architectural insight is that **side panels are extension pages with full access to all Chrome APIs**. The sidebar can directly call `chrome.tabs.update()`, `chrome.tabs.create()`, `chrome.storage.*`, and even IndexedDB without routing through the service worker. This eliminates unnecessary messaging complexity.

```json
{
  "manifest_version": 3,
  "permissions": ["sidePanel", "storage", "tabGroups"],
  "side_panel": { "default_path": "sidepanel.html" },
  "action": { "default_title": "Open Routine Navigator" },
  "background": { "service_worker": "background.js", "type": "module" }
}
```

Opening the sidebar on toolbar icon click requires one line in the service worker:

```js
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
```

Key limitations to design around: `sidePanel.open()` **requires a user gesture** (cannot open programmatically without user interaction), there's **no API to control panel width**, and the `onOpened`/`onClosed` events only arrived in Chrome 141–142. For Firefox compatibility, note that Firefox uses the entirely incompatible `browser.sidebarAction` API—cross-browser sidebar support requires conditional code paths and separate manifest entries.

---

## Controlling tabs and tab groups from the sidebar

The sidebar can directly orchestrate tab navigation using Chrome's tabs APIs. For **same-tab sequential navigation**, `chrome.tabs.update()` changes the active tab's URL:

```typescript
async function navigateInSameTab(url: string) {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (activeTab?.id) {
    await chrome.tabs.update(activeTab.id, { url });
  }
}
```

For **multi-tab mode with tab groups**, create tabs and group them:

```typescript
async function openRoutineAsTabs(urls: string[], routineName: string) {
  const tabIds: number[] = [];
  for (const url of urls) {
    const tab = await chrome.tabs.create({ url, active: false });
    if (tab.id) tabIds.push(tab.id);
  }
  const groupId = await chrome.tabs.group({ tabIds });
  await chrome.tabGroups.update(groupId, {
    title: routineName,
    color: 'blue',
    collapsed: false
  });
  if (tabIds[0]) await chrome.tabs.update(tabIds[0], { active: true });
}
```

Browser history navigation uses `chrome.tabs.goBack(tabId)` and `chrome.tabs.goForward(tabId)`. To detect when a tab finishes loading, listen for `chrome.tabs.onUpdated` with `changeInfo.status === 'complete'`.

A crucial permissions detail: **most `chrome.tabs` methods work without the `tabs` permission**. You can call `create()`, `update()`, `group()`, and `query({ active: true })` freely. The `tabs` permission is only needed to read `url`, `title`, `pendingUrl`, and `favIconUrl` from Tab objects—and it triggers the alarming "Read your browsing history" warning. Use `optional_permissions` to request it at runtime only when needed.

---

## IndexedDB shares a single origin across all extension contexts

IndexedDB in Chrome extensions operates under the `chrome-extension://EXTENSION_ID` origin. This means the service worker, sidebar, popup, and options page all access the **exact same database**—there are no separate databases per context. Content scripts are the exception: they access IndexedDB under the host page's origin, not the extension's.

For the routine navigator, **Dexie.js** (~30KB) is the recommended IndexedDB wrapper, providing a fluent query API, schema migrations, and the `useLiveQuery` React hook for reactive database queries:

```typescript
// lib/db.ts
import Dexie, { type Table } from 'dexie';

export interface Routine {
  id?: number;
  name: string;
  urls: string[];
  createdAt: number;
  updatedAt: number;
}

class RoutineDB extends Dexie {
  routines!: Table<Routine>;
  constructor() {
    super('RoutineNavigator');
    this.version(1).stores({
      routines: '++id, name, createdAt'
    });
  }
}

export const db = new RoutineDB();
```

```typescript
// hooks/useRoutines.ts — reactive queries in React
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';

export function useRoutines() {
  const routines = useLiveQuery(() => db.routines.toArray());
  const addRoutine = (name: string, urls: string[]) =>
    db.routines.add({ name, urls, createdAt: Date.now(), updatedAt: Date.now() });
  return { routines: routines ?? [], addRoutine };
}
```

**Persistence has one gotcha**: IndexedDB can be evicted under extreme storage pressure, even in extensions. Mitigate this by requesting the `"unlimitedStorage"` permission and calling `navigator.storage.persist()`. Extension storage is not cleared when users clear browsing data—only on extension uninstall.

Use a layered storage strategy: **IndexedDB** for routines and large structured data, **`chrome.storage.session`** (10MB, in-memory, cleared on browser restart) for active navigation session state, and **`chrome.storage.sync`** (100KB total, 8KB per item) for user preferences that sync across devices.

---

## Cross-browser compatibility requires conditional code and a sync backend

Edge and Brave consume Chrome MV3 extensions natively—most extensions work without modification. Firefox is the outlier, requiring attention in three areas: the `browser.*` namespace (vs Chrome's `chrome.*`), the incompatible `sidebarAction` API for sidebars, and different manifest keys. The **webextension-polyfill** library normalizes the namespace difference, but sidebar APIs must be handled with feature detection:

```typescript
if (typeof chrome !== 'undefined' && chrome.sidePanel) {
  // Chrome/Edge/Brave: use sidePanel API
} else if (typeof browser !== 'undefined' && browser.sidebarAction) {
  // Firefox: use sidebarAction API
}
```

For **data sync across browsers and devices**, `chrome.storage.sync` only works within a single browser ecosystem (Chrome-to-Chrome via Google account, Firefox-to-Firefox via Mozilla account). Cross-browser sync requires a custom backend. The practical progression is:

- **V1**: Local-only IndexedDB storage + JSON export/import for manual backup
- **V2**: Serialize routines into `chrome.storage.sync` for same-browser device sync (if data fits within 100KB)
- **V3**: Backend sync via Supabase or Firebase, with `chrome.identity` for authentication and an offline-first architecture that syncs when connectivity is available

**Dexie Cloud** is a purpose-built sync solution for IndexedDB that handles conflict resolution and authentication, eliminating the need to build a custom backend for routine data sync.

---

## Recommended architecture for a routine navigator extension

The optimal architecture follows the **"smart sidebar, thin service worker"** pattern. The sidebar React app owns all user interaction and directly calls Chrome APIs. The service worker handles only background event listening and initial setup.

```
SIDEBAR (React App)                     SERVICE WORKER (Thin)
├── RoutineListPage                     ├── setPanelBehavior on install
├── RoutineRunnerPage                   ├── tabs.onUpdated listener
│   ├── useRoutineSession (storage)     │   (detect navigation away)
│   ├── useTabNavigation (chrome.tabs)  └── tabs.onRemoved listener
│   └── NavigationControls                  (clean up session)
├── RoutineEditorPage
└── useRoutines (Dexie/IndexedDB)
```

The recommended project structure using WXT:

```
src/
├── entrypoints/
│   ├── background.ts              # Thin service worker
│   ├── sidepanel/                 # Main UI
│   │   ├── index.html
│   │   ├── main.tsx
│   │   ├── App.tsx                # HashRouter + Routes
│   │   └── pages/
│   │       ├── RoutineListPage.tsx
│   │       ├── RoutineRunnerPage.tsx
│   │       └── RoutineEditorPage.tsx
│   └── options/                   # Settings page
├── hooks/
│   ├── useRoutines.ts             # Dexie CRUD
│   ├── useRoutineSession.ts       # chrome.storage.session state
│   └── useTabNavigation.ts        # chrome.tabs wrapper
├── components/                    # Shared UI components
└── lib/
    ├── db.ts                      # Dexie schema
    └── types.ts                   # Shared interfaces
```

The session state hook bridges the sidebar lifecycle—when the sidebar is closed and reopened, it rehydrates from `chrome.storage.session`. The service worker uses `chrome.storage.onChanged` as a communication bus rather than direct messaging, which is more reliable given the service worker's ephemeral lifecycle.

**Use `HashRouter`** (not `BrowserRouter`) for React routing inside the sidebar—extension pages are served as static files from `chrome-extension://` URLs, so path-based routing doesn't work.

The complete dependency stack: `wxt`, `react` (or `preact`), `react-router-dom`, `dexie`, `dexie-react-hooks`, `tailwindcss`, and `@vitejs/plugin-react`. This gives you auto-generated manifests, HMR across all contexts, reactive IndexedDB queries, and a production-ready build pipeline—with `wxt build` producing optimized bundles for Chrome and `wxt build --browser firefox` for Firefox.

## Conclusion

The Chrome extension ecosystem in 2025–2026 has converged on clear best practices. **MV3 is mandatory**, and its service worker model—while initially painful—is well-understood with established patterns for state persistence (`chrome.storage.session`), background tasks (`chrome.alarms`), and DOM access needs (`offscreen` documents). **WXT has decisively won the build tool competition**, offering Vite-powered development with framework flexibility and cross-browser support that Plasmo's declining maintenance can't match. The **sidePanel API** is the right UI surface for persistent sidebar experiences, and its ability to directly call Chrome APIs eliminates the service-worker-as-middleman antipattern. For storage, the combination of **Dexie.js for structured data** and **`chrome.storage.session` for ephemeral state** provides a robust foundation. The biggest remaining friction point is cross-browser sidebar compatibility—Chrome's `sidePanel` and Firefox's `sidebarAction` are fundamentally different APIs—and cross-browser data sync, which still requires either `chrome.storage.sync` (limited to same-browser ecosystems) or a custom backend.