// Aggregates every stat source into game.stats. Called whenever game.statsDirty is set (and each second for buffs).
import { SKILL } from './content/skills.js';
import { ITEM } from './content/items.js';
import { FACTION, FACTIONS, SYNERGIES, TRIADS } from './content/factions.js';
import { ACCOUNT, TALENT, MASTERY } from './content/meta.js';

export const STAT_DEFAULTS = {
  hpFlat: 0, hpMult: 0, atkFlat: 0, atkMult: 0, def: 0, defMult: 0, crit: 0, critDmg: 0, atkSpeed: 0, speedMult: 0, cdr: 0, area: 0, duration: 0,
  projectiles: 0, pierce: 0, regenPct: 0, lifesteal: 0, skillLifesteal: 0, lifestealMult: 0, pickup: 0, luck: 0, goldGain: 0, xpGain: 0,
  musouGain: 0, musouDur: 0, musouDmg: 0, musouStart: 0, musouBars: 0, trueMusou: 0, dodgeCdr: 0, iframes: 0, knockback: 0,
  ccPower: 0, stunPower: 0, freezePower: 0, slowPower: 0, rootPower: 0, summonPower: 0, skillDmg: 0, lightDmg: 0, chargeDmg: 0,
  vsElite: 0, vsBoss: 0, vsFrozen: 0, vsStunned: 0, block: 0, evasion: 0, thorns: 0, dmgReduction: 0, armorReduction: 0, dmgTaken: 0, dmgMult: 0,
  burnPower: 0, poisonPower: 0, bleedPower: 0, fireDmg: 0, stormDmg: 0, igniteChance: 0, poisonStacks: 0, chainJumps: 0, comboDmg: 0, healPower: 0,
  revives: 0, shopDiscount: 0, rerolls: 0, banishes: 0, settleGold: 0, beastCount: 0, size: 0, kbImmune: 0, ccImmune: 0,
  phoenixHeal: 0, overloadDmg: 0, chargeEvery: 0, soulMax: 0, coupChance: 0, echoChance: 0, rageAtk: 0, manaStars: 0, venom: 0, comboCrit: 0,
  plagueRaise: 0, boneArmor: 0, tremorDmg: 0, martyrHeal: 0, shieldPct: 0, vsBossOnly: 0, vsBoss2: 0,
};

const addStats = (acc, stats, mult = 1) => { if (!stats) return; for (const k in stats) acc[k] = (acc[k] || 0) + stats[k] * mult; };

/** Stats contributed by an owned passive skill at level lv. */
export function passiveStats(def, lv) {
  const out = {};
  if (def.statsPerLevelOnly) { addStats(out, def.statsOnce); addStats(out, def.statsPerLevelOnly, lv); return out; }
  for (const k in def.stats || {}) {
    out[k] = def.statsPerLevel && def.statsPerLevel[k] != null ? def.stats[k] + def.statsPerLevel[k] * (lv - 1) : def.stats[k] * lv;
  }
  return out;
}

export function factionCounts(owned) {
  const counts = {};
  for (const id of owned.keys()) { const f = SKILL[id]?.faction; if (f) counts[f] = (counts[f] || 0) + 1; }
  return counts;
}
export function activeTiers(counts) {
  const out = [];
  for (const f of FACTIONS) for (const t of f.tiers) if ((counts[f.id] || 0) >= t.n) out.push({ faction: f.id, ...t });
  return out;
}
export const activeSynergies = (counts) => SYNERGIES.filter((s) => (counts[s.a] || 0) >= 2 && (counts[s.b] || 0) >= 2);
export const activeTriads = (counts) => TRIADS.filter((t) => t.factions.every((f) => (counts[f] || 0) >= 2));

export function computeStats(game) {
  const p = game.player, hero = game.hero, acc = { ...STAT_DEFAULTS };
  const base = { hp: hero.base.hp, atk: hero.base.atk, def: hero.base.def, speed: hero.base.speed };
  addStats(acc, { crit: hero.base.crit || 0, critDmg: (hero.base.critDmg || 1.5) - 1.5, block: hero.base.block || 0, lifesteal: hero.base.lifesteal || 0,
    skillDmg: hero.base.skillDmg || 0, cdr: hero.base.cdr || 0, atkSpeed: hero.base.atkSpeed || 0, summonPower: hero.base.summonPower || 0 });
  const procs = [];
  const meta = game.meta || {};
  // Account level & talents & mastery
  const al = meta.accountLevel || 1;
  addStats(acc, ACCOUNT.perLevel, al - 1);
  for (const tid of meta.talents || []) { const t = TALENT[tid]; if (!t) continue; addStats(acc, t.stats); if (t.procs) procs.push(...t.procs.map((x) => ({ ...x, src: tid, lv: 1 }))); }
  const ml = meta.mastery || 1;
  for (let l = 2; l <= ml; l++) addStats(acc, MASTERY.unlocks[l]?.stats);
  addStats(acc, game.runMods?.stats);
  addStats(acc, game.chapterStats);
  // Skills
  for (const [id, s] of game.skills.owned) {
    const def = SKILL[id]; if (!def) continue;
    if (def.kind === 'passive') {
      addStats(acc, passiveStats(def, s.lv));
      if (def.procs) procs.push(...def.procs.map((x) => ({ ...x, src: id, lv: s.lv })));
    }
  }
  // Factions / synergies
  const counts = factionCounts(game.skills.owned);
  game.factionCounts = counts;
  game.factionTiers = activeTiers(counts);
  for (const t of game.factionTiers) { addStats(acc, t.stats); if (t.procs) procs.push(...t.procs.map((x) => ({ ...x, src: `${t.faction}${t.n}`, lv: 1 }))); }
  game.synergies = activeSynergies(counts);
  for (const s of game.synergies) { addStats(acc, s.stats); if (s.procs) procs.push(...s.procs.map((x) => ({ ...x, src: s.id, lv: 1 }))); }
  game.triads = activeTriads(counts);
  // Items
  for (const id of game.inventory.items) {
    if (!id) continue; const it = ITEM[id]; addStats(acc, it.stats);
    if (it.procs) procs.push(...it.procs.map((x) => ({ ...x, src: id, lv: 1 })));
  }
  if (game.inventory.neutral) { const n = ITEM[game.inventory.neutral]; addStats(acc, n.stats); procs.push(...n.procs.map((x) => ({ ...x, src: n.id, lv: 1 }))); }
  // Temporary buffs
  for (const b of p.buffs) addStats(acc, b.stats);
  // Derived
  const lvlAtk = 1 + 0.025 * (game.run.level - 1), lvlHp = 1 + 0.03 * (game.run.level - 1);
  const st = acc;
  st.maxHp = Math.max(50, (base.hp + acc.hpFlat) * Math.max(0.2, 1 + acc.hpMult) * lvlHp);
  st.atk = (base.atk + acc.atkFlat) * Math.max(0.2, 1 + acc.atkMult) * lvlAtk;
  st.armor = Math.max(0, (base.def + acc.def) * (1 + acc.defMult));
  st.speed = Math.min(14, base.speed * Math.max(0.4, 1 + acc.speedMult) * (1 + acc.size * 0.2));
  st.critChance = Math.min(0.95, acc.crit);
  st.critMult = 1.5 + acc.critDmg;
  st.cdrTotal = Math.min(0.65, acc.cdr);
  st.attackRate = Math.max(0.5, 1 + acc.atkSpeed);
  st.areaMult = 1 + acc.area;
  st.durMult = 1 + acc.duration;
  st.pickupRange = 3.2 * (1 + acc.pickup);
  st.blockChance = Math.min(0.75, acc.block);
  st.evasionChance = Math.min(0.6, acc.evasion);
  st.dr = Math.min(0.8, acc.dmgReduction);
  st.musouGainMult = 1 + acc.musouGain;
  st.dodgeCd = 0.6 * Math.max(0.3, 1 - acc.dodgeCdr);
  st.iframeTime = 0.3 + acc.iframes;
  st.summonMult = 1 + acc.summonPower;
  st.ccMult = 1 + acc.ccPower;
  st.lifestealTotal = acc.lifesteal * (1 + acc.lifestealMult);
  st.scale = 1 + acc.size;
  game.stats = st;
  game.procs = procs;
  if (p.hp > st.maxHp) p.hp = st.maxHp;
  if (p.maxHpPrev && st.maxHp > p.maxHpPrev) p.hp += st.maxHp - p.maxHpPrev; // grow current HP with max HP
  p.maxHpPrev = st.maxHp;
  game.statsDirty = false;
  return st;
}

export const factionOf = (id) => FACTION[SKILL[id]?.faction];
