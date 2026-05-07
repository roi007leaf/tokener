import { CUSTOM_FOLDERS_SETTING_KEY, MODULE_ID } from './constants.js';
import { isObject, localize, normalizeHudElement, normalizeLabel, normalizePath } from './utils.js';

export const CUSTOM_FOLDER_SOURCE_PREFIX = 'custom-folder:';
export const CUSTOM_FOLDERS_MENU_KEY = 'customFoldersMenu';

const CUSTOM_FOLDERS_TEMPLATE = 'modules/pf2e-tokener/templates/custom-folders.hbs';

let CustomFolderSettingsApplicationBase = null;
let CustomFolderSettingsApplicationClass = null;

export function registerCustomFolderSettings(settings = globalThis.game?.settings) {
  const menuType = getCustomFolderSettingsApplicationClass();
  const hasSettingsMenu = Boolean(menuType && typeof settings?.registerMenu === 'function');

  settings?.register?.(MODULE_ID, CUSTOM_FOLDERS_SETTING_KEY, {
    name: localize('Settings.CustomFolders.Name', 'Custom token folders'),
    hint: localize(
      'Settings.CustomFolders.Hint',
      'Data paths to scan for token art. Separate entries with commas, semicolons, or new lines. Use "Label | path" to name a source.',
    ),
    scope: 'world',
    config: !hasSettingsMenu,
    type: String,
    default: '',
    onChange: () => {
      void globalThis.game?.modules?.get?.(MODULE_ID)?.api?.rebuildIndex?.();
    },
  });

  if (hasSettingsMenu) {
    settings.registerMenu(MODULE_ID, CUSTOM_FOLDERS_MENU_KEY, {
      name: localize('Settings.CustomFolders.MenuName', 'Custom token folders'),
      label: localize('Settings.CustomFolders.MenuLabel', 'Configure'),
      hint: localize(
        'Settings.CustomFolders.MenuHint',
        'Choose custom token art folders and name each source.',
      ),
      icon: 'fas fa-folder-open',
      type: menuType,
      restricted: true,
    });
  }
}

export function getCustomFolderSources(settings = globalThis.game?.settings) {
  return normalizeCustomFolderSources(readCustomFolderSetting(settings));
}

export function getCustomFolderSettingsApplicationClass(
  FormApplicationClass = globalThis.FormApplication,
) {
  if (!FormApplicationClass) return null;
  if (
    CustomFolderSettingsApplicationClass &&
    CustomFolderSettingsApplicationBase === FormApplicationClass
  )
    return CustomFolderSettingsApplicationClass;

  CustomFolderSettingsApplicationClass = class Pf2eTokenerCustomFolders extends (
    FormApplicationClass
  ) {
    static get defaultOptions() {
      const baseOptions = super.defaultOptions ?? {};
      const merge = globalThis.foundry?.utils?.mergeObject;
      const options = {
        id: 'pf2e-tokener-custom-folders',
        classes: ['pf2e-tokener-custom-folders-app'],
        template: CUSTOM_FOLDERS_TEMPLATE,
        title: localize('Settings.CustomFolders.MenuName', 'Custom token folders'),
        width: 640,
      };
      return typeof merge === 'function'
        ? merge(baseOptions, options)
        : { ...baseOptions, ...options };
    }

    get title() {
      return localize('Settings.CustomFolders.MenuName', 'Custom token folders');
    }

    getData(options) {
      const context = super.getData?.(options) ?? {};
      const folders =
        this._folders ??
        (getCustomFolderSources().map(({ path, title }) => ({ path, title })) || []);
      const visibleFolders = folders.length ? folders : [{ path: '', title: '' }];
      return {
        ...context,
        addLabel: localize('Settings.CustomFolders.Add', 'Add folder'),
        browseLabel: localize('Settings.CustomFolders.Browse', 'Browse'),
        folders: visibleFolders.map((folder, index) => ({
          index,
          path: folder.path ?? '',
          pathPlaceholder: localize('Settings.CustomFolders.PathPlaceholder', 'Folder path'),
          removeLabel: localize('Settings.CustomFolders.Remove', 'Remove'),
          title: folder.title ?? '',
          titlePlaceholder: localize('Settings.CustomFolders.TitlePlaceholder', 'Source name'),
        })),
        hasFolders: visibleFolders.length > 0,
        hint: localize(
          'Settings.CustomFolders.MenuHint',
          'Choose custom token art folders and name each source.',
        ),
        saveLabel: localize('Settings.CustomFolders.Save', 'Save changes'),
      };
    }

    activateListeners(html) {
      super.activateListeners?.(html);
      const root = normalizeHudElement(html);
      root?.addEventListener?.('click', (event) => this.#handleClick(event));
    }

    _getFilePickerOptions(event) {
      return {
        ...(super._getFilePickerOptions?.(event) ?? {}),
        type: 'folder',
      };
    }

    async _updateObject(_event, formData) {
      const folders = normalizeCustomFolderSources(getSubmittedFolderEntries(formData));
      await globalThis.game?.settings?.set?.(
        MODULE_ID,
        CUSTOM_FOLDERS_SETTING_KEY,
        serializeCustomFolderSources(folders),
      );
      this._folders = null;
    }

    #handleClick(event) {
      const action = event.target?.closest?.('[data-folder-action]');
      if (!action) return;

      event.preventDefault?.();
      const folders = getFormFolderEntries(this.form);
      if (action.dataset.folderAction === 'add') {
        folders.push({ path: '', title: '' });
      } else if (action.dataset.folderAction === 'remove') {
        folders.splice(Number(action.dataset.folderIndex), 1);
      }
      this._folders = folders;
      this.render?.();
    }
  };

  CustomFolderSettingsApplicationBase = FormApplicationClass;
  return CustomFolderSettingsApplicationClass;
}

function readCustomFolderSetting(settings) {
  try {
    return settings?.get?.(MODULE_ID, CUSTOM_FOLDERS_SETTING_KEY) ?? '';
  } catch {
    return '';
  }
}

function normalizeCustomFolderSources(value) {
  const sources = [];
  const seen = new Set();

  for (const entry of getCustomFolderEntries(value)) {
    const normalized = normalizeCustomFolderEntry(entry);
    if (!normalized || seen.has(normalized.path)) continue;
    seen.add(normalized.path);
    sources.push(normalized);
  }

  return sources;
}

function serializeCustomFolderSources(sources) {
  return (sources ?? [])
    .map((source) =>
      source.title && source.title !== titleFromPath(source.path)
        ? `${source.title} | ${source.path}`
        : source.path,
    )
    .filter(Boolean)
    .join('\n');
}

function getCustomFolderEntries(value) {
  if (Array.isArray(value)) return value.flatMap(getCustomFolderEntries);
  if (isObject(value)) return [value];
  if (typeof value !== 'string') return [];

  const trimmed = value.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      return getCustomFolderEntries(JSON.parse(trimmed));
    } catch {
      return splitCustomFolderText(trimmed);
    }
  }

  return splitCustomFolderText(trimmed);
}

function splitCustomFolderText(value) {
  return value
    .split(/[\n;,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeCustomFolderEntry(entry) {
  const raw = isObject(entry) ? getObjectFolderEntry(entry) : getTextFolderEntry(entry);
  const path = normalizeFolderPath(raw.path);
  if (!path) return null;

  return {
    id: `${CUSTOM_FOLDER_SOURCE_PREFIX}${path}`,
    path,
    title: normalizeLabel(raw.title) || titleFromPath(path),
  };
}

function getFormFolderEntries(form) {
  if (!form || typeof FormData === 'undefined') return getCustomFolderSources();
  const data = Object.fromEntries(new FormData(form).entries());
  return getSubmittedFolderEntries(data);
}

function getSubmittedFolderEntries(data) {
  const rows = new Map();

  for (const [key, value] of Object.entries(data ?? {})) {
    const match = key.match(/^folders\.(\d+)\.(path|title)$/);
    if (!match) continue;
    const row = rows.get(match[1]) ?? {};
    row[match[2]] = value;
    rows.set(match[1], row);
  }

  if (Array.isArray(data?.folders)) {
    data.folders.forEach((folder, index) => rows.set(String(index), folder));
  } else if (isObject(data?.folders)) {
    for (const [index, folder] of Object.entries(data.folders)) rows.set(String(index), folder);
  }

  return [...rows.entries()]
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([, row]) => ({
      path: row?.path,
      title: row?.title,
    }));
}

function getObjectFolderEntry(entry) {
  return {
    path: entry.path ?? entry.folder ?? entry.target,
    title: entry.title ?? entry.label ?? entry.name,
  };
}

function getTextFolderEntry(entry) {
  const text = String(entry ?? '').trim();
  const separator = text.indexOf('|');
  if (separator === -1) return { path: text, title: '' };

  return {
    path: text.slice(separator + 1),
    title: text.slice(0, separator),
  };
}

function normalizeFolderPath(path) {
  return normalizePath(path)
    .replace(/^data:/i, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .trim();
}

function titleFromPath(path) {
  const folder = path.split('/').filter(Boolean).pop() || path;
  return normalizeLabel(folder.replace(/[-_]+/g, ' '));
}
