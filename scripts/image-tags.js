import { IMAGE_TAGS_SETTING_KEY, MODULE_ID } from './constants.js';
import {
  isObject,
  localize,
  normalizeHudElement,
  normalizePath,
  normalizeSearchText,
} from './utils.js';

export const IMAGE_TAGS_MENU_KEY = 'imageTagsMenu';

let ImageTagOverridesApplicationBase = null;
let ImageTagOverridesDialogBase = null;
let ImageTagOverridesApplicationClass = null;

export function registerImageTagSettings(settings = globalThis.game?.settings) {
  const menuType = getImageTagOverridesApplicationClass();
  const hasSettingsMenu = Boolean(menuType && typeof settings?.registerMenu === 'function');

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

  if (hasSettingsMenu) {
    settings.registerMenu(MODULE_ID, IMAGE_TAGS_MENU_KEY, {
      name: localize('Settings.ImageTags.MenuName', 'Image tag overrides'),
      label: localize('Settings.ImageTags.MenuLabel', 'Import / export'),
      hint: localize(
        'Settings.ImageTags.MenuHint',
        'Export or replace GM-added image tag overrides as JSON.',
      ),
      icon: 'fas fa-tags',
      type: menuType,
      restricted: true,
    });
  }
}

export function getImageTagOverrides(settings = globalThis.game?.settings) {
  return normalizeImageTagOverrides(settings?.get?.(MODULE_ID, IMAGE_TAGS_SETTING_KEY));
}

export function getImageTagOverridesExport(settings = globalThis.game?.settings) {
  return JSON.stringify(getImageTagOverrides(settings), null, 2);
}

export function getImageTagOverrideExport(tags = {}) {
  return JSON.stringify(
    {
      tags: normalizeImageTags(tags) ?? {},
    },
    null,
    2,
  );
}

export async function importImageTagOverrides(json, settings = globalThis.game?.settings) {
  let parsed;
  try {
    parsed = JSON.parse(String(json || '{}'));
  } catch (error) {
    throw new Error('Invalid image tag JSON.', { cause: error });
  }

  if (!isObject(parsed)) throw new Error('Invalid image tag JSON.');
  const singleImageTagOverrideMap = getSingleImageTagOverrideMap(parsed);
  if (!singleImageTagOverrideMap && isObject(parsed.tags)) throw new Error('Invalid image tag JSON.');

  const normalized = normalizeImageTagOverrides(singleImageTagOverrideMap ?? parsed);
  await settings?.set?.(MODULE_ID, IMAGE_TAGS_SETTING_KEY, normalized);
  return normalized;
}

export function parseImageTagOverrideImport(json, imagePath = '') {
  let parsed;
  try {
    parsed = JSON.parse(String(json || '{}'));
  } catch (error) {
    throw new Error('Invalid image tag JSON.', { cause: error });
  }

  if (!isObject(parsed)) throw new Error('Invalid image tag JSON.');
  if (isObject(parsed.tags)) return normalizeImageTags(parsed.tags);

  const path = normalizePath(imagePath);
  if (path) {
    if (Object.hasOwn(parsed, path)) return normalizeImageTags(parsed[path]);

    const matchingEntry = Object.entries(parsed).find(([entryPath]) => normalizePath(entryPath) === path);
    if (matchingEntry) return normalizeImageTags(matchingEntry[1]);
  }

  if (Object.values(parsed).some((value) => isObject(value))) return undefined;
  return normalizeImageTags(parsed);
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

export function getImageTagOverridesApplicationClass(
  ApplicationV2Class = resolveApplicationV2Class(),
  DialogV2Class = resolveDialogV2Class(),
) {
  if (!ApplicationV2Class || !DialogV2Class) return null;
  if (
    ImageTagOverridesApplicationClass &&
    ImageTagOverridesApplicationBase === ApplicationV2Class &&
    ImageTagOverridesDialogBase === DialogV2Class
  )
    return ImageTagOverridesApplicationClass;

  ImageTagOverridesApplicationClass = class Pf2eTokenerImageTags extends ApplicationV2Class {
    static DEFAULT_OPTIONS = {
      id: 'pf2e-tokener-image-tags',
      classes: ['pf2e-tokener-image-tags-app'],
      tag: 'section',
      window: {
        icon: 'fas fa-tags',
        title: localize('Settings.ImageTags.MenuName', 'Image tag overrides'),
      },
    };

    render(_options) {
      void this.openDialog();
      return this;
    }

    async openDialog() {
      return DialogV2Class.input({
        window: {
          icon: 'fas fa-tags',
          title: this.title,
        },
        position: {
          width: 640,
        },
        content: renderImageTagOverridesContent(getImageTagOverridesExport()),
        render: (_event, dialog) => activateImageTagOverridesDialog(dialog),
        ok: {
          label: localize('Settings.ImageTags.Import', 'Import JSON'),
          icon: 'fas fa-upload',
          callback: async (_event, button) => {
            try {
              const tags = await importImageTagOverrides(getImageTagOverridesJson(button.form));
              globalThis.ui?.notifications?.info?.(
                localize('Notifications.ImageTagsImported', 'Tokener: image tags imported.'),
              );
              return tags;
            } catch (error) {
              globalThis.ui?.notifications?.error?.(
                localize(
                  'Notifications.ImageTagsImportFailed',
                  'Tokener: failed to import image tags.',
                ),
              );
              throw error;
            }
          },
        },
      });
    }

    get title() {
      return localize('Settings.ImageTags.MenuName', 'Image tag overrides');
    }
  };

  ImageTagOverridesApplicationBase = ApplicationV2Class;
  ImageTagOverridesDialogBase = DialogV2Class;
  return ImageTagOverridesApplicationClass;
}

function resolveApplicationV2Class() {
  return (
    globalThis.foundry?.applications?.api?.ApplicationV2 ??
    globalThis.foundry?.applications?.ApplicationV2 ??
    null
  );
}

function resolveDialogV2Class() {
  return (
    globalThis.foundry?.applications?.api?.DialogV2 ??
    globalThis.foundry?.applications?.DialogV2 ??
    null
  );
}

function renderImageTagOverridesContent(json) {
  return `<div class="pf2e-tokener-image-tags-import-export">
    <p class="notes">${escapeHtml(
      localize(
        'Settings.ImageTags.ImportExportHint',
        'Copy or download GM-added image tag overrides. Paste JSON here and import to replace current overrides.',
      ),
    )}</p>
    <textarea name="imageTagsJson" spellcheck="false">${escapeHtml(json)}</textarea>
    <button type="button" data-image-tags-export>
      <i class="fas fa-download" aria-hidden="true"></i>
      ${escapeHtml(localize('Settings.ImageTags.Export', 'Export JSON'))}
    </button>
  </div>`;
}

function activateImageTagOverridesDialog(dialog) {
  const root = normalizeHudElement(dialog?.element);
  if (!root || root.dataset.pf2eTokenerImageTagsBound) return;
  root.dataset.pf2eTokenerImageTagsBound = 'true';

  root.addEventListener?.('click', (event) => {
    const button = event.target?.closest?.('[data-image-tags-export]');
    if (!button) return;

    event.preventDefault?.();
    const json =
      root.querySelector?.('[name="imageTagsJson"]')?.value ?? getImageTagOverridesExport();
    downloadImageTagOverrides(json);
  });
}

function getImageTagOverridesJson(form) {
  if (!form) return '{}';
  if (typeof FormData !== 'undefined') {
    const value = new FormData(form).get('imageTagsJson');
    if (value !== null) return String(value);
  }
  return form.querySelector?.('[name="imageTagsJson"]')?.value ?? '{}';
}

function downloadImageTagOverrides(json) {
  return downloadImageTagJson(json, 'tokener-image-tags.json');
}

export function downloadImageTagJson(json, filename = 'tokener-image-tags.json') {
  const safeFilename = sanitizeJsonFilename(filename);
  const saver = globalThis.foundry?.utils?.saveDataToFile ?? globalThis.saveDataToFile;
  if (typeof saver === 'function') {
    saver(String(json || '{}'), 'application/json', safeFilename);
    return true;
  }

  const document = globalThis.document;
  const urlApi = globalThis.URL;
  if (!document?.createElement || !urlApi?.createObjectURL || typeof Blob === 'undefined')
    return false;

  const url = urlApi.createObjectURL(
    new Blob([String(json || '{}')], { type: 'application/json' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = safeFilename;
  link.click?.();
  urlApi.revokeObjectURL?.(url);
  return true;
}

function sanitizeJsonFilename(filename) {
  const safe = String(filename || 'tokener-image-tags.json')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return safe.endsWith('.json') ? safe : `${safe || 'tokener-image-tags'}.json`;
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

function getSingleImageTagOverrideMap(value) {
  if (!isObject(value) || !isObject(value.tags)) return null;
  const path = normalizePath(value.image ?? value.imagePath ?? value.path ?? '');
  return path ? { [path]: value.tags } : null;
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

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
