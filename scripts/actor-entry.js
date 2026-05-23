import { REVERT_FLAG_PATH } from './actions.js';
import { openTokenPicker } from './picker-app.js';
import { localize, normalizeHudElement } from './utils.js';

const ACTOR_SHEET_IMAGE_SELECTOR = [
  'img[data-edit="img"]',
  'img.profile-img',
  'img.actor-image',
  'img[data-action="editImage"]',
].join(',');
const ACTOR_SHEET_IMAGE_HOST_SELECTOR = [
  '.image-container',
  '.profile-img-container',
  '.portrait',
  '.avatar',
  '.sheet-profile',
  'figure',
].join(',');
const ACTOR_SHEET_BUTTON_CLASS = 'pf2e-tokener-actor-sheet-button';
const ACTOR_SHEET_IMAGE_HOST_CLASS = 'pf2e-tokener-actor-sheet-image-host';
const ACTOR_DIRECTORY_ENTRY_SELECTOR = '[data-document-id],[data-entry-id],[data-actor-id]';

export function renderActorSheetTokenerEntry(app, html) {
  const root = normalizeHudElement(html);
  const actor = getSheetActor(app);
  if (!root || !canUseTokenerActor(actor)) return;
  installActorSheetTokenerButton(root, actor);
}

export function renderActorDirectoryTokenerEntry(_app, html) {
  const root = normalizeHudElement(html);
  if (!root || !globalThis.game?.user?.isGM || root.dataset.pf2eTokenerActorDirectoryBound) return;
  root.dataset.pf2eTokenerActorDirectoryBound = 'true';

  root.addEventListener?.('contextmenu', async (event) => {
    const image = event.target?.closest?.('img');
    const entry = image?.closest?.(ACTOR_DIRECTORY_ENTRY_SELECTOR);
    const actor = getDirectoryActor(entry);
    if (!actor || !canUseTokenerActor(actor)) return;

    event.preventDefault?.();
    event.stopPropagation?.();
    await openTokenPickerForActor(actor);
  });
}

export function openTokenPickerForActor(actor) {
  if (!canUseTokenerActor(actor)) return null;
  return openTokenPicker(createActorTokenDocument(actor));
}

export function createActorTokenDocument(actor) {
  const proxy = {
    actor,
    baseActor: actor,
    isTokenerActorProxy: true,
    get flags() {
      return actor?.flags;
    },
    get id() {
      return actor?.id;
    },
    get name() {
      return actor?.name;
    },
    get prototypeToken() {
      return getActorPrototypeToken(actor);
    },
    get texture() {
      return getActorPrototypeToken(actor)?.texture ?? {};
    },
    get ring() {
      return getActorPrototypeToken(actor)?.ring ?? {};
    },
    get randomImg() {
      return getActorPrototypeToken(actor)?.randomImg;
    },
    canUserModify(user, action) {
      return canActorUserModify(actor, user, action);
    },
    get(path) {
      return readActorPrototypePath(actor, path);
    },
    getFlag(moduleId, key) {
      return actor?.getFlag?.(moduleId, key) ?? actor?.flags?.[moduleId]?.[key] ?? null;
    },
    testUserPermission(user, level) {
      return actor?.testUserPermission?.(user, level) ?? Boolean(actor?.isOwner ?? user?.isGM);
    },
    async update(update) {
      const actorUpdate = {};
      for (const [key, value] of Object.entries(update ?? {})) {
        actorUpdate[key === REVERT_FLAG_PATH ? key : `prototypeToken.${key}`] = value;
      }
      return actor?.update?.(actorUpdate);
    },
  };
  return proxy;
}

function installActorSheetTokenerButton(root, actor) {
  const image = root.querySelector?.(ACTOR_SHEET_IMAGE_SELECTOR);
  const host = getActorSheetImageHost(image);
  if (!host || host.querySelector?.(`.${ACTOR_SHEET_BUTTON_CLASS}`)) return;

  const button = createActorSheetTokenerButton(root, actor);
  if (!button) return;

  host.classList?.add(ACTOR_SHEET_IMAGE_HOST_CLASS);
  host.append?.(button);
}

function createActorSheetTokenerButton(root, actor) {
  const document = root?.ownerDocument ?? globalThis.document;
  const button = document?.createElement?.('button');
  if (!button) return null;

  button.type = 'button';
  button.className = ACTOR_SHEET_BUTTON_CLASS;
  button.dataset.tooltip = localize('HUD.ActorSheetButtonTooltip', 'Open Tokener');
  button.dataset.tooltipDirection = 'UP';
  button.innerHTML = '<i class="fas fa-images" aria-hidden="true"></i>';
  button.addEventListener?.('click', async (event) => {
    event.preventDefault?.();
    event.stopPropagation?.();
    await openTokenPickerForActor(actor);
  });
  return button;
}

function getActorSheetImageHost(image) {
  if (!image) return null;
  const closestHost = image.closest?.(ACTOR_SHEET_IMAGE_HOST_SELECTOR);
  if (closestHost && closestHost !== image) return closestHost;
  return image.parentElement ?? null;
}

function getSheetActor(app) {
  return app?.actor ?? app?.object?.actor ?? app?.object ?? app?.document ?? null;
}

function getDirectoryActor(entry) {
  const id =
    entry?.dataset?.documentId ?? entry?.dataset?.entryId ?? entry?.dataset?.actorId ?? null;
  return id ? (globalThis.game?.actors?.get?.(id) ?? null) : null;
}

function canUseTokenerActor(actor) {
  if (!globalThis.game?.user?.isGM || !actor) return false;
  if (globalThis.game.user.isGM) return true;
  return canActorUserModify(actor, globalThis.game.user, 'update');
}

function canActorUserModify(actor, user, action) {
  try {
    if (typeof actor?.canUserModify === 'function') return actor.canUserModify(user, action);
    if (typeof actor?.testUserPermission === 'function')
      return actor.testUserPermission(user, 'OWNER');
  } catch {
    return false;
  }
  return Boolean(actor?.isOwner ?? user?.isGM);
}

function getActorPrototypeToken(actor) {
  return actor?.prototypeToken ?? actor?._source?.prototypeToken ?? {};
}

function readActorPrototypePath(actor, path) {
  const prototypeToken = getActorPrototypeToken(actor);
  return (
    prototypeToken?.get?.(path) ??
    readPath(prototypeToken, path) ??
    readPath(actor?._source?.prototypeToken, path)
  );
}

function readPath(object, path) {
  if (!object) return undefined;
  return String(path)
    .split('.')
    .reduce((value, part) => value?.[part], object);
}
