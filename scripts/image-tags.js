import { IMAGE_TAGS_SETTING_KEY, MODULE_ID } from './constants.js';
import { isObject, localize, normalizePath, normalizeSearchText } from './utils.js';

export function registerImageTagSettings(settings = globalThis.game?.settings) {
  settings?.register?.(MODULE_ID, IMAGE_TAGS_SETTING_KEY, {
    name: localize('Settings.ImageTags.Name', 'Image tag overrides'),
    hint: localize(
      'Settings.ImageTags.Hint',
      'GM-added image tags keyed by image path. Original source tags remain read-only.',
    ),
    scope: 'world',
    config: false,
    type: Object,
    default: {},
    onChange: () => {
      void globalThis.game?.modules?.get?.(MODULE_ID)?.api?.rebuildIndex?.();
    },
  });
}

export function getImageTagOverrides(settings = globalThis.game?.settings) {
  return normalizeImageTagOverrides(settings?.get?.(MODULE_ID, IMAGE_TAGS_SETTING_KEY));
}

export async function setImageTagOverrides(imagePath, tags, settings = globalThis.game?.settings) {
  const path = normalizePath(imagePath);
  if (!path || !settings?.set) return null;

  const overrides = getImageTagOverrides(settings);
  const normalizedTags = normalizeImageTags(tags);
  if (normalizedTags) overrides[path] = normalizedTags;
  else delete overrides[path];

  await settings.set(MODULE_ID, IMAGE_TAGS_SETTING_KEY, overrides);
  return overrides;
}

export function applyImageTagOverrides(candidates, settings = globalThis.game?.settings) {
  const overrides = getImageTagOverrides(settings);
  return candidates.map((candidate) => {
    const imageTagPath = getCandidateImageTagPath(candidate);
    const imageTagOverrides = overrides[imageTagPath];
    if (!imageTagPath)
      return {
        ...candidate,
        imageTagsEditable: true,
      };

    const tags = mergeImageTags(candidate.tags, imageTagOverrides);
    return {
      ...candidate,
      imageTagPath,
      imageTagOverrides,
      imageTagsEditable: true,
      originalTags: candidate.tags,
      searchText: undefined,
      tags,
    };
  });
}

function getCandidateImageTagPath(candidate) {
  return normalizePath(
    candidate?.customImagePath ||
      candidate?.tokenSrc ||
      candidate?.portraitSrc ||
      candidate?.subjectSrc ||
      '',
  );
}

function normalizeImageTagOverrides(overrides) {
  if (!isObject(overrides)) return {};
  const normalized = {};
  for (const [path, tags] of Object.entries(overrides)) {
    const normalizedPath = normalizePath(path);
    const normalizedTags = normalizeImageTags(tags);
    if (normalizedPath && normalizedTags) normalized[normalizedPath] = normalizedTags;
  }
  return normalized;
}

function normalizeImageTags(tags) {
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

function mergeImageTags(...tagSets) {
  const merged = {};
  for (const tags of tagSets) {
    if (!isObject(tags)) continue;
    for (const [group, values] of Object.entries(tags)) {
      const groupKey = normalizeSearchText(group);
      if (!groupKey) continue;
      const list = (Array.isArray(values) ? values : [values])
        .map((value) => normalizeSearchText(value))
        .filter(Boolean);
      if (list.length) merged[groupKey] = [...new Set([...(merged[groupKey] ?? []), ...list])];
    }
  }
  return Object.keys(merged).length ? merged : undefined;
}
