import { DEFAULT_LIMIT, IMAGE_EXTENSIONS } from './constants.js';
import {
  compareStrings,
  getDocumentActor,
  isObject,
  labelFromPath,
  normalizeLabel,
  normalizePath,
  normalizeSearchText,
  numberOr,
  splitTerms,
} from './utils.js';

export function createMappedCandidates({ module, mapping, sourceType = 'native' }) {
  if (!isObject(mapping)) return [];

  const candidates = [];
  for (const [packKey, actors] of Object.entries(mapping)) {
    if (!isObject(actors)) continue;
    for (const [actorId, info] of Object.entries(actors)) {
      const token = normalizeMappedToken(info);
      if (!token?.tokenSrc) continue;

      const label = normalizeLabel(info?.name) || labelFromPath(token.tokenSrc);
      candidates.push(
        makeCandidate({
          actorId,
          label,
          module,
          packKey,
          portraitSrc: typeof info?.actor === 'string' ? info.actor : undefined,
          sourceType,
          ...token,
        }),
      );
    }
  }

  return candidates;
}

export function createDatasheetCandidates({ module, datasheet, sourceType = 'datasheet' }) {
  const entries = Array.isArray(datasheet) ? datasheet : Object.values(datasheet ?? {});
  const candidates = [];

  for (const entry of entries) {
    if (!isObject(entry)) continue;
    const art = entry.art;
    if (!isObject(art) || !art.token) continue;

    const scale = numberOr(art.scale, 1);
    candidates.push(
      makeCandidate({
        label: entry.label || labelFromPath(art.token),
        module,
        portraitSrc: art.portrait,
        scaleX: scale,
        scaleY: scale,
        sourceType,
        subjectScale: scale,
        subjectSrc: art.subject,
        tags: normalizeCandidateTags(entry.tags),
        tokenSrc: art.token,
      }),
    );
  }

  return candidates;
}

export function createFolderCandidates({ module, files }) {
  if (!Array.isArray(files)) return [];
  const art = buildFolderArtLookups(files);

  return files
    .map(normalizePath)
    .filter((file) => IMAGE_EXTENSIONS.test(file) && isTokenFolderPath(file))
    .map((file) =>
      makeCandidate({
        label: labelFromPath(file),
        module,
        portraitSrc: art.portraits.get(assetStem(file)),
        sourceType: 'folder',
        subjectSrc: art.subjects.get(assetStem(file)),
        tokenSrc: file,
      }),
    );
}

export function searchCandidates(index, query = '', { limit = DEFAULT_LIMIT } = {}) {
  const search = parseCandidateSearch(query);
  const rows = [];

  for (const candidate of index) {
    const haystack = candidate.searchText || buildSearchText(candidate);
    if (search.terms.length && !search.terms.every((term) => haystack.includes(term))) continue;
    if (!search.tagFilters.every((filter) => candidateHasTag(candidate, filter))) continue;

    const label = normalizeSearchText(candidate.label);
    const matchedTags = getMatchedTags(candidate, search);
    let score = 0;
    for (const term of search.terms) {
      if (label === term) score += 20;
      else if (label.startsWith(term)) score += 12;
      else if (label.includes(term)) score += 8;
      else if (matchedTags.some((tag) => tag.matches.has(term))) score += 7;
      else if (haystack.includes(term)) score += 3;
    }
    score += search.tagFilters.length * 16;
    if (!search.terms.length && !search.tagFilters.length) score = 1;
    rows.push({ candidate, matchedTags, score });
  }

  rows.sort(
    (a, b) =>
      b.score - a.score ||
      compareStrings(a.candidate.label, b.candidate.label) ||
      compareStrings(a.candidate.moduleTitle, b.candidate.moduleTitle),
  );

  return rows.slice(0, limit).map((row) => ({
    ...row.candidate,
    matchedTags: row.matchedTags.map(({ group, value }) => ({ group, value })),
    matchType: 'search',
  }));
}

export function getCandidatesForTokenDocument(index, tokenDocument, query = '') {
  const actor = getDocumentActor(tokenDocument);
  const actorName = normalizeLabel(actor?.name || tokenDocument?.name || '');
  const normalizedActorName = normalizeSearchText(actorName);
  const sourceIds = getActorSourceIds(actor);
  const fallbackQuery = query || actorName;
  const picked = new Set();
  const results = [];

  const add = (candidate, matchType) => {
    const key = candidate.id || candidate.tokenSrc;
    if (!key || picked.has(key)) return;
    picked.add(key);
    results.push({ ...candidate, matchType });
  };

  for (const candidate of index) {
    if (sourceIds.some((source) => isExactSourceMatch(candidate, source))) {
      add(candidate, 'exact');
    }
  }

  if (normalizedActorName) {
    for (const candidate of index) {
      if (normalizeSearchText(candidate.label) === normalizedActorName) {
        add(candidate, 'name');
      }
    }
  }

  for (const candidate of searchCandidates(index, fallbackQuery)) {
    add(candidate, 'search');
  }

  return results;
}

export function dedupeCandidates(candidates) {
  const byToken = new Map();
  const order = [];
  for (const candidate of candidates) {
    const key = normalizePath(candidate?.tokenSrc);
    if (!key) continue;

    const existing = byToken.get(key);
    if (existing) {
      byToken.set(key, mergeCandidateArt(existing, candidate));
    } else {
      byToken.set(key, { ...candidate, tokenSrc: key });
      order.push(key);
    }
  }
  return order.map((key) => byToken.get(key));
}

function normalizeMappedToken(info) {
  const token = info?.token;
  if (typeof token === 'string') {
    return { tokenSrc: token };
  }
  if (!isObject(token)) return null;

  const tokenSrc = token.texture?.src || token.img;
  if (!tokenSrc) return null;

  const scale = numberOr(token.scale, undefined);
  const scaleX = numberOr(token.texture?.scaleX, scale ?? 1);
  const scaleY = numberOr(token.texture?.scaleY, scale ?? scaleX);
  const subject = token.ring?.subject;

  return {
    tokenSrc,
    scaleX,
    scaleY,
    subjectScale: numberOr(subject?.scale, undefined),
    subjectSrc: subject?.texture,
  };
}

function makeCandidate({
  actorId,
  label,
  module,
  packKey,
  portraitSrc,
  scaleX,
  scaleY,
  sourceType,
  subjectScale,
  subjectSrc,
  tags,
  tokenSrc,
}) {
  const normalizedPackKey = packKey ? normalizePackKey(packKey) : undefined;
  const candidate = {
    actorId,
    canonicalPackKey: normalizedPackKey,
    id: makeCandidateId(module?.id, packKey, actorId, tokenSrc),
    label: normalizeLabel(label) || labelFromPath(tokenSrc),
    moduleId: module?.id || 'unknown',
    moduleTitle: module?.title || module?.id || 'Unknown Module',
    packKey,
    portraitSrc,
    scaleX,
    scaleY,
    sourceType,
    subjectScale,
    subjectSrc,
    tags,
    tokenSrc: normalizePath(tokenSrc),
  };
  candidate.searchText = buildSearchText(candidate);
  return candidate;
}

function makeCandidateId(moduleId, packKey, actorId, tokenSrc) {
  return [moduleId, packKey, actorId, tokenSrc].filter(Boolean).join('|');
}

function buildSearchText(candidate) {
  return normalizeSearchText(
    [
      candidate.label,
      candidate.moduleTitle,
      candidate.moduleId,
      candidate.packKey,
      candidate.canonicalPackKey,
      candidate.sourceType,
      tagSearchText(candidate.tags),
      labelFromPath(candidate.tokenSrc || ''),
    ]
      .filter(Boolean)
      .join(' '),
  );
}

function normalizeCandidateTags(tags) {
  if (!isObject(tags)) return undefined;
  const normalized = {};
  for (const [group, values] of Object.entries(tags)) {
    const groupKey = normalizeSearchText(group);
    if (!groupKey) continue;
    const list = (Array.isArray(values) ? values : [values])
      .map((value) => normalizeSearchText(value))
      .filter(Boolean);
    if (list.length) normalized[groupKey] = [...new Set(list)];
  }
  return Object.keys(normalized).length ? normalized : undefined;
}

function tagSearchText(tags) {
  return getTagEntries(tags)
    .flatMap((tag) => [tag.group, tag.value, `${tag.group} ${tag.value}`])
    .join(' ');
}

function parseCandidateSearch(query) {
  const terms = [];
  const tagFilters = [];
  for (const rawPart of String(query ?? '')
    .split(/\s+/)
    .filter(Boolean)) {
    const tagMatch = rawPart.match(/^([a-z][\w-]*):(.+)$/i);
    if (tagMatch) {
      const group = normalizeSearchText(tagMatch[1]);
      const value = normalizeSearchText(tagMatch[2]);
      if (group && value) tagFilters.push({ group, value });
      continue;
    }
    terms.push(...splitTerms(rawPart));
  }
  return { tagFilters, terms };
}

function candidateHasTag(candidate, filter) {
  return getTagEntries(candidate.tags).some((tag) => tagMatchesFilter(tag, filter));
}

function tagMatchesFilter(tag, filter) {
  if (filter.group === 'tag' || filter.group === 'tags') return tag.value === filter.value;
  return tag.group === filter.group && tag.value === filter.value;
}

function getMatchedTags(candidate, search) {
  const matched = new Map();
  for (const tag of getTagEntries(candidate.tags)) {
    const matches = new Set();
    for (const term of search.terms) {
      if (tag.value === term || `${tag.group} ${tag.value}` === term) {
        matches.add(term);
      }
    }
    for (const filter of search.tagFilters) {
      if (tagMatchesFilter(tag, filter)) matches.add(`${filter.group}:${filter.value}`);
    }
    if (matches.size) matched.set(`${tag.group}:${tag.value}`, { ...tag, matches });
  }
  return [...matched.values()].slice(0, 4);
}

function getTagEntries(tags) {
  if (!isObject(tags)) return [];
  const entries = [];
  for (const [group, values] of Object.entries(tags)) {
    for (const value of values ?? []) entries.push({ group, value });
  }
  return entries;
}

function isTokenFolderPath(path) {
  return /(^|\/)(resources\/tokens|assets\/tokens|tokens)\//i.test(path);
}

function isPortraitFolderPath(path) {
  return /(^|\/)(resources\/art|resources\/portraits|assets\/art|assets\/portraits|art|portraits)\//i.test(
    path,
  );
}

function isSubjectFolderPath(path) {
  return /(^|\/)(resources\/subjects|assets\/subjects|subjects)\//i.test(path);
}

function buildFolderArtLookups(files) {
  const portraits = new Map();
  const subjects = new Map();
  for (const file of files.map(normalizePath)) {
    if (!IMAGE_EXTENSIONS.test(file)) continue;
    const stem = assetStem(file);
    if (!stem) continue;
    if (isPortraitFolderPath(file) && !portraits.has(stem)) portraits.set(stem, file);
    else if (isSubjectFolderPath(file) && !subjects.has(stem)) subjects.set(stem, file);
  }
  return { portraits, subjects };
}

function assetStem(path) {
  const file = normalizePath(path).split('/').pop() || '';
  return normalizeSearchText(file.replace(/\.[^.]+$/, ''));
}

function getActorSourceIds(actor) {
  const values = new Set();
  const candidates = [
    actor?.getFlag?.('core', 'sourceId'),
    actor?.flags?.core?.sourceId,
    actor?._source?.flags?.core?.sourceId,
    actor?._stats?.compendiumSource,
    actor?._source?._stats?.compendiumSource,
  ];

  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) values.add(value.trim());
  }

  if (actor?.pack && actor?.id) values.add(`Compendium.${actor.pack}.Actor.${actor.id}`);

  return [...values].map(parseCompendiumSource).filter(Boolean);
}

function parseCompendiumSource(sourceId) {
  const stripped = String(sourceId).replace(/^Compendium\./, '');
  const marker = '.Actor.';
  if (stripped.includes(marker)) {
    const [packKey, actorId] = stripped.split(marker);
    return { actorId, canonicalPackKey: normalizePackKey(packKey), packKey };
  }

  const parts = stripped.split('.');
  const actorId = parts.pop();
  const packKey = parts.join('.');
  if (!actorId || !packKey) return null;
  return { actorId, canonicalPackKey: normalizePackKey(packKey), packKey };
}

function normalizePackKey(packKey) {
  const key = String(packKey ?? '').trim();
  if (!key) return '';
  if (key.startsWith('pf2e.')) return key;
  if (!key.includes('.')) return `pf2e.${key}`;
  return key;
}

function isExactSourceMatch(candidate, source) {
  if (!candidate.actorId || !source.actorId || candidate.actorId !== source.actorId) return false;
  const candidatePack = candidate.canonicalPackKey || normalizePackKey(candidate.packKey);
  return candidatePack === source.canonicalPackKey || candidate.packKey === source.packKey;
}

function mergeCandidateArt(existing, incoming) {
  const primary = candidateRichness(incoming) > candidateRichness(existing) ? incoming : existing;
  const fallback = primary === incoming ? existing : incoming;
  const merged = {
    ...fallback,
    ...primary,
    actorId: primary.actorId ?? fallback.actorId,
    canonicalPackKey: primary.canonicalPackKey ?? fallback.canonicalPackKey,
    id: primary.id ?? fallback.id,
    label: primary.label ?? fallback.label,
    packKey: primary.packKey ?? fallback.packKey,
    portraitSrc: primary.portraitSrc ?? fallback.portraitSrc,
    scaleX: primary.scaleX ?? fallback.scaleX,
    scaleY: primary.scaleY ?? fallback.scaleY,
    sourceType: primary.sourceType ?? fallback.sourceType,
    subjectScale: primary.subjectScale ?? fallback.subjectScale,
    subjectSrc: primary.subjectSrc ?? fallback.subjectSrc,
    tags: primary.tags ?? fallback.tags,
    tokenSrc: normalizePath(primary.tokenSrc ?? fallback.tokenSrc),
  };
  merged.searchText = buildSearchText(merged);
  return merged;
}

function candidateRichness(candidate) {
  return (
    (candidate?.portraitSrc ? 16 : 0) +
    (candidate?.subjectSrc ? 8 : 0) +
    (candidate?.actorId ? 4 : 0) +
    (candidate?.packKey ? 2 : 0) +
    (candidate?.sourceType && candidate.sourceType !== 'folder' ? 1 : 0)
  );
}
