import { getLastRevertData, hasRevertTargets, revertLastTokenerChange } from './actions.js';
import { canUseTokenHudDocument } from './permissions.js';
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
  setHudButtonRevertState(button, tokenDocument);
  button.dataset.action = 'pf2e-tokener';
  button.innerHTML = '<i class="fas fa-images"></i>';
  button.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await openTokenPicker(tokenDocument);
  });
  button.addEventListener('contextmenu', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await revertFromHudButton(button, tokenDocument);
  });
  target.append(button);
}

function setHudButtonRevertState(button, tokenDocument) {
  const hasRevert = hasRevertTargets(getLastRevertData(tokenDocument));
  button.className = `control-icon pf2e-tokener-button${hasRevert ? ' is-overridden' : ''}`;
  button.dataset.tooltip = hasRevert
    ? localize('HUD.RevertButtonTooltip', 'Tokener - right-click to revert last change.')
    : localize('HUD.Tooltip', 'Tokener');
}

async function revertFromHudButton(button, tokenDocument) {
  if (!hasRevertTargets(getLastRevertData(tokenDocument))) return;

  try {
    const reverted = await revertLastTokenerChange(tokenDocument);
    if (!reverted) return;
    setHudButtonRevertState(button, null);
    globalThis.ui?.notifications?.info?.(
      localize('Notifications.Reverted', 'Tokener: previous art restored.'),
    );
  } catch (error) {
    console.error('pf2e-tokener | Failed to revert token art from HUD button', error);
    globalThis.ui?.notifications?.error?.(
      localize('Notifications.RevertFailed', 'Tokener: failed to restore previous art.'),
    );
  }
}

function getHudTokenDocument(app) {
  return app?.object?.document ?? app?.document ?? app?.object ?? null;
}

function canUseTokener(tokenDocument) {
  return canUseTokenHudDocument(tokenDocument);
}
