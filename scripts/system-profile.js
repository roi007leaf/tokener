export const DEFAULT_SYSTEM_ID = 'pf2e';

const GENERIC_TOKEN_DATA_MODULE_PATTERN =
  /token|tokens|collection|bestiary|compendium|monster|monsters|creature|creatures|npc|adventure|actor|actors|portrait|portraits|gallery/i;

const SYSTEM_PROFILES = {
  pf2e: {
    title: 'Pathfinder Second Edition',
    nativeMappingKeys: ['pf2e'],
    legacyMappingFlagKeys: ['pf2e-art'],
    tokenDataModulePattern:
      /pf2e|pathfinder|token|tokens|collection|bestiary|battlezoo|beginner|abomination|summons|claws|kingmaker|monster|monsters|creature|creatures|npc|adventure|drakkenheim/i,
  },
  sf2e: {
    title: 'Starfinder Second Edition',
    nativeMappingKeys: ['sf2e'],
    legacyMappingFlagKeys: [],
    tokenDataModulePattern:
      /sf2e|starfinder|token|tokens|collection|bestiary|alien|monster|monsters|creature|creatures|npc|adventure/i,
  },
};

export function getCurrentSystemId(game = globalThis.game) {
  return normalizeSystemId(game?.system?.id) || DEFAULT_SYSTEM_ID;
}

export function getSystemProfile(systemId = getCurrentSystemId()) {
  const id = normalizeSystemId(systemId) || DEFAULT_SYSTEM_ID;
  const override = SYSTEM_PROFILES[id] ?? {};
  return {
    id,
    title: override.title ?? id.toUpperCase(),
    nativeMappingKeys: uniqueStrings(override.nativeMappingKeys ?? [id]),
    legacyMappingFlagKeys: uniqueStrings(override.legacyMappingFlagKeys ?? []),
    supportsActorPortrait: true,
    supportsDynamicTokenRing: true,
    supportsPrototypeToken: true,
    tokenDataModulePattern: override.tokenDataModulePattern ?? GENERIC_TOKEN_DATA_MODULE_PATTERN,
  };
}

export function getCurrentSystemProfile(game = globalThis.game) {
  return getSystemProfile(getCurrentSystemId(game));
}

export function normalizeSystemPackKey(
  packKey,
  { systemId = getCurrentSystemId(), assumeSystemPrefix = true } = {},
) {
  const key = String(packKey ?? '').trim();
  if (!key) return '';
  if (!assumeSystemPrefix || key.includes('.')) return key;

  const prefix = normalizeSystemId(systemId);
  return prefix ? `${prefix}.${key}` : key;
}

function normalizeSystemId(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

function uniqueStrings(values) {
  return [...new Set((values ?? []).map((value) => String(value ?? '').trim()).filter(Boolean))];
}
