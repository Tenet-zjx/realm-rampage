// Hero debuffs: application (with CC immunity, difficulty scaling and stack conversions), per-step ticking
// (DoTs, soul tether, time bomb, gaze meter) and the movement/combat modifiers the controller reads each step.
import { DEBUFF, GAZE } from './content/debuffs.js';
import { emit, areaDamage } from './combat.js';
import { dist2, clamp } from './util.js';

export const NO_MODS = Object.freeze({ move: 1, atk: 1, cdRate: 1, stunned: false, rooted: false, noAttack: false, noCast: false, noDodge: false, fear: null, invert: false, dodgeMult: 1, miss: 0, dmgTaken: 1, armorMult: 1, healMult: 1 });

export const hasDebuff = (p, id) => (p.debuffs[id]?.t || 0) > 0;
export const debuffStacks = (p, id) => (hasDebuff(p, id) ? p.debuffs[id].stacks : 0);
const ccImmune = (game) => game.player.buffCcImmune > 0 || game.stats.ccImmune > 0 || game.player.state === 'musou';

/** Apply one debuff. `value` = seconds (or stacks for stacking debuffs). Returns true if it landed. */
export function applyDebuff(game, id, value, o = {}) {
  const p = game.player, def = DEBUFF[id];
  if (!def || p.dead || !(value > 0)) return false;
  if (def.cc && ccImmune(game)) { emit(game, { type: 'debuffResist', id, x: p.x, z: p.z }); return false; }
  const scale = (game.diff?.debuff ?? 1) * (def.scale || 1) * (id === 'slow' && ccImmune(game) ? 0.5 : 1);
  const dur = (def.max ? (o.dur ?? def.dur) : value) * scale;
  let d = p.debuffs[id];
  const fresh = !d || d.t <= 0, prevT = fresh ? 0 : d.t, prevDur = fresh ? 0 : d.dur;
  if (fresh) d = p.debuffs[id] = { id, t: 0, dur: 0, stacks: 0, tick: 0.5 };
  d.t = Math.max(d.t, dur); d.dur = Math.max(fresh ? 0 : d.dur, d.t);
  if (def.max) d.stacks = Math.min(def.max, d.stacks + Math.round(value));
  if (o.src) { d.src = o.src.uid; d.sx = o.src.x; d.sz = o.src.z; }
  if (id === 'bomb') { if (fresh) { d.dmg = o.dmg || 60; d.t = d.dur = def.dur; } else { d.dmg += (o.dmg || 60) * 0.5; d.t = prevT; d.dur = prevDur; } } // extra bombs add damage but never reset the fuse
  emit(game, { type: 'debuff', id, stacks: d.stacks, fresh, x: p.x, z: p.z });
  // stack conversions
  if (id === 'webbed' && d.stacks >= def.max) { delete p.debuffs.webbed; applyDebuff(game, 'root', 1.2 / DEBUFF.root.scale); emit(game, { type: 'debuffBurst', id: 'webbed', x: p.x, z: p.z }); }
  if (id === 'frostbite' && d.stacks >= def.max) { delete p.debuffs.frostbite; applyDebuff(game, 'freeze', 1.4 / DEBUFF.freeze.scale); emit(game, { type: 'debuffBurst', id: 'frostbite', x: p.x, z: p.z }); }
  if (def.cc) { p.buffer = null; if (p.state === 'attack' && (id !== 'silence')) { p.state = 'idle'; p.move = null; } }
  return true;
}

/** Map a hostile `status` object ({ slow: 2, poison: 1, ... }) onto debuffs. */
export function applyStatusToPlayer(game, status, src = {}) {
  for (const k in status) if (DEBUFF[k]) applyDebuff(game, k, status[k], { src: src.enemy, dmg: src.enemy ? src.enemy.dmg * 3 : undefined });
}

export function clearDebuffs(game, { ccOnly = false } = {}) {
  const p = game.player; let n = 0;
  for (const id of Object.keys(p.debuffs)) if (!ccOnly || DEBUFF[id]?.cc) { delete p.debuffs[id]; n++; }
  if (!ccOnly) p.gaze = 0;
  if (n) emit(game, { type: 'cleanse', x: p.x, z: p.z });
  return n;
}

export function debuffMods(p) {
  const D = p.debuffs;
  if (!Object.keys(D).length) return NO_MODS;
  const has = (id) => (D[id]?.t || 0) > 0, st = (id) => (has(id) ? D[id].stacks : 0);
  const ts = has('timeslow');
  return {
    move: (has('slow') ? 0.6 : 1) * (1 - 0.18 * st('webbed')) * (1 - 0.07 * st('frostbite')) * (ts ? 0.6 : 1) * (has('hex') ? 0.65 : 1),
    atk: (1 - 0.07 * st('frostbite')) * (ts ? 0.6 : 1),
    cdRate: ts ? 0.5 : 1,
    stunned: has('freeze') || has('petrify') || has('hooked'),
    rooted: has('root'),
    noAttack: has('fear') || has('hex'),
    noCast: has('fear') || has('hex') || has('silence'),
    noDodge: has('hex') || has('root'),
    fear: has('fear') ? D.fear : null,
    invert: has('confuse'),
    dodgeMult: st('webbed') ? 0.6 : 1,
    miss: has('blind') ? 0.35 : 0,
    dmgTaken: (1 + 0.05 * st('corrode')) * (has('petrify') ? 0.5 : 1),
    armorMult: 1 - 0.12 * st('corrode'),
    healMult: has('poison') ? 0.6 : 1,
  };
}

function enemyByUid(game, uid) { return game.enemies.find((e) => e.uid === uid); }

export function updateDebuffs(game, dt) {
  const p = game.player, st = game.stats, D = p.debuffs;
  // gaze meter (filled by basilisks via game.player.gazedBy this step)
  if (p.gazeImmune > 0) p.gazeImmune -= dt;
  if (p.gazedBy && !(p.gazeImmune > 0) && !hasDebuff(p, 'petrify')) {
    p.gaze = Math.min(1, (p.gaze || 0) + dt * GAZE.fill);
    if (p.gaze >= 1) { p.gaze = 0; p.gazeImmune = GAZE.immune; if (applyDebuff(game, 'petrify', DEBUFF.petrify.dur)) emit(game, { type: 'petrified', x: p.x, z: p.z }); }
  } else p.gaze = Math.max(0, (p.gaze || 0) - dt * GAZE.decay);
  p.gazedBy = null;
  for (const id in D) {
    const d = D[id];
    d.t -= dt; d.tick -= dt;
    const tick = d.tick <= 0; if (tick) d.tick += 0.5;
    if (id === 'burn' && tick) game.damagePlayer(st.maxHp * 0.008, { kind: 'dot', debuff: id });
    else if (id === 'poison' && tick) game.damagePlayer(st.maxHp * 0.0018 * d.stacks, { kind: 'dot', debuff: id });
    else if (id === 'bleed' && tick) game.damagePlayer(st.maxHp * 0.0015 * d.stacks * (p.movedThisStep > 0.01 || p.state === 'move' ? 3 : 1), { kind: 'dot', debuff: id });
    else if (id === 'tether') {
      const e = enemyByUid(game, d.src);
      if (!e || e.dying || e.status.stun || e.status.freeze || e.status.silence || e.state !== 'channel' || dist2(e.x, e.z, p.x, p.z) > 11 * 11) { d.t = 0; if (e && e.state === 'channel') { e.state = 'idle'; e.stateT = 0; } emit(game, { type: 'tetherBreak', x: p.x, z: p.z }); }
      else {
        const drain = 11 * dt;
        if (p.musou > 0 && p.state !== 'musou') p.musou = Math.max(0, p.musou - drain);
        else if (tick) game.damagePlayer(st.maxHp * 0.004, { kind: 'dot', debuff: id });
        e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.03 * dt);
      }
    } else if (id === 'bomb' && d.t <= 0) detonateBomb(game, d);
    if (d.t <= 0) delete D[id];
  }
}

function detonateBomb(game, d) {
  const p = game.player, r = 3.6;
  const dodged = p.invuln > 0 || p.state === 'dodge';
  if (dodged) emit(game, { type: 'banner', text: '完美规避', sub: '炸弹在闪避中爆炸', style: 'combo' });
  else game.damagePlayer(d.dmg, { kind: 'bomb', x: p.x, z: p.z });
  areaDamage(game, p.x, p.z, r, 4, { source: 'proc', kb: 5, launch: 4, noArea: true, tags: ['fire'] });
  game.addEffect({ kind: 'bombBlast', x: p.x, z: p.z, r, life: 0.7, palette: 'fire' });
  emit(game, { type: 'shake', a: 0.7 }); emit(game, { type: 'bombExplode', x: p.x, z: p.z, dodged });
}

/** Hook pull: drag the hero to just in front of the enemy. */
export function hookPull(game, e) {
  const p = game.player;
  if (!applyDebuff(game, 'hooked', DEBUFF.hooked.dur, { src: e })) return false;
  const a = Math.atan2(p.x - e.x, p.z - e.z), half = game.arena.half - 1;
  p.forced = { sx: p.x, sz: p.z, ex: clamp(e.x + Math.sin(a) * (e.radius + 1.1), -half, half), ez: clamp(e.z + Math.cos(a) * (e.radius + 1.1), -half, half), t: 0, dur: 0.32 };
  p.state = 'idle'; p.move = null;
  return true;
}

