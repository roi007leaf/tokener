import { DEFAULT_LIMIT, MODULE_ID } from './constants.js';
import {
  buildActorUpdate,
  buildRevertSnapshot,
  buildTokenUpdate,
  getApplyActionsForCandidate,
  getApplyTargets,
  getCandidatePreviewSrc,
  getCandidatePreviewSources,
  getLastRevertData,
  hasRevertTargets,
  REVERT_FLAG_PATH,
  revertLastTokenerChange,
} from './actions.js';
import { getCandidatesForTokenDocument, searchCandidates } from './candidates.js';
import {
  filterFavoriteCandidates,
  getFavoriteIds,
  isFavoriteCandidate,
  toggleFavoriteCandidate,
} from './favorites.js';
import { ensureIndex } from './foundry-index.js';
import { setCustomFolderImageTags } from './custom-folders.js';
import { openImagePreview } from './preview.js';
import {
  filterCandidatesBySources,
  filterSourceOptionsByQuery,
  getPanelSourceFilterOptions,
  getSourceFilterLabel,
} from './sources.js';
import { getTagFilterOptions, getTagGroupSearchState, isTagOptionSearchMatch } from './tags.js';
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
        width: 720,
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
      this.selectedExcludedTagIds = new Set();
      this.favoritesOnly = false;
      this.resultLimit = DEFAULT_LIMIT;
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
  const favoriteIds = getFavoriteIds();
  const candidatePool = getPickerCandidatePool(index, app, { favoriteIds, sourceOptions });
  const sections = prepareCandidateSections(candidatePool.candidates, app, favoriteIds);

  return {
    count: candidatePool.countLabel,
    emptyMessage: localize('HUD.NoTokenArt', 'No token art found.'),
    hasResults: candidatePool.candidates.length > 0,
    paging: preparePagingView(candidatePool),
    searchPlaceholder: localize('HUD.SearchPlaceholder', 'Search tokens'),
    searchQuery: app.searchQuery,
    sections,
    favorites: prepareFavoritesView(favoriteIds, app),
    revert: prepareRevertView(app.tokenDocument),
    source: prepareSourceFilterView(sourceOptions, app),
    tags: prepareTagFilterView(tagOptions, app),
  };
}

export function getPickerCandidatePool(
  index,
  app,
  { favoriteIds = new Set(), sourceOptions = getPanelSourceFilterOptions(index) } = {},
) {
  const resultLimit = Math.max(DEFAULT_LIMIT, Number(app?.resultLimit) || DEFAULT_LIMIT);
  const selectedSourceIds =
    app?.selectedSourceIds ?? new Set(sourceOptions.map((option) => option.id));
  const selectedTagIds = app?.selectedTagIds ?? new Set();
  const excludedTagIds = app?.selectedExcludedTagIds ?? app?.excludedTagIds ?? new Set();
  const query = buildCandidateSearchQuery(app?.searchQuery, selectedTagIds, excludedTagIds);
  const browseMode = shouldBrowseAllResults(app, sourceOptions);
  const allCandidates = browseMode
    ? searchCandidates(index, query, { limit: Number.POSITIVE_INFINITY })
    : getCandidatesForTokenDocument(index, app?.tokenDocument, query, {
        limit: Number.POSITIVE_INFINITY,
      });
  const sourceFilteredCandidates = filterCandidatesBySources(allCandidates, selectedSourceIds, {
    emptyMeansAll: false,
  });
  const filteredCandidates = filterFavoriteCandidates(
    sourceFilteredCandidates,
    favoriteIds,
    Boolean(app?.favoritesOnly),
  );
  const candidates = filteredCandidates.slice(0, resultLimit);

  return {
    browseMode,
    candidates,
    countLabel:
      candidates.length < filteredCandidates.length
        ? `${candidates.length} / ${filteredCandidates.length}`
        : String(filteredCandidates.length),
    hasMore: candidates.length < filteredCandidates.length,
    limit: resultLimit,
    shown: candidates.length,
    total: filteredCandidates.length,
  };
}

function shouldBrowseAllResults(app, sourceOptions) {
  const hasSearch = Boolean(String(app?.searchQuery ?? '').trim());
  if (hasSearch) return false;
  return (
    isSourceFilterChanged(app?.selectedSourceIds, sourceOptions) ||
    collectionSize(app?.selectedTagIds) > 0 ||
    collectionSize(app?.selectedExcludedTagIds ?? app?.excludedTagIds) > 0 ||
    Boolean(app?.favoritesOnly)
  );
}

function isSourceFilterChanged(selectedSourceIds, sourceOptions) {
  if (!selectedSourceIds) return false;
  const selected = new Set(selectedSourceIds);
  if (selected.size !== sourceOptions.length) return true;
  return sourceOptions.some((option) => !selected.has(option.id));
}

function collectionSize(collection) {
  return collection?.size ?? collection?.length ?? 0;
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
    resetResultLimit(app);
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
  if (closestTarget(target, '[data-revert-action="last"]')) {
    event.preventDefault?.();
    await revertLastChange(app);
    return;
  }

  if (closestTarget(target, '[data-favorites-filter="toggle"]')) {
    event.preventDefault?.();
    event.stopPropagation?.();
    app.favoritesOnly = !app.favoritesOnly;
    resetResultLimit(app);
    renderMainPart(app);
    return;
  }

  const favoriteButton = closestTarget(target, '[data-favorite-candidate-id]');
  if (favoriteButton) {
    event.preventDefault?.();
    event.stopPropagation?.();
    const candidate = app._candidateMap.get(favoriteButton.dataset.favoriteCandidateId);
    if (candidate) await toggleFavoriteCandidate(candidate);
    renderMainPart(app);
    return;
  }

  const customImageTagsButton = closestTarget(target, '[data-custom-image-tags-candidate-id]');
  if (customImageTagsButton) {
    event.preventDefault?.();
    event.stopPropagation?.();
    const candidate = app._candidateMap.get(
      customImageTagsButton.dataset.customImageTagsCandidateId,
    );
    if (candidate) await openCustomImageTagsDialog(app, candidate);
    return;
  }

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

  if (closestTarget(target, '[data-results-action="more"]')) {
    event.preventDefault?.();
    app.resultLimit = (Number(app.resultLimit) || DEFAULT_LIMIT) + DEFAULT_LIMIT;
    renderMainPart(app);
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
    resetResultLimit(app);
    renderMainPart(app);
    return;
  }

  const sourceOption = closestTarget(target, '.pf2e-tokener-source-option[data-source-id]');
  if (sourceOption) {
    event.preventDefault?.();
    const sourceId = sourceOption.dataset.sourceId;
    if (app.selectedSourceIds.has(sourceId)) app.selectedSourceIds.delete(sourceId);
    else app.selectedSourceIds.add(sourceId);
    resetResultLimit(app);
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
    app.selectedExcludedTagIds.clear();
    app.tagFilterQuery = '';
    resetResultLimit(app);
    renderMainPart(app);
    return;
  }

  const tagExcludeButton = closestTarget(target, '[data-tag-exclude-id]');
  if (tagExcludeButton) {
    event.preventDefault?.();
    const tag = app._tagMap.get(tagExcludeButton.dataset.tagExcludeId);
    if (!tag) return;
    toggleExcludedTag(app, tag.id);
    resetResultLimit(app);
    renderMainPart(app);
    return;
  }

  const tagButton = closestTarget(target, '[data-tag-id]');
  if (tagButton) {
    event.preventDefault?.();
    const tag = app._tagMap.get(tagButton.dataset.tagId);
    if (!tag) return;
    toggleIncludedTag(app, tag.id);
    resetResultLimit(app);
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
  app?.render?.({ parts: ['main'] });
}

function resetResultLimit(app) {
  app.resultLimit = DEFAULT_LIMIT;
}

function toggleIncludedTag(app, tagId) {
  if (app.selectedTagIds.has(tagId)) {
    app.selectedTagIds.delete(tagId);
    return;
  }
  app.selectedExcludedTagIds.delete(tagId);
  app.selectedTagIds.add(tagId);
}

function toggleExcludedTag(app, tagId) {
  if (app.selectedExcludedTagIds.has(tagId)) {
    app.selectedExcludedTagIds.delete(tagId);
    return;
  }
  app.selectedTagIds.delete(tagId);
  app.selectedExcludedTagIds.add(tagId);
}

export function buildCandidateSearchQuery(searchQuery, selectedTagIds = [], excludedTagIds = []) {
  return [
    String(searchQuery ?? '').trim(),
    ...selectedTagIds,
    ...[...excludedTagIds].map((tagId) => `!${tagId}`),
  ]
    .filter(Boolean)
    .join(' ');
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
  }
  if (!app.selectedExcludedTagIds) app.selectedExcludedTagIds = new Set();
  for (const id of [...app.selectedTagIds]) {
    if (!validIds.has(id)) app.selectedTagIds.delete(id);
  }
  for (const id of [...app.selectedExcludedTagIds]) {
    if (!validIds.has(id)) app.selectedExcludedTagIds.delete(id);
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
    excluded: app.selectedExcludedTagIds.has(option.id),
    included: app.selectedTagIds.has(option.id),
    groupLabel: normalizeLabel(option.group),
  }));
  const activeIncluded = preparedOptions.filter((option) => option.included);
  const activeExcluded = preparedOptions.filter((option) => option.excluded);
  const groups = groupTagOptions(preparedOptions);
  const tagFilter = normalizeSearchText(app.tagFilterQuery);
  const activeCount = activeIncluded.length + activeExcluded.length;

  return {
    activeExcluded: activeExcluded.map((option) => prepareActiveTagView(option, 'excluded')),
    activeIncluded: activeIncluded.map((option) => prepareActiveTagView(option, 'included')),
    buttonLabel: activeCount
      ? `${localize('HUD.Tags', 'Tags')} (${activeCount})`
      : localize('HUD.Tags', 'Tags'),
    className: [options.length ? '' : 'is-empty'].filter(Boolean).join(' '),
    clearLabel: localize('HUD.ClearTags', 'Clear tags'),
    filterQuery: app.tagFilterQuery,
    groups: groups.map((group) => {
      const searchState = getTagGroupSearchState(group, tagFilter);
      const visibleOptions = group.options.filter((option) =>
        isTagOptionSearchMatch(option, tagFilter),
      );
      return {
        ...group,
        ...searchState,
        className: [
          searchState.isFiltering && searchState.hasMatches ? 'is-match' : '',
          searchState.isFiltering && !searchState.hasMatches ? 'is-filtered-out' : '',
        ]
          .filter(Boolean)
          .join(' '),
        displayCount: searchState.isFiltering ? searchState.matchedOptionCount : group.count,
        open: !searchState.isFiltering || searchState.hasMatches,
        visibleOptions: visibleOptions.map(prepareTagOptionView),
      };
    }),
    hasActive: activeCount > 0,
    hasOptions: options.length > 0,
    searchPlaceholder: localize('HUD.TagSearchPlaceholder', 'Search tags'),
    title: localize('HUD.Filters', 'Filters'),
  };
}

function prepareActiveTagView(option, mode) {
  return {
    ...option,
    className: `pf2e-tokener-active-tag is-${mode}`,
    prefix: mode === 'excluded' ? '-' : '+',
  };
}

function prepareTagOptionView(option) {
  return {
    ...option,
    excludeAriaPressed: option.excluded ? 'true' : 'false',
    excludeClassName: `pf2e-tokener-tag-exclude${option.excluded ? ' is-excluded' : ''}`,
    excludeTooltip: localize('HUD.ExcludeTag', 'Exclude tag'),
    includeAriaPressed: option.included ? 'true' : 'false',
    includeClassName: [
      option.included ? 'is-included' : '',
      option.excluded ? 'is-excluded is-muted' : '',
    ]
      .filter(Boolean)
      .join(' '),
    includeTooltip: localize('HUD.IncludeTag', 'Include tag'),
  };
}

function prepareRevertView(tokenDocument) {
  const snapshot = getLastRevertData(tokenDocument);
  const available = hasRevertTargets(snapshot);
  return {
    available,
    buttonLabel: localize('HUD.RevertLast', 'Revert last'),
    detail: available ? getRevertDetail(snapshot) : '',
    tooltip: localize('HUD.RevertTooltip', 'Restore the art from before the last Tokener change.'),
  };
}

function prepareFavoritesView(favoriteIds, app) {
  const count = favoriteIds.size;
  return {
    active: Boolean(app.favoritesOnly),
    ariaPressed: app.favoritesOnly ? 'true' : 'false',
    buttonLabel: count
      ? `${localize('HUD.Favorites', 'Favorites')} (${count})`
      : localize('HUD.Favorites', 'Favorites'),
    className: [
      'pf2e-tokener-favorites-filter-button',
      app.favoritesOnly ? 'is-active' : '',
      count ? '' : 'is-empty',
    ]
      .filter(Boolean)
      .join(' '),
    tooltip: localize('HUD.FavoritesTooltip', 'Show only favorite token art.'),
  };
}

function preparePagingView(candidatePool) {
  return {
    hasMore: candidatePool.hasMore,
    showMoreLabel: localize('HUD.ShowMore', 'Show more'),
  };
}

function prepareCandidateSections(candidates, app, favoriteIds = new Set()) {
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
        prepareCandidateView(candidate, app, `pinned-${index}`, favoriteIds),
      ),
      title: localize('HUD.BestMatches', 'Best matches'),
    },
    {
      candidates: broad.map((candidate, index) =>
        prepareCandidateView(candidate, app, `broad-${index}`, favoriteIds),
      ),
      title: localize('HUD.SearchResults', 'Search results'),
    },
  ].filter((section) => section.candidates.length);
}

function prepareCandidateView(candidate, app, viewId, favoriteIds = new Set()) {
  app._candidateMap.set(viewId, candidate);
  const actions = getApplyActionsForCandidate(candidate);
  const previewSrc = getCandidatePreviewSrc(candidate);
  const hasPreview = Boolean(previewSrc);
  const isUnavailable = actions.length === 0;
  const favorite = isFavoriteCandidate(candidate, favoriteIds);
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
    favoriteAriaPressed: favorite ? 'true' : 'false',
    favoriteClassName: `pf2e-tokener-favorite-toggle${favorite ? ' is-active' : ''}`,
    favoriteIconClass: favorite ? 'fas fa-star' : 'far fa-star',
    favoriteTooltip: favorite
      ? localize('HUD.RemoveFavorite', 'Remove favorite')
      : localize('HUD.AddFavorite', 'Add favorite'),
    hasMatchedTags: Array.isArray(candidate.matchedTags) && candidate.matchedTags.length > 0,
    hasPreview: hasPreview,
    previewSrc: previewSrc,
    cardTooltip: getCandidateCardTooltip(candidate),
    customImageTagsTooltip: localize('HUD.EditCustomImageTags', 'Edit image tags'),
    tabIndex: isUnavailable ? '-1' : '0',
    viewId,
  };
}

async function openCustomImageTagsDialog(app, candidate) {
  if (!candidate?.customImageTagsEditable || !candidate.customImagePath) return;
  const DialogV2 = resolveDialogV2Class();
  if (!DialogV2?.input) return;

  const tagOptions = getTagFilterOptions(await ensureIndex());
  const content = renderCustomImageTagsContent(candidate, tagOptions);
  await DialogV2.input({
    window: {
      icon: 'fas fa-tags',
      title: localize('HUD.EditCustomImageTags', 'Edit image tags'),
    },
    position: {
      width: 560,
    },
    content,
    render: (_event, dialog) => activateCustomImageTagsDialog(dialog),
    ok: {
      label: localize('HUD.SaveImageTags', 'Save tags'),
      icon: 'fas fa-save',
      callback: async (_event, button) => {
        const tags = tagIdsToTags(getCheckedImageTagIds(button.form));
        await setCustomFolderImageTags(candidate.customImagePath, tags);
        await globalThis.game?.modules?.get?.(MODULE_ID)?.api?.rebuildIndex?.();
        renderMainPart(app);
        return tags;
      },
    },
  });
}

function activateCustomImageTagsDialog(dialog) {
  const root = normalizeHudElement(dialog?.element);
  if (!root || root.dataset.pf2eTokenerCustomImageTagsBound) return;
  root.dataset.pf2eTokenerCustomImageTagsBound = 'true';

  root.addEventListener?.('change', (event) => {
    if (!matchesTarget(event.target, '[name="imageTagIds"]')) return;
    updateCustomImageSelectedTags(root);
  });

  root.addEventListener?.('click', (event) => {
    const chip = closestTarget(event.target, '[data-custom-image-tag-remove]');
    if (!chip) return;

    event.preventDefault?.();
    const input = root.querySelector?.(
      `[name="imageTagIds"][value="${cssEscape(chip.dataset.customImageTagRemove)}"]`,
    );
    if (input) input.checked = false;
    updateCustomImageSelectedTags(root);
  });
}

function resolveDialogV2Class() {
  return (
    globalThis.foundry?.applications?.api?.DialogV2 ??
    globalThis.foundry?.applications?.DialogV2 ??
    null
  );
}

function renderCustomImageTagsContent(candidate, tagOptions) {
  const selected = new Set(tagsToIds(candidate.customImageTags));
  const preparedOptions = tagOptions.map((option) => ({
    ...option,
    groupLabel: normalizeLabel(option.group),
    selected: selected.has(option.id),
  }));
  const groups = groupTagOptions(preparedOptions);
  const selectedOptions = preparedOptions.filter((option) => option.selected);

  return `<div class="pf2e-tokener-custom-image-tags">
    <p class="notes">${escapeHtml(
      localize('HUD.CustomImageTagsHint', 'Choose tags to add to this custom folder image.'),
    )}</p>
    <div class="pf2e-tokener-custom-image-tags-selected">
      <div class="pf2e-tokener-custom-image-tags-selected-title">${escapeHtml(
        localize('HUD.SelectedImageTags', 'Selected tags'),
      )}</div>
      <div class="pf2e-tokener-custom-image-tags-chips" data-custom-image-tags-selected>
        ${renderCustomImageSelectedTags(selectedOptions)}
      </div>
    </div>
    <div class="pf2e-tokener-custom-image-tags-groups">
      ${groups
        .map(
          (group) => `<details class="pf2e-tokener-custom-image-tags-group" open>
            <summary>${escapeHtml(group.label)}</summary>
            <div class="pf2e-tokener-custom-image-tags-options">
              ${group.options
                .map(
                  (option) => `<label>
                    <input
                      type="checkbox"
                      name="imageTagIds"
                      value="${escapeHtml(option.id)}"
                      data-group="${escapeHtml(option.group)}"
                      data-label="${escapeHtml(option.label)}"
                      ${option.selected ? 'checked' : ''}
                    >
                    <span>${escapeHtml(option.label)}</span>
                  </label>`,
                )
                .join('')}
            </div>
          </details>`,
        )
        .join('')}
    </div>
  </div>`;
}

function updateCustomImageSelectedTags(root) {
  const target = root.querySelector?.('[data-custom-image-tags-selected]');
  if (!target) return;

  const selectedOptions = [...(root.querySelectorAll?.('[name="imageTagIds"]:checked') ?? [])].map(
    (input) => ({
      id: input.value,
      label: input.dataset.label || input.value,
      group: input.dataset.group || '',
    }),
  );
  target.innerHTML = renderCustomImageSelectedTags(selectedOptions);
}

function renderCustomImageSelectedTags(options) {
  if (!options.length) {
    return `<span class="pf2e-tokener-custom-image-tags-empty">${escapeHtml(
      localize('HUD.NoSelectedImageTags', 'No image tags selected.'),
    )}</span>`;
  }

  return options
    .map(
      (option) => `<button
        class="pf2e-tokener-custom-image-tags-chip"
        type="button"
        data-custom-image-tag-remove="${escapeHtml(option.id)}"
        data-tooltip="${escapeHtml(option.group)}: ${escapeHtml(option.label)}"
        data-tooltip-direction="UP"
      >
        <span>${escapeHtml(option.label)}</span>
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>`,
    )
    .join('');
}

function getCheckedImageTagIds(form) {
  if (!form || typeof FormData === 'undefined') return [];
  return new FormData(form).getAll('imageTagIds');
}

function tagIdsToTags(tagIds) {
  const ids = Array.isArray(tagIds) ? tagIds : tagIds ? [tagIds] : [];
  const tags = {};
  for (const id of ids) {
    const [group, ...rest] = String(id ?? '').split(':');
    const value = rest.join(':');
    if (!group || !value) continue;
    tags[group] = [...new Set([...(tags[group] ?? []), value])];
  }
  return Object.keys(tags).length ? tags : undefined;
}

function tagsToIds(tags) {
  if (!tags || typeof tags !== 'object') return [];
  return Object.entries(tags).flatMap(([group, values]) =>
    (Array.isArray(values) ? values : [values])
      .map((value) => normalizeSearchText(value))
      .filter(Boolean)
      .map((value) => `${normalizeSearchText(group)}:${value}`),
  );
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function cssEscape(value) {
  const escape = globalThis.CSS?.escape;
  if (typeof escape === 'function') return escape(String(value ?? ''));
  return String(value ?? '')
    .replaceAll('\\', '\\\\')
    .replaceAll('"', '\\"');
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
  const revertSnapshot = buildRevertSnapshot({ action, candidate, tokenDocument });
  card?.classList.add('is-applying');

  try {
    if (targets.token) {
      await tokenDocument.update({
        ...buildTokenUpdate(candidate),
        [REVERT_FLAG_PATH]: revertSnapshot,
      });
    }

    if (targets.actor && actor) {
      await actor.update({
        ...buildActorUpdate(candidate),
        [REVERT_FLAG_PATH]: revertSnapshot,
      });
    }

    if (targets.portrait && actor) {
      await actor.update({
        img: candidate.portraitSrc || candidate.tokenSrc,
        [REVERT_FLAG_PATH]: revertSnapshot,
      });
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
    renderMainPart(activePicker);
  }
}

async function revertLastChange(app) {
  const tokenDocument = app.tokenDocument;

  try {
    const reverted = await revertLastTokenerChange(tokenDocument);
    if (!reverted) return;

    globalThis.ui?.notifications?.info?.(
      localize('Notifications.Reverted', 'PF2e Tokener: previous art restored.'),
    );
  } catch (error) {
    console.error(`${MODULE_ID} | Failed to revert token art`, error);
    globalThis.ui?.notifications?.error?.(
      localize('Notifications.RevertFailed', 'PF2e Tokener: failed to restore previous art.'),
    );
  } finally {
    renderMainPart(app);
  }
}

function getRevertDetail(snapshot) {
  return [normalizeLabel(snapshot?.action), snapshot?.label].filter(Boolean).join(': ');
}
