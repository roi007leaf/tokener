import { CUSTOM_FOLDERS_SETTING_KEY, IMAGE_EXTENSIONS, MODULE_ID } from './constants.js';
import {
  isObject,
  localize,
  normalizeHudElement,
  normalizeLabel,
  normalizePath,
  normalizeSearchText,
} from './utils.js';
import { getTagFilterOptions } from './tags.js';

export const CUSTOM_FOLDER_SOURCE_PREFIX = 'custom-folder:';
export const CUSTOM_FOLDERS_MENU_KEY = 'customFoldersMenu';

const CUSTOM_FOLDERS_TEMPLATE = 'modules/pf2e-tokener/templates/custom-folders.hbs';
const CUSTOM_FOLDER_BROWSER_IMAGE_LIMIT = 80;

let CustomFolderSettingsApplicationBase = null;
let CustomFolderSettingsDialogBase = null;
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

export async function setCustomFolderImageTags(
  imagePath,
  tags,
  settings = globalThis.game?.settings,
) {
  const normalizedImagePath = normalizePath(imagePath);
  if (!normalizedImagePath || !settings?.set) return null;

  const normalizedTags = normalizeCustomFolderTags(tags);
  const sources = getCustomFolderSources(settings);
  let changed = false;
  const updated = sources.map((source) => {
    if (!isImageInCustomFolderSource(normalizedImagePath, source)) return source;
    changed = true;
    const imageTags = { ...(source.imageTags ?? {}) };
    if (normalizedTags) imageTags[normalizedImagePath] = normalizedTags;
    else delete imageTags[normalizedImagePath];
    return {
      ...source,
      ...(Object.keys(imageTags).length ? { imageTags } : {}),
    };
  });

  if (!changed) return null;
  const serialized = serializeCustomFolderSources(updated);
  await settings.set(MODULE_ID, CUSTOM_FOLDERS_SETTING_KEY, serialized);
  return updated;
}

export function getCustomFolderSettingsApplicationClass(
  ApplicationV2Class = resolveApplicationV2Class(),
  DialogV2Class = resolveDialogV2Class(),
) {
  if (!ApplicationV2Class || !DialogV2Class) return null;
  if (
    CustomFolderSettingsApplicationClass &&
    CustomFolderSettingsApplicationBase === ApplicationV2Class &&
    CustomFolderSettingsDialogBase === DialogV2Class
  )
    return CustomFolderSettingsApplicationClass;

  CustomFolderSettingsApplicationClass = class Pf2eTokenerCustomFolders extends ApplicationV2Class {
    static DEFAULT_OPTIONS = {
      id: 'pf2e-tokener-custom-folders',
      classes: ['pf2e-tokener-custom-folders-app'],
      tag: 'section',
      window: {
        icon: 'fas fa-folder-open',
        title: localize('Settings.CustomFolders.MenuName', 'Custom token folders'),
      },
    };

    render(_options) {
      void this.openDialog();
      return this;
    }

    async openDialog() {
      let folders = getCustomFolderSources().map(sourceToFormFolder);
      if (!folders.length) folders = [createEmptyFolderRow()];
      const tagOptions = await getCustomFolderTagOptions();

      const renderContent = async () => renderCustomFoldersContent(folders, tagOptions);
      const activate = (dialog) => {
        activateCustomFolderDialog(dialog, {
          getFolders: () => folders,
          setFolders: (nextFolders) => {
            folders = nextFolders.length ? nextFolders : [createEmptyFolderRow()];
          },
          renderContent,
        });
      };

      return DialogV2Class.input({
        window: {
          icon: 'fas fa-folder-open',
          title: this.title,
        },
        position: {
          width: 720,
        },
        content: await renderContent(),
        render: (_event, dialog) => activate(dialog),
        ok: {
          label: localize('Settings.CustomFolders.Save', 'Save changes'),
          icon: 'fas fa-save',
          callback: async (_event, button) => {
            const submitted = normalizeCustomFolderSources(
              getFormFolderEntries(button.form, folders),
            );
            await globalThis.game?.settings?.set?.(
              MODULE_ID,
              CUSTOM_FOLDERS_SETTING_KEY,
              serializeCustomFolderSources(submitted),
            );
            return submitted;
          },
        },
      });
    }

    get title() {
      return localize('Settings.CustomFolders.MenuName', 'Custom token folders');
    }
  };

  CustomFolderSettingsApplicationBase = ApplicationV2Class;
  CustomFolderSettingsDialogBase = DialogV2Class;
  return CustomFolderSettingsApplicationClass;
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

async function renderCustomFoldersContent(folders, tagOptions = []) {
  const context = prepareCustomFolderContext(folders, tagOptions);
  const renderer =
    globalThis.foundry?.applications?.handlebars?.renderTemplate ?? globalThis.renderTemplate;
  if (typeof renderer === 'function') return renderer(CUSTOM_FOLDERS_TEMPLATE, context);

  return `<div class="pf2e-tokener-custom-folders">${context.folders
    .map(
      (folder) => `
        <div class="pf2e-tokener-custom-folder-row" data-folder-index="${folder.index}">
          <input type="text" name="folders.${folder.index}.title" value="${escapeHtml(folder.title)}" placeholder="${escapeHtml(folder.titlePlaceholder)}">
          <div class="pf2e-tokener-custom-folder-path">
            <input type="text" name="folders.${folder.index}.path" value="${escapeHtml(folder.path)}" placeholder="${escapeHtml(folder.pathPlaceholder)}">
            <button class="file-picker" type="button" data-folder-browser data-type="folder" data-target="folders.${folder.index}.path"><i class="fas fa-folder-open" aria-hidden="true"></i></button>
            <button type="button" data-folder-action="remove" data-folder-index="${folder.index}"><i class="fas fa-trash" aria-hidden="true"></i></button>
          </div>
          <div class="pf2e-tokener-custom-folder-tags">
            <div class="pf2e-tokener-custom-folder-tags-title">${escapeHtml(folder.tagsLabel)}</div>
            ${renderCustomFolderTagGroupsFallback(folder)}
          </div>
        </div>`,
    )
    .join('')}
    <button type="button" data-folder-action="add"><i class="fas fa-plus" aria-hidden="true"></i>${escapeHtml(context.addLabel)}</button>
  </div>`;
}

function renderCustomFolderTagGroupsFallback(folder) {
  if (!folder.tagGroups.length) return `<p class="notes">${escapeHtml(folder.tagsEmptyLabel)}</p>`;
  return folder.tagGroups
    .map(
      (group) => `
        <details class="pf2e-tokener-custom-folder-tag-group">
          <summary>
            <label>
              <input type="checkbox" data-folder-tag-group="${escapeHtml(group.id)}" ${group.selected ? 'checked' : ''}>
              <span>${escapeHtml(group.label)}</span>
            </label>
          </summary>
          <div class="pf2e-tokener-custom-folder-tag-options">
            ${group.options
              .map(
                (option) => `
                  <label class="pf2e-tokener-custom-folder-tag-option">
                    <input type="checkbox" name="folders.${folder.index}.tagIds" value="${escapeHtml(option.id)}" data-folder-tag-id="${escapeHtml(option.id)}" data-folder-tag-group-id="${escapeHtml(option.group)}" ${option.checked ? 'checked' : ''}>
                    <span>${escapeHtml(option.label)}</span>
                  </label>`,
              )
              .join('')}
          </div>
        </details>`,
    )
    .join('');
}

function prepareCustomFolderContext(folders, tagOptions = []) {
  const visibleFolders = folders.length ? folders : [createEmptyFolderRow()];
  return {
    addLabel: localize('Settings.CustomFolders.Add', 'Add folder'),
    browseLabel: localize('Settings.CustomFolders.Browse', 'Browse'),
    folders: visibleFolders.map((folder, index) => ({
      advancedLabel: localize('Settings.CustomFolders.AdvancedPaths', 'Advanced art folders'),
      index,
      path: folder.path ?? '',
      pathPlaceholder: localize('Settings.CustomFolders.PathPlaceholder', 'Folder path'),
      portraitPath: folder.portraitPath ?? '',
      portraitPathPlaceholder: localize(
        'Settings.CustomFolders.PortraitPathPlaceholder',
        'Portrait/artwork folder path',
      ),
      removeLabel: localize('Settings.CustomFolders.Remove', 'Remove'),
      subjectPath: folder.subjectPath ?? '',
      subjectPathPlaceholder: localize(
        'Settings.CustomFolders.SubjectPathPlaceholder',
        'Dynamic token subject folder path',
      ),
      tagGroups: prepareCustomFolderTagGroups(tagOptions, folder.tags, index),
      tagsEmptyLabel: localize('Settings.CustomFolders.TagsEmpty', 'No indexed tags available.'),
      tagsLabel: localize('Settings.CustomFolders.TagsLabel', 'Tags'),
      title: folder.title ?? '',
      titlePlaceholder: localize('Settings.CustomFolders.TitlePlaceholder', 'Source name'),
    })),
    hasFolders: visibleFolders.length > 0,
    hint: localize(
      'Settings.CustomFolders.MenuHint',
      'Choose custom token art folders and name each source.',
    ),
  };
}

async function getCustomFolderTagOptions() {
  const api = globalThis.game?.modules?.get?.(MODULE_ID)?.api;
  const index =
    (typeof api?.ensureIndex === 'function' ? await api.ensureIndex() : api?.index) ?? [];
  return getTagFilterOptions(index);
}

function prepareCustomFolderTagGroups(options, selectedTags, folderIndex) {
  const selectedIds = new Set(tagsToIds(selectedTags));
  return groupCustomFolderTagOptions(options).map((group) => {
    const preparedOptions = group.options.map((option) => ({
      ...option,
      checked: selectedIds.has(option.id),
      checkedAttribute: selectedIds.has(option.id) ? 'checked' : '',
      inputName: `folders.${folderIndex}.tagIds`,
    }));
    const selected =
      preparedOptions.length > 0 && preparedOptions.every((option) => option.checked);
    return {
      ...group,
      options: preparedOptions,
      selected,
      selectedAttribute: selected ? 'checked' : '',
    };
  });
}

function groupCustomFolderTagOptions(options) {
  const byGroup = new Map();
  for (const option of options ?? []) {
    const group = byGroup.get(option.group) ?? {
      id: option.group,
      label: normalizeLabel(option.group),
      options: [],
    };
    group.options.push(option);
    byGroup.set(option.group, group);
  }
  return [...byGroup.values()];
}

function activateCustomFolderDialog(dialog, { getFolders, setFolders, renderContent }) {
  const root = normalizeHudElement(dialog?.element);
  if (!root || root.dataset.pf2eTokenerCustomFoldersBound) return;
  root.dataset.pf2eTokenerCustomFoldersBound = 'true';

  root.addEventListener('click', async (event) => {
    const picker = event.target?.closest?.('[data-folder-browser]');
    if (picker) {
      event.preventDefault?.();
      await openCustomFolderBrowser(root, picker);
      return;
    }

    const action = event.target?.closest?.('[data-folder-action]');
    if (!action) return;

    event.preventDefault?.();
    const folders = getFormFolderEntries(root.querySelector?.('form'), getFolders());
    if (action.dataset.folderAction === 'add') {
      folders.push(createEmptyFolderRow());
    } else if (action.dataset.folderAction === 'remove') {
      folders.splice(Number(action.dataset.folderIndex), 1);
    }

    setFolders(folders);
    const content = root.querySelector?.('.dialog-content');
    if (content) {
      content.innerHTML = await renderContent();
    }
  });

  root.addEventListener('change', (event) => {
    const group = event.target?.closest?.('[data-folder-tag-group]');
    if (!group) return;

    const row = group.closest?.('[data-folder-index]');
    const groupId = group.dataset.folderTagGroup;
    row?.querySelectorAll?.(`[data-folder-tag-group-id="${groupId}"]`)?.forEach((input) => {
      input.checked = group.checked;
    });
  });
}

async function openCustomFolderBrowser(root, button) {
  const input = root.querySelector?.(`[name="${button.dataset.target}"]`);
  const DialogV2Class = resolveDialogV2Class();
  if (!input || !DialogV2Class?.input) return;

  return DialogV2Class.input({
    window: {
      icon: 'fas fa-folder-open',
      title: localize('Settings.CustomFolders.BrowserTitle', 'Custom folder browser'),
    },
    position: {
      width: 760,
    },
    content: await renderCustomFolderBrowserContent(input.value),
    render: (_event, dialog) => activateCustomFolderBrowser(dialog),
    ok: {
      label: localize('Settings.CustomFolders.SelectBrowserFolder', 'Select folder'),
      icon: 'fas fa-check',
      callback: async (_event, button) => {
        const selected = getCustomFolderBrowserPath(button.form);
        input.value = selected;
        input.dispatchEvent?.(new Event('change', { bubbles: true }));
        return selected;
      },
    },
  });
}

function activateCustomFolderBrowser(dialog) {
  const root = normalizeHudElement(dialog?.element);
  if (!root || root.dataset.pf2eTokenerFolderBrowserBound) return;
  root.dataset.pf2eTokenerFolderBrowserBound = 'true';

  root.addEventListener('click', async (event) => {
    const target = event.target?.closest?.('[data-folder-browser-path]');
    if (!target) return;

    event.preventDefault?.();
    const content = root.querySelector?.('.dialog-content');
    if (content)
      content.innerHTML = await renderCustomFolderBrowserContent(target.dataset.folderBrowserPath);
  });
}

async function renderCustomFolderBrowserContent(path) {
  const model = await getCustomFolderBrowserModel(path);
  return `<div class="pf2e-tokener-folder-browser">
    <div class="pf2e-tokener-folder-browser-bar">
      <button type="button" data-folder-browser-path="${escapeHtml(model.parentPath)}" ${model.parentPath === model.path ? 'disabled' : ''}>
        <i class="fas fa-level-up-alt" aria-hidden="true"></i>
      </button>
      <input type="text" name="folderBrowserPath" value="${escapeHtml(model.path)}" placeholder="${escapeHtml(localize('Settings.CustomFolders.PathPlaceholder', 'Folder path'))}">
    </div>
    <section class="pf2e-tokener-folder-browser-section">
      <h3>${escapeHtml(localize('Settings.CustomFolders.BrowserFolders', 'Folders'))}</h3>
      <div class="pf2e-tokener-folder-browser-folders">
        ${
          model.dirs.length
            ? model.dirs
                .map(
                  (
                    dir,
                  ) => `<button type="button" data-folder-browser-path="${escapeHtml(dir.path)}">
                    <i class="fas fa-folder" aria-hidden="true"></i>
                    <span>${escapeHtml(dir.label)}</span>
                  </button>`,
                )
                .join('')
            : `<p class="notes">${escapeHtml(localize('Settings.CustomFolders.BrowserNoFolders', 'No subfolders found.'))}</p>`
        }
      </div>
    </section>
    <section class="pf2e-tokener-folder-browser-section">
      <h3>${escapeHtml(model.imageCountLabel)}</h3>
      <div class="pf2e-tokener-folder-browser-images">
        ${
          model.images.length
            ? model.images
                .map(
                  (image) => `<figure>
                    <img src="${escapeHtml(image.path)}" loading="lazy" alt="">
                    <figcaption title="${escapeHtml(image.label)}">${escapeHtml(image.label)}</figcaption>
                  </figure>`,
                )
                .join('')
            : `<p class="notes">${escapeHtml(localize('Settings.CustomFolders.BrowserNoImages', 'No images found in this folder tree.'))}</p>`
        }
      </div>
    </section>
  </div>`;
}

async function getCustomFolderBrowserModel(path) {
  const normalizedPath = normalizeFolderPath(path);
  const immediate = await browseCustomFolderFiles(normalizedPath, { recursive: false });
  const recursive = await browseCustomFolderFiles(normalizedPath, { recursive: true });
  const dirs = immediate.dirs.map(normalizePath).filter(Boolean).sort(compareFolderPaths);
  const images = recursive.files
    .map(normalizePath)
    .filter((file) => IMAGE_EXTENSIONS.test(file))
    .sort(compareFolderPaths);
  const shownImages = images.slice(0, CUSTOM_FOLDER_BROWSER_IMAGE_LIMIT);
  const imageLabel =
    images.length > shownImages.length
      ? localize('Settings.CustomFolders.BrowserImagesLimited', 'Images ({shown} / {total})')
          .replace('{shown}', String(shownImages.length))
          .replace('{total}', String(images.length))
      : localize('Settings.CustomFolders.BrowserImages', 'Images ({count})').replace(
          '{count}',
          String(images.length),
        );

  return {
    dirs: dirs.map((dir) => ({ label: titleFromPath(dir), path: dir })),
    imageCountLabel: imageLabel,
    images: shownImages.map((image) => ({ label: image.split('/').pop() || image, path: image })),
    parentPath: parentFolderPath(normalizedPath),
    path: normalizedPath,
  };
}

async function browseCustomFolderFiles(path, { recursive }) {
  const picker = getFilePickerImplementation();
  if (!picker?.browse) return { dirs: [], files: [] };
  try {
    const result = await picker.browse('data', path, { recursive });
    return {
      dirs: Array.isArray(result?.dirs) ? result.dirs : [],
      files: Array.isArray(result?.files) ? result.files : [],
    };
  } catch {
    return { dirs: [], files: [] };
  }
}

function getFilePickerImplementation() {
  return (
    globalThis.foundry?.applications?.apps?.FilePicker?.implementation ??
    globalThis.FilePicker ??
    null
  );
}

function getCustomFolderBrowserPath(form) {
  if (!form || typeof FormData === 'undefined') return '';
  return normalizeFolderPath(new FormData(form).get('folderBrowserPath'));
}

function parentFolderPath(path) {
  const parts = normalizeFolderPath(path).split('/').filter(Boolean);
  parts.pop();
  return parts.join('/');
}

function compareFolderPaths(a, b) {
  return String(a).localeCompare(String(b), undefined, { sensitivity: 'base' });
}

function sourceToFormFolder(source) {
  return {
    imageTags: source.imageTags,
    path: source.path ?? '',
    portraitPath: source.portraitPath ?? '',
    subjectPath: source.subjectPath ?? '',
    tags: source.tags,
    title: source.title ?? '',
  };
}

function createEmptyFolderRow() {
  return { path: '', tags: '', title: '' };
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
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
  if (
    (sources ?? []).some(
      (source) => source.tags || source.imageTags || source.portraitPath || source.subjectPath,
    )
  ) {
    return JSON.stringify(
      (sources ?? []).map(({ imageTags, path, portraitPath, subjectPath, tags, title }) => ({
        ...(imageTags ? { imageTags } : {}),
        path,
        ...(portraitPath ? { portraitPath } : {}),
        ...(subjectPath ? { subjectPath } : {}),
        ...(tags ? { tags } : {}),
        title,
      })),
      null,
      2,
    );
  }

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
  const portraitPath = normalizeFolderPath(raw.portraitPath);
  const subjectPath = normalizeFolderPath(raw.subjectPath);
  const tags = normalizeCustomFolderTags(raw.tags);
  const imageTags = normalizeCustomFolderImageTags(raw.imageTags);

  return {
    id: `${CUSTOM_FOLDER_SOURCE_PREFIX}${path}`,
    ...(imageTags ? { imageTags } : {}),
    path,
    ...(portraitPath ? { portraitPath } : {}),
    ...(subjectPath ? { subjectPath } : {}),
    ...(tags ? { tags } : {}),
    title: normalizeLabel(raw.title) || titleFromPath(path),
  };
}

function getFormFolderEntries(form, existingFolders = getCustomFolderSources()) {
  if (!form || typeof FormData === 'undefined') return existingFolders;
  const data = {};
  for (const [key, value] of new FormData(form).entries()) {
    if (Object.hasOwn(data, key)) data[key] = [...[data[key]].flat(), value];
    else data[key] = value;
  }
  return getSubmittedFolderEntries(data, existingFolders);
}

function getSubmittedFolderEntries(data, existingFolders = []) {
  const rows = new Map();
  const existingByPath = new Map(
    (existingFolders ?? [])
      .map((folder) => [normalizeFolderPath(folder?.path), folder])
      .filter(([path]) => path),
  );

  for (const [key, value] of Object.entries(data ?? {})) {
    const match = key.match(/^folders\.(\d+)\.(path|portraitPath|subjectPath|tagIds|tags|title)$/);
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
    .map(([, row]) => {
      const path = row?.path;
      const existing = existingByPath.get(normalizeFolderPath(path));
      return {
        ...(existing?.imageTags ? { imageTags: existing.imageTags } : {}),
        path,
        portraitPath: row?.portraitPath,
        subjectPath: row?.subjectPath,
        tags: row?.tags ?? tagIdsToTags(row?.tagIds),
        title: row?.title,
      };
    });
}

function getObjectFolderEntry(entry) {
  return {
    imageTags: entry.imageTags ?? entry.images ?? entry.imageTagOverrides,
    path: entry.path ?? entry.tokenPath ?? entry.folder ?? entry.target,
    portraitPath: entry.portraitPath ?? entry.artworkPath ?? entry.artPath,
    subjectPath: entry.subjectPath ?? entry.dynamicTokenPath,
    tags: entry.tags ?? entry.tag ?? tagIdsToTags(entry.tagIds),
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

function normalizeCustomFolderTags(tags) {
  if (typeof tags === 'string') return tagsTextToObject(tags);
  if (!isObject(tags)) return undefined;

  const normalized = {};
  for (const [group, values] of Object.entries(tags)) {
    addTagValues(normalized, group, Array.isArray(values) ? values : [values]);
  }
  return Object.keys(normalized).length ? normalized : undefined;
}

function normalizeCustomFolderImageTags(imageTags) {
  if (!isObject(imageTags)) return undefined;

  const normalized = {};
  for (const [path, tags] of Object.entries(imageTags)) {
    const imagePath = normalizePath(path);
    const normalizedTags = normalizeCustomFolderTags(tags);
    if (imagePath && normalizedTags) normalized[imagePath] = normalizedTags;
  }
  return Object.keys(normalized).length ? normalized : undefined;
}

function tagIdsToTags(tagIds) {
  const ids = Array.isArray(tagIds) ? tagIds : tagIds ? [tagIds] : [];
  const normalized = {};
  for (const id of ids) {
    const separator = String(id ?? '').indexOf(':');
    if (separator === -1) continue;
    addTagValues(normalized, String(id).slice(0, separator), [String(id).slice(separator + 1)]);
  }
  return Object.keys(normalized).length ? normalized : undefined;
}

function tagsTextToObject(text) {
  const normalized = {};
  for (const part of String(text ?? '')
    .split(/[\n;,]+/)
    .map((value) => value.trim())
    .filter(Boolean)) {
    const separator = part.indexOf(':');
    const group = separator === -1 ? 'tag' : part.slice(0, separator);
    const value = separator === -1 ? part : part.slice(separator + 1);
    addTagValues(normalized, group, [value]);
  }
  return Object.keys(normalized).length ? normalized : undefined;
}

function addTagValues(target, group, values) {
  const groupKey = normalizeSearchText(group);
  if (!groupKey) return;
  const list = values.map((value) => normalizeSearchText(value)).filter(Boolean);
  if (!list.length) return;
  target[groupKey] = [...new Set([...(target[groupKey] ?? []), ...list])];
}

function tagsToText(tags) {
  if (!isObject(tags)) return '';
  return Object.entries(tags)
    .flatMap(([group, values]) =>
      (Array.isArray(values) ? values : [values])
        .map((value) => normalizeSearchText(value))
        .filter(Boolean)
        .map((value) => (group === 'tag' || group === 'tags' ? value : `${group}:${value}`)),
    )
    .join(', ');
}

function tagsToIds(tags) {
  if (!isObject(tags)) return [];
  return Object.entries(tags).flatMap(([group, values]) =>
    (Array.isArray(values) ? values : [values])
      .map((value) => normalizeSearchText(value))
      .filter(Boolean)
      .map((value) => `${normalizeSearchText(group)}:${value}`),
  );
}

function normalizeFolderPath(path) {
  return normalizePath(path)
    .replace(/^data:/i, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .trim();
}

function isImageInCustomFolderSource(imagePath, source) {
  const sourcePath = normalizePath(source?.path);
  return Boolean(
    sourcePath && (imagePath === sourcePath || imagePath.startsWith(`${sourcePath}/`)),
  );
}

function titleFromPath(path) {
  const folder = path.split('/').filter(Boolean).pop() || path;
  return normalizeLabel(folder.replace(/[-_]+/g, ' '));
}
