import { MODULE_ID } from './constants.js';
import { registerFavoriteSettings } from './favorites.js';
import { installApi, rebuildIndex, state } from './foundry-index.js';
import { renderTokenHud, updateOpenPanelsCanvasZoom } from './hud.js';

export { MODULE_ID } from './constants.js';
export {
  buildActorUpdate,
  buildActorRevertUpdate,
  buildRevertSnapshot,
  buildTokenUpdate,
  buildTokenRevertUpdate,
  getApplyActions,
  getApplyActionsForCandidate,
  getApplyTargets,
  getCandidatePreviewSrc,
  getCandidatePreviewSources,
  getLastRevertData,
  hasRevertTargets,
  REVERT_FLAG_PATH,
  revertLastTokenerChange,
} from './actions.js';
export {
  createDatasheetCandidates,
  createFolderCandidates,
  createMappedCandidates,
  dedupeCandidates,
  getCandidatesForTokenDocument,
  searchCandidates,
} from './candidates.js';
export {
  filterFavoriteCandidates,
  getFavoriteIds,
  isFavoriteCandidate,
  registerFavoriteSettings,
  toggleFavoriteCandidate,
} from './favorites.js';
export { ensureIndex, rebuildIndex, state } from './foundry-index.js';
export { renderTokenHud, updateOpenPanelsCanvasZoom } from './hud.js';
export {
  buildCandidateSearchQuery,
  getTokenPickerApplicationClass,
  getPickerCandidatePool,
  openTokenPicker,
  resolveApplicationV2Class,
  resolveHandlebarsApplicationMixin,
} from './picker-app.js';
export { getCandidatePreviewTagGroups, getImagePreviewItems, openImagePreview } from './preview.js';
export {
  filterSourceOptionsByQuery,
  filterCandidatesBySources,
  getPanelSourceFilterOptions,
  getSourceFilterLabel,
  getSourceFilterOptions,
} from './sources.js';
export {
  clearTagFilterTerms,
  getTagGroupSearchState,
  getTagFilterOptions,
  getTagListCountLabel,
  isTagFilterTermActive,
  isTagOptionSearchMatch,
  toggleTagFilterTerm,
} from './tags.js';
export {
  getCanvasZoom,
  getDocumentActor,
  getPanelZoomData,
  localize,
  normalizeHudElement,
  setTextTooltip,
} from './utils.js';

function registerFoundryIntegration() {
  const hooks = globalThis.Hooks;
  if (!hooks || typeof hooks.once !== 'function') return;

  hooks.once('init', () => {
    registerFavoriteSettings();
  });

  hooks.once('ready', async () => {
    installApi();
    if (globalThis.game?.system?.id !== 'pf2e') return;
    await rebuildIndex();
    hooks.on('renderTokenHUD', renderTokenHud);
    hooks.on('canvasPan', updateOpenPanelsCanvasZoom);
    console.log(`${MODULE_ID} | indexed ${state.index.length} token art candidates`);
  });
}

registerFoundryIntegration();
