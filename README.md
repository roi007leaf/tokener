# Tokener

Tokener adds a searchable token art picker to the Foundry VTT Token HUD.

Select a token, open its HUD, click the Tokener button, then search and apply art from enabled token-art modules or your own world data folders. The picker opens as a Foundry ApplicationV2 window, so it stays open while you pan or zoom the canvas.

Tokener does not include art. It indexes image files and art metadata from other enabled sources, then points selected tokens and actors at those existing images.

The internal module id remains `pf2e-tokener` so existing settings, favorites, tag overrides, and revert flags keep working.

## Feature Summary

- Token HUD button for selected tokens in any Foundry system.
- Searchable gallery of token art from enabled token-art modules.
- System-profile support for native compendium art mappings keyed by the active system id.
- PF2e compatibility profile for existing PF2e compendium art mappings and legacy `pf2e-art` mapping modules.
- Support for mapped module art, gallery datasheets, common token folders, actor portraits, and dynamic token ring subject art.
- Custom world data folders with optional source names, recursive scans, folder browser thumbnails, source-level tags, nested `folder:*` tags, and advanced split paths for token, portrait/artwork, and subject images.
- Search by actor name, creature or NPC name, filename, module/source name, broad terms, or tags.
- Multi-source filter with source search, select all, and clear all.
- Tag filters grouped by category, with include and exclude controls.
- Direct tag search syntax such as `ancestry:human`, `equipment:sword`, `tag:magic`, and `!family:undead`.
- Client-side favorites with a sidebar favorites filter.
- GM image tag overrides for any indexed image, with source tags kept read-only.
- Matched tag chips on result cards and grouped tags in fullscreen preview.
- `Token`, `Actor`, `Portrait`, and `Both` apply actions.
- Revert last Tokener change from the sidebar or by right-clicking the highlighted HUD button.
- Current-token marker, result counts, paging with `Show more`, and scroll preservation while applying art or changing filters.

## Compatibility

- Foundry VTT v13 and v14.
- System-agnostic default behavior for token folders, datasheets, custom folders, actor portraits, and token image updates.
- First-class PF2e profile for Pathfinder token packs and legacy PF2e art mappings.
- Best with enabled token art modules that use recognized token folders, datasheets, or active-system compendium art mappings.

## Supported Art Sources

Tokener builds its index when the world loads and when relevant Tokener settings change.

It can index:

- Native compendium art mappings for the active system, such as `compendiumArtMappings.dnd5e`, `compendiumArtMappings.pf2e`, or `compendiumArtMappings.sf2e`.
- Older PF2e `pf2e-art` mapping modules when the active system is PF2e.
- Gallery datasheets with searchable tags.
- Datasheet JSON files discovered in common module data folders.
- Token images in common module paths such as `tokens`, `assets/tokens`, and `resources/tokens`.
- Matching portrait art in paths such as `art`, `portraits`, `assets/art`, `assets/portraits`, `resources/art`, and `resources/portraits`.
- Matching dynamic token subject art in paths such as `subjects`, `assets/subjects`, and `resources/subjects`.
- Custom world data folders configured in the module settings.

Known compatible source styles include:

- Pathfinder Tokens: Bestiaries
- Pathfinder Tokens: Monster Core
- Pathfinder Tokens: Monster Core 2
- Pathfinder Tokens: NPC Core
- Pathfinder Tokens: Character Gallery
- Pathfinder Tokens: Myth and Magic
- Pathfinder Tokens: Draconic Codex
- Starfinder Tokens: Alien Core
- older PF2e art mapping modules such as PF2e All Tokens
- other token modules that use recognizable token folders, active-system mappings, or datasheets

Some sources only provide token images. When portrait or subject art is missing, Tokener hides unavailable panes and actions instead of showing broken image placeholders.

## Installation

1. Install Tokener in Foundry VTT.
2. Enable it in your world.
3. Enable the token art modules you want to search.
4. Reload the world.

Reload after enabling or disabling token art modules so the index can be rebuilt.

## How To Use

1. Select a token on the canvas.
2. Open the Token HUD.
3. Click the Tokener image button.
4. Search, filter, or browse matching art.
5. Click a card to reveal apply buttons.
6. Choose what to update.

Right-click a result card to open fullscreen preview.

## Apply Actions

| Button     | What It Changes                                                                                                 |
| ---------- | --------------------------------------------------------------------------------------------------------------- |
| `Token`    | Selected token on the current scene. Also applies dynamic token ring subject art when available.                |
| `Actor`    | Actor portrait and actor default token art. Also applies default dynamic token ring subject art when available. |
| `Portrait` | Actor portrait only. Uses separate portrait art when available, otherwise falls back to token art.              |
| `Both`     | Selected scene token plus actor default token art. Also updates actor portrait when portrait art is available.  |

Use `Token` for a one-time scene change.

Use `Actor` when future tokens created from that actor should use the new art.

Use `Portrait` when only the actor sheet image should change.

Use `Both` when the current scene token and future actor tokens should match.

## Reverting Changes

After applying art, Tokener stores one recent revert point for the selected token or actor.

Use `Revert last` in the sidebar to restore the previous art for the last Tokener action. When a token or actor has a revert point, the Tokener HUD button is highlighted. Right-click that highlighted HUD button to revert without opening the picker.

Revert can restore:

- selected scene token image, scale, and ring subject data
- actor default token image, scale, and ring subject data
- actor portrait

Making another Tokener change replaces the stored revert point.

## Searching And Filtering

The search box starts empty so you can type immediately. Tokener still uses the selected token behind the scenes to put exact and same-name results in `Best matches`.

You can search by:

- actor, creature, or NPC name
- token filename
- module or source name
- folder name from custom folders
- tags from supported galleries and GM overrides
- broad terms such as `dragon`, `kobold`, `guard`, or `sword`

The left sidebar includes:

- source filter with source search, select all, and clear all
- `Favorites` filter
- grouped `Filters` panel for tags
- tag search inside the filter panel
- active included and excluded tag chips
- `Clear tags`
- `Revert last` when available

Selecting a source, tag, excluded tag, or favorites filter while the main search box is empty browses all matching art. Tokener shows the first 120 results and offers `Show more` when more matches are available.

Direct tag searches work in the main search box:

- `ancestry:human`
- `equipment:sword`
- `family:warrior`
- `category:humanoid`
- `tag:magic`
- `folder:npcs`
- `!equipment:firearm`
- `-family:undead`

When a tag helps match a result, Tokener shows that matched tag on the result card.

## Favorites

Click the star on any result to mark that art as a favorite.

Use `Favorites` in the sidebar to show only starred art. Favorites are saved as a client setting, so each Foundry user keeps their own favorite list.

## Image Tag Overrides

GMs can click the tag button on a result card to edit GM-added tags for that image.

Image tag overrides:

- work on all indexed art sources, not only custom folders
- are saved as a world setting
- are searchable and filterable after the index rebuilds
- can use existing tag groups or new custom group/value pairs
- preserve original source tags as read-only tags

Original module or datasheet tags are not changed.

## Custom Folders

Use `Configure` beside the `Custom token folders` module setting to add your own world data folders as extra sources.

Each custom folder can have:

- source name
- token folder path
- source-level tags applied to every indexed image from that folder
- optional portrait/artwork folder path
- optional dynamic token subject folder path

Use the folder button to browse Foundry data folders. The custom folder browser shows subfolders and image thumbnails so you can confirm the folder before selecting it.

Tokener scans custom folders recursively. If images live under recognizable `tokens`, `art`, `portraits`, or `subjects` folders, it links token, portrait, and subject images by matching filenames. If no token folder is found, every image in the custom folder can be treated as token art.

Nested custom folder names become searchable `folder:*` tags, excluding structural names such as `tokens`, `art`, `portraits`, `subjects`, `assets`, and `resources`.

You can also type simple paths manually in the setting:

- `tokens/npcs`
- `My NPCs | uploads/npcs`

Separate multiple entries with commas, semicolons, or new lines. Structured custom folder settings remain compatible with older plain path entries.

## Previewing Art

Right-click any result to open fullscreen preview.

The preview shows:

- actor portrait image when available
- token image when available
- source module or custom source name
- associated tags grouped by category

Close preview with the close button, `Escape`, or clicking outside the preview.

## Notes

- Tokener only changes token and actor image references.
- It does not change, copy, import, or generate image files.
- It rebuilds its gallery index on world load and after Tokener tag or custom folder setting changes.
- Result cards use the best available preview source and recover when one image side is missing.
- Utility images such as hazards, treasure, rings, backgrounds, or trackers may not have actor portraits.

## Troubleshooting

### The Tokener Button Does Not Appear

Check that:

- Tokener is enabled
- a token is selected
- your user has permission to update that token
- your Foundry version supports ApplicationV2

### Search Shows No Results

Check that:

- at least one token art module or custom folder source is enabled
- the world was reloaded after enabling token modules
- custom folder paths point inside Foundry data storage
- source, favorites, included tags, or excluded tags are not hiding the art
- the search text is not too specific

Try clearing search, sources, favorites, and tags.

### Actor Image Is Missing In Preview

Some sources only provide token art. Tokener shows portrait panes only when portrait art exists or can be linked by filename.

### Dynamic Token Ring Subject Is Missing

Subject art is only applied when the source provides matching subject art through mappings, datasheets, recognized `subjects` folders, or the custom folder subject path.

### I Enabled A New Token Module But Do Not See It

Reload the Foundry world after enabling or disabling token art modules.

### The Wrong Pack Appears First

Tokener puts exact actor matches and same-name results first when it can identify them. If several packs have similar names or art, use the source filter to narrow results.

## License

See `LICENSE`.
