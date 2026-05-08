# Per-Card Token Scale Controls Design

## Goal

Add a fast way to change token scale while applying token art from the picker. The control lives on each expanded card so the scale is tied to the art being applied and does not create hidden picker-wide state.

## User Experience

When a token art card is expanded, the action area shows a compact numeric `Scale` control above the existing apply buttons. The field defaults to that candidate's indexed token scale, falling back to `1`. The GM can adjust it and then press `Token`, `Actor`, or `Both`.

The same scale value applies to:

- `texture.scaleX`
- `texture.scaleY`
- `ring.subject.scale`, when the candidate has dynamic token subject art
- `prototypeToken` equivalents for `Actor` and `Both`

Portrait-only actions ignore scale because they do not update token texture fields.

## Behavior

The input accepts decimal values from `0.25` to `3` in `0.05` increments. Invalid, empty, or non-positive values fall back to the candidate's original scale, then to `1`.

Scale changes are temporary per rendered card. They are not stored in module settings, not written back to the index, and not shared across cards. Re-rendering resets controls to candidate defaults.

The existing revert flow remains unchanged because it already captures previous token texture scale and dynamic ring subject scale before applying changes.

## Implementation Shape

`buildTokenUpdate` and `buildActorUpdate` will accept an optional scale override. The override will be normalized once and applied to token texture scale and dynamic subject scale. Without an override, existing candidate scale behavior remains unchanged.

`prepareCandidateView` will provide scale-control view data for candidates with token actions. The Handlebars template will render the field inside `.pf2e-tokener-actions`, before apply buttons.

`applyCandidateAction` will read the expanded card's scale input and pass it to token/actor update builders. Portrait-only apply remains unaffected.

## Testing

Tests will cover:

- `buildTokenUpdate` applies an override to texture scale and dynamic subject scale.
- `buildActorUpdate` applies the same override to prototype token fields.
- Invalid override values fall back to candidate/default scale.
- Picker template renders the per-card scale input.
- Apply path reads the card input and passes scale options into update builders.

