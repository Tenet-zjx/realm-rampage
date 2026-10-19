// Adventure chapter map (branching node graph), node resolution and event outcomes.
import { CHAPTERS, EVENTS, BLESSINGS, BIOMES } from './content/stages.js';
import { NEUTRALS, COMPONENTS, CRAFTED } from './content/items.js';
import { SKILL, FACTION_SKILLS } from './content/skills.js';
import { rarityTier } from './content/rarities.js';
import { createStage, startStage } from './director.js';
import { openDraft, addSkill } from './draft.js';
import { addComponent, equipNeutral, buy } from './shop.js';
import { emit, rollNeutral } from './combat.js';

const LAYERS = 7;
export function generateMap(game, chapterId) {
  const rng = game.rng.fork();
  const ch = CHAPTERS.find((c) => c.id === chapterId);
  const layers = [];
  for (let L = 0; L < LAYERS; L++) {
    const n = L === 0 || L === LAYERS - 1 ? 1 : rng.int(2, 3);
    const row = [];
    for (let i = 0; i < n; i++) {
      let type = 'battle';
      if (L === LAYERS - 1) type = 'boss';
      else if (L > 0) {
        type = rng.weighted([['battle', 44], ['elite', L >= 2 ? 14 : 0], ['shop', L >= 2 ? 12 : 4], ['event', 18], ['rest', L >= 3 ? 9 : 0], ['treasure', 5]], (x) => x[1])[0];
        if (L === LAYERS - 2 && i === 0) type = rng.next() < 0.5 ? 'rest' : 'shop';
      }
      const node = { id: `${L}-${i}`, layer: L, index: i, type, next: [], done: false, x: n === 1 ? 0.5 : (i + 0.5) / n };
      if (type === 'battle') node.objective = rng.pick(ch.objectives);
      if (type === 'event') node.event = rng.pick(EVENTS).id;
      row.push(node);
    }
    layers.push(row);
  }
  // connections: each node links to 1–2 nodes in the next layer; every next node gets at least one parent
  for (let L = 0; L < LAYERS - 1; L++) {
    const cur = layers[L], nxt = layers[L + 1];
    for (const node of cur) {
      const target = Math.round(node.x * (nxt.length - 1));
      node.next.push(nxt[target].id);
      if (nxt.length > 1 && rng.next() < 0.45) { const alt = Math.min(nxt.length - 1, Math.max(0, target + (rng.next() < 0.5 ? -1 : 1))); if (!node.next.includes(nxt[alt].id)) node.next.push(nxt[alt].id); }
    }
    for (const n of nxt) if (!cur.some((c) => c.next.includes(n.id))) rng.pick(cur).next.push(n.id);
  }
  return { chapter: chapterId, layers, current: null, available: [layers[0][0].id] };
}

export const nodeById = (map, id) => map.layers.flat().find((n) => n.id === id);

export function enterNode(game, id) {
  const map = game.map;
  if (!map.available.includes(id)) return false;
  const node = nodeById(map, id);
  map.current = id;
  game.nodeDepth = node.layer;
  game.player.buffs = []; game.statsDirty = true;
  switch (node.type) {
    case 'battle': case 'elite': case 'boss':
      if (game.skipBattle && node.type === 'battle') { game.skipBattle--; completeNode(game); emit(game, { type: 'popup', text: '迷雾小径：跳过了这场战斗' }); return true; }
      resetArena(game);
      startStage(game, createStage(game, node));
      game.status = 'playing';
      break;
    case 'shop': game.status = 'shopNode'; break;
    case 'event': game.status = 'event'; game.currentEvent = EVENTS.find((e) => e.id === node.event); break;
    case 'rest': game.status = 'rest'; break;
    case 'treasure': game.status = 'treasure'; game.treasure = rollTreasure(game); break;
    default: break;
  }
  emit(game, { type: 'nodeEnter', node: node.type });
  return true;
}

export function completeNode(game) {
  const map = game.map;
  const node = nodeById(map, map.current);
  node.done = true;
  map.available = node.next.slice();
  if (node.type === 'boss') { game.status = 'chapterClear'; game.result = { win: true }; game.onChapterClear?.(); return; }
  game.status = 'map';
  // between nodes: small recovery
  game.player.hp = Math.min(game.stats.maxHp, game.player.hp + game.stats.maxHp * 0.12);
  game.player.state = 'idle'; game.player.move = null;
}

export function resetArena(game) {
  game.enemies.length = 0; game.bosses.length = 0; game.allies.length = 0; game.projectiles.length = 0; game.hostile.length = 0; game.hazards.length = 0;
  game.zones.length = 0; game.waves.length = 0; game.rings.length = 0; game.beams.length = 0; game.tethers.length = 0; game.traps.length = 0; game.walls.length = 0;
  game.pickups.length = 0; game.scheduled.length = 0; game.effects.length = 0; game.effectsById.clear(); game.corpses.length = 0; game.bossesKilled = 0;
  game.orbits.length = 0;
  game.player.invuln = 1.5; game.player.state = 'idle'; game.player.move = null; game.player.forced = null; game.player.omni = null; game.player.musouState = null; game.player.y = 0;
}

function rollTreasure(game) {
  const r = game.rng.next();
  if (r < 0.4) return { kind: 'neutral', item: rollNeutral(game, 1) };
  if (r < 0.75) return { kind: 'crafted', item: game.rng.pick(CRAFTED.filter((c) => c.rarity !== 'legendary')).id };
  return { kind: 'gold', amount: Math.round(600 * game.diff.reward * (1 + (game.nodeDepth || 0) * 0.2)) };
}

export function claimTreasure(game) {
  const t = game.treasure;
  if (t.kind === 'neutral') equipNeutral(game, t.item);
  else if (t.kind === 'crafted') { const slot = game.inventory.items.indexOf(null); if (slot >= 0) { game.inventory.items[slot] = t.item; game.statsDirty = true; } else game.inventory.gold += 900; }
  else { game.inventory.gold += t.amount; game.run.goldEarned += t.amount; }
  game.treasure = null;
  completeNode(game);
}

export function restChoice(game, choice) {
  if (choice === 'heal') game.player.hp = Math.min(game.stats.maxHp, game.player.hp + game.stats.maxHp * 0.45);
  if (choice === 'upgrade') { const up = [...game.skills.owned.entries()].filter(([id, s]) => s.lv < SKILL[id].max); if (up.length) { const [id] = game.rng.pick(up); addSkill(game, id); emit(game, { type: 'popup', text: `${SKILL[id].name} 提升 1 级` }); } }
  completeNode(game);
}

export function eventOption(game, index) {
  const ev = game.currentEvent; const opt = ev?.options[index];
  if (!opt) return false;
  if (opt.cost && game.inventory.gold < opt.cost) { emit(game, { type: 'popup', text: '金币不足' }); return false; }
  if (opt.cost) game.inventory.gold -= opt.cost;
  const fx = opt.effect, p = game.player, st = game.stats;
  const result = [];
  if (fx.hpCostMax) { game.chapterStats.hpMult = (game.chapterStats.hpMult || 0) - fx.hpCostMax; game.statsDirty = true; result.push('最大生命降低'); }
  if (fx.heal) { p.hp = Math.min(st.maxHp, p.hp + st.maxHp * fx.heal); result.push('生命恢复'); }
  if (fx.gamble) { if (game.rng.next() < fx.gamble.chance) { game.inventory.gold += fx.gamble.gold; result.push(`赢得 ${fx.gamble.gold} 金币！`); } else result.push('箱子是空的……'); }
  if (fx.upgradeRandom) { const up = [...game.skills.owned.entries()].filter(([id, s]) => s.lv < SKILL[id].max); if (up.length) { const [id] = game.rng.pick(up); addSkill(game, id); result.push(`${SKILL[id].name} +1`); } }
  if (fx.upgradeChoose) { const up = [...game.skills.owned.entries()].filter(([id, s]) => s.lv < SKILL[id].max).sort((a, b) => rarityTier(SKILL[b[0]].rarity) - rarityTier(SKILL[a[0]].rarity)); if (up.length) { addSkill(game, up[0][0], fx.upgradeChoose); result.push(`${SKILL[up[0][0]].name} +${fx.upgradeChoose}`); } }
  if (fx.neutral) { equipNeutral(game, rollNeutral(game, 1)); result.push('获得秘宝'); }
  if (fx.curse) { Object.assign(game.chapterCurse, fx.curse); result.push('诅咒加身'); }
  if (fx.chapterStats) { for (const k in fx.chapterStats) game.chapterStats[k] = (game.chapterStats[k] || 0) + fx.chapterStats[k]; game.statsDirty = true; result.push('获得祝福'); }
  if (fx.randomComponent) { addComponent(game, game.rng.pick(COMPONENTS.filter((c) => c.cost <= 1400)).id); result.push('获得配件'); }
  if (fx.randomCrafted) { const slot = game.inventory.items.indexOf(null); const it = game.rng.pick(CRAFTED.filter((c) => c.rarity !== 'legendary')); if (slot >= 0) { game.inventory.items[slot] = it.id; result.push(`获得 ${it.name}`); } else { game.inventory.gold += 800; result.push('装备栏已满，换成 800 金币'); } game.statsDirty = true; }
  if (fx.sacrificeSkill) { const list = [...game.skills.owned.keys()]; if (list.length) { const id = game.rng.pick(list); game.skills.owned.delete(id); const s = game.skills.slots.indexOf(id); if (s >= 0) game.skills.slots[s] = null; game.statsDirty = true; result.push(`失去 ${SKILL[id].name}`); } }
  if (fx.gold) { game.inventory.gold += fx.gold; result.push(`+${fx.gold} 金币`); }
  if (fx.shop) { game.consumableDiscount = fx.shop.consumableDiscount; game.status = 'shopNode'; game.currentEvent = null; return true; }
  if (fx.xpLevels) { for (let i = 0; i < Math.floor(fx.xpLevels); i++) game.addXp(game.xpToNext() - game.run.xp + 0.01); game.addXp(game.xpToNext() * (fx.xpLevels % 1)); result.push('经验大增'); }
  if (fx.treasure) { game.treasure = rollTreasure(game); game.status = 'treasure'; game.currentEvent = null; return true; }
  if (fx.skipBattle) { game.skipBattle = (game.skipBattle || 0) + 1; result.push('下一场战斗将被跳过'); }
  if (fx.extraOptions) { game.draft.extraOptions += fx.extraOptions; result.push('接下来的升级多一个选项'); }
  if (fx.eliteBonus) { game.eliteBonus = 1; result.push('精英将掉落秘宝'); }
  if (fx.swapPassive) { const ps = [...game.skills.owned.keys()].filter((id) => SKILL[id].kind === 'passive'); if (ps.length) { game.skills.owned.delete(game.rng.pick(ps)); game.statsDirty = true; } for (let i = 0; i < fx.swapPassive; i++) { const pool = FACTION_SKILLS.filter((s) => !game.skills.owned.has(s.id) && s.kind !== 'active'); if (pool.length) addSkill(game, game.rng.pick(pool).id); } result.push('命运已改写'); }
  if (fx.mutateSkill) { const list = [...game.skills.owned.keys()].filter((id) => SKILL[id].faction); if (list.length) { const id = game.rng.pick(list), def = SKILL[id]; const better = FACTION_SKILLS.filter((s) => s.faction === def.faction && s.kind === def.kind && rarityTier(s.rarity) > rarityTier(def.rarity) && !game.skills.owned.has(s.id)); if (better.length) { const nb = game.rng.pick(better); const lv = game.skills.owned.get(id).lv; game.skills.owned.delete(id); const s = game.skills.slots.indexOf(id); if (s >= 0) game.skills.slots[s] = null; addSkill(game, nb.id, lv); result.push(`${def.name} → ${nb.name}`); } else result.push('改造失败了……'); } }
  if (fx.wheel) { const r = game.rng.next(); if (r < 0.3) { game.inventory.gold += 1500; result.push('大奖：1500 金币！'); } else if (r < 0.55) { equipNeutral(game, rollNeutral(game, 2)); result.push('获得高阶秘宝！'); } else if (r < 0.8) { p.hp = Math.max(1, p.hp * 0.5); result.push('厄运：生命减半'); } else { game.chapterCurse.enemyHp = (game.chapterCurse.enemyHp || 0) + 0.15; result.push('厄运：敌人变强了'); } }
  if (fx.blessing) { const b = game.rng.pick(BLESSINGS); for (const k in b.stats) game.chapterStats[k] = (game.chapterStats[k] || 0) + b.stats[k]; game.statsDirty = true; result.push(`获得「${b.name}」`); }
  if (fx.bonusStage) { game.inventory.gold += Math.round(1000 * game.diff.reward); result.push('追上了宝藏地精：+金币'); }
  if (fx.duel) { game.pendingDuel = { gold: fx.rewardGold, component: fx.rewardComponent }; }
  game.recomputeStats();
  game.eventResult = result.join('，') || '你离开了。';
  if (fx.draft) { game.currentEvent = null; game.draft.returnTo = 'eventDone'; openDraft(game, { minRarity: fx.draft.minRarity, source: 'event' }); return true; }
  if (fx.duel) {
    game.currentEvent = null;
    resetArena(game);
    startStage(game, createStage(game, { type: 'elite', layer: game.nodeDepth }));
    game.status = 'playing';
    return true;
  }
  game.status = 'eventDone';
  return true;
}

export function biomeFor(chapterId) { return BIOMES[CHAPTERS.find((c) => c.id === chapterId).biome]; }
export { buy };
