import { localize } from './utils.js';

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
  ];
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
  for (const item of getImagePreviewItems(candidate)) {
    panes.append(createPreviewPane(item));
  }

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
  overlay.append(dialog);
  doc.body.append(overlay);
  close.focus?.();
}

function createPreviewPane(item) {
  const doc = globalThis.document;
  const pane = doc.createElement('article');
  pane.className = `pf2e-tokener-preview-pane pf2e-tokener-preview-pane-${item.kind}`;

  const heading = doc.createElement('h3');
  heading.textContent = item.label;

  const frame = doc.createElement('div');
  frame.className = 'pf2e-tokener-preview-frame';

  if (item.available) {
    const image = doc.createElement('img');
    image.src = item.src;
    image.alt = item.label;
    frame.append(image);
  } else {
    const empty = doc.createElement('div');
    empty.className = 'pf2e-tokener-preview-empty';
    empty.textContent = localize('Preview.ActorUnavailable', 'No actor image available.');
    frame.append(empty);
  }

  pane.append(heading, frame);
  return pane;
}
