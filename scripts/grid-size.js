import { MODULE_ID, PICKER_GRID_SIZE_SETTING_KEY } from './constants.js';
import { clamp, localize, numberOr } from './utils.js';

export const MIN_PICKER_GRID_SIZE = 40;
export const MAX_PICKER_GRID_SIZE = 200;
export const PICKER_GRID_SIZE_STEP = 2;
export const DEFAULT_PICKER_GRID_SIZE = 54;

export function registerPickerGridSizeSetting(settings = globalThis.game?.settings) {
  settings?.register?.(MODULE_ID, PICKER_GRID_SIZE_SETTING_KEY, {
    name: localize('Settings.PickerGridSize.Name', 'Token browser grid size'),
    hint: localize(
      'Settings.PickerGridSize.Hint',
      'Client-side default thumbnail size for the Tokener browser.',
    ),
    scope: 'client',
    config: false,
    type: Number,
    default: DEFAULT_PICKER_GRID_SIZE,
  });
}

export function getPickerGridSize(settings = globalThis.game?.settings) {
  try {
    return normalizePickerGridSize(settings?.get?.(MODULE_ID, PICKER_GRID_SIZE_SETTING_KEY));
  } catch {
    return DEFAULT_PICKER_GRID_SIZE;
  }
}

export async function setPickerGridSize(value, settings = globalThis.game?.settings) {
  const size = normalizePickerGridSize(value);
  await settings?.set?.(MODULE_ID, PICKER_GRID_SIZE_SETTING_KEY, size);
  return size;
}

export function normalizePickerGridSize(value) {
  const size = numberOr(value, DEFAULT_PICKER_GRID_SIZE);
  const stepped = Math.round(size / PICKER_GRID_SIZE_STEP) * PICKER_GRID_SIZE_STEP;
  return clamp(stepped, MIN_PICKER_GRID_SIZE, MAX_PICKER_GRID_SIZE);
}

export function getPickerGridMinSize(value) {
  return normalizePickerGridSize(value) + 50;
}

export function preparePickerGridSizeView(value = getPickerGridSize()) {
  const size = normalizePickerGridSize(value);
  return {
    gridMin: getPickerGridMinSize(size),
    label: localize('HUD.GridSize', 'Size'),
    max: MAX_PICKER_GRID_SIZE,
    min: MIN_PICKER_GRID_SIZE,
    step: PICKER_GRID_SIZE_STEP,
    tooltip: localize('HUD.GridSizeTooltip', 'Adjust token art grid size.'),
    value: size,
    valueLabel: `${size}px`,
  };
}
