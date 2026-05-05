import { localize, normalizePath, numberOr } from './utils.js';

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

export function buildTokenUpdate(candidate) {
  const tokenSrc = getImageSource(candidate?.tokenSrc);
  if (!tokenSrc) throw new Error('PF2e Tokener candidate has no token image.');

  const scaleX = numberOr(candidate?.scaleX ?? candidate?.scale, 1);
  const scaleY = numberOr(candidate?.scaleY ?? candidate?.scale, scaleX);
  const update = {
    'texture.src': tokenSrc,
    'texture.scaleX': scaleX,
    'texture.scaleY': scaleY,
    randomImg: false,
  };

  if (candidate?.subjectSrc) {
    update['ring.enabled'] = true;
    update['ring.subject.texture'] = candidate.subjectSrc;
    update['ring.subject.scale'] = numberOr(
      candidate.subjectScale,
      Math.max(Math.abs(scaleX), Math.abs(scaleY)),
    );
  } else {
    update['ring.enabled'] = false;
  }

  return update;
}

export function buildActorUpdate(candidate) {
  const actorUpdate = {};
  for (const [key, value] of Object.entries(buildTokenUpdate(candidate))) {
    actorUpdate[`prototypeToken.${key}`] = value;
  }
  if (candidate?.portraitSrc) actorUpdate.img = candidate.portraitSrc;
  return actorUpdate;
}

function getImageSource(source) {
  return normalizePath(source).trim();
}

function hasImageSource(source) {
  return Boolean(getImageSource(source));
}
