import { compareStrings, localize, normalizeSearchText } from './utils.js';

export function getSourceFilterOptions(candidates) {
  const modules = new Map();
  for (const candidate of candidates ?? []) {
    if (!candidate?.moduleId) continue;
    const existing = modules.get(candidate.moduleId);
    modules.set(candidate.moduleId, {
      id: candidate.moduleId,
      title: candidate.moduleTitle || candidate.moduleId,
      count: (existing?.count ?? 0) + 1,
    });
  }
  return [...modules.values()].sort((a, b) => compareStrings(a.title, b.title));
}

export function getPanelSourceFilterOptions(index) {
  return getSourceFilterOptions(index);
}

export function filterSourceOptionsByQuery(options, query) {
  const terms = normalizeSearchText(query).split(' ').filter(Boolean);
  if (!terms.length) return options ?? [];

  return (options ?? []).filter((option) => {
    const title = normalizeSearchText(option?.title ?? option?.id ?? '');
    return terms.every((term) => title.includes(term));
  });
}

export function filterCandidatesBySources(
  candidates,
  selectedSourceIds,
  { emptyMeansAll = true } = {},
) {
  const selected = new Set(selectedSourceIds ?? []);
  if (!selected.size) return emptyMeansAll ? candidates : [];
  return candidates.filter((candidate) => selected.has(candidate.moduleId));
}

export function getSourceFilterLabel(options, selectedSourceIds, { emptyMeansAll = true } = {}) {
  const selected = new Set(selectedSourceIds ?? []);
  if (!selected.size) {
    return emptyMeansAll
      ? localize('HUD.AllSources', 'All sources')
      : localize('HUD.NoSources', 'No sources');
  }
  if (selected.size >= (options?.length ?? 0)) return localize('HUD.AllSources', 'All sources');
  if (selected.size === 1) {
    const [id] = selected;
    return (
      options.find((option) => option.id === id)?.title ?? localize('HUD.AllSources', 'All sources')
    );
  }
  return localize('HUD.SourcesSelected', '{count} sources').replace(
    '{count}',
    String(selected.size),
  );
}
