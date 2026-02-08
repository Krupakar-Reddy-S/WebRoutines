export const FOCUS_CONTROLLER_STYLES = `
  :host { all: initial; }
  .webroutines-pill {
    --wr-accent: rgb(99, 102, 241);
    --wr-on-accent: rgb(255, 255, 255);
    --wr-surface: rgba(24, 24, 27, 0.92);
    --wr-text: rgb(250, 250, 250);
    --wr-muted: rgba(255, 255, 255, 0.8);
    --wr-border: rgba(255, 255, 255, 0.24);
    --wr-btn-bg: rgba(255, 255, 255, 0.08);
    --wr-btn-border: rgba(255, 255, 255, 0.24);
    --wr-btn-text: rgb(250, 250, 250);
    position: fixed;
    right: 16px;
    top: 120px;
    z-index: 2147483647;
    width: fit-content;
    max-width: min(252px, calc(100vw - 24px));
    border: 1px solid var(--wr-border);
    border-radius: 999px;
    padding: 8px;
    box-sizing: border-box;
    background: var(--wr-surface);
    color: var(--wr-text);
    backdrop-filter: blur(8px);
    font-family: Inter, ui-sans-serif, system-ui, sans-serif;
    font-size: 12px;
    box-shadow: 0 0 0 1px rgba(17, 24, 39, 0.25), 0 8px 30px rgba(17, 24, 39, 0.35);
  }
  .webroutines-row {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .webroutines-title {
    flex: 1 1 auto;
    min-width: 56px;
    max-width: 108px;
    cursor: ns-resize;
    user-select: none;
  }
  .webroutines-title strong {
    line-height: 1.15;
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .webroutines-title span {
    color: var(--wr-muted);
  }
  .webroutines-btn {
    border: 1px solid var(--wr-btn-border);
    background: var(--wr-btn-bg);
    color: var(--wr-btn-text);
    border-radius: 999px;
    height: 28px;
    min-width: 28px;
    padding: 0 8px;
    font-size: 12px;
    line-height: 1;
    cursor: pointer;
  }
  .webroutines-btn--return {
    min-width: 64px;
  }
  .webroutines-btn:disabled {
    opacity: 0.45;
    cursor: default;
  }
`;

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&#39;');
}
