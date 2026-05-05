import { MODULE_ID } from './constants.js';
import { installApi, rebuildIndex, state } from './foundry-index.js';
import { renderTokenHud, updateOpenPanelsCanvasZoom } from './hud.js';

export { MODULE_ID } from './constants.js';
export {
  buildActorUpdate,
  buildTokenUpdate,
  getApplyActions,
  getApplyActionsForCandidate,
  getApplyTargets,
  getCandidatePreviewSrc,
  getCandidatePreviewSources,
} from './actions.js';
export {
  createDatasheetCandidates,
  createFolderCandidates,
  createMappedCandidates,
  dedupeCandidates,
  getCandidatesForTokenDocument,
  searchCandidates,
} from './candidates.js';
export { ensureIndex, rebuildIndex, state } from './foundry-index.js';
export { renderTokenHud, updateOpenPanelsCanvasZoom } from './hud.js';
export {
  buildCandidateSearchQuery,
  getTokenPickerApplicationClass,
  openTokenPicker,
  resolveApplicationV2Class,
  resolveHandlebarsApplicationMixin,
} from './picker-app.js';
export { getImagePreviewItems, openImagePreview } from './preview.js';
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
