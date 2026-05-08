import { MODULE_ID } from './constants.js';
import { getDocumentActor, isObject, localize, normalizePath, numberOr } from './utils.js';

export const REVERT_FLAG_KEY = 'lastRevert';
export const REVERT_FLAG_PATH = `flags.${MODULE_ID}.${REVERT_FLAG_KEY}`;

export function getApplyActions() {
  return [
    {
      action: 'token',
      label: localize('Actions.Token', 'Token'),
      tooltip: localize('ActionTooltips.Token', 'Update only the selected token on this scene.'),
    },
    {
      action: 'actor',
      label: localize('Actions.Actor', 'Actor'),
      tooltip: localize('ActionTooltips.Actor', 'Update the actor portrait and default token art.'),
    },
    {
      action: 'portrait',
      label: localize('Actions.Portrait', 'Portrait'),
      tooltip: localize('ActionTooltips.Portrait', 'Update only the actor portrait.'),
    },
    {
      action: 'both',
      label: localize('Actions.Both', 'Both'),
      tooltip: localize(
        'ActionTooltips.Both',
        'Update the selected token and the actor default token art.',
      ),
    },
  ];
}

export function getApplyActionsForCandidate(candidate) {
  const hasTokenArt = hasImageSource(candidate?.tokenSrc);
  const hasPortraitArt = hasImageSource(candidate?.portraitSrc) || hasTokenArt;
  return getApplyActions().filter((option) => {
    switch (option.action) {
      case 'token':
      case 'actor':
      case 'both':
        return hasTokenArt;
      case 'portrait':
        return hasPortraitArt;
      default:
        return false;
    }
  });
}

export function getCandidatePreviewSrc(candidate) {
  return getCandidatePreviewSources(candidate)[0] ?? '';
}

export function getCandidatePreviewSources(candidate) {
  const sources = [
    getImageSource(candidate?.tokenSrc),
    getImageSource(candidate?.portraitSrc),
    getImageSource(candidate?.subjectSrc),
  ].filter(Boolean);
  return [...new Set(sources)];
}

export function getApplyTargets(action) {
  switch (action) {
    case 'token':
      return { token: true, actor: false, portrait: false };
    case 'actor':
      return { token: false, actor: true, portrait: false };
    case 'portrait':
      return { token: false, actor: false, portrait: true };
    case 'both':
      return { token: true, actor: true, portrait: false };
    default:
      return { token: false, actor: false, portrait: false };
  }
}

export function buildTokenUpdate(candidate, { scale } = {}) {
  const tokenSrc = getImageSource(candidate?.tokenSrc);
  if (!tokenSrc) throw new Error('PF2e Tokener candidate has no token image.');

  const scaleOverride = getScaleOverride(scale);
  const scaleX = scaleOverride ?? numberOr(candidate?.scaleX ?? candidate?.scale, 1);
  const scaleY = scaleOverride ?? numberOr(candidate?.scaleY ?? candidate?.scale, scaleX);
  const update = {
    'texture.src': tokenSrc,
    'texture.scaleX': scaleX,
    'texture.scaleY': scaleY,
    randomImg: false,
  };

  if (candidate?.subjectSrc) {
    update['ring.enabled'] = true;
    update['ring.subject.texture'] = candidate.subjectSrc;
    update['ring.subject.scale'] =
      scaleOverride ??
      numberOr(candidate.subjectScale, Math.max(Math.abs(scaleX), Math.abs(scaleY)));
  } else {
    update['ring.enabled'] = false;
  }

  return update;
}

export function buildActorUpdate(candidate, options = {}) {
  const actorUpdate = {};
  for (const [key, value] of Object.entries(buildTokenUpdate(candidate, options))) {
    actorUpdate[`prototypeToken.${key}`] = value;
  }
  if (candidate?.portraitSrc) actorUpdate.img = candidate.portraitSrc;
  return actorUpdate;
}

export function buildTokenScalePreviewUpdate(candidate, scale) {
  const scaleOverride = getScaleOverride(scale);
  if (scaleOverride === null) return {};
  const update = {
    'texture.scaleX': scaleOverride,
    'texture.scaleY': scaleOverride,
  };
  if (candidate?.subjectSrc) update['ring.subject.scale'] = scaleOverride;
  return update;
}

export function buildRevertSnapshot({ action, candidate, tokenDocument } = {}) {
  const actor = getDocumentActor(tokenDocument);
  const targets = getApplyTargets(action);
  const actorUpdate = targets.actor && candidate ? buildActorUpdate(candidate) : {};
  const changesPortrait =
    targets.portrait || Object.prototype.hasOwnProperty.call(actorUpdate, 'img');
  return {
    action,
    label: candidate?.label ?? '',
    time: Date.now(),
    token: targets.token ? captureTokenState(tokenDocument) : undefined,
    actor: targets.actor && actor ? captureTokenState(actor.prototypeToken) : undefined,
    portrait: changesPortrait && actor ? { img: actor.img ?? actor._source?.img ?? '' } : undefined,
  };
}

export function getLastRevertData(tokenDocument) {
  const actor = getDocumentActor(tokenDocument);
  const tokenSnapshot = readFlag(tokenDocument, REVERT_FLAG_KEY);
  const actorSnapshot = readFlag(actor, REVERT_FLAG_KEY);
  if (tokenSnapshot && actorSnapshot) {
    return numberOr(actorSnapshot.time, 0) > numberOr(tokenSnapshot.time, 0)
      ? actorSnapshot
      : tokenSnapshot;
  }
  return tokenSnapshot ?? actorSnapshot ?? null;
}

export function buildTokenRevertUpdate(snapshot) {
  if (!isObject(snapshot?.token)) return {};
  return tokenStateToUpdate(snapshot.token);
}

export function buildActorRevertUpdate(snapshot) {
  const update = {};
  if (isObject(snapshot?.actor)) {
    for (const [key, value] of Object.entries(tokenStateToUpdate(snapshot.actor))) {
      update[`prototypeToken.${key}`] = value;
    }
  }
  if (isObject(snapshot?.portrait)) update.img = snapshot.portrait.img ?? '';
  return update;
}

export function hasRevertTargets(snapshot) {
  return Boolean(
    isObject(snapshot?.token) || isObject(snapshot?.actor) || isObject(snapshot?.portrait),
  );
}

export async function revertLastTokenerChange(tokenDocument) {
  const actor = getDocumentActor(tokenDocument);
  const snapshot = getLastRevertData(tokenDocument);
  if (!hasRevertTargets(snapshot)) return false;

  if (snapshot.token && tokenDocument?.update) {
    await tokenDocument.update({
      ...buildTokenRevertUpdate(snapshot),
      [REVERT_FLAG_PATH]: null,
    });
  }

  if ((snapshot.actor || snapshot.portrait) && actor?.update) {
    await actor.update({
      ...buildActorRevertUpdate(snapshot),
      [REVERT_FLAG_PATH]: null,
    });
  }

  return true;
}

function captureTokenState(documentLike) {
  return {
    texture: {
      src: normalizePath(readDocumentPath(documentLike, 'texture.src')).trim(),
      scaleX: numberOr(readDocumentPath(documentLike, 'texture.scaleX'), 1),
      scaleY: numberOr(readDocumentPath(documentLike, 'texture.scaleY'), 1),
    },
    randomImg: Boolean(readDocumentPath(documentLike, 'randomImg')),
    ring: {
      enabled: Boolean(readDocumentPath(documentLike, 'ring.enabled')),
      subject: {
        texture: normalizePath(readDocumentPath(documentLike, 'ring.subject.texture')).trim(),
        scale: numberOr(readDocumentPath(documentLike, 'ring.subject.scale'), 1),
      },
    },
  };
}

function tokenStateToUpdate(state) {
  const subjectTexture = normalizePath(state?.ring?.subject?.texture).trim();
  return {
    'texture.src': normalizePath(state?.texture?.src).trim(),
    'texture.scaleX': numberOr(state?.texture?.scaleX, 1),
    'texture.scaleY': numberOr(state?.texture?.scaleY, 1),
    randomImg: Boolean(state?.randomImg),
    'ring.enabled': Boolean(state?.ring?.enabled),
    'ring.subject.texture': subjectTexture,
    'ring.subject.scale': numberOr(state?.ring?.subject?.scale, 1),
  };
}

function readDocumentPath(documentLike, path) {
  if (!documentLike) return undefined;
  return readPath(documentLike, path) ?? readPath(documentLike._source, path);
}

function readFlag(documentLike, key) {
  return (
    documentLike?.getFlag?.(MODULE_ID, key) ??
    documentLike?.flags?.[MODULE_ID]?.[key] ??
    documentLike?._source?.flags?.[MODULE_ID]?.[key] ??
    null
  );
}

function readPath(object, path) {
  if (!object) return undefined;
  return String(path)
    .split('.')
    .reduce((value, part) => value?.[part], object);
}

function getImageSource(source) {
  return normalizePath(source).trim();
}

function hasImageSource(source) {
  return Boolean(getImageSource(source));
}

function getScaleOverride(value) {
  const scale = Number(value);
  return Number.isFinite(scale) && scale > 0 ? scale : null;
}
