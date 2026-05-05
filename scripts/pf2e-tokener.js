const MODULE_ID = "pf2e-tokener";
const DEFAULT_LIMIT = 120;
const TOKEN_FOLDER_ROOTS = ["resources/tokens", "assets/tokens", "tokens"];
const PORTRAIT_FOLDER_ROOTS = ["resources/art", "resources/portraits", "assets/art", "assets/portraits", "art", "portraits"];
const SUBJECT_FOLDER_ROOTS = ["resources/subjects", "assets/subjects", "subjects"];
const IMAGE_EXTENSIONS = /\.(avif|webp|png|jpe?g|gif)$/i;

const state = {
  index: [],
  indexing: null,
  errors: [],
};

export function localize(key, fallback = "") {
  const fullKey = key.startsWith("PF2ETokener.") ? key : `PF2ETokener.${key}`;
  const value = globalThis.game?.i18n?.localize?.(fullKey);
  return value && value !== fullKey ? value : fallback;
}

export function getApplyActions() {
  return [
    { action: "token", label: localize("Actions.Token", "Token") },
    { action: "actor", label: localize("Actions.Actor", "Actor") },
    { action: "portrait", label: localize("Actions.Portrait", "Portrait") },
    { action: "both", label: localize("Actions.Both", "Both") },
  ];
}

export function getApplyTargets(action) {
  switch (action) {
    case "token":
      return { token: true, actor: false, portrait: false };
    case "actor":
      return { token: false, actor: true, portrait: false };
    case "portrait":
      return { token: false, actor: false, portrait: true };
    case "both":
      return { token: true, actor: true, portrait: false };
    default:
      return { token: false, actor: false, portrait: false };
  }
}

export function setTextTooltip(element, text) {
  if (!element || !text) return;
  element.title = text;
  element.dataset.tooltip = text;
  element.dataset.tooltipDirection = "UP";
  element.setAttribute?.("aria-label", text);
}

export function getCanvasZoom(canvasLike = globalThis.canvas) {
  const zoom = Number(
    canvasLike?.stage?.scale?.x
    ?? canvasLike?.app?.stage?.scale?.x
    ?? canvasLike?.tokens?.stage?.scale?.x
    ?? 1,
  );
  return Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
}

export function getPanelZoomData(canvasLike = globalThis.canvas) {
  const zoom = getCanvasZoom(canvasLike);
  return {
    zoom,
    inverse: clamp(1 / zoom, 0.5, 2),
  };
}

export function getImagePreviewItems(candidate) {
  return [
    {
      kind: "actor",
      label: localize("Preview.ActorImage", "Actor image"),
      src: candidate?.portraitSrc || "",
      available: Boolean(candidate?.portraitSrc),
    },
    {
      kind: "token",
      label: localize("Preview.TokenImage", "Token image"),
      src: candidate?.tokenSrc || "",
      available: Boolean(candidate?.tokenSrc),
    },
  ];
}

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

export function filterCandidatesBySources(candidates, selectedSourceIds) {
  const selected = new Set(selectedSourceIds ?? []);
  if (!selected.size) return candidates;
  return candidates.filter((candidate) => selected.has(candidate.moduleId));
}

export function getSourceFilterLabel(options, selectedSourceIds) {
  const selected = new Set(selectedSourceIds ?? []);
  if (!selected.size || selected.size >= (options?.length ?? 0)) return localize("HUD.AllSources", "All sources");
  if (selected.size === 1) {
    const [id] = selected;
    return options.find((option) => option.id === id)?.title ?? localize("HUD.AllSources", "All sources");
  }
  return localize("HUD.SourcesSelected", "{count} sources").replace("{count}", String(selected.size));
}

export function normalizeHudElement(html) {
  if (!html) return null;
  if (html.nodeType === 1) return html;
  if (typeof html.get === "function") return html.get(0) ?? null;
  if (Array.isArray(html)) return html[0] ?? null;
  if (typeof html.length === "number" && html[0]) return html[0];
  return null;
}

function applyPanelCanvasZoom(panel, canvasLike = globalThis.canvas) {
  const { zoom, inverse } = getPanelZoomData(canvasLike);
  panel.style.setProperty("--pf2e-tokener-canvas-zoom", String(zoom));
  panel.style.setProperty("--pf2e-tokener-inverse-zoom", String(inverse));
}

function updateOpenPanelsCanvasZoom() {
  globalThis.document
    ?.querySelectorAll?.("#token-hud .pf2e-tokener-panel")
    ?.forEach((panel) => applyPanelCanvasZoom(panel));
}

export function createMappedCandidates({ module, mapping, sourceType = "native" }) {
  if (!isObject(mapping)) return [];

  const candidates = [];
  for (const [packKey, actors] of Object.entries(mapping)) {
    if (!isObject(actors)) continue;
    for (const [actorId, info] of Object.entries(actors)) {
      const token = normalizeMappedToken(info);
      if (!token?.tokenSrc) continue;

      const label = normalizeLabel(info?.name) || labelFromPath(token.tokenSrc);
      candidates.push(makeCandidate({
        actorId,
        label,
        module,
        packKey,
        portraitSrc: typeof info?.actor === "string" ? info.actor : undefined,
        sourceType,
        ...token,
      }));
    }
  }

  return candidates;
}

export function createDatasheetCandidates({ module, datasheet, sourceType = "datasheet" }) {
  const entries = Array.isArray(datasheet) ? datasheet : Object.values(datasheet ?? {});
  const candidates = [];

  for (const entry of entries) {
    if (!isObject(entry)) continue;
    const art = entry.art;
    if (!isObject(art) || !art.token) continue;

    const scale = numberOr(art.scale, 1);
    candidates.push(makeCandidate({
      label: entry.label || labelFromPath(art.token),
      module,
      portraitSrc: art.portrait,
      scaleX: scale,
      scaleY: scale,
      sourceType,
      subjectScale: scale,
      subjectSrc: art.subject,
      tokenSrc: art.token,
    }));
  }

  return candidates;
}

export function createFolderCandidates({ module, files }) {
  if (!Array.isArray(files)) return [];
  const art = buildFolderArtLookups(files);

  return files
    .map(normalizePath)
    .filter((file) => IMAGE_EXTENSIONS.test(file) && isTokenFolderPath(file))
    .map((file) => makeCandidate({
      label: labelFromPath(file),
      module,
      portraitSrc: art.portraits.get(assetStem(file)),
      sourceType: "folder",
      subjectSrc: art.subjects.get(assetStem(file)),
      tokenSrc: file,
    }));
}

export function searchCandidates(index, query = "", { limit = DEFAULT_LIMIT } = {}) {
  const terms = splitTerms(query);
  const rows = [];

  for (const candidate of index) {
    const haystack = candidate.searchText || buildSearchText(candidate);
    if (terms.length && !terms.every((term) => haystack.includes(term))) continue;

    const label = normalizeSearchText(candidate.label);
    let score = 0;
    for (const term of terms) {
      if (label === term) score += 20;
      else if (label.startsWith(term)) score += 12;
      else if (label.includes(term)) score += 8;
      else if (haystack.includes(term)) score += 3;
    }
    if (!terms.length) score = 1;
    rows.push({ candidate, score });
  }

  rows.sort((a, b) => (
    b.score - a.score
    || compareStrings(a.candidate.label, b.candidate.label)
    || compareStrings(a.candidate.moduleTitle, b.candidate.moduleTitle)
  ));

  return rows.slice(0, limit).map((row) => ({ ...row.candidate, matchType: "search" }));
}

export function getCandidatesForTokenDocument(index, tokenDocument, query = "") {
  const actor = getDocumentActor(tokenDocument);
  const actorName = normalizeLabel(actor?.name || tokenDocument?.name || "");
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
      add(candidate, "exact");
    }
  }

  if (normalizedActorName) {
    for (const candidate of index) {
      if (normalizeSearchText(candidate.label) === normalizedActorName) {
        add(candidate, "name");
      }
    }
  }

  for (const candidate of searchCandidates(index, fallbackQuery)) {
    add(candidate, "search");
  }

  return results;
}

export function buildTokenUpdate(candidate) {
  const scaleX = numberOr(candidate?.scaleX ?? candidate?.scale, 1);
  const scaleY = numberOr(candidate?.scaleY ?? candidate?.scale, scaleX);
  const update = {
    "texture.src": candidate.tokenSrc,
    "texture.scaleX": scaleX,
    "texture.scaleY": scaleY,
    randomImg: false,
  };

  if (candidate?.subjectSrc) {
    update["ring.enabled"] = true;
    update["ring.subject.texture"] = candidate.subjectSrc;
    update["ring.subject.scale"] = numberOr(candidate.subjectScale, Math.max(Math.abs(scaleX), Math.abs(scaleY)));
  } else {
    update["ring.enabled"] = false;
  }

  return update;
}

export function buildActorUpdate(candidate) {
  const actorUpdate = {};
  for (const [key, value] of Object.entries(buildTokenUpdate(candidate))) {
    actorUpdate[`prototypeToken.${key}`] = value;
  }
  if (candidate?.portraitSrc) actorUpdate.img = candidate.portraitSrc;
  return actorUpdate;
}

function normalizeMappedToken(info) {
  const token = info?.token;
  if (typeof token === "string") {
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
  tokenSrc,
}) {
  const normalizedPackKey = packKey ? normalizePackKey(packKey) : undefined;
  const candidate = {
    actorId,
    canonicalPackKey: normalizedPackKey,
    id: makeCandidateId(module?.id, packKey, actorId, tokenSrc),
    label: normalizeLabel(label) || labelFromPath(tokenSrc),
    moduleId: module?.id || "unknown",
    moduleTitle: module?.title || module?.id || "Unknown Module",
    packKey,
    portraitSrc,
    scaleX,
    scaleY,
    sourceType,
    subjectScale,
    subjectSrc,
    tokenSrc: normalizePath(tokenSrc),
  };
  candidate.searchText = buildSearchText(candidate);
  return candidate;
}

function makeCandidateId(moduleId, packKey, actorId, tokenSrc) {
  return [moduleId, packKey, actorId, tokenSrc].filter(Boolean).join("|");
}

function buildSearchText(candidate) {
  return normalizeSearchText([
    candidate.label,
    candidate.moduleTitle,
    candidate.moduleId,
    candidate.packKey,
    candidate.canonicalPackKey,
    candidate.sourceType,
    labelFromPath(candidate.tokenSrc || ""),
  ].filter(Boolean).join(" "));
}

function isTokenFolderPath(path) {
  return /(^|\/)(resources\/tokens|assets\/tokens|tokens)\//i.test(path);
}

function isPortraitFolderPath(path) {
  return /(^|\/)(resources\/art|resources\/portraits|assets\/art|assets\/portraits|art|portraits)\//i.test(path);
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
  const file = normalizePath(path).split("/").pop() || "";
  return normalizeSearchText(file.replace(/\.[^.]+$/, ""));
}

function labelFromPath(path) {
  const file = normalizePath(path).split("/").pop() || "";
  const withoutExt = file.replace(/\.[^.]+$/, "");
  return normalizeLabel(withoutExt.replace(/[-_]+/g, " "));
}

function normalizeLabel(value) {
  const text = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";
  return text.replace(/\w\S*/g, (word) => word[0].toUpperCase() + word.slice(1));
}

function splitTerms(query) {
  return normalizeSearchText(query).split(" ").filter(Boolean);
}

function normalizeSearchText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePath(path) {
  return String(path ?? "").replace(/\\/g, "/");
}

function numberOr(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function compareStrings(a = "", b = "") {
  return String(a).localeCompare(String(b));
}

function getDocumentActor(tokenDocument) {
  return tokenDocument?.baseActor ?? tokenDocument?.actor ?? null;
}

function getActorSourceIds(actor) {
  const values = new Set();
  const candidates = [
    actor?.getFlag?.("core", "sourceId"),
    actor?.flags?.core?.sourceId,
    actor?._source?.flags?.core?.sourceId,
    actor?._stats?.compendiumSource,
    actor?._source?._stats?.compendiumSource,
  ];

  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) values.add(value.trim());
  }

  if (actor?.pack && actor?.id) values.add(`Compendium.${actor.pack}.Actor.${actor.id}`);

  return [...values].map(parseCompendiumSource).filter(Boolean);
}

function parseCompendiumSource(sourceId) {
  const stripped = String(sourceId).replace(/^Compendium\./, "");
  const marker = ".Actor.";
  if (stripped.includes(marker)) {
    const [packKey, actorId] = stripped.split(marker);
    return { actorId, canonicalPackKey: normalizePackKey(packKey), packKey };
  }

  const parts = stripped.split(".");
  const actorId = parts.pop();
  const packKey = parts.join(".");
  if (!actorId || !packKey) return null;
  return { actorId, canonicalPackKey: normalizePackKey(packKey), packKey };
}

function normalizePackKey(packKey) {
  const key = String(packKey ?? "").trim();
  if (!key) return "";
  if (key.startsWith("pf2e.")) return key;
  if (!key.includes(".")) return `pf2e.${key}`;
  return key;
}

function isExactSourceMatch(candidate, source) {
  if (!candidate.actorId || !source.actorId || candidate.actorId !== source.actorId) return false;
  const candidatePack = candidate.canonicalPackKey || normalizePackKey(candidate.packKey);
  return candidatePack === source.canonicalPackKey || candidate.packKey === source.packKey;
}

async function rebuildIndex() {
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

async function ensureIndex() {
  if (state.indexing) await state.indexing;
  if (!state.index.length && !state.indexing) await rebuildIndex();
  return state.index;
}

async function buildFoundryIndex() {
  const modules = getFoundryModules();
  const candidates = [];

  for (const module of modules) {
    if (!module || module.id === MODULE_ID) continue;
    candidates.push(...await collectMappedModuleCandidates(module));
  }

  for (const module of modules) {
    if (!module || module.id === MODULE_ID || !isTokenishModule(module)) continue;
    candidates.push(...await collectFolderModuleCandidates(module));
  }

  return candidates;
}

async function collectMappedModuleCandidates(module) {
  const candidates = [];
  const native = module.flags?.compendiumArtMappings?.pf2e;
  if (native?.mapping) {
    try {
      const mapping = await fetchJsonCompat(native.mapping);
      candidates.push(...createMappedCandidates({ module, mapping, sourceType: "native" }));
    } catch (error) {
      state.errors.push(error);
      console.warn(`${MODULE_ID} | Failed native mapping for ${module.id}`, error);
    }
  }

  for (const flag of Object.values(module.flags ?? {})) {
    if (!isObject(flag) || !flag["pf2e-art"]) continue;
    try {
      const mapping = await fetchJsonCompat(flag["pf2e-art"]);
      candidates.push(...createMappedCandidates({ module, mapping, sourceType: "pf2e-art" }));
    } catch (error) {
      state.errors.push(error);
      console.warn(`${MODULE_ID} | Failed pf2e-art mapping for ${module.id}`, error);
    }
  }

  for (const datasheet of Object.values(module.flags?.galleryDatasheets ?? {})) {
    if (!isObject(datasheet) || !datasheet.sheet) continue;
    try {
      const data = await fetchJsonCompat(datasheet.sheet);
      candidates.push(...createDatasheetCandidates({ module, datasheet: data }));
    } catch (error) {
      state.errors.push(error);
      console.warn(`${MODULE_ID} | Failed gallery datasheet for ${module.id}`, error);
    }
  }

  return candidates;
}

async function collectFolderModuleCandidates(module) {
  const candidates = [];
  const tokenFiles = [];
  for (const root of TOKEN_FOLDER_ROOTS) {
    const target = `modules/${module.id}/${root}`;
    tokenFiles.push(...await browseFilesCompat(target));
  }
  if (!tokenFiles.length) return candidates;

  const relatedFiles = [...tokenFiles];
  for (const root of [...PORTRAIT_FOLDER_ROOTS, ...SUBJECT_FOLDER_ROOTS]) {
    const target = `modules/${module.id}/${root}`;
    relatedFiles.push(...await browseFilesCompat(target));
  }
  candidates.push(...createFolderCandidates({ module, files: relatedFiles }));
  return candidates;
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
    tokenSrc: normalizePath(primary.tokenSrc ?? fallback.tokenSrc),
  };
  merged.searchText = buildSearchText(merged);
  return merged;
}

function candidateRichness(candidate) {
  return (
    (candidate?.portraitSrc ? 16 : 0)
    + (candidate?.subjectSrc ? 8 : 0)
    + (candidate?.actorId ? 4 : 0)
    + (candidate?.packKey ? 2 : 0)
    + (candidate?.sourceType && candidate.sourceType !== "folder" ? 1 : 0)
  );
}

function getFoundryModules() {
  const modules = globalThis.game?.modules;
  if (!modules) return [];
  if (typeof modules.values === "function") return [...modules.values()];
  if (Array.isArray(modules)) return modules;
  return [...modules];
}

function isTokenishModule(module) {
  return /token|collection/i.test(`${module.id ?? ""} ${module.title ?? ""}`);
}

async function fetchJsonCompat(path) {
  const fetcher = globalThis.foundry?.utils?.fetchJsonWithTimeout;
  if (typeof fetcher === "function") return fetcher(path);

  const response = await globalThis.fetch(path);
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${path}`);
  return response.json();
}

async function browseFilesCompat(target) {
  const picker = getFilePickerImplementation();
  if (!picker || typeof picker.browse !== "function") return [];

  try {
    const result = await picker.browse("data", target, { recursive: true });
    return Array.isArray(result?.files) ? result.files : [];
  } catch {
    return [];
  }
}

function getFilePickerImplementation() {
  return globalThis.foundry?.applications?.apps?.FilePicker?.implementation
    ?? globalThis.CONFIG?.ux?.FilePicker
    ?? globalThis.FilePicker
    ?? null;
}

function renderTokenHud(app, html) {
  const root = normalizeHudElement(html);
  const tokenDocument = getHudTokenDocument(app);
  if (!root || !tokenDocument || !canUpdateDocument(tokenDocument)) return;

  root.querySelectorAll(".pf2e-tokener-button, .pf2e-tokener-panel").forEach((element) => element.remove());

  const target = root.querySelector(".col.right") ?? root.querySelector(".right") ?? root;
  const button = document.createElement("div");
  button.className = "control-icon pf2e-tokener-button";
  button.dataset.action = "pf2e-tokener";
  button.dataset.tooltip = localize("HUD.Tooltip", "PF2e Tokener");
  button.innerHTML = '<i class="fas fa-images"></i>';
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    togglePanel(root, tokenDocument);
  });
  target.append(button);
}

function getHudTokenDocument(app) {
  return app?.object?.document ?? app?.document ?? app?.object ?? null;
}

function canUpdateDocument(document) {
  const user = globalThis.game?.user;
  try {
    if (typeof document.canUserModify === "function") return document.canUserModify(user, "update");
    if (typeof document.testUserPermission === "function") return document.testUserPermission(user, "OWNER");
  } catch {
    return false;
  }
  return Boolean(document.isOwner ?? user?.isGM);
}

function togglePanel(root, tokenDocument) {
  const existing = root.querySelector(".pf2e-tokener-panel");
  if (existing) {
    existing.remove();
    return;
  }

  const panel = document.createElement("section");
  panel.className = "pf2e-tokener-panel";
  applyPanelCanvasZoom(panel);
  panel.addEventListener("click", (event) => event.stopPropagation());
  root.append(panel);
  renderPanel(panel, tokenDocument);
}

async function renderPanel(panel, tokenDocument) {
  panel.replaceChildren(createLoadingState());
  const index = await ensureIndex();
  panel.replaceChildren();

  const toolbar = document.createElement("div");
  toolbar.className = "pf2e-tokener-toolbar";

  const search = document.createElement("input");
  search.type = "search";
  search.placeholder = localize("HUD.SearchPlaceholder", "Search tokens");
  search.value = getDocumentActor(tokenDocument)?.name ?? tokenDocument?.name ?? "";

  const sourceFilter = document.createElement("div");
  sourceFilter.className = "pf2e-tokener-source-filter";
  const count = document.createElement("span");
  count.className = "pf2e-tokener-count";

  toolbar.append(search, sourceFilter, count);

  const content = document.createElement("div");
  content.className = "pf2e-tokener-content";
  panel.append(toolbar, content);

  const sourceOptions = getPanelSourceFilterOptions(index);
  const selectedSourceIds = new Set();

  const render = () => {
    const allCandidates = getCandidatesForTokenDocument(index, tokenDocument, search.value);
    renderSourceFilter(sourceFilter, sourceOptions, selectedSourceIds, render);
    const candidates = filterCandidatesBySources(allCandidates, selectedSourceIds);
    count.textContent = String(candidates.length);
    renderCandidateSections(content, candidates, tokenDocument);
  };

  search.addEventListener("input", render);
  render();
}

function createLoadingState() {
  const loading = document.createElement("div");
  loading.className = "pf2e-tokener-state";
  loading.textContent = localize("HUD.Indexing", "Indexing token art...");
  return loading;
}

function renderSourceFilter(container, options, selectedSourceIds, onChange) {
  const wasOpen = container.classList.contains("is-open");
  container.replaceChildren();
  container.classList.toggle("is-open", wasOpen);

  const button = document.createElement("button");
  button.type = "button";
  button.className = "pf2e-tokener-source-button";
  button.textContent = getSourceFilterLabel(options, selectedSourceIds);
  button.setAttribute("aria-haspopup", "true");
  button.setAttribute("aria-expanded", wasOpen ? "true" : "false");
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    container.classList.toggle("is-open");
    button.setAttribute("aria-expanded", container.classList.contains("is-open") ? "true" : "false");
  });

  const menu = document.createElement("div");
  menu.className = "pf2e-tokener-source-menu";
  menu.addEventListener("click", (event) => event.stopPropagation());

  if (options.length > 2) {
    const controls = document.createElement("div");
    controls.className = "pf2e-tokener-source-controls";
    controls.append(
      createSourceControlButton(localize("HUD.SelectAllSources", "Select all"), selectedSourceIds, onChange),
      createSourceControlButton(localize("HUD.ClearSources", "Clear"), selectedSourceIds, onChange),
    );
    menu.append(controls);
  }

  const effectiveSelected = getEffectiveSourceIds(options, selectedSourceIds);
  for (const option of options) {
    menu.append(createSourceOption(option, options.length, effectiveSelected, selectedSourceIds, onChange));
  }

  container.append(button, menu);
}

function createSourceControlButton(label, selectedSourceIds, onChange) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", (event) => {
    event.preventDefault();
    selectedSourceIds.clear();
    onChange();
  });
  return button;
}

function createSourceOption(option, totalSourceCount, effectiveSelected, selectedSourceIds, onChange) {
  const label = document.createElement("label");
  label.className = "pf2e-tokener-source-option";

  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = effectiveSelected.has(option.id);
  input.addEventListener("change", () => {
    const next = new Set(effectiveSelected);
    if (input.checked) next.add(option.id);
    else next.delete(option.id);

    selectedSourceIds.clear();
    if (next.size !== totalSourceCount) {
      for (const id of next) selectedSourceIds.add(id);
    }
    onChange();
  });

  const title = document.createElement("span");
  title.textContent = option.title;
  setTextTooltip(title, option.title);

  const count = document.createElement("span");
  count.className = "pf2e-tokener-source-option-count";
  count.textContent = String(option.count);

  label.append(input, title, count);
  return label;
}

function getEffectiveSourceIds(options, selectedSourceIds) {
  if (selectedSourceIds.size) return new Set(selectedSourceIds);
  return new Set(options.map((option) => option.id));
}

function renderCandidateSections(content, candidates, tokenDocument) {
  content.replaceChildren();
  if (!candidates.length) {
    const empty = document.createElement("div");
    empty.className = "pf2e-tokener-state";
    empty.textContent = localize("HUD.NoTokenArt", "No token art found.");
    content.append(empty);
    return;
  }

  const pinned = candidates.filter((candidate) => candidate.matchType === "exact" || candidate.matchType === "name");
  const broad = candidates.filter((candidate) => candidate.matchType !== "exact" && candidate.matchType !== "name");
  if (pinned.length) content.append(createSection(localize("HUD.BestMatches", "Best matches"), pinned, tokenDocument));
  if (broad.length) content.append(createSection(localize("HUD.SearchResults", "Search results"), broad, tokenDocument));
}

function createSection(title, candidates, tokenDocument) {
  const section = document.createElement("section");
  section.className = "pf2e-tokener-section";

  const heading = document.createElement("h4");
  heading.textContent = title;

  const grid = document.createElement("div");
  grid.className = "pf2e-tokener-grid";
  for (const candidate of candidates) grid.append(createCandidateCard(candidate, tokenDocument));

  section.append(heading, grid);
  return section;
}

function createCandidateCard(candidate, tokenDocument) {
  const card = document.createElement("article");
  card.className = "pf2e-tokener-card";
  card.tabIndex = 0;
  if (isCurrentTokenArt(candidate, tokenDocument)) card.classList.add("is-current");

  const image = document.createElement("img");
  image.loading = "lazy";
  image.src = candidate.tokenSrc;
  image.alt = "";

  const badge = document.createElement("div");
  badge.className = "pf2e-tokener-badge";
  badge.textContent = localize("HUD.Current", "Current");

  const label = document.createElement("div");
  label.className = "pf2e-tokener-label";
  label.textContent = candidate.label;
  setTextTooltip(label, candidate.label);

  const source = document.createElement("div");
  source.className = "pf2e-tokener-source";
  source.textContent = candidate.moduleTitle;
  setTextTooltip(source, candidate.moduleTitle);

  const actions = document.createElement("div");
  actions.className = "pf2e-tokener-actions";
  for (const { action, label } of getApplyActions()) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      await applyCandidateAction(action, candidate, tokenDocument, card);
    });
    actions.append(button);
  }

  card.append(image, badge, label, source, actions);
  card.addEventListener("click", () => toggleCardActions(card));
  card.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openImagePreview(candidate);
  });
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleCardActions(card);
    }
  });
  return card;
}

function openImagePreview(candidate) {
  const doc = globalThis.document;
  if (!doc?.body) return;

  doc.querySelector(".pf2e-tokener-preview")?.remove();

  const overlay = doc.createElement("section");
  overlay.className = "pf2e-tokener-preview";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", candidate.label);

  const dialog = doc.createElement("div");
  dialog.className = "pf2e-tokener-preview-dialog";

  const header = doc.createElement("header");
  header.className = "pf2e-tokener-preview-header";

  const title = doc.createElement("div");
  title.className = "pf2e-tokener-preview-title";
  title.textContent = candidate.label;

  const source = doc.createElement("div");
  source.className = "pf2e-tokener-preview-source";
  source.textContent = candidate.moduleTitle;

  const titleBlock = doc.createElement("div");
  titleBlock.append(title, source);

  const close = doc.createElement("button");
  close.type = "button";
  close.className = "pf2e-tokener-preview-close";
  close.dataset.tooltip = localize("Preview.Close", "Close preview");
  close.setAttribute("aria-label", localize("Preview.Close", "Close preview"));
  close.innerHTML = "&times;";

  const panes = doc.createElement("div");
  panes.className = "pf2e-tokener-preview-panes";
  for (const item of getImagePreviewItems(candidate)) {
    panes.append(createPreviewPane(item));
  }

  const closePreview = () => {
    globalThis.window?.removeEventListener?.("keydown", onKeyDown);
    overlay.remove();
  };
  const onKeyDown = (event) => {
    if (event.key === "Escape") closePreview();
  };

  close.addEventListener("click", closePreview);
  overlay.addEventListener("mousedown", (event) => {
    if (event.target === overlay) closePreview();
  });
  globalThis.window?.addEventListener?.("keydown", onKeyDown);

  header.append(titleBlock, close);
  dialog.append(header, panes);
  overlay.append(dialog);
  doc.body.append(overlay);
  close.focus?.();
}

function createPreviewPane(item) {
  const doc = globalThis.document;
  const pane = doc.createElement("article");
  pane.className = `pf2e-tokener-preview-pane pf2e-tokener-preview-pane-${item.kind}`;

  const heading = doc.createElement("h3");
  heading.textContent = item.label;

  const frame = doc.createElement("div");
  frame.className = "pf2e-tokener-preview-frame";

  if (item.available) {
    const image = doc.createElement("img");
    image.src = item.src;
    image.alt = item.label;
    frame.append(image);
  } else {
    const empty = doc.createElement("div");
    empty.className = "pf2e-tokener-preview-empty";
    empty.textContent = localize("Preview.ActorUnavailable", "No actor image available.");
    frame.append(empty);
  }

  pane.append(heading, frame);
  return pane;
}

function isCurrentTokenArt(candidate, tokenDocument) {
  const current = normalizePath(tokenDocument?.texture?.src ?? tokenDocument?._source?.texture?.src ?? "");
  return Boolean(current && (current === candidate.tokenSrc || current === candidate.subjectSrc));
}

function toggleCardActions(card) {
  const grid = card.closest(".pf2e-tokener-grid");
  grid?.querySelectorAll(".pf2e-tokener-card.is-open").forEach((openCard) => {
    if (openCard !== card) openCard.classList.remove("is-open");
  });
  card.classList.toggle("is-open");
}

async function applyCandidateAction(action, candidate, tokenDocument, card) {
  const actor = getDocumentActor(tokenDocument);
  const targets = getApplyTargets(action);
  card.classList.add("is-applying");

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

    globalThis.ui?.notifications?.info?.(localize("Notifications.Applied", "PF2e Tokener: token art applied."));
  } catch (error) {
    console.error(`${MODULE_ID} | Failed to apply token art`, error);
    globalThis.ui?.notifications?.error?.(localize("Notifications.ApplyFailed", "PF2e Tokener: failed to apply token art."));
  } finally {
    card.classList.remove("is-applying");
  }
}

function installApi() {
  const module = globalThis.game?.modules?.get?.(MODULE_ID);
  if (!module) return;
  module.api = {
    get index() {
      return state.index;
    },
    rebuildIndex,
    search: (query) => searchCandidates(state.index, query),
    getCandidatesForToken: (tokenDocument, query = "") => getCandidatesForTokenDocument(state.index, tokenDocument, query),
  };
}

function registerFoundryIntegration() {
  const hooks = globalThis.Hooks;
  if (!hooks || typeof hooks.once !== "function") return;

  hooks.once("ready", async () => {
    installApi();
    if (globalThis.game?.system?.id !== "pf2e") return;
    await rebuildIndex();
    hooks.on("renderTokenHUD", renderTokenHud);
    hooks.on("canvasPan", updateOpenPanelsCanvasZoom);
    console.log(`${MODULE_ID} | indexed ${state.index.length} token art candidates`);
  });
}

registerFoundryIntegration();
