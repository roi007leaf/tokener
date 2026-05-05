import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  buildActorUpdate,
  buildTokenUpdate,
  getCanvasZoom,
  getApplyActions,
  getApplyTargets,
  getImagePreviewItems,
  getPanelZoomData,
  getPanelSourceFilterOptions,
  getSourceFilterLabel,
  getSourceFilterOptions,
  createDatasheetCandidates,
  createFolderCandidates,
  createMappedCandidates,
  dedupeCandidates,
  filterCandidatesBySources,
  getCandidatesForTokenDocument,
  localize,
  normalizeHudElement,
  setTextTooltip,
  searchCandidates,
} from "../scripts/pf2e-tokener.js";

const MODULE = {
  id: "pf2e-tokens-draconic-codex",
  title: "Pathfinder Tokens: Draconic Codex",
};

test("native compendiumArtMappings become searchable token candidates", () => {
  const mapping = {
    "pf2e.pathfinder-bestiary": {
      abc123: {
        name: "Adult Blue Dragon",
        actor: "modules/pf2e-tokens-draconic-codex/assets/art/blue.webp",
        token: {
          randomImg: false,
          texture: {
            src: "modules/pf2e-tokens-draconic-codex/assets/tokens/blue.webp",
            scaleX: 2,
            scaleY: 2,
          },
          ring: {
            enabled: true,
            subject: {
              texture: "modules/pf2e-tokens-draconic-codex/assets/subjects/blue.webp",
              scale: 2,
            },
          },
        },
      },
    },
  };

  const candidates = createMappedCandidates({ module: MODULE, mapping, sourceType: "native" });

  assert.equal(candidates.length, 1);
  assert.deepEqual(
    {
      label: candidates[0].label,
      moduleId: candidates[0].moduleId,
      packKey: candidates[0].packKey,
      actorId: candidates[0].actorId,
      tokenSrc: candidates[0].tokenSrc,
      portraitSrc: candidates[0].portraitSrc,
      subjectSrc: candidates[0].subjectSrc,
      scaleX: candidates[0].scaleX,
      scaleY: candidates[0].scaleY,
      subjectScale: candidates[0].subjectScale,
      sourceType: candidates[0].sourceType,
    },
    {
      label: "Adult Blue Dragon",
      moduleId: "pf2e-tokens-draconic-codex",
      packKey: "pf2e.pathfinder-bestiary",
      actorId: "abc123",
      tokenSrc: "modules/pf2e-tokens-draconic-codex/assets/tokens/blue.webp",
      portraitSrc: "modules/pf2e-tokens-draconic-codex/assets/art/blue.webp",
      subjectSrc: "modules/pf2e-tokens-draconic-codex/assets/subjects/blue.webp",
      scaleX: 2,
      scaleY: 2,
      subjectScale: 2,
      sourceType: "native",
    },
  );
});

test("old pf2e-art string and object token shapes normalize to candidates", () => {
  const mapping = {
    "pathfinder-bestiary": {
      tiger1: {
        actor: "modules/pf2e-kingmaker/assets/actor-portraits/tiger.webp",
        token: "modules/pf2e-kingmaker/assets/actor-tokens/tiger.webp",
      },
      bear1: {
        name: "Cave Bear",
        token: {
          img: "modules/pf2e-kingmaker/assets/actor-tokens/bear.webp",
          scale: 1.5,
        },
      },
    },
  };

  const candidates = createMappedCandidates({
    module: { id: "pf2e-kingmaker", title: "Pathfinder Kingmaker" },
    mapping,
    sourceType: "pf2e-art",
  });

  assert.equal(candidates.length, 2);
  assert.equal(candidates[0].tokenSrc, "modules/pf2e-kingmaker/assets/actor-tokens/tiger.webp");
  assert.equal(candidates[0].portraitSrc, "modules/pf2e-kingmaker/assets/actor-portraits/tiger.webp");
  assert.equal(candidates[1].label, "Cave Bear");
  assert.equal(candidates[1].scaleX, 1.5);
  assert.equal(candidates[1].scaleY, 1.5);
});

test("gallery datasheets normalize portrait, token, subject, and scale art", () => {
  const datasheet = [
    {
      label: "Aphorite Kobold Rogue",
      key: "aphorite-kobold-rogue",
      art: {
        portrait: "modules/pf2e-tokens-characters/assets/portraits/aphorite-kobold-rogue.webp",
        token: "modules/pf2e-tokens-characters/assets/tokens/aphorite-kobold-rogue.webp",
        subject: "modules/pf2e-tokens-characters/assets/subjects/aphorite-kobold-rogue.webp",
        scale: 1,
      },
    },
  ];

  const candidates = createDatasheetCandidates({
    module: {
      id: "pf2e-tokens-characters",
      title: "Pathfinder Tokens: Character Gallery",
    },
    datasheet,
  });

  assert.equal(candidates.length, 1);
  assert.deepEqual(
    {
      label: candidates[0].label,
      moduleId: candidates[0].moduleId,
      tokenSrc: candidates[0].tokenSrc,
      portraitSrc: candidates[0].portraitSrc,
      subjectSrc: candidates[0].subjectSrc,
      scaleX: candidates[0].scaleX,
      scaleY: candidates[0].scaleY,
      subjectScale: candidates[0].subjectScale,
      sourceType: candidates[0].sourceType,
    },
    {
      label: "Aphorite Kobold Rogue",
      moduleId: "pf2e-tokens-characters",
      tokenSrc: "modules/pf2e-tokens-characters/assets/tokens/aphorite-kobold-rogue.webp",
      portraitSrc: "modules/pf2e-tokens-characters/assets/portraits/aphorite-kobold-rogue.webp",
      subjectSrc: "modules/pf2e-tokens-characters/assets/subjects/aphorite-kobold-rogue.webp",
      scaleX: 1,
      scaleY: 1,
      subjectScale: 1,
      sourceType: "datasheet",
    },
  );
});

test("folder candidates only include token-looking image files", () => {
  const files = [
    "modules/fantasy-token-collection-dragon-01/resources/images/banner.webp",
    "modules/fantasy-token-collection-dragon-01/resources/tokens/Black-Dragon-Angry.webp",
    "modules/fantasy-token-collection-dragon-01/resources/tokens/Black-Dragon-Aura.webp",
    "modules/fantasy-token-collection-dragon-01/resources/tokens/readme.txt",
  ];

  const candidates = createFolderCandidates({
    module: {
      id: "fantasy-token-collection-dragon-01",
      title: "Fantasy Token Collection - Dragon 01",
    },
    files,
  });

  assert.deepEqual(
    candidates.map((candidate) => candidate.label),
    ["Black Dragon Angry", "Black Dragon Aura"],
  );
});

test("folder candidates infer actor and subject images from sibling art folders", () => {
  const files = [
    "modules/pf2e-ap207-the-resurrection-flood/assets/tokens/achex-weak-peryton.webp",
    "modules/pf2e-ap207-the-resurrection-flood/assets/art/achex-weak-peryton.webp",
    "modules/pf2e-ap207-the-resurrection-flood/assets/subjects/achex-weak-peryton.webp",
  ];

  const candidates = createFolderCandidates({
    module: {
      id: "pf2e-ap207-the-resurrection-flood",
      title: "Triumph of the Tusk 1 of 3: The Resurrection Flood",
    },
    files,
  });

  assert.equal(candidates.length, 1);
  assert.equal(
    candidates[0].portraitSrc,
    "modules/pf2e-ap207-the-resurrection-flood/assets/art/achex-weak-peryton.webp",
  );
  assert.equal(
    candidates[0].subjectSrc,
    "modules/pf2e-ap207-the-resurrection-flood/assets/subjects/achex-weak-peryton.webp",
  );
});

test("folder duplicates merge into mapped art so previews keep actor images", () => {
  const module = {
    id: "pf2e-tokens-monster-core-2",
    title: "Pathfinder Tokens: Monster Core 2",
  };
  const mapping = {
    "pf2e.monster-core-2": {
      phaseAdult: {
        name: "Dragon Adult Phase",
        actor: "modules/pf2e-tokens-monster-core-2/assets/art/dragon-adult-phase.webp",
        token: {
          texture: {
            src: "modules/pf2e-tokens-monster-core-2/assets/tokens/dragon-adult-phase.webp",
            scaleX: 2,
            scaleY: 2,
          },
          ring: {
            enabled: true,
            subject: {
              texture: "modules/pf2e-tokens-monster-core-2/assets/subjects/dragon-adult-phase.webp",
              scale: 2,
            },
          },
        },
      },
    },
  };
  const folderCandidates = createFolderCandidates({
    module,
    files: ["modules/pf2e-tokens-monster-core-2/assets/tokens/dragon-adult-phase.webp"],
  });
  const mappedCandidates = createMappedCandidates({ module, mapping });

  const candidates = dedupeCandidates([...folderCandidates, ...mappedCandidates]);

  assert.equal(candidates.length, 1);
  assert.equal(
    candidates[0].portraitSrc,
    "modules/pf2e-tokens-monster-core-2/assets/art/dragon-adult-phase.webp",
  );
  assert.equal(
    candidates[0].subjectSrc,
    "modules/pf2e-tokens-monster-core-2/assets/subjects/dragon-adult-phase.webp",
  );
  assert.equal(candidates[0].scaleX, 2);
  assert.equal(candidates[0].scaleY, 2);
  assert.equal(candidates[0].subjectScale, 2);
  assert.equal(candidates[0].sourceType, "native");
});

test("candidate lookup ranks exact source before same-name and broad search", () => {
  const index = [
    {
      id: "exact",
      label: "Adult Blue Dragon",
      moduleId: "a",
      moduleTitle: "A",
      packKey: "pf2e.pathfinder-bestiary",
      actorId: "abc123",
      tokenSrc: "exact.webp",
      searchText: "adult blue dragon exact",
    },
    {
      id: "name",
      label: "Adult Blue Dragon",
      moduleId: "b",
      moduleTitle: "B",
      tokenSrc: "name.webp",
      searchText: "adult blue dragon name",
    },
    {
      id: "broad",
      label: "Blue Dragon Wyrmling",
      moduleId: "c",
      moduleTitle: "C",
      tokenSrc: "broad.webp",
      searchText: "blue dragon wyrmling broad",
    },
  ];
  const tokenDocument = {
    actor: {
      id: "world-actor",
      name: "Adult Blue Dragon",
      flags: {
        core: {
          sourceId: "Compendium.pf2e.pathfinder-bestiary.Actor.abc123",
        },
      },
    },
  };

  const candidates = getCandidatesForTokenDocument(index, tokenDocument, "blue");

  assert.deepEqual(
    candidates.map((candidate) => candidate.id),
    ["exact", "name", "broad"],
  );
  assert.equal(candidates[0].matchType, "exact");
  assert.equal(candidates[1].matchType, "name");
  assert.equal(candidates[2].matchType, "search");
});

test("candidate lookup uses base actor source for unlinked token documents", () => {
  const index = [
    {
      id: "exact",
      label: "Adult Blue Dragon",
      moduleId: "a",
      moduleTitle: "A",
      packKey: "pf2e.pathfinder-bestiary",
      actorId: "abc123",
      tokenSrc: "exact.webp",
      searchText: "adult blue dragon exact",
    },
  ];
  const tokenDocument = {
    actor: {
      name: "Renamed Scene Token",
    },
    baseActor: {
      name: "Adult Blue Dragon",
      flags: {
        core: {
          sourceId: "Compendium.pf2e.pathfinder-bestiary.Actor.abc123",
        },
      },
    },
  };

  const candidates = getCandidatesForTokenDocument(index, tokenDocument, "blue");

  assert.equal(candidates[0].id, "exact");
  assert.equal(candidates[0].matchType, "exact");
});

test("search matches normalized labels and module titles", () => {
  const index = [
    {
      id: "a",
      label: "Black Dragon Angry",
      moduleTitle: "Fantasy Token Collection - Dragon 01",
      tokenSrc: "black.webp",
      searchText: "black dragon angry fantasy token collection dragon 01",
    },
  ];

  assert.equal(searchCandidates(index, "black angry").length, 1);
  assert.equal(searchCandidates(index, "collection dragon").length, 1);
  assert.equal(searchCandidates(index, "skeleton").length, 0);
});

test("source filter options are unique sorted modules with counts", () => {
  const options = getSourceFilterOptions([
    { moduleId: "b", moduleTitle: "Bestiary Tokens" },
    { moduleId: "a", moduleTitle: "Adventure Tokens" },
    { moduleId: "b", moduleTitle: "Bestiary Tokens" },
  ]);

  assert.deepEqual(options, [
    { id: "a", title: "Adventure Tokens", count: 1 },
    { id: "b", title: "Bestiary Tokens", count: 2 },
  ]);
});

test("panel source filter options use full index instead of selected token candidates", () => {
  const index = [
    {
      id: "exact",
      label: "Adult Blue Dragon",
      moduleId: "bestiary",
      moduleTitle: "Bestiary Tokens",
      packKey: "pf2e.pathfinder-bestiary",
      actorId: "abc123",
      tokenSrc: "exact.webp",
      searchText: "adult blue dragon",
    },
    {
      id: "name",
      label: "Adult Blue Dragon",
      moduleId: "draconic",
      moduleTitle: "Draconic Codex",
      tokenSrc: "name.webp",
      searchText: "adult blue dragon",
    },
    {
      id: "unrelated",
      label: "Aphorite Kobold Rogue",
      moduleId: "characters",
      moduleTitle: "Character Gallery",
      tokenSrc: "kobold.webp",
      searchText: "aphorite kobold rogue character gallery",
    },
  ];
  const tokenDocument = {
    actor: {
      name: "Adult Blue Dragon",
      flags: {
        core: {
          sourceId: "Compendium.pf2e.pathfinder-bestiary.Actor.abc123",
        },
      },
    },
  };

  const tokenScopedOptions = getSourceFilterOptions(getCandidatesForTokenDocument(index, tokenDocument, ""));

  assert.deepEqual(tokenScopedOptions.map((option) => option.id), ["bestiary", "draconic"]);
  assert.deepEqual(getPanelSourceFilterOptions(index).map((option) => option.id), ["bestiary", "characters", "draconic"]);
});

test("HUD source menu is built from full index", () => {
  const script = fs.readFileSync(new URL("../scripts/pf2e-tokener.js", import.meta.url), "utf8");

  assert.match(script, /const sourceOptions = getPanelSourceFilterOptions\(index\);/);
  assert.doesNotMatch(script, /getSourceFilterOptions\(getCandidatesForTokenDocument\(index, tokenDocument, ""\)\)/);
});

test("source filter accepts multiple selected modules and treats empty as all", () => {
  const candidates = [
    { id: "a", moduleId: "bestiary" },
    { id: "b", moduleId: "draconic" },
    { id: "c", moduleId: "npc-core" },
  ];

  assert.deepEqual(filterCandidatesBySources(candidates, []).map((candidate) => candidate.id), ["a", "b", "c"]);
  assert.deepEqual(filterCandidatesBySources(candidates, ["bestiary", "npc-core"]).map((candidate) => candidate.id), ["a", "c"]);
});

test("source filter label summarizes all, one, or multiple selected sources", () => {
  const options = [
    { id: "bestiary", title: "Bestiary Tokens", count: 8 },
    { id: "draconic", title: "Draconic Codex", count: 3 },
    { id: "npc-core", title: "NPC Core", count: 2 },
  ];

  assert.equal(getSourceFilterLabel(options, []), "All sources");
  assert.equal(getSourceFilterLabel(options, ["draconic"]), "Draconic Codex");
  assert.equal(getSourceFilterLabel(options, ["bestiary", "npc-core"]), "2 sources");
});

test("token update preserves dynamic ring fields when subject art exists", () => {
  const update = buildTokenUpdate({
    tokenSrc: "modules/pkg/assets/tokens/dragon.webp",
    subjectSrc: "modules/pkg/assets/subjects/dragon.webp",
    scaleX: 2,
    scaleY: 2,
    subjectScale: 2,
  });

  assert.deepEqual(update, {
    "texture.src": "modules/pkg/assets/tokens/dragon.webp",
    "texture.scaleX": 2,
    "texture.scaleY": 2,
    "ring.enabled": true,
    "ring.subject.texture": "modules/pkg/assets/subjects/dragon.webp",
    "ring.subject.scale": 2,
    randomImg: false,
  });
});

test("token update disables dynamic ring when no subject art exists", () => {
  const update = buildTokenUpdate({
    tokenSrc: "modules/pkg/resources/tokens/dragon.webp",
  });

  assert.deepEqual(update, {
    "texture.src": "modules/pkg/resources/tokens/dragon.webp",
    "texture.scaleX": 1,
    "texture.scaleY": 1,
    "ring.enabled": false,
    randomImg: false,
  });
});

test("actor update writes prototype token fields and portrait only", () => {
  const update = buildActorUpdate({
    tokenSrc: "modules/pkg/assets/tokens/dragon.webp",
    portraitSrc: "modules/pkg/assets/art/dragon.webp",
    subjectSrc: "modules/pkg/assets/subjects/dragon.webp",
    scaleX: 2,
    scaleY: 2,
    subjectScale: 2,
  });

  assert.deepEqual(update, {
    "prototypeToken.texture.src": "modules/pkg/assets/tokens/dragon.webp",
    "prototypeToken.texture.scaleX": 2,
    "prototypeToken.texture.scaleY": 2,
    "prototypeToken.ring.enabled": true,
    "prototypeToken.ring.subject.texture": "modules/pkg/assets/subjects/dragon.webp",
    "prototypeToken.ring.subject.scale": 2,
    "prototypeToken.randomImg": false,
    img: "modules/pkg/assets/art/dragon.webp",
  });
});

test("HUD apply actions include separate token, actor, portrait, and both choices", () => {
  assert.deepEqual(getApplyActions().map((action) => action.action), ["token", "actor", "portrait", "both"]);
});

test("apply target helper keeps Actor separate from selected Token", () => {
  assert.deepEqual(getApplyTargets("token"), { token: true, actor: false, portrait: false });
  assert.deepEqual(getApplyTargets("actor"), { token: false, actor: true, portrait: false });
  assert.deepEqual(getApplyTargets("portrait"), { token: false, actor: false, portrait: true });
  assert.deepEqual(getApplyTargets("both"), { token: true, actor: true, portrait: false });
});

test("HUD adapter accepts HTMLElement and jQuery-like wrappers", () => {
  const element = { nodeType: 1 };
  assert.equal(normalizeHudElement(element), element);
  assert.equal(normalizeHudElement([element]), element);
  assert.equal(normalizeHudElement({ 0: element, length: 1 }), element);
});

test("module manifest declares English localization file", () => {
  const manifest = JSON.parse(fs.readFileSync(new URL("../module.json", import.meta.url), "utf8"));

  assert.deepEqual(manifest.languages, [
    {
      lang: "en",
      name: "English",
      path: "languages/en.json",
    },
  ]);
});

test("English localization file contains Token HUD strings", () => {
  const translations = JSON.parse(fs.readFileSync(new URL("../languages/en.json", import.meta.url), "utf8"));

  assert.equal(translations["PF2ETokener.HUD.Tooltip"], "PF2e Tokener");
  assert.equal(translations["PF2ETokener.HUD.SearchPlaceholder"], "Search tokens");
  assert.equal(translations["PF2ETokener.HUD.AllSources"], "All sources");
  assert.equal(translations["PF2ETokener.HUD.SourcesSelected"], "{count} sources");
  assert.equal(translations["PF2ETokener.HUD.SelectAllSources"], "Select all");
  assert.equal(translations["PF2ETokener.HUD.ClearSources"], "Clear");
  assert.equal(translations["PF2ETokener.HUD.BestMatches"], "Best matches");
  assert.equal(translations["PF2ETokener.HUD.SearchResults"], "Search results");
  assert.equal(translations["PF2ETokener.HUD.Current"], "Current");
  assert.equal(translations["PF2ETokener.Actions.Token"], "Token");
  assert.equal(translations["PF2ETokener.Actions.Actor"], "Actor");
  assert.equal(translations["PF2ETokener.Actions.Portrait"], "Portrait");
  assert.equal(translations["PF2ETokener.Actions.Both"], "Both");
  assert.equal(translations["PF2ETokener.Notifications.Applied"], "PF2e Tokener: token art applied.");
});

test("localize uses Foundry i18n and falls back when unavailable", () => {
  assert.equal(localize("HUD.SearchPlaceholder", "Search tokens"), "Search tokens");

  const previousGame = globalThis.game;
  globalThis.game = {
    i18n: {
      localize: (key) => (key === "PF2ETokener.HUD.SearchPlaceholder" ? "Localized search" : key),
    },
  };

  try {
    assert.equal(localize("HUD.SearchPlaceholder", "Search tokens"), "Localized search");
    assert.equal(localize("HUD.Missing", "Fallback"), "Fallback");
  } finally {
    if (previousGame === undefined) delete globalThis.game;
    else globalThis.game = previousGame;
  }
});

test("token grid does not stretch sibling cards when one card opens actions", () => {
  const css = fs.readFileSync(new URL("../styles/pf2e-tokener.css", import.meta.url), "utf8");
  const gridRule = css.match(/#token-hud \.pf2e-tokener-grid\s*\{[^}]+\}/)?.[0] ?? "";

  assert.match(gridRule, /align-items:\s*start;/);
});

test("truncated text helper sets Foundry and browser tooltip attributes", () => {
  const attributes = {};
  const element = {
    dataset: {},
    setAttribute: (key, value) => {
      attributes[key] = value;
    },
  };

  setTextTooltip(element, "Pathfinder Tokens: Monster Core");

  assert.equal(element.title, "Pathfinder Tokens: Monster Core");
  assert.equal(element.dataset.tooltip, "Pathfinder Tokens: Monster Core");
  assert.equal(element.dataset.tooltipDirection, "UP");
  assert.equal(attributes["aria-label"], "Pathfinder Tokens: Monster Core");
});

test("token card typography fits compact thumbnail cells", () => {
  const css = fs.readFileSync(new URL("../styles/pf2e-tokener.css", import.meta.url), "utf8");
  const labelRule = css.match(/#token-hud \.pf2e-tokener-label\s*\{[^}]+\}/)?.[0] ?? "";
  const sourceRule = [...css.matchAll(/#token-hud \.pf2e-tokener-source\s*\{[^}]+\}/g)].at(-1)?.[0] ?? "";
  const toolbarRule = css.match(
    /#token-hud \.pf2e-tokener-toolbar input,\s*#token-hud \.pf2e-tokener-source-button\s*\{[^}]+\}/,
  )?.[0] ?? "";

  assert.match(labelRule, /font-size:\s*12px;/);
  assert.match(labelRule, /-webkit-line-clamp:\s*2;/);
  assert.match(labelRule, /white-space:\s*normal;/);
  assert.match(sourceRule, /font-size:\s*11px;/);
  assert.match(toolbarRule, /font-size:\s*15px;/);
});

test("source filter CSS uses checkbox popover instead of native select", () => {
  const css = fs.readFileSync(new URL("../styles/pf2e-tokener.css", import.meta.url), "utf8");
  const filterRule = css.match(/#token-hud \.pf2e-tokener-source-filter\s*\{[^}]+\}/)?.[0] ?? "";
  const menuRule = css.match(/#token-hud \.pf2e-tokener-source-menu\s*\{[^}]+\}/)?.[0] ?? "";
  const optionRule = css.match(/#token-hud \.pf2e-tokener-source-option\s*\{[^}]+\}/)?.[0] ?? "";
  const checkboxRule = css.match(
    /#token-hud \.pf2e-tokener-source-option input\[type="checkbox"\]\s*\{[^}]+\}/,
  )?.[0] ?? "";
  const checkedRule = css.match(
    /#token-hud \.pf2e-tokener-source-option input\[type="checkbox"\]:checked\s*\{[^}]+\}/,
  )?.[0] ?? "";
  const checkmarkRule = css.match(
    /#token-hud \.pf2e-tokener-source-option input\[type="checkbox"\]:checked::after\s*\{[^}]+\}/,
  )?.[0] ?? "";
  const hoverRule = css.match(/#token-hud \.pf2e-tokener-source-option:hover\s*\{[^}]+\}/)?.[0] ?? "";
  const countRule = css.match(/#token-hud \.pf2e-tokener-source-option-count\s*\{[^}]+\}/)?.[0] ?? "";

  assert.match(filterRule, /position:\s*relative;/);
  assert.match(menuRule, /position:\s*absolute;/);
  assert.match(menuRule, /max-height:\s*220px;/);
  assert.match(optionRule, /grid-template-columns:\s*auto minmax\(0, 1fr\)/);
  assert.match(optionRule, /min-height:\s*28px;/);
  assert.match(optionRule, /padding:\s*2px 4px;/);
  assert.match(optionRule, /font-size:\s*11px;/);
  assert.match(checkboxRule, /appearance:\s*none;/);
  assert.match(checkboxRule, /width:\s*16px;/);
  assert.match(checkboxRule, /height:\s*16px;/);
  assert.doesNotMatch(checkboxRule, /accent-color:/);
  assert.match(checkedRule, /background:\s*#8fb9d6;/);
  assert.match(checkmarkRule, /transform:\s*rotate\(45deg\);/);
  assert.match(hoverRule, /background:\s*rgba\(143, 185, 214, 0\.08\);/);
  assert.match(countRule, /justify-self:\s*end;/);
  assert.match(countRule, /border-radius:\s*999px;/);
  assert.match(countRule, /background:\s*rgba\(255, 255, 255, 0\.06\);/);
});

test("canvas zoom helper reads stage scale and clamps panel inverse scale", () => {
  assert.equal(getCanvasZoom({ stage: { scale: { x: 0.5 } } }), 0.5);
  assert.equal(getCanvasZoom({ app: { stage: { scale: { x: 2 } } } }), 2);
  assert.equal(getCanvasZoom({ stage: { scale: { x: 0 } } }), 1);

  assert.deepEqual(getPanelZoomData({ stage: { scale: { x: 0.5 } } }), {
    zoom: 0.5,
    inverse: 2,
  });
  assert.deepEqual(getPanelZoomData({ stage: { scale: { x: 8 } } }), {
    zoom: 8,
    inverse: 0.5,
  });
});

test("token picker panel CSS uses canvas zoom variables", () => {
  const css = fs.readFileSync(new URL("../styles/pf2e-tokener.css", import.meta.url), "utf8");
  const panelRule = css.match(/#token-hud \.pf2e-tokener-panel\s*\{[^}]+\}/)?.[0] ?? "";

  assert.match(panelRule, /left:\s*calc\(64px \* var\(--pf2e-tokener-inverse-zoom, 1\)\);/);
  assert.match(panelRule, /transform:\s*scale\(var\(--pf2e-tokener-inverse-zoom, 1\)\);/);
  assert.match(panelRule, /transform-origin:\s*top left;/);
});

test("image preview helper returns actor and token panes side by side", () => {
  const items = getImagePreviewItems({
    portraitSrc: "actor.webp",
    tokenSrc: "token.webp",
  });

  assert.deepEqual(items, [
    {
      kind: "actor",
      label: "Actor image",
      src: "actor.webp",
      available: true,
    },
    {
      kind: "token",
      label: "Token image",
      src: "token.webp",
      available: true,
    },
  ]);
});

test("image preview helper marks missing actor image unavailable", () => {
  const items = getImagePreviewItems({
    tokenSrc: "token.webp",
  });

  assert.equal(items[0].kind, "actor");
  assert.equal(items[0].available, false);
  assert.equal(items[0].src, "");
  assert.equal(items[1].src, "token.webp");
});

test("English localization file contains image preview strings", () => {
  const translations = JSON.parse(fs.readFileSync(new URL("../languages/en.json", import.meta.url), "utf8"));

  assert.equal(translations["PF2ETokener.Preview.ActorImage"], "Actor image");
  assert.equal(translations["PF2ETokener.Preview.TokenImage"], "Token image");
  assert.equal(translations["PF2ETokener.Preview.Close"], "Close preview");
  assert.equal(translations["PF2ETokener.Preview.ActorUnavailable"], "No actor image available.");
});

test("image preview CSS is fullscreen and side by side", () => {
  const css = fs.readFileSync(new URL("../styles/pf2e-tokener.css", import.meta.url), "utf8");
  const overlayRule = css.match(/\.pf2e-tokener-preview\s*\{[^}]+\}/)?.[0] ?? "";
  const panesRule = css.match(/\.pf2e-tokener-preview-panes\s*\{[^}]+\}/)?.[0] ?? "";

  assert.match(overlayRule, /position:\s*fixed;/);
  assert.match(overlayRule, /inset:\s*0;/);
  assert.match(panesRule, /grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/);
});
