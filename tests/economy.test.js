import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/game/sim.js';
import { buy, sell, acquisitionPlan, autoCombine } from '../src/game/shop.js';
import { ITEM, itemTotalCost } from '../src/game/content/items.js';
import { createProfile, migrateProfile, buyTalent, canBuyTalent, settleRun, buyMeta, toggleLoadout, consumeLoadout, unlockHero, chapterUnlocked } from '../src/game/progression.js';
import { rarityWeight } from '../src/game/content/rarities.js';

const fresh = () => createGame({ mode: 'endless', hero: 'knight', seed: 1, starter: false });

test('buying a crafted item buys missing parts and the recipe', () => {
  const g = fresh(); g.inventory.gold = 10000;
  const plan = acquisitionPlan(g, 'i_cleaver');
  assert.equal(plan.cost, itemTotalCost('i_cleaver'));
  assert.ok(buy(g, 'c_hatchet').ok);
  const after = acquisitionPlan(g, 'i_cleaver');
  assert.equal(after.cost, itemTotalCost('i_cleaver') - ITEM.c_hatchet.cost);
  const gold = g.inventory.gold;
  assert.ok(buy(g, 'i_cleaver').ok);
  assert.equal(g.inventory.gold, gold - after.cost);
  assert.deepEqual(g.inventory.items.filter(Boolean), ['i_cleaver']);
});

test('recipe-free items combine automatically and artifacts upgrade crafted items', () => {
  const g = fresh(); g.inventory.gold = 50000;
  buy(g, 'c_boots'); buy(g, 'c_chainmail');
  assert.ok(g.inventory.items.includes('i_phase_boots'), g.inventory.items.join());
  buy(g, 'i_cleaver');
  assert.ok(buy(g, 'a_worldsplitter').ok);
  assert.ok(g.inventory.items.includes('a_worldsplitter') && !g.inventory.items.includes('i_cleaver'));
  autoCombine(g);
});

test('sell refunds half and a full inventory refuses new items', () => {
  const g = fresh(); g.inventory.gold = 50000;
  for (const id of ['c_mithril', 'c_plate', 'c_robe', 'c_boots', 'c_crown', 'c_relic']) buy(g, id);
  assert.equal(g.inventory.items.filter(Boolean).length, 6);
  const r = buy(g, 'c_iron_sword');
  assert.equal(r.ok, false);
  const gold = g.inventory.gold;
  sell(g, 0);
  assert.equal(g.inventory.gold, gold + Math.round(itemTotalCost('c_mithril') * 0.5));
});

test('consumables stack on the belt', () => {
  const g = fresh(); g.inventory.gold = 5000;
  buy(g, 'k_heal_potion'); buy(g, 'k_heal_potion'); buy(g, 'k_bomb');
  assert.deepEqual(g.inventory.belt.filter(Boolean).map((b) => `${b.id}x${b.count}`), ['k_heal_potion x2'.replace(' ', ''), 'k_bombx1']);
});

test('higher rarity is rarer and luck shifts the odds upward', () => {
  assert.ok(rarityWeight('common') > rarityWeight('rare'));
  assert.ok(rarityWeight('rare') > rarityWeight('arcana'));
  const base = rarityWeight('legendary') / rarityWeight('common');
  const lucky = rarityWeight('legendary', { luck: 40, level: 30 }) / rarityWeight('common', { luck: 40, level: 30 });
  assert.ok(lucky > base * 2);
});

test('talents follow order, cost and talent point rules', () => {
  const p = createProfile(); p.gold = 100000;
  assert.equal(canBuyTalent(p, 't_body_1').ok, false);
  assert.ok(buyTalent(p, 't_body_0').ok);
  for (let i = 1; i < 4; i++) assert.ok(buyTalent(p, `t_body_${i}`).ok);
  assert.equal(canBuyTalent(p, 't_body_4').ok, false, 'needs a talent point');
  p.accountLevel = 10;
  assert.ok(buyTalent(p, 't_body_4').ok);
});

test('meta shop loadout is consumed when a run starts', () => {
  const p = createProfile(); p.gold = 5000;
  assert.ok(buyMeta(p, 'm_war_banner').ok);
  assert.ok(toggleLoadout(p, 'm_war_banner').ok);
  assert.deepEqual(consumeLoadout(p), ['m_war_banner']);
  assert.equal(p.metaInv.m_war_banner, 0);
  const g = createGame({ mode: 'endless', hero: 'knight', seed: 1, starter: false, meta: { metaItems: ['m_war_banner'] } });
  const g0 = createGame({ mode: 'endless', hero: 'knight', seed: 1, starter: false });
  assert.ok(g.stats.atk > g0.stats.atk * 1.1);
});

test('settlement grants gold, xp and mastery and unlocks the next chapter', () => {
  const p = createProfile();
  const g = createGame({ mode: 'adventure', hero: 'knight', chapter: 1, seed: 1 });
  g.run.kills = 600; g.run.goldEarned = 4000; g.run.level = 20; g.status = 'chapterClear'; g.result = { win: true };
  assert.equal(chapterUnlocked(p, 2), false);
  const s = settleRun(p, g);
  assert.ok(s.gold > 400 && s.xp > 500);
  assert.ok(p.accountLevel > 1);
  assert.equal(chapterUnlocked(p, 2), true);
  assert.ok(s.achievements.some((a) => a.id === 'ach_ch1'));
});

test('profile migration keeps progress and fills new fields', () => {
  const old = { gold: 1234, accountLevel: 7, heroes: { knight: { mastery: 3 } }, stats: { runs: 4 } };
  const p = migrateProfile(old);
  assert.equal(p.gold, 1234); assert.equal(p.accountLevel, 7); assert.equal(p.heroes.knight.mastery, 3); assert.equal(p.heroes.knight.unlocked, true);
  assert.equal(p.stats.runs, 4); assert.ok(p.settings && p.codex && p.heroes.necromancer);
  assert.equal(unlockHero(p, 'necromancer').ok, false);
});
