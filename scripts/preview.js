import { TAG_GROUP_ORDER } from './tags.js';
import { localize, normalizeLabel, normalizeSearchText } from './utils.js';

const PREVIEW_TAG_GROUP_ORDER = ['category', ...TAG_GROUP_ORDER.filter((group) => group !== 'category')];

export function getImagePreviewItems(candidate) {
  return [
    {
      kind: 'actor',
      label: localize('Preview.ActorImage', 'Actor image'),
      src: candidate?.portraitSrc || '',
      available: Boolean(candidate?.portraitSrc),
    },
    {
      kind: 'token',
      label: localize('Preview.TokenImage', 'Token image'),
      src: candidate?.tokenSrc || '',
      available: Boolean(candidate?.tokenSrc),
    },
  ].filter((item) => item.available);
}

export function getCandidatePreviewTagGroups(candidate) {
  const tags = candidate?.tags;
  if (!tags || typeof tags !== 'object') return [];

  return Object.entries(tags)
    .map(([group, values]) => {
      const normalizedGroup = normalizeSearchText(group);
      const normalizedValues = (Array.isArray(values) ? values : [values])
        .map((value) => normalizeSearchText(value))
        .filter(Boolean);
      return {
        group: normalizedGroup,
        label: normalizeLabel(normalizedGroup),
        values: [...new Set(normalizedValues)].map((value) => value.toUpperCase()),
      };
    })
    .filter((group) => group.group && group.values.length)
    .sort(
      (a, b) =>
        previewTagGroupRank(a.group) - previewTagGroupRank(b.group) ||
        a.label.localeCompare(b.label),
    )
    .map(({ label, values }) => ({ label, values }));
}

export function openImagePreview(candidate) {
  const doc = globalThis.document;
  if (!doc?.body) return;

  doc.querySelector('.pf2e-tokener-preview')?.remove();

  const overlay = doc.createElement('section');
  overlay.className = 'pf2e-tokener-preview';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', candidate.label);

  const dialog = doc.createElement('div');
  dialog.className = 'pf2e-tokener-preview-dialog';

  const header = doc.createElement('header');
  header.className = 'pf2e-tokener-preview-header';

  const title = doc.createElement('div');
  title.className = 'pf2e-tokener-preview-title';
  title.textContent = candidate.label;

  const source = doc.createElement('div');
  source.className = 'pf2e-tokener-preview-source';
  source.textContent = candidate.moduleTitle;

  const titleBlock = doc.createElement('div');
  titleBlock.append(title, source);

  const close = doc.createElement('button');
  close.type = 'button';
  close.className = 'pf2e-tokener-preview-close';
  close.dataset.tooltip = localize('Preview.Close', 'Close preview');
  close.setAttribute('aria-label', localize('Preview.Close', 'Close preview'));
  close.innerHTML = '&times;';

  const panes = doc.createElement('div');
  panes.className = 'pf2e-tokener-preview-panes';
  const items = getImagePreviewItems(candidate);
  for (const item of items) {
    panes.append(createPreviewPane(item));
  }
  const tags = createPreviewTags(candidate);

  const closePreview = () => {
    globalThis.window?.removeEventListener?.('keydown', onKeyDown);
    overlay.remove();
  };
  const onKeyDown = (event) => {
    if (event.key === 'Escape') closePreview();
  };

  close.addEventListener('click', closePreview);
  overlay.addEventListener('mousedown', (event) => {
    if (event.target === overlay) closePreview();
  });
  globalThis.window?.addEventListener?.('keydown', onKeyDown);

  header.append(titleBlock, close);
  dialog.append(header, panes);
  if (tags) dialog.append(tags);
  overlay.append(dialog);
  doc.body.append(overlay);
  close.focus?.();
}

function createPreviewTags(candidate) {
  const groups = getCandidatePreviewTagGroups(candidate);
  if (!groups.length) return null;

  const doc = globalThis.document;
  const container = doc.createElement('div');
  container.className = 'pf2e-tokener-preview-tags';

  for (const group of groups) {
    const row = doc.createElement('div');
    row.className = 'pf2e-tokener-preview-tag-row';

    const label = doc.createElement('div');
    label.className = 'pf2e-tokener-preview-tag-label';
    label.textContent = group.label;

    const values = doc.createElement('div');
    values.className = 'pf2e-tokener-preview-tag-values';
    for (const value of group.values) {
      const chip = doc.createElement('span');
      chip.className = 'pf2e-tokener-preview-tag-chip';
      chip.textContent = value;
      values.append(chip);
    }

    row.append(label, values);
    container.append(row);
  }

  return container;
}

function previewTagGroupRank(group) {
  const index = PREVIEW_TAG_GROUP_ORDER.indexOf(group);
  return index >= 0 ? index : PREVIEW_TAG_GROUP_ORDER.length;
}

function createPreviewPane(item) {
  const doc = globalThis.document;
  const pane = doc.createElement('article');
  pane.className = `pf2e-tokener-preview-pane pf2e-tokener-preview-pane-${item.kind}`;

  const heading = doc.createElement('h3');
  heading.textContent = item.label;

  const frame = doc.createElement('div');
  frame.className = 'pf2e-tokener-preview-frame';

  const image = doc.createElement('img');
  image.src = item.src;
  image.alt = item.label;
  image.addEventListener('error', () => pane.classList.add('is-hidden'));
  frame.append(image);

  pane.append(heading, frame);
  return pane;
}
