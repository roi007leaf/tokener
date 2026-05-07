import {
  MODULE_ID,
  PORTRAIT_FOLDER_ROOTS,
  SUBJECT_FOLDER_ROOTS,
  TOKEN_FOLDER_ROOTS,
} from './constants.js';
import {
  createDatasheetCandidates,
  createCustomFolderCandidates,
  createFolderCandidates,
  createMappedCandidates,
  dedupeCandidates,
  getCandidatesForTokenDocument,
  searchCandidates,
} from './candidates.js';
import { getCustomFolderSources } from './custom-folders.js';
import { isObject, normalizePath } from './utils.js';

const DATASHEET_BROWSE_ROOTS = [
  { root: 'assets/datasheet', recursive: true },
  { root: 'data', recursive: true },
  { root: 'datasheets', recursive: true },
  { root: '', recursive: false },
];
const DATASHEET_JSON = /(?:^|\/)[^/]*datasheet[^/]*\.json$/i;

export const state = {
  index: [],
  indexing: null,
  errors: [],
};

export async function rebuildIndex() {
  state.indexing = buildFoundryIndex()
    .then((index) => {
      state.index = dedupeCandidates(index);
      return state.index;
    })
    .catch((error) => {
      state.errors.push(error);
      console.error(`${MODULE_ID} | Failed to build token index`, error);
      state.index = [];
      return state.index;
    });
  return state.indexing;
}

export async function ensureIndex() {
  if (state.indexing) await state.indexing;
  if (!state.index.length && !state.indexing) await rebuildIndex();
  return state.index;
}

export function installApi() {
  const module = globalThis.game?.modules?.get?.(MODULE_ID);
  if (!module) return;
  module.api = {
    get index() {
      return state.index;
    },
    rebuildIndex,
    search: (query) => searchCandidates(state.index, query),
    getCandidatesForToken: (tokenDocument, query = '') =>
      getCandidatesForTokenDocument(state.index, tokenDocument, query),
  };
}

async function buildFoundryIndex() {
  const modules = getFoundryModules();
  const candidates = [];

  for (const module of modules) {
    if (!module || module.id === MODULE_ID) continue;
    candidates.push(...(await collectMappedModuleCandidates(module)));
  }

  for (const module of modules) {
    if (!module || module.id === MODULE_ID) continue;
    candidates.push(...(await collectFolderModuleCandidates(module)));
  }

  candidates.push(...(await collectCustomFolderCandidates()));

  return candidates;
}

async function collectMappedModuleCandidates(module) {
  const candidates = [];
  const seenDatasheets = new Set();
  const native = module.flags?.compendiumArtMappings?.pf2e;
  if (native?.mapping) {
    try {
      const mapping = await fetchJsonCompat(native.mapping);
      candidates.push(...createMappedCandidates({ module, mapping, sourceType: 'native' }));
    } catch (error) {
      state.errors.push(error);
      console.warn(`${MODULE_ID} | Failed native mapping for ${module.id}`, error);
    }
  }

  for (const flag of Object.values(module.flags ?? {})) {
    if (!isObject(flag) || !flag['pf2e-art']) continue;
    try {
      const mapping = await fetchJsonCompat(flag['pf2e-art']);
      candidates.push(...createMappedCandidates({ module, mapping, sourceType: 'pf2e-art' }));
    } catch (error) {
      state.errors.push(error);
      console.warn(`${MODULE_ID} | Failed pf2e-art mapping for ${module.id}`, error);
    }
  }

  for (const datasheet of Object.values(module.flags?.galleryDatasheets ?? {})) {
    if (!isObject(datasheet) || !datasheet.sheet) continue;
    await addDatasheetCandidates({ module, candidates, seenDatasheets, sheet: datasheet.sheet });
  }

  if (isTokenDataModule(module)) {
    for (const sheet of await discoverDatasheetSheets(module)) {
      await addDatasheetCandidates({ module, candidates, seenDatasheets, sheet });
    }
  }

  return candidates;
}

async function addDatasheetCandidates({ module, candidates, seenDatasheets, sheet }) {
  const normalizedSheet = normalizePath(sheet);
  if (!normalizedSheet || seenDatasheets.has(normalizedSheet)) return;
  seenDatasheets.add(normalizedSheet);

  try {
    const data = await fetchJsonCompat(normalizedSheet);
    candidates.push(...createDatasheetCandidates({ module, datasheet: data }));
  } catch (error) {
    state.errors.push(error);
    console.warn(`${MODULE_ID} | Failed gallery datasheet for ${module.id}`, error);
  }
}

async function discoverDatasheetSheets(module) {
  const sheets = new Set();
  for (const { root, recursive } of DATASHEET_BROWSE_ROOTS) {
    const target = root ? `modules/${module.id}/${root}` : `modules/${module.id}`;
    for (const file of await browseFilesCompat(target, { recursive })) {
      const normalized = normalizePath(file);
      if (DATASHEET_JSON.test(normalized)) sheets.add(normalized);
    }
  }
  return [...sheets];
}

async function collectFolderModuleCandidates(module) {
  const candidates = [];
  const tokenFiles = [];
  for (const root of TOKEN_FOLDER_ROOTS) {
    const target = `modules/${module.id}/${root}`;
    tokenFiles.push(...(await browseFilesCompat(target)));
  }
  if (!tokenFiles.length) return candidates;

  const relatedFiles = [...tokenFiles];
  for (const root of [...PORTRAIT_FOLDER_ROOTS, ...SUBJECT_FOLDER_ROOTS]) {
    const target = `modules/${module.id}/${root}`;
    relatedFiles.push(...(await browseFilesCompat(target)));
  }
  candidates.push(...createFolderCandidates({ module, files: relatedFiles }));
  return candidates;
}

async function collectCustomFolderCandidates() {
  const candidates = [];
  for (const source of getCustomFolderSources()) {
    const files = await browseFilesCompat(source.path, { recursive: true });
    candidates.push(...createCustomFolderCandidates({ source, files }));
  }
  return candidates;
}

function getFoundryModules() {
  const modules = globalThis.game?.modules;
  if (!modules) return [];
  if (typeof modules.values === 'function') return [...modules.values()];
  if (Array.isArray(modules)) return modules;
  return [...modules];
}

function isTokenDataModule(module) {
  return /pf2e|sf2e|token|collection|bestiary|battlezoo|beginner|abomination|summons|claws|kingmaker|monster|monsters|creature|creatures|npc|adventure|drakkenheim/i.test(
    `${module.id ?? ''} ${module.title ?? ''}`,
  );
}

async function fetchJsonCompat(path) {
  const fetcher = globalThis.foundry?.utils?.fetchJsonWithTimeout;
  if (typeof fetcher === 'function') return fetcher(path);

  const response = await globalThis.fetch(path);
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${path}`);
  return response.json();
}

async function browseFilesCompat(target, { recursive = true } = {}) {
  const picker = getFilePickerImplementation();
  if (!picker || typeof picker.browse !== 'function') return [];

  try {
    const result = await picker.browse('data', target, { recursive });
    return Array.isArray(result?.files) ? result.files : [];
  } catch {
    return [];
  }
}

function getFilePickerImplementation() {
  return (
    globalThis.foundry?.applications?.apps?.FilePicker?.implementation ??
    globalThis.CONFIG?.ux?.FilePicker ??
    globalThis.FilePicker ??
    null
  );
}
