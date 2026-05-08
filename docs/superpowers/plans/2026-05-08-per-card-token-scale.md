# Per-Card Token Scale Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-card scale sliders that live-preview selected scene token scale and apply final scale to token/prototype updates.

**Architecture:** Keep scale update construction in `scripts/actions.js` so token, actor, and preview paths share one normalization path. Keep picker UI state ephemeral in `scripts/picker-app.js`, with per-card preview snapshots stored on the application instance and reused during apply. Render slider controls in existing card action panels.

**Tech Stack:** Foundry VTT ApplicationV2, Handlebars templates, plain JavaScript modules, Jest tests, ESLint.

---

### Task 1: Scale Update Builders

**Files:**

- Modify: `scripts/actions.js`
- Modify: `scripts/pf2e-tokener.js`
- Test: `tests/pf2e-tokener.test.mjs`

- [ ] **Step 1: Write failing tests for linked scale overrides**

Add tests near existing `buildTokenUpdate` and `buildActorUpdate` tests:

```js
test('token update applies linked scale override to token and dynamic subject', () => {
  const update = buildTokenUpdate(
    {
      tokenSrc: 'modules/pkg/assets/tokens/dragon.webp',
      subjectSrc: 'modules/pkg/assets/subjects/dragon.webp',
      scaleX: 2,
      scaleY: 2,
      subjectScale: 2,
    },
    { scale: 1.35 },
  );

  assert.equal(update['texture.scaleX'], 1.35);
  assert.equal(update['texture.scaleY'], 1.35);
  assert.equal(update['ring.subject.scale'], 1.35);
});

test('actor update applies linked scale override to prototype token fields', () => {
  const update = buildActorUpdate(
    {
      tokenSrc: 'modules/pkg/assets/tokens/dragon.webp',
      portraitSrc: 'modules/pkg/assets/art/dragon.webp',
      subjectSrc: 'modules/pkg/assets/subjects/dragon.webp',
      scaleX: 2,
      scaleY: 2,
      subjectScale: 2,
    },
    { scale: 0.85 },
  );

  assert.equal(update['prototypeToken.texture.scaleX'], 0.85);
  assert.equal(update['prototypeToken.texture.scaleY'], 0.85);
  assert.equal(update['prototypeToken.ring.subject.scale'], 0.85);
});

test('invalid linked scale override falls back to candidate scale', () => {
  const update = buildTokenUpdate(
    {
      tokenSrc: 'modules/pkg/assets/tokens/dragon.webp',
      subjectSrc: 'modules/pkg/assets/subjects/dragon.webp',
      scaleX: 1.2,
      scaleY: 1.2,
      subjectScale: 1.4,
    },
    { scale: '' },
  );

  assert.equal(update['texture.scaleX'], 1.2);
  assert.equal(update['texture.scaleY'], 1.2);
  assert.equal(update['ring.subject.scale'], 1.4);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/pf2e-tokener.test.mjs --runInBand`

Expected: FAIL because `buildTokenUpdate` and `buildActorUpdate` ignore the second options argument.

- [ ] **Step 3: Implement scale options**

In `scripts/actions.js`, add an options parameter and helpers:

```js
export function buildTokenUpdate(candidate, { scale } = {}) {
  const tokenSrc = getImageSource(candidate?.tokenSrc);
  if (!tokenSrc) throw new Error('PF2e Tokener candidate has no token image.');

  const scaleOverride = getScaleOverride(scale);
  const scaleX = scaleOverride ?? numberOr(candidate?.scaleX ?? candidate?.scale, 1);
  const scaleY = scaleOverride ?? numberOr(candidate?.scaleY ?? candidate?.scale, scaleX);
  const update = {
    'texture.src': tokenSrc,
    'texture.scaleX': scaleX,
    'texture.scaleY': scaleY,
    randomImg: false,
  };

  if (candidate?.subjectSrc) {
    update['ring.enabled'] = true;
    update['ring.subject.texture'] = candidate.subjectSrc;
    update['ring.subject.scale'] =
      scaleOverride ??
      numberOr(candidate.subjectScale, Math.max(Math.abs(scaleX), Math.abs(scaleY)));
  } else {
    update['ring.enabled'] = false;
  }

  return update;
}

export function buildActorUpdate(candidate, options = {}) {
  const actorUpdate = {};
  for (const [key, value] of Object.entries(buildTokenUpdate(candidate, options))) {
    actorUpdate[`prototypeToken.${key}`] = value;
  }
  if (candidate?.portraitSrc) actorUpdate.img = candidate.portraitSrc;
  return actorUpdate;
}

function getScaleOverride(value) {
  const scale = Number(value);
  return Number.isFinite(scale) && scale > 0 ? scale : null;
}
```

Export any new public helper only if later tasks require it.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/pf2e-tokener.test.mjs --runInBand`

Expected: PASS.

### Task 2: Live Preview Update Helper

**Files:**

- Modify: `scripts/actions.js`
- Modify: `scripts/pf2e-tokener.js`
- Test: `tests/pf2e-tokener.test.mjs`

- [ ] **Step 1: Write failing test for preview-only scale update**

Add import `buildTokenScalePreviewUpdate` from `../scripts/pf2e-tokener.js`, then add:

```js
test('token scale preview update changes selected token scale only', () => {
  assert.deepEqual(
    buildTokenScalePreviewUpdate(
      {
        tokenSrc: 'modules/pkg/assets/tokens/dragon.webp',
        subjectSrc: 'modules/pkg/assets/subjects/dragon.webp',
      },
      1.45,
    ),
    {
      'texture.scaleX': 1.45,
      'texture.scaleY': 1.45,
      'ring.subject.scale': 1.45,
    },
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/pf2e-tokener.test.mjs --runInBand`

Expected: FAIL because `buildTokenScalePreviewUpdate` is not exported.

- [ ] **Step 3: Implement preview helper**

In `scripts/actions.js`:

```js
export function buildTokenScalePreviewUpdate(candidate, scale) {
  const scaleOverride = getScaleOverride(scale);
  if (scaleOverride === null) return {};
  const update = {
    'texture.scaleX': scaleOverride,
    'texture.scaleY': scaleOverride,
  };
  if (candidate?.subjectSrc) update['ring.subject.scale'] = scaleOverride;
  return update;
}
```

Export it from `scripts/pf2e-tokener.js`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/pf2e-tokener.test.mjs --runInBand`

Expected: PASS.

### Task 3: Slider Rendering

**Files:**

- Modify: `scripts/picker-app.js`
- Modify: `templates/picker.hbs`
- Modify: `styles/pf2e-tokener.css`
- Modify: `languages/en.json`
- Test: `tests/pf2e-tokener.test.mjs`

- [ ] **Step 1: Write failing template/style test**

Add a template/CSS test:

```js
test('picker template renders per-card token scale slider controls', () => {
  const template = fs.readFileSync(new URL('../templates/picker.hbs', import.meta.url), 'utf8');
  const css = fs.readFileSync(new URL('../styles/pf2e-tokener.css', import.meta.url), 'utf8');

  assert.match(template, /{{#if scaleControl}}/);
  assert.match(template, /class=['"]pf2e-tokener-scale-slider['"]/);
  assert.match(template, /data-scale-value/);
  assert.match(css, /\.pf2e-tokener-scale-control\s*\{/);
  assert.match(css, /\.pf2e-tokener-scale-slider\s*\{/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/pf2e-tokener.test.mjs --runInBand`

Expected: FAIL because slider markup and CSS do not exist.

- [ ] **Step 3: Implement slider view data and markup**

In `scripts/picker-app.js`, add constants and helpers:

```js
const SCALE_MIN = 0.25;
const SCALE_MAX = 3;
const SCALE_STEP = 0.05;
```

Add `scaleControl` in `prepareCandidateView` only when actions include token-changing actions:

```js
scaleControl: hasTokenScaleAction(actions) ? prepareScaleControlView(candidate) : null,
```

Use helpers:

```js
function hasTokenScaleAction(actions) {
  return actions.some(
    (option) => option.action === 'token' || option.action === 'actor' || option.action === 'both',
  );
}

function prepareScaleControlView(candidate) {
  const value = formatScaleValue(getCandidateLinkedScale(candidate));
  return {
    label: localize('HUD.Scale', 'Scale'),
    tooltip: localize('HUD.ScaleTooltip', 'Preview token scale'),
    min: SCALE_MIN,
    max: SCALE_MAX,
    step: SCALE_STEP,
    value,
    valueLabel: `${value}x`,
  };
}

function getCandidateLinkedScale(candidate) {
  const scaleX = Number(candidate?.scaleX ?? candidate?.scale ?? 1);
  const scaleY = Number(candidate?.scaleY ?? candidate?.scale ?? scaleX);
  const scale = Number.isFinite(scaleX) && scaleX > 0 ? scaleX : scaleY;
  return clampScaleValue(scale);
}
```

Add `clampScaleValue` and `formatScaleValue`.

In `templates/picker.hbs`, render before action buttons:

```hbs
{{#if scaleControl}}
  <div class='pf2e-tokener-scale-control'>
    <label>{{scaleControl.label}}</label>
    <span class='pf2e-tokener-scale-value' data-scale-value>{{scaleControl.valueLabel}}</span>
    <input
      class='pf2e-tokener-scale-slider'
      type='range'
      min='{{scaleControl.min}}'
      max='{{scaleControl.max}}'
      step='{{scaleControl.step}}'
      value='{{scaleControl.value}}'
      data-scale-default='{{scaleControl.value}}'
      aria-label='{{scaleControl.tooltip}}'
      data-tooltip='{{scaleControl.tooltip}}'
      data-tooltip-direction='UP'
    />
  </div>
{{/if}}
```

Add i18n:

```json
"PF2ETokener.HUD.Scale": "Scale",
"PF2ETokener.HUD.ScaleTooltip": "Preview token scale"
```

Add compact CSS for `.pf2e-tokener-scale-control`, `.pf2e-tokener-scale-value`, and `.pf2e-tokener-scale-slider` in both picker style contexts if needed.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/pf2e-tokener.test.mjs --runInBand`

Expected: PASS.

### Task 4: Slider Live Preview and Apply Integration

**Files:**

- Modify: `scripts/picker-app.js`
- Test: `tests/pf2e-tokener.test.mjs`

- [ ] **Step 1: Write failing integration-shape test**

Add a source-shape test:

```js
test('token scale slider previews scene token scale and reuses preview revert snapshot', () => {
  const picker = fs.readFileSync(new URL('../scripts/picker-app.js', import.meta.url), 'utf8');

  assert.match(picker, /\.pf2e-tokener-scale-slider/);
  assert.match(picker, /handleScaleSliderInput/);
  assert.match(picker, /buildTokenScalePreviewUpdate/);
  assert.match(picker, /_scalePreviewSnapshots/);
  assert.match(picker, /buildApplyRevertSnapshot/);
  assert.match(picker, /buildTokenUpdate\(candidate, \{ scale/);
  assert.match(picker, /buildActorUpdate\(candidate, \{ scale/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/pf2e-tokener.test.mjs --runInBand`

Expected: FAIL because live slider handlers are missing.

- [ ] **Step 3: Implement live preview input handling**

In `scripts/picker-app.js`, import `buildTokenScalePreviewUpdate`.

Add app state in constructor:

```js
this._scalePreviewSnapshots = new Map();
this._pendingScalePreview = null;
this._scalePreviewScheduled = false;
```

In `handlePickerInput`, add before search handlers:

```js
if (matchesTarget(target, '.pf2e-tokener-scale-slider')) {
  handleScaleSliderInput(app, target);
  return;
}
```

Implement:

```js
function handleScaleSliderInput(app, input) {
  const card = closestTarget(input, '.pf2e-tokener-card');
  const candidate = app._candidateMap.get(card?.dataset?.candidateId);
  if (!card || !candidate) return;
  const scale = readCardScaleValue(card, candidate);
  updateCardScaleValue(card, scale);
  ensureScalePreviewSnapshot(app, card, candidate);
  scheduleScalePreviewUpdate(app, candidate, scale, card.dataset.candidateId);
}
```

Use `requestAnimationFrame` or `setTimeout` fallback to coalesce updates:

```js
function scheduleScalePreviewUpdate(app, candidate, scale, candidateId) {
  app._pendingScalePreview = { candidate, candidateId, scale };
  if (app._scalePreviewScheduled) return;
  app._scalePreviewScheduled = true;
  const schedule =
    globalThis.requestAnimationFrame ??
    ((callback) => globalThis.setTimeout?.(callback, 0) ?? callback());
  schedule(() => void flushScalePreviewUpdate(app));
}
```

`flushScalePreviewUpdate` calls `tokenDocument.update` with `buildTokenScalePreviewUpdate(candidate, scale)` and `[REVERT_FLAG_PATH]` set to the stored preview snapshot.

- [ ] **Step 4: Integrate slider value into apply**

Change `applyCandidateAction` signature to accept `app`:

```js
async function applyCandidateAction(action, candidate, tokenDocument, card, app = activePicker) {
```

Read scale:

```js
const scale = readCardScaleValue(card, candidate);
const updateOptions = { scale };
const revertSnapshot = buildApplyRevertSnapshot(app, action, candidate, tokenDocument, card);
```

Use:

```js
...buildTokenUpdate(candidate, updateOptions)
...buildActorUpdate(candidate, updateOptions)
```

Update click call to pass `app`.

`buildApplyRevertSnapshot` creates the normal snapshot and replaces or adds `.token` with the preview snapshot token when one exists for that card.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- tests/pf2e-tokener.test.mjs --runInBand`

Expected: PASS.

### Task 5: Verification and Cleanup

**Files:**

- Modify: `CHANGELOG.md` if the repository expects user-facing changes to be recorded.

- [ ] **Step 1: Run full test suite**

Run: `npm test -- --runInBand`

Expected: all tests pass.

- [ ] **Step 2: Run lint**

Run: `npm run lint`

Expected: exit 0.

- [ ] **Step 3: Update changelog**

Add one line under the current unreleased/current version section:

```md
- Added per-card token scale sliders with live selected-token preview.
```

- [ ] **Step 4: Run final verification**

Run:

```bash
npm test -- --runInBand
npm run lint
```

Expected: both commands exit 0.

- [ ] **Step 5: Commit implementation**

Run:

```bash
git add scripts/actions.js scripts/pf2e-tokener.js scripts/picker-app.js templates/picker.hbs styles/pf2e-tokener.css languages/en.json tests/pf2e-tokener.test.mjs CHANGELOG.md
git commit -m "feat: add live token scale sliders"
```
