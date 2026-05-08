# Per-Card Token Scale Controls Design

## Goal

Add a fast way to preview and change token scale while applying token art from the picker. The control lives on each expanded card so the scale is tied to the art being applied and does not create hidden picker-wide state.

## User Experience

When a token art card is expanded, the action area shows a compact `Scale` slider with a small numeric value display beside the existing apply buttons. The slider defaults to that candidate's indexed token scale, falling back to `1`. The GM can drag it to preview scale on the selected scene token, then press `Token`, `Actor`, or `Both` to apply art with the current scale.

The selected slider value applies to:

- `texture.scaleX`
- `texture.scaleY`
- `ring.subject.scale`, when the candidate has dynamic token subject art
- `prototypeToken` equivalents for `Actor` and `Both`

Portrait-only actions ignore scale because they do not update token texture fields. Live slider preview also ignores portrait data.

## Behavior

The slider accepts decimal values from `0.25` to `3` in `0.05` increments. Invalid, empty, or non-positive values fall back to the candidate's original scale, then to `1`.

Dragging the slider updates only the selected scene token in real time. It writes `texture.scaleX`, `texture.scaleY`, and, when the candidate has dynamic subject art, `ring.subject.scale`. It does not update the actor prototype token, actor portrait, module settings, or indexed candidate data.

Scale changes are temporary per rendered card and reset to candidate defaults after a re-render. Clicking `Token`, `Actor`, or `Both` applies the selected art plus the current slider value. `Actor` and `Both` persist the final scale to prototype token fields only when clicked.

The revert flow must capture the token state before the first live preview change for that card. Repeated slider drags must not overwrite that pre-preview snapshot. Applying art will reuse that snapshot so `Revert last` restores the token from before live preview and apply.

## Implementation Shape

`buildTokenUpdate` and `buildActorUpdate` will accept an optional scale override. The override will be normalized once and applied to token texture scale and dynamic subject scale. Without an override, existing candidate scale behavior remains unchanged.

`prepareCandidateView` will provide scale-control view data for candidates with token actions. The Handlebars template will render the slider and value display inside `.pf2e-tokener-actions`, before apply buttons.

`applyCandidateAction` will read the expanded card's slider value and pass it to token/actor update builders. Portrait-only apply remains unaffected.

Slider input handling will find the card candidate, capture a pre-preview revert snapshot once, update the scene token scale immediately, and update the visible value display. Preview updates will be debounced or coalesced so dragging does not spam Foundry document updates.

## Testing

Tests will cover:

- `buildTokenUpdate` applies an override to texture scale and dynamic subject scale.
- `buildActorUpdate` applies the same override to prototype token fields.
- Invalid override values fall back to candidate/default scale.
- Picker template renders the per-card scale slider and value display.
- Slider input path updates selected scene token scale and dynamic subject scale only.
- Slider preview captures pre-preview revert state once.
- Apply path reads the card slider value and passes scale options into update builders.
