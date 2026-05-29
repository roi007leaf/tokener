import fs from 'node:fs';
import path from 'node:path';

import { localize } from '../scripts/pf2e-tokener.js';

test('manifest declares English localization file', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'module.json'), 'utf8'));

  expect(manifest.languages).toEqual([
    {
      lang: 'en',
      name: 'English',
      path: 'languages/en.json',
    },
  ]);
});

test('English localization file contains HUD/action/notification strings', () => {
  const translations = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'languages', 'en.json'), 'utf8'),
  );

  expect(translations['PF2ETokener.HUD.Tooltip']).toBe('Tokener');
  expect(translations['PF2ETokener.HUD.RevertButtonTooltip']).toBe(
    'Tokener - right-click to revert last change.',
  );
  expect(translations['PF2ETokener.HUD.SearchPlaceholder']).toBe('Search tokens');
  expect(translations['PF2ETokener.HUD.AllSources']).toBe('All sources');
  expect(translations['PF2ETokener.HUD.NoSources']).toBe('No sources');
  expect(translations['PF2ETokener.HUD.SourcesSelected']).toBe('{count} sources');
  expect(translations['PF2ETokener.HUD.SelectAllSources']).toBe('Select all');
  expect(translations['PF2ETokener.HUD.ClearSources']).toBe('Clear all');
  expect(translations['PF2ETokener.HUD.Filters']).toBe('Filters');
  expect(translations['PF2ETokener.HUD.Tags']).toBe('Tags');
  expect(translations['PF2ETokener.HUD.TagSearchPlaceholder']).toBe('Search tags');
  expect(translations['PF2ETokener.HUD.ClearTags']).toBe('Clear tags');
  expect(translations['PF2ETokener.HUD.ResetTags']).toBeUndefined();
  expect(translations['PF2ETokener.HUD.IncludeTag']).toBe('Include tag');
  expect(translations['PF2ETokener.HUD.ExcludeTag']).toBe('Exclude tag');
  expect(translations['PF2ETokener.HUD.GridSize']).toBe('Size');
  expect(translations['PF2ETokener.HUD.GridSizeTooltip']).toBe('Adjust token art grid size.');
  expect(translations['PF2ETokener.HUD.ShowMore']).toBe('Show more');
  expect(translations['PF2ETokener.Actions.Token']).toBe('Token');
  expect(translations['PF2ETokener.Actions.Actor']).toBe('Actor');
  expect(translations['PF2ETokener.Actions.Portrait']).toBe('Portrait');
  expect(translations['PF2ETokener.Actions.Both']).toBe('Both');
  expect(translations['PF2ETokener.Notifications.Applied']).toBe('Tokener: token art applied.');
});

test('localize uses Foundry i18n and falls back when unavailable', () => {
  expect(localize('HUD.SearchPlaceholder', 'Search tokens')).toBe('Search tokens');

  const previousGame = globalThis.game;
  globalThis.game = {
    i18n: {
      localize: (key) => (key === 'PF2ETokener.HUD.SearchPlaceholder' ? 'Localized search' : key),
    },
  };

  try {
    expect(localize('HUD.SearchPlaceholder', 'Search tokens')).toBe('Localized search');
    expect(localize('HUD.Missing', 'Fallback')).toBe('Fallback');
  } finally {
    if (previousGame === undefined) delete globalThis.game;
    else globalThis.game = previousGame;
  }
});
