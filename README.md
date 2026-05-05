# PF2e Tokener

PF2e Tokener adds a fast token image picker to the Foundry VTT Token HUD for Pathfinder Second Edition.

When you select a token, open its HUD, and click the PF2e Tokener button, you get a searchable gallery of token art from your enabled token modules. The gallery opens as a Foundry window, so it stays in place while you pan or zoom the canvas. Pick an image, choose what to update, and keep playing.

## Who This Is For

PF2e Tokener is for GMs who use several PF2e token art modules and want a quicker way to swap token art during prep or play.

Use it when you want to:

- Try alternate art for a creature.
- Swap a scene token without opening the token sheet.
- Update an actor portrait and token from the same place.
- Search across several installed token packs at once.
- Compare the portrait and token art before choosing.

## Compatibility

- Foundry VTT v13 and v14.
- Pathfinder Second Edition worlds.
- Works best with enabled PF2e token art modules.

## Supported Art Sources

PF2e Tokener looks through enabled token modules and builds a temporary gallery when your world loads.

It supports common PF2e token module styles, including:

- Pathfinder Tokens: Bestiaries
- Pathfinder Tokens: Monster Core
- Pathfinder Tokens: Monster Core 2
- Pathfinder Tokens: NPC Core
- Pathfinder Tokens: Character Gallery
- Pathfinder Tokens: Myth and Magic
- Pathfinder Tokens: Draconic Codex
- Starfinder Tokens: Alien Core
- older PF2e art mapping modules such as PF2e All Tokens
- other token modules that store images in recognizable token folders

Some third-party modules only include token images and do not include actor portrait images. In those cases, PF2e Tokener hides the missing image side and shows only the art it can use.

## Installation

1. Install the module in Foundry VTT.
2. Enable PF2e Tokener in your PF2e world.
3. Enable the token art modules you want to use.
4. Reload the world.

PF2e Tokener does not include token art by itself. It uses art from other enabled modules.

## How To Use

1. Select a token on the canvas.
2. Open the Token HUD.
3. Click the PF2e Tokener image button.
4. Search for a creature, NPC, or art source.
5. Use the source filter if you want to limit results to one or more token packs.
6. Click a thumbnail to show the action buttons.
7. Choose what you want to update.

## Action Buttons

| Button     | What It Changes                                        |
| ---------- | ------------------------------------------------------ |
| `Token`    | Only the selected token on the current scene.          |
| `Actor`    | The actor portrait and the actor's default token art.  |
| `Portrait` | Only the actor portrait.                               |
| `Both`     | The selected scene token and the actor's default token |

Use `Token` for a one-time scene change.

Use `Actor` when you want future tokens created from that actor to use the new art.

Use `Portrait` when you only want the actor sheet image to change.

Use `Both` when you want the current token and the actor's default token to match.

## Previewing Art

Right-click any result to open a fullscreen preview.

The preview shows:

- actor portrait image on the left
- token image on the right

Close the preview with:

- the close button
- `Escape`
- clicking outside the preview

## Searching

The search box starts empty so you can search immediately. PF2e Tokener still uses the selected token behind the scenes to show best matches first.

You can search by:

- creature name
- NPC name
- token filename
- token module name
- tags from supported galleries, such as ancestry, equipment, family, category, or features
- broad terms such as `dragon`, `kobold`, or `guard`

Some gallery modules include tags. For example, a search like `human sword warrior` can find art tagged with those ideas even when they are not all in the character name.

Use the `Tags` button under the search bar to browse available tags. Tags are grouped by category, such as ancestry, equipment, family, features, and special traits. The tag browser has its own search box, so you can quickly narrow a long list of tags without changing your main token search.

Selecting a tag filters the results without changing the text in the main search box. Active tags appear as small chips and can be removed one at a time or cleared together.

You can also use direct tag searches:

- `ancestry:human`
- `equipment:sword`
- `family:warrior`
- `category:humanoid`
- `tag:magic`

When a tag helped match a result, PF2e Tokener shows the matched tags as small chips on that result.

Best matches appear first. Broader results appear below them.

Result cards show the art name. Hover a shortened card name to see the full name and the source module.

## Source Filter

The source filter lets you choose which token packs to search.

You can:

- search all sources
- pick one source
- pick several sources
- clear all sources
- select all sources again

This is useful when several modules include similar creatures.

## Current Token Marker

If a result already matches the selected token's current image, it is marked as current.

## Canvas Pan And Zoom

The picker opens in its own Foundry window. It does not disappear when the canvas pans, and it stays readable while the canvas zoom changes.

## Troubleshooting

### The PF2e Tokener Button Does Not Appear

Check that:

- the world is using the Pathfinder Second Edition system
- PF2e Tokener is enabled
- you selected a token
- you have permission to update that token

### Search Shows No Results

Check that:

- at least one token art module is enabled
- the world was reloaded after enabling token modules
- your source filter is not hiding the module you want
- the search text is not too specific

Try clearing the search and source filter.

### Actor Image Is Missing In Preview

Some modules only provide token art. Others provide actor portraits too.

If PF2e Tokener can find both, it shows both. If a module only has token art, the preview shows only the token image.

### I Enabled A New Token Module But Do Not See It

Reload the Foundry world after enabling or disabling token art modules.

### The Wrong Pack Appears First

PF2e Tokener puts exact actor matches first when it can identify them. If several packs have similar names or art, use the source filter to narrow the results.

## Notes

- PF2e Tokener does not change or copy image files.
- PF2e Tokener does not add new art to your world.
- PF2e Tokener only points selected tokens and actors at images that already exist in enabled modules.
- The gallery is rebuilt when the world loads.

## License

See `LICENSE`.
