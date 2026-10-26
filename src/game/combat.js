// Damage resolution, status effects, kills and drops. Pure simulation; emits game.events for presentation.
import { clamp, dist2 } from './util.js';
import { runProcs, procMods } from './procs.js';
import { FACTION } from './content/factions.js';
import { ITEM, NEUTRALS, COMPONENTS } from './content/items.js';
import { applyStatusToPlayer } from './debuffs.js';

export const TAG_COLOR = { fire: '#ff8a3a', frost: '#8fe3ff', storm: '#9ec1ff', shadow: '#c58cff', holy: '#ffe07a', nature: '#8cf06a', blade: '#f2f4f8', arcane: '#ff7ae6', earth: '#e2b06a', blood: '#ff5468' };
const DOT_COLOR = { burn: '#ff9a4a', poison: '#7cf05a', bleed: '#ff4a5e', doom: '#b07aff' };
const MULTIKILL = [[10, '十连斩'], [25, '横扫千军'], [50, '万夫莫敌'], [80, '无双乱舞'], [120, '天下无双']];
const KO_MILESTONES = [100, 300, 500, 1000, 1500, 2000, 3000, 5000, 8000, 10000];

export const emit = (game, ev) => { game.events.push(ev); return ev; };

export function isElite(e) { return e.elite || e.officer || e.boss; }

/** Player-side damage roll (before target armor). coef = multiple of attack. */
export function rollPlayerDamage(game, e, coef, o = {}) {
  const st = game.stats, p = game.player;
  let mult = 1 + st.dmgMult;
  if (o.source === 'light' || o.source === 'charge') mult *= 1 + st.lightDmg + (o.source === 'charge' ? st.chargeDmg : 0);
  if (o.source === 'skill' || o.source === 'proc' || o.source === 'summon') mult *= 1 + st.skillDmg;
  if (o.source === 'musou') mult *= 1 + st.musouDmg + (p.musouAwakened ? 0.3 : 0) + (p.trueMusou ? 0.25 : 0);
  if (o.source === 'summon') mult *= st.summonMult;
  for (const t of o.tags || []) { if (t === 'fire') mult *= 1 + st.fireDmg; else if (t === 'storm') mult *= 1 + st.stormDmg; }
  if (e) {
    if (isElite(e)) mult *= 1 + st.vsElite + (e.boss ? st.vsBoss : 0);
    if (e.status.freeze || e.status.timeStop) mult *= 1 + st.vsFrozen;
    if (e.status.stun || e.status.timeStop) mult *= 1 + st.vsStunned;
    if (e.vuln) mult *= 1 + e.vuln;
    if (e.status.mark) mult *= 1 + (e.status.mark.vuln || 0);
    if (e.status.chrono) mult *= 1 + e.status.chrono.vuln;
    mult *= procMods(game, e, o);
  }
  if (game.combo.n >= 50 && st.comboDmg) mult *= 1 + Math.min(10, Math.floor(game.combo.n / 50)) * st.comboDmg;
  if (p.nextHitMult && o.source !== 'dot') { mult *= p.nextHitMult; p.nextHitMult = 0; }
  let critChance = st.critChance + (o.critBonus || 0) + (e?.critBonus || 0);
  if (e?.status.mark?.alwaysCrit || p.guaranteedCrits > 0 || o.crit === 1) critChance = 1;
  const crit = o.source !== 'dot' && game.rng.next() < critChance;
  if (crit && p.guaranteedCrits > 0 && o.source !== 'proc') p.guaranteedCrits--;
  const variance = 0.92 + game.rng.next() * 0.16;
  let amount = st.atk * coef * mult * variance * (crit ? st.critMult : 1) * (game.runMods?.playerDmg || 1);
  return { amount, crit };
}

export function damageEnemy(game, e, coef, o = {}) {
  if (!e || e.dead || e.dying) return 0;
  const roll = o.raw != null ? { amount: o.raw, crit: !!o.crit } : rollPlayerDamage(game, e, coef, o);
  let amount = roll.amount;
  // armor
  const armor = Math.max(0, e.armor - (game.stats.armorPen || 0));
  amount *= 60 / (60 + armor);
  // shield guard: blocks from the front unless guard-broken
  if (e.def?.block && !e.guardBroken && !o.pierceGuard && e.state !== 'stun' && o.fromX != null) {
    const ang = Math.atan2(o.fromX - e.x, o.fromZ - e.z);
    const diff = Math.abs(((ang - e.face + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    if (diff < 1.2) {
      if (o.guardBreak || o.source === 'charge' || o.source === 'musou') { e.guardBroken = 2.5; emit(game, { type: 'guardBreak', x: e.x, z: e.z }); }
      else { amount *= 1 - e.def.block; emit(game, { type: 'blocked', x: e.x, z: e.z, y: e.height }); }
    }
  }
  if (e.shield > 0) { const ab = Math.min(e.shield, amount); e.shield -= ab; amount -= ab; }
  amount = Math.max(1, amount);
  e.hp -= amount;
  e.flash = 1;
  e.lastHitAt = game.time;
  const color = o.color || (o.tags && TAG_COLOR[o.tags[0]]) || (o.source === 'dot' ? DOT_COLOR[o.dot] : null);
  if (o.source !== 'dot' || amount >= 1) emit(game, { type: 'hit', x: e.x, z: e.z, y: e.y + e.height, amount, crit: roll.crit, color, source: o.source, dot: o.dot, elite: isElite(e), id: e.uid });
  game.run.damageDealt += amount;
  // physical reactions
  if (!o.noReact && o.source !== 'dot') {
    const kbMult = (1 + game.stats.knockback) / (e.mass * (e.boss ? 6 : 1));
    if (o.kb && !e.boss) {
      const dx = e.x - (o.fromX ?? game.player.x), dz = e.z - (o.fromZ ?? game.player.z), d = Math.hypot(dx, dz) || 1;
      e.vx += (dx / d) * o.kb * kbMult * 2.2; e.vz += (dz / d) * o.kb * kbMult * 2.2;
    }
    if (o.launch && !e.boss && !e.def?.fly && e.mass < 5.5) { e.vy = Math.max(e.vy, o.launch * Math.min(1.2, 1.6 / Math.sqrt(e.mass))); e.airborne = true; e.y = Math.max(e.y, 0.05); }
    else if (e.airborne && o.source !== 'proc') e.vy = Math.max(e.vy, 2.6); // juggle
    if (!e.boss && e.state !== 'dying') {
      if (o.stun) applyStatus(game, e, { stun: o.stun });
      else if (e.state !== 'windup' || o.source === 'charge' || o.source === 'musou' || (e.elite ? 0 : e.def.mass < 2)) { e.stagger = Math.max(e.stagger || 0, e.elite ? 0.12 : 0.28); }
    } else if (o.stun && e.boss) applyStatus(game, e, { stun: o.stun * 0.25 });
  }
  if (o.status) applyStatus(game, e, o.status, o);
  if (game.stats.igniteChance && o.source !== 'dot' && game.rng.next() < game.stats.igniteChance) applyStatus(game, e, { burn: 2 });
  // sustain + resources
  if (o.source !== 'dot') {
    const ls = (o.source === 'skill' ? game.stats.skillLifesteal : 0) + game.stats.lifestealTotal + (o.lifesteal || 0);
    if (ls > 0) healPlayer(game, amount * ls * (o.source === 'skill' ? 0.5 : 1), true);
    const gain = (o.source === 'light' ? 0.55 : o.source === 'charge' ? 0.7 : o.source === 'musou' ? 0 : 0.25) * game.stats.musouGainMult;
    addMusou(game, gain);
    game.combo.n++; game.combo.t = 2.6; if (game.combo.n > game.run.maxCombo) game.run.maxCombo = game.combo.n;
    if (roll.crit) runProcs(game, 'crit', { e, amount, o });
    if (!o.noProc) runProcs(game, 'hit', { e, amount, crit: roll.crit, o });
  }
  if (e.affixes?.includes('reflect') && o.source !== 'dot' && o.source !== 'proc') damagePlayer(game, amount * 0.15, { x: e.x, z: e.z, kind: 'reflect', noReflect: true });
  if (e.hp <= 0) killEnemy(game, e, o);
  return amount;
}

export function applyStatus(game, e, status, o = {}) {
  const st = game.stats, s = e.status, boss = e.boss, resist = boss ? 0.35 : e.elite || e.officer ? 0.7 : 1;
  const cc = st.ccMult;
  for (const k in status) {
    const v = status[k];
    switch (k) {
      case 'burn': { const dps = 0.3 * (1 + st.burnPower); s.burn = { t: Math.max(s.burn?.t || 0, v), dps: Math.max(s.burn?.dps || 0, dps), tick: s.burn?.tick ?? 0.5 }; break; }
      case 'poison': { const stacks = Math.min(3 + st.poisonStacks, (s.poison?.stacks || 0) + 1); s.poison = { t: Math.max(s.poison?.t || 0, v), dps: 0.22 * (1 + st.poisonPower), stacks, tick: s.poison?.tick ?? 0.5 }; break; }
      case 'bleed': { s.bleed = { t: Math.max(s.bleed?.t || 0, v), dps: 0.35 * (1 + st.bleedPower), tick: s.bleed?.tick ?? 0.5 }; break; }
      case 'slow': s.slow = { t: Math.max(s.slow?.t || 0, v * cc), pct: Math.min(0.7, 0.4 * (1 + st.slowPower)) }; break;
      case 'freeze': if (!boss) { s.freeze = { t: Math.max(s.freeze?.t || 0, v * cc * (1 + st.freezePower) * resist) }; e.vx *= 0.2; e.vz *= 0.2; } else s.slow = { t: 2, pct: 0.5 }; break;
      case 'stun': { const d = v * cc * (1 + st.stunPower) * resist; if (d > 0.05) s.stun = { t: Math.max(s.stun?.t || 0, d) }; break; }
      case 'root': if (!boss) s.root = { t: Math.max(s.root?.t || 0, v * cc * (1 + st.rootPower) * resist) }; break;
      case 'fear': if (!boss) s.fear = { t: Math.max(s.fear?.t || 0, v * resist) }; break;
      case 'silence': s.silence = { t: Math.max(s.silence?.t || 0, v) }; break;
      default: break;
    }
  }
  if (status.freeze && !boss) emit(game, { type: 'status', kind: 'freeze', id: e.uid, x: e.x, z: e.z });
}

export function addMusou(game, amount) {
  const p = game.player, cap = 100 * (1 + game.stats.musouBars);
  if (p.state === 'musou') return;
  const before = p.musou;
  p.musou = clamp(p.musou + amount, 0, cap);
  if (Math.floor(before / 100) < Math.floor(p.musou / 100)) emit(game, { type: 'musouReady' });
}

export function healPlayer(game, amount, quiet = false) {
  const p = game.player, st = game.stats;
  if (p.dead || amount <= 0) return 0;
  const heal = amount * (1 + st.healPower) * (p.mods?.healMult ?? 1);
  const missing = st.maxHp - p.hp;
  const applied = Math.min(missing, heal);
  p.hp += applied;
  const over = heal - applied;
  if (over > 0) runProcs(game, 'overheal', { amount: over });
  if (applied > 0) runProcs(game, 'heal', { amount: applied });
  if (!quiet && applied >= 1) emit(game, { type: 'heal', amount: applied, x: p.x, z: p.z });
  game.run.healed += applied;
  return applied;
}

export function damagePlayer(game, amount, src = {}) {
  const p = game.player, st = game.stats;
  if (p.dead || game.status !== 'playing') return 0;
  if (p.invuln > 0 || p.state === 'musou' || p.buffInvuln > 0) { if (src.kind !== 'dot') emit(game, { type: 'immune', x: p.x, z: p.z }); return 0; }
  if (src.kind !== 'dot' && game.rng.next() < st.evasionChance) { emit(game, { type: 'evade', x: p.x, z: p.z }); runProcs(game, 'evade', {}); return 0; }
  if (p.spellShield && src.kind !== 'dot') { p.spellShield = false; emit(game, { type: 'spellShield', x: p.x, z: p.z }); return 0; }
  let dmg = amount * (game.diff.dmg) * (1 + st.dmgTaken);
  let blocked = false;
  if (src.kind !== 'dot' && game.rng.next() < st.blockChance) { dmg *= 0.3; blocked = true; runProcs(game, 'block', { src }); }
  dmg *= 50 / (50 + Math.max(0, st.armor * (p.mods?.armorMult ?? 1)));
  dmg *= p.mods?.dmgTaken ?? 1;
  dmg *= 1 - st.dr;
  if (p.armorState) dmg *= 1 - st.armorReduction;
  dmg *= procMods(game, null, { incoming: true });
  dmg = Math.max(1, dmg);
  if (p.shield > 0) { const ab = Math.min(p.shield, dmg); p.shield -= ab; dmg -= ab; if (dmg <= 0) { emit(game, { type: 'shieldHit', x: p.x, z: p.z }); return 0; } }
  p.hp -= dmg;
  p.hurtFlash = 1;
  game.run.damageTaken += dmg;
  game.run.lastHurtAt = game.time;
  emit(game, { type: 'playerHit', amount: dmg, blocked, x: p.x, z: p.z, kind: src.kind });
  if (src.kind !== 'dot') addMusou(game, 2.5 * st.musouGainMult * (game.procIndex?.rage ? 2 : 1));
  if (!src.noReflect) runProcs(game, 'damaged', { amount: dmg, src });
  if (st.thorns > 0 && src.enemy && !src.noReflect) damageEnemy(game, src.enemy, 0, { raw: amount * st.thorns * 2, source: 'proc', noProc: true, color: '#d9a05b' });
  if (src.status) applyPlayerStatus(game, src.status, src);
  if (p.hp <= 0) playerDowned(game);
  return dmg;
}

export function applyPlayerStatus(game, status, src = {}) {
  applyStatusToPlayer(game, status, src);
}

function playerDowned(game) {
  const p = game.player;
  if (runProcs(game, 'save', {})) return; // a proc saved the player
  if (p.revives > 0) {
    p.revives--; p.hp = game.stats.maxHp * 0.6; p.invuln = 3;
    emit(game, { type: 'banner', text: '涅槃重生', sub: `剩余复活 ${p.revives}`, style: 'revive' });
    emit(game, { type: 'revive', x: p.x, z: p.z });
    for (const e of game.enemies) if (!e.boss && Math.hypot(e.x - p.x, e.z - p.z) < 9) damageEnemy(game, e, 3, { source: 'proc', kb: 8, launch: 6 });
    return;
  }
  p.hp = 0; p.dead = true; p.state = 'dead'; p.stateT = 0;
  emit(game, { type: 'playerDeath', x: p.x, z: p.z });
  game.endAt = game.time + 2.2;
}

export function killEnemy(game, e, o = {}) {
  if (e.dying) return;
  e.dying = true; e.state = 'dying'; e.stateT = 0; e.hp = 0;
  e.deathStyle = e.airborne ? 'air' : o.launch ? 'launch' : game.rng.next() < 0.5 ? 1 : 2;
  const run = game.run;
  run.kills++;
  game.killsThisStage++;
  if (e.officer) { run.officers++; if (game.stage) game.stage.officersKilled = (game.stage.officersKilled || 0) + 1; emit(game, { type: 'banner', text: '敌将击破！', sub: e.officer.name, style: 'officer' }); emit(game, { type: 'hitstop', t: 0.13 }); emit(game, { type: 'shake', a: 0.7 }); }
  if (e.elite && !e.officer && !e.boss) emit(game, { type: 'hitstop', t: 0.07 });
  addMusou(game, (e.boss ? 40 : isElite(e) ? 6 : 1.0) * game.stats.musouGainMult);
  emit(game, { type: 'kill', id: e.uid, x: e.x, z: e.z, y: e.y, elite: isElite(e), boss: !!e.boss, model: e.model, by: o.source });
  // multikill window
  const mk = game.multikill;
  if (game.time - mk.last > 1.25) mk.n = 0;
  mk.n++; mk.last = game.time;
  for (const [n, text] of MULTIKILL) if (mk.n === n) emit(game, { type: 'multikill', n, text });
  const ko = run.kills;
  if (KO_MILESTONES.includes(ko)) emit(game, { type: 'ko', n: ko });
  // drops
  dropLoot(game, e);
  runProcs(game, 'kill', { e, o });
  if (e.status.burn) runProcs(game, 'burnDeath', { e });
  if (e.status.poison) runProcs(game, 'poisonDeath', { e });
  if (e.status.freeze) runProcs(game, 'frozenDeath', { e });
  if (e.status.doom || e.status.mark?.explode) {
    const ex = e.status.mark?.explode || e.status.doom?.explode;
    if (ex) areaDamage(game, e.x, e.z, ex.r, ex.dmg, { source: 'skill', tags: ['shadow'], vfx: 'shadowBurst' });
  }
  if (e.def?.split && !e.isSplit) {
    for (let i = 0; i < e.def.split.count; i++) game.spawnQueue.push({ id: e.def.id, x: e.x + game.rng.range(-1, 1), z: e.z + game.rng.range(-1, 1), split: e.def.split, noSpawnAnim: true });
  }
  if (e.affixes?.includes('splitter') && !e.isSplit) {
    for (let i = 0; i < 2; i++) game.spawnQueue.push({ id: e.def.id, x: e.x + game.rng.range(-1.5, 1.5), z: e.z + game.rng.range(-1.5, 1.5), splitAffix: true, hpMult: 0.3, noSpawnAnim: true });
  }
  if (game.runMods?.volatile && game.rng.next() < game.runMods.volatile) {
    game.hostile.push({ kind: 'circle', x: e.x, z: e.z, r: 2.2, t: 0, windup: 0.9, dmg: 14, id: game.uid++ });
  }
  game.corpses.push({ x: e.x, z: e.z, t: game.time });
  if (game.corpses.length > 60) game.corpses.shift();
  if (e.boss) game.onBossKilled?.(e);
}

function dropLoot(game, e) {
  const rng = game.rng, st = game.stats;
  const xp = e.xp * (1 + st.xpGain) * (game.diff.reward > 1 ? 1 + (game.diff.reward - 1) * 0.5 : 1);
  const gp = (v, kind, extra = {}) => game.pickups.push({ uid: game.uid++, kind, value: v, x: e.x + rng.range(-0.6, 0.6), z: e.z + rng.range(-0.6, 0.6), vx: rng.range(-3, 3), vz: rng.range(-3, 3), vy: rng.range(4, 7), y: e.y + 0.6, t: 0, ...extra });
  if (xp > 0) gp(xp, 'xp');
  const goldChance = e.boss || isElite(e) ? 1 : 0.3;
  if (rng.next() < goldChance) gp(Math.max(1, Math.round(e.gold * rng.range(0.8, 1.6) * game.diff.reward * (1 + st.goldGain))), 'gold');
  if (!isElite(e) && rng.next() < 0.012) gp(0.12, 'heal');
  if (e.elite || e.officer) {
    const bonus = game.eliteBonus ? 1 : 0;
    if (rng.next() < (e.officer ? 0.55 : 0.18) + bonus * 0.5) gp(0, 'neutral', { item: rollNeutral(game) });
    if (rng.next() < (e.officer ? 0.6 : 0.2)) gp(0, 'component', { item: rng.pick(COMPONENTS.filter((c) => c.cost <= 1400)).id });
    if (e.officer) gp(Math.round(80 * game.diff.reward * (1 + st.goldGain)), 'gold');
    if (bonus) game.eliteBonus = 0;
  }
  if (e.boss) { for (let i = 0; i < 12; i++) gp(Math.round(40 * game.diff.reward), 'gold'); gp(0, 'neutral', { item: rollNeutral(game, 1) }); gp(0.5, 'heal'); }
}

export function rollNeutral(game, bonusTier = 0) {
  const depth = game.mode === 'endless' ? Math.floor((game.wave || 1) / 6) : (game.chapter?.id || 1) - 1 + Math.floor((game.nodeDepth || 0) / 3);
  const tier = clamp(1 + Math.floor(depth * 0.8) + bonusTier + (game.rng.next() < 0.15 ? 1 : 0), 1, 5);
  const pool = NEUTRALS.filter((n) => n.tier === tier);
  return game.rng.pick(pool).id;
}

/** Generic area damage helper used by procs and skills. */
export function areaDamage(game, x, z, r, coef, o = {}) {
  let hits = 0;
  const rr = r * (o.noArea ? 1 : game.stats.areaMult);
  game.grid.query(x, z, rr + 1.5, (e) => {
    if (e.dying || e.team !== 'enemy') return;
    if (dist2(x, z, e.x, e.z) <= (rr + e.radius) * (rr + e.radius)) { damageEnemy(game, e, coef, { fromX: x, fromZ: z, ...o }); hits++; }
  });
  if (o.vfx) game.addEffect({ kind: o.vfx, x, z, r: rr, life: o.vfxLife || 0.6, palette: o.palette || o.tags?.[0] });
  return hits;
}

export function tickEnemyStatus(game, e, dt) {
  const s = e.status;
  for (const k of ['burn', 'poison', 'bleed']) {
    const d = s[k]; if (!d) continue;
    d.t -= dt; d.tick -= dt;
    if (d.tick <= 0) { d.tick += 0.5; const stacks = d.stacks || 1; damageEnemy(game, e, d.dps * 0.5 * stacks, { source: 'dot', dot: k, noReact: true, tags: k === 'burn' ? ['fire'] : undefined }); if (e.dying) return; }
    if (d.t <= 0) delete s[k];
  }
  if (s.doom) { s.doom.t -= dt; s.doom.tick -= dt; if (s.doom.tick <= 0) { s.doom.tick += 0.5; damageEnemy(game, e, s.doom.dps * 0.5, { source: 'dot', dot: 'doom', noReact: true }); if (e.dying) return; } if (s.doom.t <= 0) delete s.doom; }
  for (const k of ['slow', 'freeze', 'stun', 'root', 'fear', 'silence', 'mark', 'chrono', 'timeStop']) { const d = s[k]; if (d) { d.t -= dt; if (d.t <= 0) delete s[k]; } }
  if (e.vulnT > 0) { e.vulnT -= dt; if (e.vulnT <= 0) e.vuln = 0; }
  if (e.guardBroken > 0) e.guardBroken -= dt;
}

export function eliteName(e) { return e.officer?.name || (e.elite ? `精英 ${e.def.name}` : e.def.name); }
export const factionColor = (f) => FACTION[f]?.color || '#fff';
export { ITEM };
