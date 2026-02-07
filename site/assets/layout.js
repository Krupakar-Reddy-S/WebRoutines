const FALLBACK_HEADER = `
<header class="sticky top-0 z-20 border-b border-surface-border bg-base/80 backdrop-blur-sm">
  <div class="mx-auto flex w-full max-w-[1400px] items-center justify-between px-6 py-4">
    <a href="__BASE__/index.html" class="flex items-center gap-2.5 font-display text-base font-semibold tracking-tight text-fg">
      <img src="__BASE__/assets/icon-placeholder-128.svg" alt="" class="h-7 w-7" />
      WebRoutines
    </a>
    <nav class="flex items-center gap-1 text-sm">
      <a data-nav-item="home" href="__BASE__/index.html" class="rounded-md px-3 py-1.5 text-fg-muted transition-colors hover:bg-surface hover:text-fg">Home</a>
      <a data-nav-item="docs" href="__BASE__/docs/index.html" class="rounded-md px-3 py-1.5 text-fg-muted transition-colors hover:bg-surface hover:text-fg">Docs</a>
      <a data-nav-item="privacy" href="__BASE__/privacy.html" class="rounded-md px-3 py-1.5 text-fg-muted transition-colors hover:bg-surface hover:text-fg">Privacy</a>
      <a data-nav-item="github" href="https://github.com" class="rounded-md px-3 py-1.5 text-fg-muted transition-colors hover:bg-surface hover:text-fg">GitHub</a>
    </nav>
  </div>
</header>
`;

const FALLBACK_FOOTER = `
<footer class="sticky bottom-0 z-10 border-t border-surface-border bg-base/90 backdrop-blur-sm">
  <div class="mx-auto flex w-full max-w-[1400px] items-center justify-between px-6 py-3 text-xs text-fg-faint">
    <span>&copy; 2026 WebRoutines</span>
    <div class="flex items-center gap-2">
      <span class="h-1 w-1 rounded-full bg-accent/50"></span>
      <span>All data stays in your browser</span>
    </div>
  </div>
</footer>
`;

function applyTemplate(target, template, basePath) {
  target.innerHTML = template.split('__BASE__').join(basePath);
}

async function loadPartial(targetId, partialPath, basePath, fallbackTemplate) {
  const target = document.getElementById(targetId);
  if (!target) return;

  try {
    // Local file mode can block fetch for file:// URLs; use fallback templates.
    if (window.location.protocol === 'file:') {
      applyTemplate(target, fallbackTemplate, basePath);
      return;
    }

    const response = await fetch(partialPath);
    if (!response.ok) {
      applyTemplate(target, fallbackTemplate, basePath);
      return;
    }

    const raw = await response.text();
    applyTemplate(target, raw, basePath);
  } catch {
    // Keep pages usable if partial fetch fails for any reason.
    applyTemplate(target, fallbackTemplate, basePath);
  }
}

function setActiveNav(page) {
  const items = document.querySelectorAll('[data-nav-item]');
  items.forEach((item) => {
    const isActive = item.getAttribute('data-nav-item') === page;
    if (isActive) {
      item.classList.add('bg-surface', 'text-fg');
      item.classList.remove('text-fg-muted');
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const base = document.body.dataset.base || '.';
  const page = document.body.dataset.page || '';

  await Promise.all([
    loadPartial('site-header', `${base}/partials/header.html`, base, FALLBACK_HEADER),
    loadPartial('site-footer', `${base}/partials/footer.html`, base, FALLBACK_FOOTER),
  ]);

  setActiveNav(page);
});
