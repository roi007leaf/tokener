export function localize(key, fallback = '') {
  const fullKey = key.startsWith('PF2ETokener.') ? key : `PF2ETokener.${key}`;
  const value = globalThis.game?.i18n?.localize?.(fullKey);
  return value && value !== fullKey ? value : fallback;
}

export function setTextTooltip(element, text) {
  if (!element || !text) return;
  element.removeAttribute?.('title');
  element.dataset.tooltip = text;
  element.dataset.tooltipDirection = 'UP';
  element.setAttribute?.('aria-label', text);
}

export function getCanvasZoom(canvasLike = globalThis.canvas) {
  const zoom = Number(
    canvasLike?.stage?.scale?.x ??
      canvasLike?.app?.stage?.scale?.x ??
      canvasLike?.tokens?.stage?.scale?.x ??
      1,
  );
  return Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
}

export function getPanelZoomData(canvasLike = globalThis.canvas) {
  const zoom = getCanvasZoom(canvasLike);
  return {
    zoom,
    inverse: clamp(1 / zoom, 0.5, 2),
  };
}

export function normalizeHudElement(html) {
  if (!html) return null;
  if (html.nodeType === 1) return html;
  if (typeof html.get === 'function') return html.get(0) ?? null;
  if (Array.isArray(html)) return html[0] ?? null;
  if (typeof html.length === 'number' && html[0]) return html[0];
  return null;
}

export function labelFromPath(path) {
  const file = normalizePath(path).split('/').pop() || '';
  const withoutExt = file.replace(/\.[^.]+$/, '');
  return normalizeLabel(withoutExt.replace(/[-_]+/g, ' '));
}

export function normalizeLabel(value) {
  const text = String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return '';
  return text.replace(/\w\S*/g, (word) => word[0].toUpperCase() + word.slice(1));
}

export function splitTerms(query) {
  return normalizeSearchText(query).split(' ').filter(Boolean);
}

export function normalizeSearchText(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/['â€™]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizePath(path) {
  return String(path ?? '').replace(/\\/g, '/');
}

export function numberOr(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function compareStrings(a = '', b = '') {
  return String(a).localeCompare(String(b));
}

export function getDocumentActor(tokenDocument) {
  return tokenDocument?.baseActor ?? tokenDocument?.actor ?? null;
}
