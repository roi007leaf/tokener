# Changelog

## 1.0.1 - 2026-05-06

### New

- Added favorites for token art results.
- Added a star button on each result card so preferred art can be marked quickly.
- Added a `Favorites` filter beside `Tags` to show only starred art.
- Added tag exclusion so unwanted traits, gear, families, or categories can be filtered out.
- Added `Show more` paging when source, tag, or favorites browsing has more than 120 matches.
- Added associated tags to the right-click fullscreen preview.
- Added a highlighted HUD button state when the selected token or actor has a Tokener change that can be reverted.
- Added right-click revert on the highlighted HUD button.
- Favorites are saved per Foundry client, so each user can keep their own preferred art list.

### Improved

- Reworked the tag picker into a distinct `Filters` panel with grouped tag facets.
- Selecting a source, tag, excluded tag, or favorites filter with an empty search now browses matching art automatically.
- Search, sources, tags, favorites, and revert controls now live in the left sidebar so token results keep more space in the picker.

## 1.0.0 - 2026-05-05

Initial release of PF2e Tokener.

### New

- Added a PF2e Tokener button to the Token HUD.
- Added a searchable gallery for token images from enabled token art modules.
- Added support for Foundry VTT v13 and v14.
- Added support for common PF2e token packs, including Bestiaries, Monster Core, Monster Core 2, NPC Core, Character Gallery, Myth and Magic, Draconic Codex, and similar packs.
- Added support for older PF2e token art packs such as PF2e All Tokens.
- Added automatic matching for token images, actor portraits, and token ring subject art when a module provides them.
- Added `Best matches` for exact or same-name results.
- Added broader search results for related names and terms.
- Added tag-aware search for supported galleries, including searches like `ancestry:human`, `equipment:sword`, `family:warrior`, `category:humanoid`, and `tag:magic`.
- Added a visible `Tags` picker for browsing and applying tag filters without knowing the exact search syntax.
- Added a `Revert last` control to restore art from before the last Tokener action on the selected token or actor.
- Added matched tag chips on search results when tags helped find that art.
- Added multi-source filtering so you can search one token pack or several token packs at once.
- Added result counts and current-token markers.
- Added compact thumbnail cards for quick browsing.
- Added tooltips for long token names and source names.
- Added right-click fullscreen preview.
- Added side-by-side actor portrait and token image preview.
- Added close button, `Escape` close, and click-outside close for previews.
- Added a real Foundry application window for the token picker so it stays open while the canvas pans.
- Converted the token picker window to a Handlebars ApplicationV2 template for easier UI maintenance.
- Added canvas pan and zoom resilience so the picker stays usable while the scene view changes.
- Added English localization.

### Actions

- Added `Token`, which changes only the selected token on the current scene.
- Added `Actor`, which changes the actor portrait and the actor's default token art.
- Added `Portrait`, which changes only the actor portrait.
- Added `Both`, which changes the selected scene token and the actor's default token art.

### Improved

- Source filtering now searches all indexed sources, not only sources that matched the selected token first.
- Search can now find results from other enabled token packs even when the selected token came from a different source.
- Tag browsing now uses all discovered datasheet tags instead of only a short top-tag list.
- Tag browsing now has grouped categories, tag search, active tag chips, and a clear-tags button.
- Search, sources, tags, and revert controls now live in a left sidebar so token results get more of the picker window.
- Selected tags now stay as chips instead of being inserted into the main search text.
- The search box now starts empty while best matches still use the selected token automatically.
- Token datasheets are now discovered from common datasheet folders in token modules, so more installed token packs can contribute searchable tags.
- Duplicate results from the same token image are merged so the richer result is shown.
- Folder-based token images can now pick up matching actor portraits and token ring subject art when those images use the same filename.
- Character Gallery entries now show actor images when portrait art is available.
- Monster Core 2 entries now show actor images when portrait art is available.
- Result cards now show the art name and keep the source module in the tooltip.

### Fixed

- Fixed action buttons stretching every card in the same grid row.
- Fixed missing tooltips on shortened names.
- Fixed single-source dropdown limitations by replacing it with a multi-source picker.
- Fixed searches being too limited after opening the picker from a specific token.
- Fixed cases where a token result showed no actor image even though the source module had one.
- Fixed Monster Core 2 results such as Dragon Adult Phase showing token art without actor art.
- Fixed Character Gallery preview results missing actor portrait art.
- Fixed broad results repeating the selected token name on every card instead of showing each result's real name.
- Fixed result titles disappearing on non-current cards after moving the source module into the tooltip.
- Fixed fullscreen preview panes showing broken image placeholders when that side has no valid art.

### Notes

- PF2e Tokener does not include art. It uses art from enabled modules.
- Some modules only provide token images, so the fullscreen preview may show only the token image for those results.
- Utility images such as treasure, hazards, rings, point trackers, or backgrounds may not have actor portraits.
- Reload the world after enabling or disabling token art modules.
