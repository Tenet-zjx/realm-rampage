// Battlefield shop: buy components/consumables, one-click buy of crafted items (buys missing parts + recipe), auto-combine, sell.
import { ITEM, COMPONENTS, CRAFTED, ARTIFACTS, CONSUMABLES, itemTotalCost } from './content/items.js';
import { emit } from './combat.js';

export const SLOT_COUNT = 6;
export const BELT_COUNT = 4;

export function priceOf(game, id) {
  const it = ITEM[id];
  const disc = 1 - (game.stats?.shopDiscount || 0) - (game.shopDiscount || 0);
  if (it.type === 'consumable') return Math.round(it.cost * disc * (1 - (game.consumableDiscount || 0)));
  if (it.type === 'component') return Math.round(it.cost * disc);
  return Math.round((it.recipe || 0) * disc * (1 - (game.runMods?.recipeDiscount || 0)));
}

/** Plan to acquire `id` using what the inventory already holds. Returns { cost, uses: [slotIndices], buys: [componentIds] }. */
export function acquisitionPlan(game, id) {
  const inv = game.inventory.items.slice();
  const used = new Set();
  let cost = 0;
  const buys = [];
  const take = (pid) => {
    const idx = inv.findIndex((x, i) => x === pid && !used.has(i));
    if (idx >= 0) { used.add(idx); return true; }
    return false;
  };
  const need = (pid) => {
    if (take(pid)) return;
    const it = ITEM[pid];
    if (it.type === 'component') { cost += priceOf(game, pid); buys.push(pid); return; }
    for (const part of it.parts) need(part);
    cost += priceOf(game, pid);
  };
  const it = ITEM[id];
  if (it.type === 'component' || it.type === 'consumable') return { cost: priceOf(game, id), uses: [], buys: [id] };
  for (const part of it.parts) need(part);
  cost += priceOf(game, id);
  return { cost, uses: [...used], buys };
}

export function canAfford(game, id) { return acquisitionPlan(game, id).cost <= game.inventory.gold; }

export function buy(game, id) {
  const it = ITEM[id];
  if (!it) return { ok: false, reason: '未知物品' };
  const inv = game.inventory;
  if (it.type === 'consumable') {
    const cost = priceOf(game, id);
    if (inv.gold < cost) return { ok: false, reason: '金币不足' };
    let slot = inv.belt.findIndex((b) => b?.id === id && b.count < it.stack);
    if (slot < 0) slot = inv.belt.findIndex((b) => !b);
    if (slot < 0) return { ok: false, reason: '药品栏已满' };
    inv.gold -= cost;
    inv.belt[slot] = inv.belt[slot] ? { id, count: inv.belt[slot].count + 1 } : { id, count: 1 };
    emit(game, { type: 'buy', id });
    return { ok: true };
  }
  const plan = acquisitionPlan(game, id);
  if (inv.gold < plan.cost) return { ok: false, reason: '金币不足' };
  const freeAfter = inv.items.filter((x) => !x).length + plan.uses.length;
  if (freeAfter < 1) return { ok: false, reason: '装备栏已满' };
  inv.gold -= plan.cost;
  for (const i of plan.uses) inv.items[i] = null;
  const slot = inv.items.indexOf(null);
  inv.items[slot] = id;
  if (it.type !== 'component') { game.run.crafts++; if (it.artifact) game.run.artifacts++; emit(game, { type: 'craft', id, name: it.name, rarity: it.rarity }); }
  else emit(game, { type: 'buy', id });
  autoCombine(game);
  game.codexSeen?.items.add(id);
  game.statsDirty = true;
  return { ok: true };
}

/** Free combines (recipe 0) happen automatically when all parts are held. */
export function autoCombine(game) {
  let changed = true;
  while (changed) {
    changed = false;
    for (const it of [...CRAFTED, ...ARTIFACTS]) {
      if (it.recipe > 0) continue;
      const inv = game.inventory.items.slice(), idxs = [];
      const ok = it.parts.every((p) => { const i = inv.findIndex((x, k) => x === p && !idxs.includes(k)); if (i < 0) return false; idxs.push(i); return true; });
      if (!ok) continue;
      for (const i of idxs) game.inventory.items[i] = null;
      game.inventory.items[game.inventory.items.indexOf(null)] = it.id;
      game.run.crafts++;
      emit(game, { type: 'craft', id: it.id, name: it.name, rarity: it.rarity, auto: true });
      changed = true;
    }
  }
  game.statsDirty = true;
}

export function sell(game, slot) {
  const id = game.inventory.items[slot];
  if (!id) return false;
  const value = Math.round(itemTotalCost(id) * 0.5);
  game.inventory.items[slot] = null;
  game.inventory.gold += value;
  delete game.inventory.cds[id];
  emit(game, { type: 'sell', id, value });
  game.statsDirty = true;
  return value;
}

export function addComponent(game, id) {
  const slot = game.inventory.items.indexOf(null);
  if (slot < 0) { const v = Math.round(ITEM[id].cost * 0.5); game.inventory.gold += v; emit(game, { type: 'popup', text: `装备栏已满 · ${ITEM[id].name} 换成 ${v} 金币` }); return false; }
  game.inventory.items[slot] = id;
  autoCombine(game);
  game.statsDirty = true;
  return true;
}

export function equipNeutral(game, id) {
  const inv = game.inventory, cur = inv.neutral && ITEM[inv.neutral];
  const it = ITEM[id];
  game.codexSeen?.items.add(id);
  if (it.tier >= 5) game.run.neutralTier5 = 1;
  if (!cur || it.tier >= cur.tier) {
    if (cur) { inv.gold += cur.tier * 150; }
    inv.neutral = id;
    emit(game, { type: 'neutral', id, name: it.name, tier: it.tier });
  } else { inv.gold += it.tier * 150; emit(game, { type: 'popup', text: `${it.name} 已兑换为 ${it.tier * 150} 金币` }); }
  game.statsDirty = true;
}

/** Items that can be built from current components (for highlighting in the shop). */
export function craftableHints(game) {
  const have = new Set(game.inventory.items.filter(Boolean));
  return [...CRAFTED, ...ARTIFACTS].filter((it) => it.parts.some((p) => have.has(p))).map((it) => it.id);
}

export const SHOP_TABS = [
  { id: 'attack', name: '攻击' }, { id: 'defense', name: '防御' }, { id: 'magic', name: '法术' }, { id: 'utility', name: '辅助' }, { id: 'consumable', name: '消耗品' }, { id: 'upgrades', name: '合成' }, { id: 'artifacts', name: '神器' },
];
export function shopList(tab) {
  if (tab === 'consumable') return CONSUMABLES.map((x) => x.id);
  if (tab === 'upgrades') return CRAFTED.map((x) => x.id);
  if (tab === 'artifacts') return ARTIFACTS.map((x) => x.id);
  return COMPONENTS.filter((c) => c.cat === tab).map((c) => c.id);
}
