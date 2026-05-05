import { MODULE_ID } from './constants.js';
import {
  buildActorUpdate,
  buildTokenUpdate,
  getApplyActionsForCandidate,
  getApplyTargets,
  getCandidatePreviewSrc,
  getCandidatePreviewSources,
} from './actions.js';
import { getCandidatesForTokenDocument } from './candidates.js';
import { ensureIndex } from './foundry-index.js';
import { openImagePreview } from './preview.js';
import {
  filterCandidatesBySources,
  filterSourceOptionsByQuery,
  getPanelSourceFilterOptions,
  getSourceFilterLabel,
} from './sources.js';
import {
  getTagFilterOptions,
  getTagGroupSearchState,
  getTagListCountLabel,
  isTagOptionSearchMatch,
} from './tags.js';
import {
  getDocumentActor,
  localize,
  normalizeLabel,
  normalizeHudElement,
  normalizePath,
  normalizeSearchText,
} from './utils.js';

const PICKER_TEMPLATE = 'modules/pf2e-tokener/templates/picker.hbs';

let activePicker = null;
let TokenPickerApplicationBase = null;
let TokenPickerApplicationClass = null;
let TokenPickerApplicationMixin = null;

export function updateOpenPanelsCanvasZoom() {}

export function openTokenPicker(tokenDocument) {
  const ApplicationV2 = resolveApplicationV2Class();
  const HandlebarsApplicationMixin = resolveHandlebarsApplicationMixin();
  if (!ApplicationV2 || !HandlebarsApplicationMixin) return openFallbackPicker();

  if (activePicker?.rendered) {
    activePicker.tokenDocument = tokenDocument;
    activePicker.bringToFront?.();
    activePicker.render?.({ parts: ['main'] });
    return activePicker;
  }

  const PickerApplication = getTokenPickerApplicationClass(
    ApplicationV2,
    HandlebarsApplicationMixin,
  );
  activePicker = new PickerApplication({ tokenDocument });
  return activePicker.render(true);
}

export function resolveApplicationV2Class() {
  return (
    globalThis.foundry?.applications?.api?.ApplicationV2 ??
    globalThis.foundry?.applications?.ApplicationV2 ??
    null
  );
}

export function resolveHandlebarsApplicationMixin() {
  return (
    globalThis.foundry?.applications?.api?.HandlebarsApplicationMixin ??
    globalThis.foundry?.applications?.HandlebarsApplicationMixin ??
    null
  );
}

export function getTokenPickerApplicationClass(
  ApplicationV2 = resolveApplicationV2Class(),
  HandlebarsApplicationMixin = resolveHandlebarsApplicationMixin(),
) {
  if (!ApplicationV2 || !HandlebarsApplicationMixin) return null;
  if (
    TokenPickerApplicationClass &&
    TokenPickerApplicationBase === ApplicationV2 &&
    TokenPickerApplicationMixin === HandlebarsApplicationMixin
  )
    return TokenPickerApplicationClass;

  const HandlebarsApplication = HandlebarsApplicationMixin(ApplicationV2);

  TokenPickerApplicationClass = class Pf2eTokenerApplication extends HandlebarsApplication {
    static DEFAULT_OPTIONS = {
      id: 'pf2e-tokener-picker',
      classes: ['pf2e-tokener-app'],
      tag: 'section',
      window: {
        icon: 'fas fa-images',
        resizable: true,
        title: 'PF2e Tokener',
      },
      position: {
        width: 420,
      },
    };

    static PARTS = {
      main: {
        template: PICKER_TEMPLATE,
      },
    };

    constructor({ tokenDocument } = {}) {
      super();
      this.tokenDocument = tokenDocument;
      this.searchQuery = '';
      this.selectedSourceIds = null;
      this.sourceMenuOpen = false;
      this.sourceFilterQuery = '';
      this.tagMenuOpen = false;
      this.activeTagGroup = null;
      this.tagFilterQuery = '';
      this.selectedTagIds = new Set();
      this._candidateMap = new Map();
      this._tagMap = new Map();
    }

    get title() {
      return localize('HUD.Tooltip', 'PF2e Tokener');
    }

    async _prepareContext(options) {
      const context = (await super._prepareContext?.(options)) ?? {};
      return {
        ...context,
        ...(await preparePickerContext(this)),
      };
    }

    async _onRender(context, options) {
      await super._onRender?.(context, options);
      activatePickerListeners(this);
    }

    _attachPartListeners(partId, html, options) {
      super._attachPartListeners?.(partId, html, options);
      if (partId === 'main') activatePickerListeners(this, html);
    }

    async _onClose(options) {
      if (activePicker === this) activePicker = null;
      await super._onClose?.(options);
    }
  };

  TokenPickerApplicationBase = ApplicationV2;
  TokenPickerApplicationMixin = HandlebarsApplicationMixin;
  return TokenPickerApplicationClass;
}

async function preparePickerContext(app) {
  const index = await ensureIndex();
  const sourceOptions = getPanelSourceFilterOptions(index);
  syncSelectedSources(app, sourceOptions);

  const sourceScopedCandidates = filterCandidatesBySources(index, app.selectedSourceIds, {
    emptyMeansAll: false,
  });
  const tagOptions = getTagFilterOptions(sourceScopedCandidates);
  syncSelectedTags(app, tagOptions);
  const allCandidates = getCandidatesForTokenDocument(
    index,
    app.tokenDocument,
    buildCandidateSearchQuery(app.searchQuery, app.selectedTagIds),
  );
  const candidates = filterCandidatesBySources(allCandidates, app.selectedSourceIds, {
    emptyMeansAll: false,
  });
  const sections = prepareCandidateSections(candidates, app);

  return {
    count: candidates.length,
    emptyMessage: localize('HUD.NoTokenArt', 'No token art found.'),
    hasResults: candidates.length > 0,
    searchPlaceholder: localize('HUD.SearchPlaceholder', 'Search tokens'),
    searchQuery: app.searchQuery,
    sections,
    source: prepareSourceFilterView(sourceOptions, app),
    tags: prepareTagFilterView(tagOptions, app),
  };
}

function activatePickerListeners(app, html) {
  const root =
    normalizeHudElement(html) ??
    normalizeHudElement(app.parts?.main) ??
    normalizeHudElement(app.element);
  if (!root) return;
  if (!isPickerRootBound(root)) {
    markPickerRootBound(root);
    root.addEventListener?.('input', (event) => handlePickerInput(app, event));
    root.addEventListener?.('click', (event) => void handlePickerClick(app, event));
    root.addEventListener?.('contextmenu', (event) => handlePickerContextMenu(app, event));
    root.addEventListener?.('keydown', (event) => handlePickerKeyDown(event));
    root.addEventListener?.('error', (event) => handlePickerImageError(app, event), true);
  }

  restorePickerFocus(app, root);
}

function isPickerRootBound(root) {
  return Boolean(root.dataset?.pf2eTokenerBound || root._pf2eTokenerBound);
}

function markPickerRootBound(root) {
  if (root.dataset) root.dataset.pf2eTokenerBound = 'true';
  else root._pf2eTokenerBound = true;
}

function handlePickerInput(app, event) {
  const target = event.target;
  if (matchesTarget(target, '.pf2e-tokener-search')) {
    app.searchQuery = target.value;
    app._focusSearch = true;
    renderMainPart(app);
    return;
  }

  if (matchesTarget(target, '.pf2e-tokener-source-search')) {
    app.sourceFilterQuery = target.value;
    app._focusSourceSearch = true;
    renderMainPart(app);
    return;
  }

  if (matchesTarget(target, '.pf2e-tokener-tag-search')) {
    app.tagFilterQuery = target.value;
    app._focusTagSearch = true;
    renderMainPart(app);
  }
}

async function handlePickerClick(app, event) {
  const target = event.target;
  const applyButton = closestTarget(target, '[data-apply-action]');
  if (applyButton) {
    event.preventDefault?.();
    event.stopPropagation?.();
    const card = closestTarget(applyButton, '.pf2e-tokener-card');
    const candidate = app._candidateMap.get(card?.dataset?.candidateId);
    if (candidate)
      await applyCandidateAction(
        applyButton.dataset.applyAction,
        candidate,
        app.tokenDocument,
        card,
      );
    return;
  }

  if (closestTarget(target, '.pf2e-tokener-source-button')) {
    event.preventDefault?.();
    event.stopPropagation?.();
    app.sourceMenuOpen = !app.sourceMenuOpen;
    app.tagMenuOpen = false;
    renderMainPart(app);
    return;
  }

  const sourceAction = closestTarget(target, '[data-source-action]');
  if (sourceAction) {
    event.preventDefault?.();
    if (sourceAction.dataset.sourceAction === 'all') {
      app.selectedSourceIds.clear();
      for (const option of app.sourceOptions ?? []) app.selectedSourceIds.add(option.id);
    } else if (sourceAction.dataset.sourceAction === 'clear') {
      app.selectedSourceIds.clear();
    }
    renderMainPart(app);
    return;
  }

  const sourceOption = closestTarget(target, '.pf2e-tokener-source-option[data-source-id]');
  if (sourceOption) {
    event.preventDefault?.();
    const sourceId = sourceOption.dataset.sourceId;
    if (app.selectedSourceIds.has(sourceId)) app.selectedSourceIds.delete(sourceId);
    else app.selectedSourceIds.add(sourceId);
    renderMainPart(app);
    return;
  }

  if (closestTarget(target, '.pf2e-tokener-tag-filter-button')) {
    event.preventDefault?.();
    event.stopPropagation?.();
    app.tagMenuOpen = !app.tagMenuOpen;
    app.sourceMenuOpen = false;
    renderMainPart(app);
    return;
  }

  if (closestTarget(target, '[data-tag-action="clear"]')) {
    event.preventDefault?.();
    app.selectedTagIds.clear();
    app.tagFilterQuery = '';
    renderMainPart(app);
    return;
  }

  const tagGroup = closestTarget(target, '[data-tag-group]');
  if (tagGroup) {
    event.preventDefault?.();
    app.activeTagGroup = tagGroup.dataset.tagGroup;
    renderMainPart(app);
    return;
  }

  const tagButton = closestTarget(target, '[data-tag-id]');
  if (tagButton) {
    event.preventDefault?.();
    const tag = app._tagMap.get(tagButton.dataset.tagId);
    if (!tag) return;
    if (app.selectedTagIds.has(tag.id)) app.selectedTagIds.delete(tag.id);
    else app.selectedTagIds.add(tag.id);
    renderMainPart(app);
    return;
  }

  const card = closestTarget(target, '.pf2e-tokener-card');
  if (card) toggleCardActions(card);
}

function handlePickerContextMenu(app, event) {
  const card = closestTarget(event.target, '.pf2e-tokener-card');
  if (!card) return;

  event.preventDefault?.();
  event.stopPropagation?.();
  const candidate = app._candidateMap.get(card.dataset?.candidateId);
  if (candidate) openImagePreview(candidate);
}

function handlePickerKeyDown(event) {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const card = matchesTarget(event.target, '.pf2e-tokener-card') ? event.target : null;
  if (!card) return;

  event.preventDefault?.();
  toggleCardActions(card);
}

function handlePickerImageError(app, event) {
  const image = matchesTarget(event.target, '.pf2e-tokener-card img') ? event.target : null;
  if (!image) return;

  const card = closestTarget(image, '.pf2e-tokener-card');
  const candidate = app._candidateMap.get(card?.dataset?.candidateId);
  if (!card || !candidate) return;

  const failedSources = getFailedPreviewSources(image);
  failedSources.add(normalizePath(image.dataset.previewSrc || image.getAttribute?.('src')).trim());
  const availableCandidate = removeFailedCandidateSources(candidate, failedSources);
  syncCardActions(card, availableCandidate);

  const nextPreviewSrc = getCandidatePreviewSources(availableCandidate)[0];
  image.dataset.failedSources = [...failedSources].join('\n');
  if (nextPreviewSrc) {
    image.dataset.previewSrc = nextPreviewSrc;
    image.src = nextPreviewSrc;
    return;
  }

  image.remove?.();
  card.classList.add('has-no-preview', 'is-unavailable');
}

function getFailedPreviewSources(image) {
  return new Set(
    String(image.dataset.failedSources ?? '')
      .split('\n')
      .filter(Boolean),
  );
}

function removeFailedCandidateSources(candidate, failedSources) {
  return {
    ...candidate,
    portraitSrc: failedSources.has(normalizePath(candidate?.portraitSrc).trim())
      ? ''
      : candidate?.portraitSrc,
    subjectSrc: failedSources.has(normalizePath(candidate?.subjectSrc).trim())
      ? ''
      : candidate?.subjectSrc,
    tokenSrc: failedSources.has(normalizePath(candidate?.tokenSrc).trim())
      ? ''
      : candidate?.tokenSrc,
  };
}

function syncCardActions(card, candidate) {
  const availableActions = new Set(
    getApplyActionsForCandidate(candidate).map((option) => option.action),
  );
  card.querySelectorAll?.('[data-apply-action]').forEach((button) => {
    if (!availableActions.has(button.dataset.applyAction)) button.remove?.();
  });

  if (availableActions.size === 0) {
    card.querySelector?.('.pf2e-tokener-actions')?.remove?.();
    card.classList.add('is-unavailable');
  }
}

function restorePickerFocus(app, root) {
  if (app._focusSearch) {
    app._focusSearch = false;
    const search = root.querySelector('.pf2e-tokener-search');
    search?.focus?.();
    search?.setSelectionRange?.(search.value.length, search.value.length);
  }

  if (app._focusSourceSearch) {
    app._focusSourceSearch = false;
    const search = root.querySelector('.pf2e-tokener-source-search');
    search?.focus?.();
    search?.setSelectionRange?.(search.value.length, search.value.length);
  }

  if (app._focusTagSearch) {
    app._focusTagSearch = false;
    const search = root.querySelector('.pf2e-tokener-tag-search');
    search?.focus?.();
    search?.setSelectionRange?.(search.value.length, search.value.length);
  }
}

function matchesTarget(target, selector) {
  return Boolean(target?.matches?.(selector));
}

function closestTarget(target, selector) {
  return target?.closest?.(selector) ?? (matchesTarget(target, selector) ? target : null);
}

function renderMainPart(app) {
  app.render?.({ parts: ['main'] });
}

export function buildCandidateSearchQuery(searchQuery, selectedTagIds = []) {
  return [String(searchQuery ?? '').trim(), ...selectedTagIds].filter(Boolean).join(' ');
}

function syncSelectedSources(app, sourceOptions) {
  app.sourceOptions = sourceOptions;
  const validIds = new Set(sourceOptions.map((option) => option.id));
  if (!app.selectedSourceIds) {
    app.selectedSourceIds = new Set(validIds);
    return;
  }
  for (const id of [...app.selectedSourceIds]) {
    if (!validIds.has(id)) app.selectedSourceIds.delete(id);
  }
}

function syncSelectedTags(app, tagOptions) {
  const validIds = new Set(tagOptions.map((option) => option.id));
  if (!app.selectedTagIds) {
    app.selectedTagIds = new Set();
    return;
  }
  for (const id of [...app.selectedTagIds]) {
    if (!validIds.has(id)) app.selectedTagIds.delete(id);
  }
}

function prepareSourceFilterView(options, app) {
  const selected = app.selectedSourceIds ?? new Set();
  const visibleOptions = filterSourceOptionsByQuery(options, app.sourceFilterQuery);
  return {
    className: `pf2e-tokener-source-filter${app.sourceMenuOpen ? ' is-open' : ''}`,
    controls: options.length > 2,
    clearLabel: localize('HUD.ClearSources', 'Clear all'),
    expanded: app.sourceMenuOpen ? 'true' : 'false',
    filterQuery: app.sourceFilterQuery,
    isOpen: app.sourceMenuOpen,
    label: getSourceFilterLabel(options, selected, { emptyMeansAll: false }),
    menuClassName: `pf2e-tokener-source-menu${app.sourceMenuOpen ? ' is-open' : ''}`,
    options: visibleOptions.map((option) => {
      const isSelected = selected.has(option.id);
      return {
        ...option,
        ariaPressed: isSelected ? 'true' : 'false',
        className: `pf2e-tokener-source-option${isSelected ? ' is-selected' : ''}`,
        selected: isSelected,
        title: option.title,
      };
    }),
    searchPlaceholder: localize('HUD.SourceSearchPlaceholder', 'Search sources'),
    selectAllLabel: localize('HUD.SelectAllSources', 'Select all'),
  };
}

function prepareTagFilterView(options, app) {
  app._tagMap = new Map(options.map((option) => [option.id, option]));
  app._tagOptions = options;
  const preparedOptions = options.map((option) => ({
    ...option,
    active: app.selectedTagIds.has(option.id),
    groupLabel: normalizeLabel(option.group),
  }));
  const activeTags = preparedOptions.filter((option) => option.active);
  const groups = groupTagOptions(preparedOptions);
  const validGroupIds = new Set(groups.map((group) => group.id));
  if (!app.activeTagGroup || !validGroupIds.has(app.activeTagGroup)) {
    app.activeTagGroup = activeTags[0]?.group ?? groups[0]?.id ?? null;
  }
  const activeGroup = groups.find((group) => group.id === app.activeTagGroup) ?? groups[0] ?? null;
  const tagFilter = normalizeSearchText(app.tagFilterQuery);
  const visibleOptions = (activeGroup?.options ?? []).filter((option) =>
    isTagOptionSearchMatch(option, tagFilter),
  );
  const activeGroupTotal = activeGroup?.options.length ?? 0;

  return {
    active: activeTags,
    buttonLabel: activeTags.length
      ? `${localize('HUD.Tags', 'Tags')} (${activeTags.length})`
      : localize('HUD.Tags', 'Tags'),
    className: [
      'pf2e-tokener-tag-filter',
      app.tagMenuOpen ? 'is-open' : '',
      options.length ? '' : 'is-empty',
    ]
      .filter(Boolean)
      .join(' '),
    activeGroupLabel: activeGroup?.label ?? '',
    clearLabel: localize('HUD.ClearTags', 'Clear tags'),
    countLabel: getTagListCountLabel(visibleOptions.length, activeGroupTotal, Boolean(tagFilter)),
    expanded: app.tagMenuOpen ? 'true' : 'false',
    filterQuery: app.tagFilterQuery,
    groups: groups.map((group) => {
      const searchState = getTagGroupSearchState(group, tagFilter);
      return {
        ...group,
        ...searchState,
        ariaPressed: group.id === activeGroup?.id ? 'true' : 'false',
        className: [
          'pf2e-tokener-tag-group-button',
          group.id === activeGroup?.id ? 'is-active' : '',
          searchState.isFiltering && searchState.hasMatches ? 'is-match' : '',
          searchState.isFiltering && !searchState.hasMatches ? 'is-filtered-out' : '',
        ]
          .filter(Boolean)
          .join(' '),
        displayCount: searchState.isFiltering ? searchState.matchedOptionCount : group.count,
      };
    }),
    hasActive: activeTags.length > 0,
    hasOptions: options.length > 0,
    isOpen: app.tagMenuOpen,
    searchPlaceholder: localize('HUD.TagSearchPlaceholder', 'Search tags'),
    totalCount: activeGroupTotal,
    visibleCount: visibleOptions.length,
    visibleOptions: visibleOptions.map((option) => ({
      ...option,
      ariaPressed: option.active ? 'true' : 'false',
      className: `pf2e-tokener-tag-option${option.active ? ' is-active' : ''}`,
    })),
  };
}

function prepareCandidateSections(candidates, app) {
  app._candidateMap = new Map();
  const pinned = candidates.filter(
    (candidate) => candidate.matchType === 'exact' || candidate.matchType === 'name',
  );
  const broad = candidates.filter(
    (candidate) => candidate.matchType !== 'exact' && candidate.matchType !== 'name',
  );
  return [
    {
      candidates: pinned.map((candidate, index) =>
        prepareCandidateView(candidate, app, `pinned-${index}`),
      ),
      title: localize('HUD.BestMatches', 'Best matches'),
    },
    {
      candidates: broad.map((candidate, index) =>
        prepareCandidateView(candidate, app, `broad-${index}`),
      ),
      title: localize('HUD.SearchResults', 'Search results'),
    },
  ].filter((section) => section.candidates.length);
}

function prepareCandidateView(candidate, app, viewId) {
  app._candidateMap.set(viewId, candidate);
  const actions = getApplyActionsForCandidate(candidate);
  const previewSrc = getCandidatePreviewSrc(candidate);
  const hasPreview = Boolean(previewSrc);
  const isUnavailable = actions.length === 0;
  return {
    ...candidate,
    actions,
    className: [
      'pf2e-tokener-card',
      isCurrentTokenArt(candidate, app.tokenDocument) ? 'is-current' : '',
      hasPreview ? '' : 'has-no-preview',
      isUnavailable ? 'is-unavailable' : '',
    ]
      .filter(Boolean)
      .join(' '),
    current: isCurrentTokenArt(candidate, app.tokenDocument),
    currentLabel: localize('HUD.Current', 'Current'),
    hasActions: actions.length > 0,
    hasMatchedTags: Array.isArray(candidate.matchedTags) && candidate.matchedTags.length > 0,
    hasPreview: hasPreview,
    previewSrc: previewSrc,
    cardTooltip: getCandidateCardTooltip(candidate),
    tabIndex: isUnavailable ? '-1' : '0',
    viewId,
  };
}

function groupTagOptions(options) {
  const groups = [];
  let current = null;
  for (const option of options) {
    if (option.group !== current?.name) {
      current = {
        count: 0,
        id: option.group,
        label: option.groupLabel,
        name: option.group,
        options: [],
      };
      groups.push(current);
    }
    current.count += option.count;
    current.options.push(option);
  }
  return groups;
}

function getCandidateCardTooltip(candidate) {
  return [candidate.label, candidate.moduleTitle].filter(Boolean).join(' | ');
}

function openFallbackPicker() {
  globalThis.ui?.notifications?.warn?.(
    localize('Notifications.AppV2Unavailable', 'PF2e Tokener requires Foundry ApplicationV2.'),
  );
  return null;
}

function isCurrentTokenArt(candidate, tokenDocument) {
  const current = normalizePath(
    tokenDocument?.texture?.src ?? tokenDocument?._source?.texture?.src ?? '',
  );
  return Boolean(current && (current === candidate.tokenSrc || current === candidate.subjectSrc));
}

function toggleCardActions(card) {
  if (card.classList.contains('is-unavailable')) return;

  const grid = card.closest('.pf2e-tokener-grid');
  grid?.querySelectorAll('.pf2e-tokener-card.is-open').forEach((openCard) => {
    if (openCard !== card) openCard.classList.remove('is-open');
  });
  card.classList.toggle('is-open');
}

async function applyCandidateAction(action, candidate, tokenDocument, card) {
  const actor = getDocumentActor(tokenDocument);
  const availableAction = getApplyActionsForCandidate(candidate).some(
    (option) => option.action === action,
  );
  if (!availableAction) return;

  const targets = getApplyTargets(action);
  card?.classList.add('is-applying');

  try {
    if (targets.token) {
      await tokenDocument.update(buildTokenUpdate(candidate));
    }

    if (targets.actor && actor) {
      await actor.update(buildActorUpdate(candidate));
    }

    if (targets.portrait && actor) {
      await actor.update({ img: candidate.portraitSrc || candidate.tokenSrc });
    }

    globalThis.ui?.notifications?.info?.(
      localize('Notifications.Applied', 'PF2e Tokener: token art applied.'),
    );
  } catch (error) {
    console.error(`${MODULE_ID} | Failed to apply token art`, error);
    globalThis.ui?.notifications?.error?.(
      localize('Notifications.ApplyFailed', 'PF2e Tokener: failed to apply token art.'),
    );
  } finally {
    card?.classList.remove('is-applying');
  }
}
