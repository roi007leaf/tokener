import { openTokenPicker, updateOpenPanelsCanvasZoom } from './picker-app.js';
import { localize, normalizeHudElement } from './utils.js';

export { updateOpenPanelsCanvasZoom } from './picker-app.js';

export function renderTokenHud(app, html) {
  const root = normalizeHudElement(html);
  const tokenDocument = getHudTokenDocument(app);
  if (!root || !tokenDocument || !canUseTokener(tokenDocument)) return;

  root.querySelectorAll('.pf2e-tokener-button').forEach((element) => element.remove());

  const target = root.querySelector('.col.right') ?? root.querySelector('.right') ?? root;
  const button = document.createElement('div');
  button.className = 'control-icon pf2e-tokener-button';
  button.dataset.action = 'pf2e-tokener';
  button.dataset.tooltip = localize('HUD.Tooltip', 'PF2e Tokener');
  button.innerHTML = '<i class="fas fa-images"></i>';
  button.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await openTokenPicker(tokenDocument);
  });
  target.append(button);
}

function getHudTokenDocument(app) {
  return app?.object?.document ?? app?.document ?? app?.object ?? null;
}

function canUseTokener(tokenDocument) {
  if (!globalThis.game?.user?.isGM) return false;
  return canUpdateDocument(tokenDocument);
}

function canUpdateDocument(document) {
  if (!document) return false;
  const user = globalThis.game?.user;
  try {
    if (typeof document.canUserModify === 'function') return document.canUserModify(user, 'update');
    if (typeof document.testUserPermission === 'function')
      return document.testUserPermission(user, 'OWNER');
  } catch {
    return false;
  }
  return Boolean(document.isOwner ?? user?.isGM);
}
