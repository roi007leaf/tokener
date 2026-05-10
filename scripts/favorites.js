import { MODULE_ID } from './constants.js';
import { isObject, localize } from './utils.js';

export const FAVORITES_SETTING_KEY = 'favorites';

let memoryFavorites = { ids: [] };

export function registerFavoriteSettings(settings = globalThis.game?.settings) {
  settings?.register?.(MODULE_ID, FAVORITES_SETTING_KEY, {
    name: localize('Settings.Favorites.Name', 'Favorite token art'),
    hint: localize('Settings.Favorites.Hint', 'Token art marked as favorites in Tokener.'),
    scope: 'client',
    config: false,
    type: Object,
    default: { ids: [] },
  });
}

export function getFavoriteIds(settings = globalThis.game?.settings) {
  return new Set(normalizeFavoriteIds(readFavoriteStore(settings)));
}

export async function toggleFavoriteCandidate(candidate, settings = globalThis.game?.settings) {
  if (!candidate?.id) return getFavoriteIds(settings);
  const ids = getFavoriteIds(settings);
  if (ids.has(candidate.id)) ids.delete(candidate.id);
  else ids.add(candidate.id);
  await writeFavoriteIds(ids, settings);
  return ids;
}

export function filterFavoriteCandidates(candidates, favoriteIds, favoritesOnly = true) {
  if (!favoritesOnly) return candidates ?? [];
  const ids = favoriteIds instanceof Set ? favoriteIds : new Set(favoriteIds ?? []);
  return (candidates ?? []).filter((candidate) => ids.has(candidate?.id));
}

export function isFavoriteCandidate(candidate, favoriteIds) {
  const ids = favoriteIds instanceof Set ? favoriteIds : new Set(favoriteIds ?? []);
  return Boolean(candidate?.id && ids.has(candidate.id));
}

function readFavoriteStore(settings) {
  try {
    return settings?.get?.(MODULE_ID, FAVORITES_SETTING_KEY) ?? memoryFavorites;
  } catch {
    return memoryFavorites;
  }
}

async function writeFavoriteIds(ids, settings) {
  const store = { ids: normalizeFavoriteIds([...ids]) };
  if (settings?.set) {
    await settings.set(MODULE_ID, FAVORITES_SETTING_KEY, store);
  } else {
    memoryFavorites = store;
  }
}

function normalizeFavoriteIds(store) {
  const ids = Array.isArray(store) ? store : isObject(store) ? store.ids : [];
  return [
    ...new Set(
      (Array.isArray(ids) ? ids : []).map((id) => String(id ?? '').trim()).filter(Boolean),
    ),
  ];
}
