# PF2e Tokener

PF2e Tokener adds a fast token image picker to the Foundry VTT Token HUD for Pathfinder Second Edition.

When you select a token, open its HUD, and click the PF2e Tokener button, you get a searchable gallery of token art from your enabled token modules. Pick an image, choose what to update, and keep playing.

## Who This Is For

PF2e Tokener is mainly for GMs who use several PF2e token art modules and want a quicker way to swap token art during prep or play.

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

Some third-party modules only include token images and do not include actor portrait images. In those cases, the preview will show the token image and say that no actor image is available.

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

The search box starts with the selected actor's name.

You can search by:

- creature name
- NPC name
- token filename
- token module name
- broad terms such as `dragon`, `kobold`, or `guard`

Best matches appear first. Broader results appear below them.

## Source Filter

The source filter lets you choose which token packs to search.

You can:

- search all sources
- pick one source
- pick several sources
- clear the selection to return to all sources

This is useful when several modules include similar creatures.

## Current Token Marker

If a result already matches the selected token's current image, it is marked as current.

## Canvas Zoom

The picker adjusts to your canvas zoom so it stays usable while you are zoomed in or out.

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

If PF2e Tokener can find both, it shows both. If a module only has token art, the actor image side will be empty.

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
