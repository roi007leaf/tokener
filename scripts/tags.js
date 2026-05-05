import { compareStrings, normalizeLabel, normalizeSearchText } from './utils.js';

export const TAG_GROUP_ORDER = [
  'ancestry',
  'category',
  'equipment',
  'family',
  'features',
  'special',
];

export function getTagFilterOptions(candidates, { limit = Infinity } = {}) {
  const byId = new Map();

  for (const candidate of candidates ?? []) {
    for (const [group, values] of Object.entries(candidate?.tags ?? {})) {
      const groupKey = normalizeSearchText(group);
      if (!groupKey) continue;

      for (const value of values ?? []) {
        const valueKey = normalizeSearchText(value);
        if (!valueKey) continue;

        const id = tagFilterTerm({ group: groupKey, value: valueKey });
        const existing = byId.get(id);
        if (existing) existing.count += 1;
        else
          byId.set(id, {
            id,
            count: 1,
            group: groupKey,
            label: normalizeLabel(valueKey),
            value: valueKey,
          });
      }
    }
  }

  const options = [...byId.values()].sort(
    (a, b) =>
      tagGroupRank(a.group) - tagGroupRank(b.group) ||
      b.count - a.count ||
      compareStrings(a.value, b.value),
  );
  return Number.isFinite(limit) ? options.slice(0, Math.max(0, limit)) : options;
}

export function getTagGroupSearchState(group, query) {
  const filter = normalizeSearchText(query);
  const options = group?.options ?? [];
  const matchedOptionCount = filter
    ? options.filter((option) => isTagOptionSearchMatch(option, filter)).length
    : options.length;

  return {
    hasMatches: !filter || matchedOptionCount > 0,
    isFiltering: Boolean(filter),
    matchedOptionCount,
  };
}

export function isTagOptionSearchMatch(option, query) {
  const filter = normalizeSearchText(query);
  return (
    !filter ||
    normalizeSearchText(option?.label).includes(filter) ||
    normalizeSearchText(option?.value).includes(filter)
  );
}

export function toggleTagFilterTerm(query, tag) {
  const term = tagFilterTerm(tag);
  if (!term) return String(query ?? '').trim();

  const parts = String(query ?? '')
    .split(/\s+/)
    .filter(Boolean);
  const index = parts.findIndex((part) => part.toLowerCase() === term);
  if (index >= 0) parts.splice(index, 1);
  else parts.push(term);
  return parts.join(' ');
}

export function isTagFilterTermActive(query, tag) {
  const term = tagFilterTerm(tag);
  if (!term) return false;
  return String(query ?? '')
    .split(/\s+/)
    .some((part) => part.toLowerCase() === term);
}

export function clearTagFilterTerms(query, tags) {
  const terms = new Set((tags ?? []).map(tagFilterTerm).filter(Boolean));
  if (!terms.size) return String(query ?? '').trim();

  return String(query ?? '')
    .split(/\s+/)
    .filter((part) => part && !terms.has(part.toLowerCase()))
    .join(' ');
}

function tagFilterTerm(tag) {
  const group = normalizeSearchText(tag?.group);
  const value = normalizeSearchText(tag?.value);
  return group && value ? `${group}:${value.replace(/\s+/g, '-')}` : '';
}

function tagGroupRank(group) {
  const index = TAG_GROUP_ORDER.indexOf(group);
  return index >= 0 ? index : TAG_GROUP_ORDER.length;
}
