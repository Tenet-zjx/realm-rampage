// DOTA2-style cosmetic rarity ladder. Colour is never the only signal: UI always prints `name` too.
export const RARITIES = [
  { id: 'common', name: '普通', color: '#b0c3d9', tier: 0, weight: 100, power: 1.0 },
  { id: 'uncommon', name: '罕见', color: '#5e98d9', tier: 1, weight: 62, power: 1.12 },
  { id: 'rare', name: '稀有', color: '#4b69ff', tier: 2, weight: 36, power: 1.26 },
  { id: 'mythical', name: '神话', color: '#8847ff', tier: 3, weight: 18, power: 1.42 },
  { id: 'legendary', name: '传奇', color: '#d32ce6', tier: 4, weight: 8, power: 1.6 },
  { id: 'ancient', name: '远古', color: '#eb4b4b', tier: 5, weight: 3.5, power: 1.8 },
  { id: 'immortal', name: '不朽', color: '#e4ae39', tier: 6, weight: 1.4, power: 2.05 },
  { id: 'arcana', name: '至宝', color: '#ade55c', tier: 7, weight: 0.5, power: 2.35 },
];
export const RARITY = Object.fromEntries(RARITIES.map((r) => [r.id, r]));
export const rarityTier = (id) => RARITY[id]?.tier ?? 0;

/** Draft weight multiplier for a rarity given player level, luck and difficulty bonus. */
export function rarityWeight(id, { level = 1, luck = 0, bonus = 0 } = {}) {
  const r = RARITY[id];
  const shift = Math.min(1.6, level * 0.035 + luck * 0.02 + bonus);
  return r.weight * Math.pow(1 + shift, r.tier * 0.55);
}
