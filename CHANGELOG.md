# Changelog

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
- Selected tags now stay as chips instead of being inserted into the main search text.
- Token datasheets are now discovered from common datasheet folders in token modules, so more installed token packs can contribute searchable tags.
- Duplicate results from the same token image are merged so the richer result is shown.
- Folder-based token images can now pick up matching actor portraits and token ring subject art when those images use the same filename.
- Character Gallery entries now show actor images when portrait art is available.
- Monster Core 2 entries now show actor images when portrait art is available.

### Fixed

- Fixed action buttons stretching every card in the same grid row.
- Fixed missing tooltips on shortened names.
- Fixed single-source dropdown limitations by replacing it with a multi-source picker.
- Fixed searches being too limited after opening the picker from a specific token.
- Fixed cases where a token result showed no actor image even though the source module had one.
- Fixed Monster Core 2 results such as Dragon Adult Phase showing token art without actor art.
- Fixed Character Gallery preview results missing actor portrait art.

### Notes

- PF2e Tokener does not include art. It uses art from enabled modules.
- Some modules only provide token images, so actor portrait preview may be empty for those results.
- Utility images such as treasure, hazards, rings, point trackers, or backgrounds may not have actor portraits.
- Reload the world after enabling or disabling token art modules.
