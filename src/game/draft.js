// Level-up drafts: three (or more) rarity-weighted cards, reroll and banish.
import { SKILL, DRAFTABLE, FACTION_SKILLS } from './content/skills.js';
import { RARITY, rarityWeight, rarityTier } from './content/rarities.js';
import { describe } from './skills.js';
import { emit } from './combat.js';

export const LIMITS = { active: 4, auto: 6, passive: 8 };

function counts(game) {
  const c = { active: 0, auto: 0, passive: 0 };
  for (const id of game.skills.owned.keys()) { const k = SKILL[id].kind; if (c[k] != null) c[k]++; }
  return c;
}

export function candidatePool(game, { minRarity } = {}) {
  const owned = game.skills.owned, c = counts(game), lim = { ...LIMITS, active: game.skills.slots.length };
  const out = [];
  const fc = game.factionCounts || {};
  for (const def of DRAFTABLE) {
    if (game.draft.banished.has(def.id)) continue;
    if (def.hero && def.hero !== game.hero.id) continue;
    if (minRarity && rarityTier(def.rarity) < rarityTier(minRarity)) continue;
    const o = owned.get(def.id);
    let weight = rarityWeight(def.rarity, { level: game.run.level, luck: game.stats.luck, bonus: game.diff.rarityBonus });
    if (def.evolved) {
      const from = owned.get(def.from);
      if (!from || from.lv < SKILL[def.from].max || owned.has(def.id)) continue;
      const withId = SKILL[def.from].evolve.with;
      if (!owned.has(withId) && !game.runMods?.freeEvolve) continue;
      weight = 40;
    } else if (o) {
      if (o.lv >= def.max) continue;
      weight *= 2.6;
    } else {
      if (c[def.kind] >= lim[def.kind]) continue;
      if (def.faction && fc[def.faction]) weight *= 1 + Math.min(1.5, fc[def.faction] * 0.35);
    }
    out.push({ def, weight });
  }
  return out;
}

function cardFor(game, def) {
  const o = game.skills.owned.get(def.id);
  const lv = def.evolved ? 1 : (o?.lv || 0) + 1;
  return { id: def.id, name: def.name, rarity: def.rarity, rarityName: RARITY[def.rarity].name, faction: def.faction, kind: def.kind, glyph: def.glyph || def.name[0], level: lv, max: def.max,
    isNew: !o && !def.evolved, isEvolve: !!def.evolved, from: def.from, desc: describe(def, lv, game.stats), hero: def.hero, cd: def.cd };
}

export function rollOptions(game, extra = {}) {
  const n = 3 + (game.runMods?.draftOptions || 0) + (game.draft.extraOptions > 0 ? 1 : 0);
  const pool = candidatePool(game, extra);
  const picks = [];
  const bag = pool.slice();
  // guarantees
  const ticket = game.draft.rarityTicket > 0 ? 'mythical' : game.draft.lucky > 0 ? 'rare' : game.draft.firstLegendary ? 'legendary' : null;
  if (ticket) {
    const strong = bag.filter((x) => rarityTier(x.def.rarity) >= rarityTier(ticket));
    if (strong.length) { const pick = game.rng.weighted(strong, (x) => x.weight); picks.push(pick.def); bag.splice(bag.indexOf(pick), 1); }
    if (game.draft.rarityTicket > 0) game.draft.rarityTicket--; else if (game.draft.lucky > 0) game.draft.lucky--; else game.draft.firstLegendary = false;
  }
  // evolutions always surface first
  for (const x of bag.filter((b) => b.def.evolved)) if (picks.length < n) { picks.push(x.def); bag.splice(bag.indexOf(x), 1); }
  while (picks.length < n && bag.length) {
    const pick = game.rng.weighted(bag, (x) => x.weight);
    picks.push(pick.def); bag.splice(bag.indexOf(pick), 1);
  }
  if (game.draft.extraOptions > 0) game.draft.extraOptions--;
  const cards = picks.map((d) => cardFor(game, d));
  if (!cards.length) cards.push({ id: 'fallback_gold', name: '战利品', rarity: 'common', rarityName: '普通', kind: 'bonus', glyph: '金', desc: '获得 250 金币。', level: 1 }, { id: 'fallback_heal', name: '休整', rarity: 'common', rarityName: '普通', kind: 'bonus', glyph: '愈', desc: '回复 40% 生命。', level: 1 });
  return cards;
}

export function openDraft(game, opts = {}) {
  game.draft.options = rollOptions(game, opts);
  game.draft.source = opts.source || 'level';
  game.status = 'draft';
  const top = game.draft.options.reduce((m, c) => Math.max(m, rarityTier(c.rarity)), 0);
  emit(game, { type: 'draftOpen', top });
}

export function addSkill(game, id, lv = 1) {
  const def = SKILL[id];
  const owned = game.skills.owned;
  if (def.evolved) {
    owned.delete(def.from);
    const slot = game.skills.slots.indexOf(def.from);
    if (slot >= 0) game.skills.slots[slot] = def.kind === 'active' ? id : null;
    game.run.evolves++;
    emit(game, { type: 'evolve', id, name: def.name });
  }
  const cur = owned.get(id);
  if (cur) cur.lv = Math.min(def.max, cur.lv + lv);
  else {
    owned.set(id, { lv: Math.min(def.max, lv), cd: 0, max: def.cd || 0, timer: 0.5 });
    if (def.kind === 'active' && !game.skills.slots.includes(id)) { const i = game.skills.slots.indexOf(null); if (i >= 0) game.skills.slots[i] = id; }
    game.codexSeen?.skills.add(id);
  }
  if (def.rarity === 'arcana') game.run.arcana++;
  game.statsDirty = true;
  const before = game.factionTiers?.map((t) => t.faction + t.n).join() || '';
  game.recomputeStats();
  const after = game.factionTiers.map((t) => t.faction + t.n);
  for (const t of game.factionTiers) if (!before.includes(t.faction + t.n)) emit(game, { type: 'factionTier', faction: t.faction, n: t.n, text: t.text });
  if (after.some((x) => x.endsWith('8'))) game.run.awakened = 1;
  game.run.synergyMax = Math.max(game.run.synergyMax, game.synergies.length);
  if (game.triads.length) game.run.triads = 1;
}

export function chooseCard(game, index) {
  const card = game.draft.options?.[index];
  if (!card) return false;
  if (card.id === 'fallback_gold') { game.inventory.gold += 250; game.run.goldEarned += 250; }
  else if (card.id === 'fallback_heal') game.player.hp = Math.min(game.stats.maxHp, game.player.hp + game.stats.maxHp * 0.4);
  else addSkill(game, card.id, card.isEvolve ? 1 : 1);
  emit(game, { type: 'cardPicked', id: card.id, rarity: card.rarity, name: card.name });
  game.draft.options = null;
  game.pendingLevels = Math.max(0, game.pendingLevels - (game.draft.source === 'level' ? 1 : 0));
  if (game.pendingLevels > 0 && game.draft.source === 'level') openDraft(game);
  else { game.status = game.draft.returnTo || 'playing'; game.draft.returnTo = null; game.onDraftClosed?.(); }
  return true;
}

export function reroll(game) {
  if (game.draft.rerolls <= 0) return false;
  game.draft.rerolls--;
  game.draft.options = rollOptions(game);
  emit(game, { type: 'reroll' });
  return true;
}

export function banish(game, index) {
  const card = game.draft.options?.[index];
  if (!card || game.draft.banishes <= 0 || card.id.startsWith('fallback')) return false;
  game.draft.banishes--;
  game.draft.banished.add(card.id);
  const pool = candidatePool(game).filter((x) => !game.draft.options.some((c) => c.id === x.def.id));
  if (pool.length) { const pick = game.rng.weighted(pool, (x) => x.weight); game.draft.options[index] = cardFor(game, pick.def); }
  else game.draft.options.splice(index, 1);
  return true;
}

/** Random owned-or-new skill of given faction (for faction stone / events). */
export function randomFactionSkill(game, faction, minRarity) {
  const pool = FACTION_SKILLS.filter((s) => s.faction === faction && !game.skills.owned.has(s.id) && (!minRarity || rarityTier(s.rarity) >= rarityTier(minRarity)) && s.kind !== 'active');
  const pool2 = FACTION_SKILLS.filter((s) => s.faction === faction && !game.skills.owned.has(s.id));
  return (pool.length ? game.rng.pick(pool) : game.rng.pick(pool2))?.id;
}
