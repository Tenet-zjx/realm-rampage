// Proc / hook registry shared by passives, faction tiers, synergies, items, neutrals and talents.
// Each handler may implement: hit, crit, kill, burnDeath, poisonDeath, frozenDeath, damaged, block, evade, heal, overheal,
// cast, swing, land, tick, save, musouEnd, mod (multiplier on outgoing/incoming damage).
import { damageEnemy, areaDamage, applyStatus, healPlayer, emit, isElite } from './combat.js';
import { fireChain, summonUnits, addZone, spawnProjectile, castAction } from './skills.js';
import { dist2 } from './util.js';

const state = (game, proc) => (game.procState[proc.src + proc.id] ??= {});
const nearest = (game, x, z, r, filter) => {
  let best = null, bd = r * r;
  game.grid.query(x, z, r, (e) => { if (e.dying || e.team !== 'enemy' || (filter && !filter(e))) return; const d = dist2(x, z, e.x, e.z); if (d < bd) { bd = d; best = e; } });
  return best;
};
const enemiesNear = (game, x, z, r, max = 99) => {
  const out = [];
  game.grid.query(x, z, r, (e) => { if (!e.dying && e.team === 'enemy' && dist2(x, z, e.x, e.z) <= r * r && out.length < max) out.push(e); });
  return out;
};
const every = (game, proc, dt, period) => { const s = state(game, proc); s.t = (s.t ?? period * 0.5) - dt; if (s.t <= 0) { s.t += period; return true; } return false; };
const directHit = (o) => o.source !== 'dot' && o.source !== 'proc';

export const PROCS = {
  burnExplode: { burnDeath: (g, p, { e }) => areaDamage(g, e.x, e.z, p.r, p.dmg, { source: 'proc', tags: ['fire'], vfx: 'fireBurst', noProc: true }) },
  meteorOnSkill: { hit: (g, p, { e, o }) => { if (o.source === 'skill' && g.rng.next() < p.chance) castAction(g, { do: 'strike', at: 'point', x: e.x, z: e.z, delay: 0.7, area: { shape: 'circle', r: 3 }, dmg: p.dmg, status: { burn: 2 }, vfx: 'meteor', tags: ['fire'] }, { source: 'proc', noProc: true }); } },
  awakenAura: { tick: (g, p, dt) => { if (every(g, p, dt, 0.5)) areaDamage(g, g.player.x, g.player.z, p.r, p.dmg * 0.5, { source: 'proc', status: p.status, tags: [p.faction], noProc: true }); } },
  shatter: { frozenDeath: (g, p, { e }) => areaDamage(g, e.x, e.z, p.r, p.dmg || g.stats.tremorDmg || 0.6, { source: 'proc', status: { freeze: p.freeze }, tags: ['frost'], vfx: 'shatter', noProc: true }) },
  periodicNova: { tick: (g, p, dt) => { if (every(g, p, dt, p.every)) areaDamage(g, g.player.x, g.player.z, p.r, p.dmg, { source: 'proc', status: p.status, tags: [p.palette], vfx: 'frostNova', palette: p.palette }); } },
  chainOnCrit: { crit: (g, p, { e, o }) => { if (o.source !== 'proc' && g.rng.next() < p.chance) fireChain(g, e, p.jumps + g.stats.chainJumps, p.dmg, { source: 'proc', tags: ['storm'], noProc: true }); } },
  periodicBolts: { tick: (g, p, dt) => { if (every(g, p, dt, p.every)) castAction(g, { do: 'targets', count: p.count, range: 16, dmg: p.dmg, stun: 0.4, vfx: 'skyBolt', tags: ['storm'] }, { source: 'proc' }); } },
  soulStacks: { kill: (g, p) => { const s = state(g, p); s.n = Math.min(p.max || g.stats.soulMax || 40, (s.n || 0) + 1); g.player.souls = s.n; }, mod: (g, p, e, o) => (o.incoming ? 1 : 1 + p.per * (state(g, p).n || 0)) },
  execute: { hit: (g, p, { e, o }) => { if (!e.dying && !isElite(e) && e.hp > 0 && e.hp / e.maxHp < (p.below || 0.15) && directHit(o)) { damageEnemy(g, e, 0, { raw: e.hp + 1, source: 'proc', noProc: true, color: '#c58cff' }); emit(g, { type: 'execute', x: e.x, z: e.z }); } } },
  raiseOnKill: { kill: (g, p, { e }) => { if (!isElite(e) && g.rng.next() < p.chance) summonUnits(g, 'ally_skeleton', 1, p.dur, 0.7, e.x, e.z); } },
  periodicShield: { tick: (g, p, dt) => { if (every(g, p, dt, p.every)) { const pct = p.pct || g.stats[p.stat] || 0.04; g.player.shield = Math.max(g.player.shield, g.stats.maxHp * pct); g.player.shieldT = p.every; emit(g, { type: 'shieldUp' }); } } },
  overhealNova: { overheal: (g, p, { amount }) => { if (amount > 2) areaDamage(g, g.player.x, g.player.z, p.r, 0, { raw: amount, source: 'proc', tags: ['holy'], noProc: true, vfx: 'haloPulse' }); } },
  cheatDeath: { save: (g, p) => { const s = state(g, p); if ((s.ready ?? 0) > g.time) return false; s.ready = g.time + p.cd; g.player.hp = 1; g.player.invuln = p.dur; emit(g, { type: 'banner', text: '炽天庇护', sub: '致命伤害已免疫', style: 'revive' }); return true; } },
  poisonSpread: { poisonDeath: (g, p, { e }) => { for (const t of enemiesNear(g, e.x, e.z, p.r, p.count)) applyStatus(g, t, { poison: 3 }); } },
  periodicThorns: { tick: (g, p, dt) => { if (every(g, p, dt, p.every)) areaDamage(g, g.player.x, g.player.z, p.r, p.dmg, { source: 'proc', status: p.status, tags: ['nature'], vfx: 'roots' }); } },
  critRefresh: { crit: (g, p) => { for (const s of g.skills.owned.values()) if (s.cd > 0) s.cd = Math.max(0, s.cd - p.amount); } },
  swordWave: { swing: (g, p) => spawnProjectile(g, { x: g.player.x, z: g.player.z, angle: g.player.face, speed: 30, range: p.len, radius: 1.1, pierce: 99, dmg: p.dmg, kind: 'crescent', source: 'proc', tags: ['blade'] }) },
  spellblade: { cast: (g, p) => { g.player.spellbladeT = p.dur; }, swing: (g, p) => { if (g.player.spellbladeT > 0) spawnProjectile(g, { x: g.player.x, z: g.player.z, angle: g.player.face, speed: 20, range: 12, radius: 0.5, homing: 4, dmg: p.dmg, kind: 'missile', source: 'proc', tags: ['arcane'] }); } },
  landingShock: { land: (g, p, { e }) => areaDamage(g, e.x, e.z, p.r, p.dmg || g.stats.tremorDmg || 0.5, { source: 'proc', tags: ['earth'], noProc: true, vfx: 'dustRing', noArea: true }) },
  stepQuake: { tick: (g, p) => { const s = state(g, p); s.d = (s.d || 0) + g.player.movedThisStep; if (s.d >= p.dist) { s.d = 0; areaDamage(g, g.player.x, g.player.z, p.r, p.dmg, { source: 'proc', status: p.status, tags: ['earth'], vfx: 'echoSlam', launch: 3 }); emit(g, { type: 'shake', a: 0.4 }); } } },
  lowHpAtk: { mod: (g, p, e, o) => (o.incoming ? 1 : g.player.hp / g.stats.maxHp < p.below ? 1 + p.atk : 1) },
  bleedOnCrit: { crit: (g, p, { e }) => applyStatus(g, e, { bleed: p.dur }) },
  berserk: {},
  killHeal: { kill: (g, p) => healPlayer(g, g.stats.maxHp * p.pct, true) },
  overhealShield: { overheal: (g, p, { amount }) => { g.player.shield = Math.min(g.stats.maxHp * p.cap, g.player.shield + amount); g.player.shieldT = Math.max(g.player.shieldT, 6); } },
  thermalShock: { hit: (g, p, { e, o }) => { if (o.tags?.includes('fire') && (e.status.freeze) && !e.dying) { delete e.status.freeze; areaDamage(g, e.x, e.z, p.r, p.dmg, { source: 'proc', tags: ['fire'], vfx: 'steamBurst', noProc: true }); emit(g, { type: 'synergy', name: '冰火两重', x: e.x, z: e.z }); } } },
  superconduct: {},
  wildfire: { hit: (g, p, { e, o }) => { if (o.tags?.includes('storm')) applyStatus(g, e, { burn: p.burn }); }, mod: (g, p, e, o) => (!o.incoming && e?.status.burn && o.tags?.includes('storm') ? 1 + p.bonus : 1) },
  twilight: { heal: (g, p, { amount }) => { if (amount > 3) areaDamage(g, g.player.x, g.player.z, p.r, 0, { raw: amount * p.ratio, source: 'proc', tags: ['shadow'], noProc: true }); } },
  plague: { kill: (g, p, { e }) => { for (const t of enemiesNear(g, e.x, e.z, p.r, 4)) applyStatus(g, t, { poison: p.poison }); }, mod: (g, p, e, o) => (!o.incoming && e?.status.poison && o.tags?.includes('shadow') ? 1 + p.bonus : 1) },
  critBolt: { crit: (g, p, { e, o }) => { const s = state(g, p); if (o.source === 'proc' || (s.t || 0) > g.time) return; s.t = g.time + 0.12; areaDamage(g, e.x, e.z, p.r, p.dmg, { source: 'proc', tags: ['storm'], noProc: true, vfx: 'skyBolt' }); } },
  starfire: {},
  timeslash: { mod: (g, p, e, o) => (!o.incoming && e && (e.status.stun || e.status.timeStop || e.status.freeze) && (o.tags?.includes('blade') || o.source === 'light' || o.source === 'charge') ? 1 + p.mult : 1) },
  grace: { tick: (g, p, dt) => { if (every(g, p, dt, 1)) for (const a of g.allies) a.hp = Math.min(a.maxHp, a.hp + a.maxHp * p.regen); } },
  frostCrit: { mod: (g, p, e, o) => { if (!o.incoming && e && (e.status.freeze || e.status.slow)) o.critBonus = (o.critBonus || 0) + p.crit; return 1; } },
  magmaGround: { land: (g, p, { e }) => { const s = state(g, p); if ((s.t || 0) > g.time) return; s.t = g.time + 0.3; addZone(g, { x: e.x, z: e.z, r: 1.8, dur: p.dur, tick: 0.5, dmg: p.dps * 0.5, status: { burn: 1 }, vfx: 'emberGround', tags: ['fire'], source: 'proc' }); } },
  brittle: { mod: (g, p, e, o) => (!o.incoming && e?.status.freeze ? 1 + p.bonus : 1) },
  overflowShadow: { overheal: (g, p, { amount }) => { if (amount > 2) areaDamage(g, g.player.x, g.player.z, 3, 0, { raw: amount, source: 'proc', tags: ['shadow'], noProc: true }); } },
  bloodCast: { cast: (g, p) => { const pl = g.player; pl.hp = Math.max(1, pl.hp - g.stats.maxHp * p.cost); } },
  beastLightning: {},
  armorToSkill: { mod: (g, p, e, o) => (!o.incoming && o.source === 'skill' ? 1 + (g.stats.armor * p.ratio) / 100 : 1) },
  killFrenzy: { kill: (g, p) => addBuff(g, { id: 'killFrenzy', dur: p.dur, stats: { crit: p.crit, atkSpeed: p.atkSpeed } }) },
  standGuard: { mod: (g, p, e, o) => (o.incoming && g.player.stillT >= p.delay ? 1 - p.dr : 1) },
  eliteBolt: { tick: (g, p, dt) => { if (!every(g, p, dt, p.every)) return; const t = nearest(g, g.player.x, g.player.z, 16, (e) => isElite(e)); if (t) areaDamage(g, t.x, t.z, 2.4, p.dmg, { source: 'proc', tags: ['holy', 'storm'], vfx: 'skyBolt', noProc: true }); } },
  miniHole: { hit: (g, p, { e, o }) => { if (o.source === 'skill' && g.rng.next() < p.chance) addZone(g, { x: e.x, z: e.z, r: p.r, dur: p.dur, tick: 0.25, dmg: 0.25, pull: 6, vfx: 'blackHole', tags: ['arcane'], source: 'proc', small: true }); } },
  burnSpread: { hit: (g, p, { e, o }) => { if (e.status.burn && directHit(o) && g.rng.next() < p.chance) for (const t of enemiesNear(g, e.x, e.z, p.r, 3)) applyStatus(g, t, { burn: 2 }); } },
  chillAttackers: { damaged: (g, p, { src }) => { if (src.enemy) applyStatus(g, src.enemy, { slow: p.dur }); } },
  chainEveryN: { hit: (g, p, { e, o }) => { if (!directHit(o)) return; const s = state(g, p); s.n = (s.n || 0) + 1; if (s.n >= Math.max(2, g.stats.chargeEvery || 6)) { s.n = 0; fireChain(g, e, p.jumps + g.stats.chainJumps, p.dmg, { source: 'proc', tags: ['storm'], noProc: true }); } } },
  overload: { cast: (g, p) => areaDamage(g, g.player.x, g.player.z, p.r, g.stats.overloadDmg || 1.6, { source: 'proc', tags: ['storm'], vfx: 'staticPulse', noProc: true }) },
  evadeCrit: { evade: (g) => { g.player.guaranteedCrits = Math.max(g.player.guaranteedCrits, 1); } },
  martyr: { tick: (g, p) => { const s = state(g, p); if ((s.ready || 0) > g.time || g.player.hp / g.stats.maxHp >= p.below) return; s.ready = g.time + p.cd; addBuff(g, { id: 'martyr', dur: p.dur, stats: { dmgReduction: p.dr } }); healPlayer(g, g.stats.maxHp * (g.stats.martyrHeal || 0.25)); emit(g, { type: 'banner', text: '殉道', sub: '神圣庇护', style: 'buff' }); } },
  phoenix: { save: (g, p) => { const s = state(g, p); if (s.used) return false; s.used = true; g.player.hp = g.stats.maxHp * (p.heal || g.stats.phoenixHeal || 0.4); g.player.invuln = 2.5; areaDamage(g, g.player.x, g.player.z, p.r, p.dmg, { source: 'proc', tags: ['fire'], vfx: 'phoenixBurst', launch: 7, kb: 6 }); emit(g, { type: 'banner', text: '浴火重生', sub: '不死鸟之魂', style: 'revive' }); emit(g, { type: 'shake', a: 1 }); return true; } },
  coup: { hit: (g, p, { e, o }) => { if (o.source !== 'light' && o.source !== 'charge') return; if (!e.dying && g.rng.next() < (g.stats.coupChance || 0.06)) { damageEnemy(g, e, p.mult, { source: 'proc', crit: 1, noProc: true, color: '#ff3030' }); emit(g, { type: 'coup', x: e.x, z: e.z }); } } },
  echo: {},
  thirstSpeed: { tick: (g, p, dt) => { if (!every(g, p, dt, 0.5)) return; const t = nearest(g, g.player.x, g.player.z, 8, (e) => e.hp / e.maxHp < 0.3); if (t) addBuff(g, { id: 'thirst', dur: 0.6, stats: { speedMult: p.speed } }); } },
  rage: { mod: (g, p, e, o) => (o.incoming ? 1 : 1 + (g.stats.rageAtk || 0.25) * (1 - g.player.hp / g.stats.maxHp)) },
  blockReflect: { block: (g, p, { src }) => { if (src.enemy) damageEnemy(g, src.enemy, p.dmg, { source: 'proc', tags: ['holy'], noProc: true }); } },
  manaSurge: { swing: (g) => { const s = (g.procState.manaSurge ??= { n: 0 }); s.n++; if (s.n % 5 === 0) { const n = g.stats.manaStars || 4; for (let i = 0; i < n; i++) spawnProjectile(g, { x: g.player.x, z: g.player.z, angle: g.player.face + (i - (n - 1) / 2) * 0.22, speed: 24, range: 15, radius: 0.55, homing: 3, dmg: 0.6, kind: 'star', source: 'proc', tags: ['arcane'] }); } } },
  venomBlades: { hit: (g, p, { e, o }) => { if (o.source === 'light' || o.source === 'charge') applyStatus(g, e, { poison: 3 }); } },
  comboCrit: { mod: (g, p, e, o) => { if (!o.incoming && g.combo.n > 30) o.critBonus = (o.critBonus || 0) + (g.stats.comboCrit || 0.15); return 1; } },
  plagueTouch: { hit: (g, p, { e, o }) => { if (o.kind === 'bone') applyStatus(g, e, { poison: 3 }); }, poisonDeath: (g, p, { e }) => { if (g.rng.next() < (g.stats.plagueRaise || 0.1)) summonUnits(g, 'ally_skeleton', 1, 12, 0.7, e.x, e.z); } },
  boneArmor: { mod: (g, p, e, o) => (o.incoming ? 1 - Math.min(p.cap, g.allies.length * (g.stats.boneArmor || 0.03)) : 1) },
  cleave: {},
  nthQuake: {},
  armorBreak: { hit: (g, p, { e, o }) => { if (!directHit(o)) return; e.vuln = Math.min(p.per * p.max, (e.vuln || 0) + p.per); e.vulnT = p.dur; } },
  chainOnHit: { hit: (g, p, { e, o }) => { if ((o.source === 'light' || o.source === 'charge') && g.rng.next() < p.chance) fireChain(g, e, p.jumps + g.stats.chainJumps, p.dmg, { source: 'proc', tags: ['storm'], noProc: true }); } },
  burnAura: { tick: (g, p, dt) => { if (!every(g, p, dt, 0.5)) return; for (const e of enemiesNear(g, g.player.x, g.player.z, p.r)) { damageEnemy(g, e, p.dps * 0.5, { source: 'dot', dot: 'burn', noReact: true, tags: ['fire'] }); if (p.blind) e.blind = 0.6; } } },
  chillOnHit: { hit: (g, p, { e, o }) => { if (directHit(o)) applyStatus(g, e, { slow: p.dur }); } },
  maim: { hit: (g, p, { e, o }) => { if (directHit(o) && g.rng.next() < p.chance) applyStatus(g, e, { slow: p.dur }); } },
  bonusStrike: { hit: (g, p, { e, o }) => { if ((o.source === 'light' || o.source === 'charge') && !e.dying && g.rng.next() < p.chance) damageEnemy(g, e, p.dmg, { source: 'proc', noProc: true, color: '#ffd76a', pierceGuard: true }); } },
  spellShield: { tick: (g, p, dt) => { if (every(g, p, dt, p.every)) g.player.spellShield = true; } },
  freezeOnHit: { hit: (g, p, { e, o }) => { if (directHit(o) && g.rng.next() < p.chance) applyStatus(g, e, { freeze: p.dur }); } },
  chillAura: { tick: (g, p, dt) => { if (every(g, p, dt, 0.5)) for (const e of enemiesNear(g, g.player.x, g.player.z, p.r)) applyStatus(g, e, { slow: 0.8 }); } },
  killHealChance: { kill: (g, p) => { if (g.rng.next() < p.chance) healPlayer(g, g.stats.maxHp * p.pct); } },
  periodicZap: { tick: (g, p, dt) => { if (every(g, p, dt, p.every)) castAction(g, { do: 'targets', count: p.count, range: 8, nearest: true, dmg: p.dmg, vfx: 'zap', tags: ['storm'] }, { source: 'proc' }); } },
  stageCheatDeath: { save: (g, p) => { const s = state(g, p); if (s.stage === g.stageIndex) return false; s.stage = g.stageIndex; g.player.hp = 1; g.player.invuln = p.dur; emit(g, { type: 'banner', text: '不朽', sub: '不朽骨片生效', style: 'revive' }); return true; } },
  chaosProc: { hit: (g, p, { e, o }) => { if (directHit(o) && g.rng.next() < p.chance) applyStatus(g, e, g.rng.pick([{ burn: 3 }, { freeze: 1 }, { stun: 0.8 }, { poison: 3 }, { bleed: 3 }])); } },
  nthWave: { swing: (g, p) => { const s = (g.procState.nthWave ??= { n: 0 }); s.n++; if (s.n % p.n === 0) spawnProjectile(g, { x: g.player.x, z: g.player.z, angle: g.player.face, speed: 30, range: p.len, radius: 1.3, pierce: 99, dmg: p.dmg, kind: 'crescent', source: 'proc', tags: ['blade'] }); } },
  musouAfter: { musouEnd: (g, p) => addBuff(g, { id: 'musouAfter', dur: p.dur, stats: { atkMult: p.atk } }) },
};

export function runProcs(game, event, ctx) {
  let result = false;
  const list = game.procs;
  if (!list) return false;
  for (let i = 0; i < list.length; i++) {
    const p = list[i], h = PROCS[p.id];
    const fn = h?.[event];
    if (!fn) continue;
    const r = fn(game, p, event === 'tick' ? ctx.dt : ctx);
    if (event === 'save' && r) return true;
    if (r === true) result = true;
  }
  return result;
}

export function procMods(game, e, o) {
  let m = 1;
  const list = game.procs;
  if (!list) return 1;
  for (let i = 0; i < list.length; i++) { const h = PROCS[list[i].id]; if (h?.mod) m *= h.mod(game, list[i], e, o); }
  return m;
}

export function addBuff(game, b) {
  const p = game.player;
  const existing = p.buffs.find((x) => x.id === b.id);
  if (existing) { existing.t = Math.max(existing.t, b.dur); return existing; }
  const buff = { ...b, t: b.dur };
  p.buffs.push(buff);
  if (b.stats) game.statsDirty = true;
  return buff;
}
