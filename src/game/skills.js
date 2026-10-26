// Skill runtime: scales card data by level/stats and executes action primitives as simulation entities.
import { SKILL } from './content/skills.js';
import { ALLIES } from './content/enemies.js';
import { damageEnemy, areaDamage, applyStatus, healPlayer, damagePlayer, emit, isElite } from './combat.js';
import { clearDebuffs } from './debuffs.js';
import { runProcs, addBuff } from './procs.js';
import { inShape, dist2, wrapAngle, DEG, clamp } from './util.js';

const COUNT_KEYS = new Set(['count', 'jumps', 'pierce', 'hits']);

/** Deep-copy action with level scaling (card `up`) and player stat scaling (area, duration, projectiles). */
export function scaleAction(act, up, lv, st, depth = 0) {
  if (!act || typeof act !== 'object') return act;
  if (Array.isArray(act)) return act.map((a) => scaleAction(a, up, lv, st, depth + 1));
  const out = {};
  const L = lv - 1;
  for (const k in act) {
    const v = act[k];
    if (v && typeof v === 'object') { out[k] = scaleAction(v, up, lv, st, depth + 1); continue; }
    out[k] = v;
  }
  if (up && L > 0) {
    if (out.dmg != null && up.dmg) out.dmg = out.dmg * (1 + up.dmg * L);
    if (out.dps != null && up.dmg) out.dps = out.dps * (1 + up.dmg * L);
    if (up.r) { if (out.r != null) out.r *= 1 + up.r * L; if (out.area?.r != null) out.area.r *= 1 + up.r * L; }
    if (up.length && out.length != null) out.length *= 1 + up.length * L;
    if (up.dur && out.dur != null) out.dur *= 1 + up.dur * L;
    if (up.power && out.power != null) out.power *= 1 + up.power * L;
    if (up.atkMult && out.stats?.atkMult != null) out.stats.atkMult += up.atkMult * L;
    for (const k of COUNT_KEYS) if (up[k] && out[k] != null) out[k] = out[k] + Math.floor(up[k] * L + 1e-6);
  }
  return out;
}

export function skillCooldown(game, def) {
  return (def.cd || 0) * (1 - game.stats.cdrTotal);
}

export function scaledFor(game, id) {
  const def = SKILL[id]; const owned = game.skills.owned.get(id);
  return scaleAction(def.act, def.up, owned?.lv || 1, game.stats);
}

/** Description with tokens filled in for UI (level lv). */
export function describe(def, lv, stats) {
  if (!def.desc) return '';
  const a = def.act ? scaleAction(def.act, def.up, lv, stats) : null;
  const first = (k) => { const stack = [a]; while (stack.length) { const x = stack.pop(); if (!x || typeof x !== 'object') continue; if (x[k] != null && typeof x[k] === 'number') return x[k]; for (const v of Object.values(x)) if (v && typeof v === 'object') stack.push(v); } return null; };
  const pct = (v) => `${Math.round(v * 100)}%`;
  return def.desc.replace(/\{(\w+)(?::(\w+))?\}/g, (m, k, sub) => {
    if (k === 'stat') {
      let v = def.stats?.[sub] ?? 0;
      if (def.statsPerLevel?.[sub] != null) v = def.stats[sub] + def.statsPerLevel[sub] * (lv - 1); else if (def.statsPerLevelOnly?.[sub] != null) v = def.statsPerLevelOnly[sub] * lv; else v *= lv;
      if (['def', 'luck', 'projectiles', 'pierce', 'revives', 'soulMax', 'chargeEvery', 'manaStars'].includes(sub)) return `${Math.round(v)}`;
      return pct(v);
    }
    if (k === 'dmg') { const v = first('dmg') ?? first('dps'); return v != null ? `${pct(v)} 攻击` : ''; }
    if (k === 'cd') return `${(def.cd || 0).toFixed(1).replace(/\.0$/, '')}`;
    if (k === 'len') { const v = first('length'); return v != null ? v.toFixed(0) : ''; }
    const v = k === 'r' ? (a?.area?.r ?? first('r')) : first(k);
    if (v == null) return '';
    return Number.isInteger(v) ? `${v}` : v.toFixed(1).replace(/\.0$/, '');
  });
}

// ---------------------------------------------------------------- targeting
const facing = (game) => game.player.face;
function nearestEnemy(game, x, z, range, filter) {
  let best = null, bd = range * range;
  game.grid.query(x, z, range, (e) => { if (e.dying || e.team !== 'enemy' || (filter && !filter(e))) return; const d = dist2(x, z, e.x, e.z); if (d < bd) { bd = d; best = e; } });
  return best;
}
export function clusterPoint(game, x, z, range) {
  let best = null, bestN = 0;
  const cand = [];
  game.grid.query(x, z, range, (e) => { if (!e.dying && e.team === 'enemy' && dist2(x, z, e.x, e.z) < range * range) cand.push(e); });
  if (!cand.length) return null;
  const step = Math.max(1, Math.floor(cand.length / 24));
  for (let i = 0; i < cand.length; i += step) {
    const c = cand[i]; let n = 0;
    for (let j = 0; j < cand.length; j += step) if (dist2(c.x, c.z, cand[j].x, cand[j].z) < 16) n += cand[j].boss ? 6 : isElite(cand[j]) ? 2 : 1;
    if (n > bestN) { bestN = n; best = c; }
  }
  return best ? { x: best.x, z: best.z } : null;
}
function resolvePoint(game, act, ctx) {
  const p = game.player, face = ctx.angle ?? facing(game);
  switch (act.at) {
    case 'point': return { x: act.x ?? ctx.x, z: act.z ?? ctx.z };
    case 'forward': { const off = act.offset || 0; return { x: (ctx.x ?? p.x) + Math.sin(face) * off, z: (ctx.z ?? p.z) + Math.cos(face) * off }; }
    case 'target': {
      const range = act.range || 12;
      if (p.aim && dist2(p.x, p.z, p.aim.x, p.aim.z) < range * range * 1.2) return { x: p.aim.x, z: p.aim.z };
      const c = clusterPoint(game, p.x, p.z, range); if (c) return c;
      return { x: p.x + Math.sin(face) * range * 0.5, z: p.z + Math.cos(face) * range * 0.5 };
    }
    case 'cluster': { const c = clusterPoint(game, p.x, p.z, act.range || 12); return c || { x: p.x + Math.sin(face) * 5, z: p.z + Math.cos(face) * 5 }; }
    case 'nearest': { const e = nearestEnemy(game, p.x, p.z, act.range || 8); return e ? { x: e.x, z: e.z } : null; }
    case 'self': default: return { x: ctx.x ?? p.x, z: ctx.z ?? p.z };
  }
}
export function aimAngle(game) {
  const p = game.player;
  if (p.aim) return Math.atan2(p.aim.x - p.x, p.aim.z - p.z);
  const e = nearestEnemy(game, p.x, p.z, 9);
  if (e) { const a = Math.atan2(e.x - p.x, e.z - p.z); if (Math.abs(wrapAngle(a - p.face)) < 1.2) return a; }
  return p.face;
}

// ---------------------------------------------------------------- casting
export function castSkill(game, id, { free = false } = {}) {
  const p = game.player, def = SKILL[id], owned = game.skills.owned.get(id);
  if (!def || !owned) return false;
  if (!free && owned.cd > 0) return false;
  if (p.dead || p.mods?.stunned || p.mods?.noCast || p.state === 'musou' || p.state === 'omnislash') return false;
  const act = scaleAction(def.act, def.up, owned.lv, game.stats);
  const angle = aimAngle(game);
  p.face = angle;
  castAction(game, act, { source: 'skill', skillId: id, angle, palette: def.faction });
  if (!free) {
    const freeProc = game.procIndex?.freeCast && game.rng.next() < game.procIndex.freeCast.chance;
    owned.cd = freeProc ? 0.5 : skillCooldown(game, def);
    owned.max = skillCooldown(game, def);
    if (freeProc) emit(game, { type: 'popup', text: '星界：无冷却', x: p.x, z: p.z, color: '#ff7ae6' });
  }
  p.castAnim = { clip: castClip(def), t: 0, dur: 0.38 };
  emit(game, { type: 'cast', skill: id, faction: def.faction, x: p.x, z: p.z, rarity: def.rarity });
  if (def.kind === 'active') {
    runProcs(game, 'cast', { def });
    const echoChance = (game.procIndex?.echo ? game.stats.echoChance || game.procIndex.echo.chance || 0 : 0);
    if (echoChance && game.rng.next() < echoChance) schedule(game, 0.4, () => { castAction(game, act, { source: 'skill', skillId: id, angle: game.player.face, palette: def.faction }); emit(game, { type: 'popup', text: '法术回响', x: game.player.x, z: game.player.z, color: '#ff7ae6' }); });
  }
  return true;
}
function castClip(def) {
  const d = def.act?.do;
  if (d === 'summon') return 'Spellcast_Summon';
  if (d === 'buff') return 'Cheer';
  if (d === 'dash' || d === 'blink' || d === 'leap' || d === 'omnislash') return null;
  if (d === 'strike' && def.act.at === 'self') return 'Spellcast_Raise';
  return 'Spellcast_Shoot';
}

export function schedule(game, delay, fn) { game.scheduled.push({ t: game.time + delay, fn }); }

export function castAction(game, act, ctx = {}) {
  if (!act) return;
  const p = game.player;
  const angle = (ctx.angle ?? p.face) + (act.angle || 0) * DEG;
  const c = { ...ctx, angle, source: ctx.source || 'skill', tags: act.tags || ctx.tags, palette: act.palette || ctx.palette || act.tags?.[0] };
  const base = { source: c.source, tags: c.tags, noProc: ctx.noProc };
  const st = game.stats;
  switch (act.do) {
    case 'multi': for (const a of act.list) castAction(game, { ...a, tags: a.tags || act.tags }, { ...c, angle: c.angle }); break;
    case 'sequence': { const x0 = p.x, z0 = p.z; for (const s of act.steps) schedule(game, s.delay || 0, () => castAction(game, { ...s, tags: s.tags || act.tags }, { ...c, angle, x: x0, z: z0 })); break; }
    case 'strike': {
      const pt = act.at === 'aimLine' ? { x: p.x, z: p.z } : resolvePoint(game, act, c); if (!pt) break;
      const delay = act.delay || 0;
      const area = act.area ? { ...act.area } : { shape: 'circle', r: 2 };
      if (area.r) area.r *= st.areaMult;
      const fire = () => {
        if (act.hpCost) p.hp = Math.max(1, p.hp - st.maxHp * act.hpCost);
        let coef = act.dmg;
        if (act.perEnemy) { let n = 0; game.grid.query(pt.x, pt.z, area.r, (e) => { if (!e.dying && e.team === 'enemy' && dist2(pt.x, pt.z, e.x, e.z) < area.r * area.r) n++; }); coef *= 1 + act.perEnemy * Math.min(act.perCap || 40, n); }
        const hits = hitShape(game, area, pt.x, pt.z, angle, coef, { ...base, kb: act.kb, launch: act.launch, stun: act.stun, status: act.status, crit: act.crit, lifesteal: act.lifesteal, execute: act.execute, fromX: pt.x, fromZ: pt.z, petrify: act.petrify });
        if (act.healPerHit && hits) healPlayer(game, st.maxHp * act.healPerHit * hits, true);
        if (act.shake) emit(game, { type: 'shake', a: act.shake });
        if (act.after) castAction(game, { ...act.after, at: 'point', x: pt.x, z: pt.z, tags: act.tags }, { ...c, x: pt.x, z: pt.z });
      };
      game.addEffect({ kind: act.vfx || 'burst', x: pt.x, z: pt.z, r: area.r ?? area.range ?? 3, angle, shape: area.shape, length: area.length, width: area.width, delay, life: delay + 0.7, palette: c.palette, team: 'player' });
      if (delay > 0) schedule(game, delay, fire); else fire();
      break;
    }
    case 'projectile': {
      const count = (act.count || 1) + (act.kind !== 'boulder' && act.kind !== 'hammer' ? st.projectiles : 0);
      const spread = (act.spread || 0) * DEG;
      const ox = ctx.x ?? p.x, oz = ctx.z ?? p.z;
      for (let i = 0; i < count; i++) {
        const a = spread >= Math.PI * 1.99 ? angle + (i / count) * Math.PI * 2 : angle + (count > 1 ? (i / (count - 1) - 0.5) * spread : 0);
        spawnProjectile(game, { ...act, x: ox, z: oz, angle: a, pierce: (act.pierce || 0) + st.pierce, source: c.source, tags: c.tags, palette: c.palette });
      }
      break;
    }
    case 'wave': {
      const ox = ctx.x ?? p.x, oz = ctx.z ?? p.z;
      game.waves.push({ uid: game.uid++, x: ox, z: oz, angle, length: act.length, width: act.width * st.areaMult, width2: (act.width2 || act.width) * st.areaMult, speed: act.speed, traveled: 0, hit: new Set(), act, base, heal: act.heal });
      game.addEffect({ kind: act.vfx || 'wave', x: ox, z: oz, angle, length: act.length, width: act.width * st.areaMult, width2: (act.width2 || act.width) * st.areaMult, speed: act.speed, life: act.length / act.speed + 0.3, palette: c.palette });
      if (act.heal) healPlayer(game, st.maxHp * act.heal);
      break;
    }
    case 'ring': {
      const pt = resolvePoint(game, act, c);
      const r = act.r * st.areaMult;
      game.rings.push({ uid: game.uid++, x: pt.x, z: pt.z, r, width: act.width, speed: act.speed, cur: 0, hit: new Set(), act, base });
      game.addEffect({ kind: act.vfx || 'ring', x: pt.x, z: pt.z, r, width: act.width, life: r / act.speed + 0.25, palette: c.palette });
      break;
    }
    case 'spikes': {
      const fan = act.fan || 1;
      for (let f = 0; f < fan; f++) {
        const a = angle + (fan > 1 ? (f / (fan - 1) - 0.5) * 0.7 : 0);
        const ox = ctx.x ?? p.x, oz = ctx.z ?? p.z;
        for (let i = 0; i < act.steps; i++) {
          const d = 1.4 + (i + 0.5) * (act.length / act.steps);
          const x = ox + Math.sin(a) * d, z = oz + Math.cos(a) * d, r = (act.width / 2) * 1.15 * st.areaMult;
          const delay = i * act.interval;
          game.addEffect({ kind: act.vfx || 'rockSpike', x, z, r, angle: a, delay, life: delay + 0.9, palette: c.palette, size: 0.8 + 0.4 * (i / act.steps) });
          schedule(game, delay, () => hitShape(game, { shape: 'circle', r }, x, z, a, act.dmg, { ...base, launch: act.launch, kb: act.kb, status: act.status, stun: act.stun, fromX: x, fromZ: z, once: act }));
        }
      }
      break;
    }
    case 'chain': fireChain(game, null, act.jumps + st.chainJumps, act.dmg, { ...base, range: act.range, jumpR: act.jumpR, falloff: act.falloff, stun: act.stun, status: act.status, fork: act.fork, palette: c.palette, vfx: act.vfx }); break;
    case 'zone': {
      const pt = resolvePoint(game, act, c); if (!pt) break;
      addZone(game, { ...act, ...pt, r: act.r * st.areaMult, dur: act.dur * st.durMult, source: c.source, tags: c.tags, palette: c.palette, noProc: ctx.noProc });
      break;
    }
    case 'orbit': break; // persistent, handled by syncOrbits
    case 'barrage': {
      const center = resolvePoint(game, act, c) || { x: p.x, z: p.z };
      const n = act.count + (act.count > 1 ? Math.floor(st.projectiles) : 0);
      for (let i = 0; i < n; i++) {
        const t = act.dur > 0 ? (i / Math.max(1, n - 1)) * act.dur : 0;
        schedule(game, t, () => {
          const cx = act.follow ? game.player.x : center.x, cz = act.follow ? game.player.z : center.z;
          const a = game.rng.angle(), d = Math.sqrt(game.rng.next()) * act.r * st.areaMult;
          castAction(game, { do: 'strike', at: 'point', x: cx + Math.sin(a) * d, z: cz + Math.cos(a) * d, delay: act.each.delay || 0.3, area: { shape: 'circle', r: act.each.r }, dmg: act.each.dmg, status: act.each.status, launch: act.each.launch, stun: act.each.stun, vfx: act.each.vfx || act.vfx, tags: act.tags }, { ...c, noProc: ctx.noProc });
        });
      }
      break;
    }
    case 'targets': {
      const list = [];
      game.grid.query(p.x, p.z, act.range, (e) => { if (!e.dying && e.team === 'enemy' && dist2(p.x, p.z, e.x, e.z) < act.range * act.range) list.push(e); });
      if (act.nearest) list.sort((a, b) => dist2(p.x, p.z, a.x, a.z) - dist2(p.x, p.z, b.x, b.z)); else game.rng.shuffle(list);
      list.sort((a, b) => (isElite(b) ? 1 : 0) - (isElite(a) ? 1 : 0));
      const n = Math.min(list.length, act.count);
      for (let i = 0; i < n; i++) {
        const e = list[i], delay = (act.delay || 0) + (act.nearest ? 0 : game.rng.range(0, 0.25));
        game.addEffect({ kind: act.vfx || 'skyBolt', x: e.x, z: e.z, r: act.area || 1.2, delay, life: delay + 0.5, palette: c.palette, fromX: p.x, fromZ: p.z });
        schedule(game, delay, () => {
          if (act.area) hitShape(game, { shape: 'circle', r: act.area * st.areaMult }, e.x, e.z, 0, act.dmg, { ...base, stun: act.stun, status: act.status, fromX: e.x, fromZ: e.z });
          else damageEnemy(game, e, act.dmg, { ...base, stun: act.stun, status: act.status, fromX: p.x, fromZ: p.z });
        });
      }
      if (act.shake && n) emit(game, { type: 'shake', a: act.shake });
      break;
    }
    case 'dash': {
      const len = act.length;
      const sx = p.x, sz = p.z;
      const ex = clamp(sx + Math.sin(angle) * len, -game.arena.half, game.arena.half), ez = clamp(sz + Math.cos(angle) * len, -game.arena.half, game.arena.half);
      p.forced = { sx, sz, ex, ez, t: 0, dur: 0.22, invuln: act.invuln };
      p.face = angle;
      if (act.invuln) p.invuln = Math.max(p.invuln, 0.3);
      game.addEffect({ kind: act.vfx || 'dashTrail', x: sx, z: sz, ex, ez, angle, width: act.width, life: 0.6, palette: c.palette });
      schedule(game, 0.12, () => hitShape(game, { shape: 'line', length: Math.hypot(ex - sx, ez - sz), width: act.width * st.areaMult }, sx, sz, angle, act.dmg, { ...base, kb: act.kb, stun: act.stun, launch: act.launch, fromX: sx, fromZ: sz }));
      break;
    }
    case 'phantomDash': {
      const t = nearestEnemy(game, p.x, p.z, 12);
      const a = t ? Math.atan2(t.x - p.x, t.z - p.z) : angle;
      game.addEffect({ kind: act.vfx || 'phantomDash', x: p.x, z: p.z, ex: p.x + Math.sin(a) * act.length, ez: p.z + Math.cos(a) * act.length, angle: a, width: act.width, life: 0.6, palette: c.palette });
      hitShape(game, { shape: 'line', length: act.length, width: act.width * st.areaMult }, p.x, p.z, a, act.dmg, { ...base, fromX: p.x, fromZ: p.z, kb: 1 });
      break;
    }
    case 'blink': {
      let tx, tz;
      if (act.forward) { tx = p.x + Math.sin(angle) * act.range; tz = p.z + Math.cos(angle) * act.range; }
      else { const cl = clusterPoint(game, p.x, p.z, act.range) || { x: p.x + Math.sin(angle) * act.range * 0.6, z: p.z + Math.cos(angle) * act.range * 0.6 }; const a = Math.atan2(cl.x - p.x, cl.z - p.z); tx = cl.x + Math.sin(a) * (act.behind || 0); tz = cl.z + Math.cos(a) * (act.behind || 0); p.face = a + Math.PI; }
      tx = clamp(tx, -game.arena.half + 1, game.arena.half - 1); tz = clamp(tz, -game.arena.half + 1, game.arena.half - 1);
      game.addEffect({ kind: act.vfx || 'blink', x: p.x, z: p.z, ex: tx, ez: tz, life: 0.5, palette: c.palette });
      p.x = tx; p.z = tz; p.invuln = Math.max(p.invuln, 0.2);
      if (act.grantCrits) p.guaranteedCrits = act.grantCrits;
      emit(game, { type: 'blink', x: tx, z: tz });
      if (act.then) castAction(game, act.then, { ...c, x: tx, z: tz, angle: p.face });
      break;
    }
    case 'leap': {
      const cl = clusterPoint(game, p.x, p.z, act.range) || { x: p.x + Math.sin(angle) * act.range * 0.6, z: p.z + Math.cos(angle) * act.range * 0.6 };
      p.forced = { sx: p.x, sz: p.z, ex: cl.x, ez: cl.z, t: 0, dur: 0.45, arc: 3, invuln: true };
      p.invuln = Math.max(p.invuln, 0.5);
      p.face = Math.atan2(cl.x - p.x, cl.z - p.z);
      game.addEffect({ kind: 'telegraphFriendly', x: cl.x, z: cl.z, r: act.then?.area?.r || 4, life: 0.5, palette: c.palette });
      schedule(game, 0.45, () => castAction(game, act.then, { ...c, x: cl.x, z: cl.z }));
      break;
    }
    case 'beam': {
      game.beams.push({ uid: game.uid++, t: 0, dur: act.dur * st.durMult, tick: act.tick, tickT: 0, act, base });
      game.addEffect({ kind: act.vfx || 'beam', follow: 'player', length: act.length, width: act.width, life: act.dur * st.durMult, palette: c.palette });
      p.channelT = act.dur * st.durMult;
      break;
    }
    case 'omnislash': {
      p.omni = { left: act.count, interval: act.interval, t: 0, range: act.range, dmg: act.dmg, crit: act.crit, base, palette: c.palette, hit: new Set() };
      p.state = 'omnislash'; p.invuln = Math.max(p.invuln, act.count * act.interval + 0.3);
      break;
    }
    case 'summon': {
      const n = act.count + (act.unit === 'ally_treant' ? st.beastCount : 0);
      summonUnits(game, act.unit, n, act.dur * st.durMult, act.power || 1, ctx.x ?? p.x, ctx.z ?? p.z, act.vfx);
      runProcs(game, 'summon', {});
      if (game.procIndex?.grace) healPlayer(game, st.maxHp * game.procIndex.grace.heal);
      break;
    }
    case 'buff': {
      const dur = act.dur * (act.dur > 0.2 ? st.durMult : 1);
      const b = addBuff(game, { id: ctx.skillId || act.vfx || 'buff', dur, stats: act.stats, aura: act.aura ? { ...act.aura, t: 0 } : null, vfx: act.vfx, staticShield: act.staticShield, healOverTime: act.healOverTime, hotRate: act.healOverTime ? (st.maxHp * act.healOverTime) / dur : 0 });
      b.t = dur;
      if (act.invuln) p.buffInvuln = Math.max(p.buffInvuln, typeof act.invuln === 'number' ? act.invuln : dur);
      if (act.heal) healPlayer(game, st.maxHp * act.heal);
      if (act.shield) { p.shield = Math.max(p.shield, st.maxHp * act.shield); p.shieldT = dur; }
      if (act.stealth) p.stealthT = dur;
      if (act.nextHit) p.nextHitMult = act.nextHit;
      if (act.stats?.ccImmune) { p.buffCcImmune = Math.max(p.buffCcImmune, dur); clearDebuffs(game, { ccOnly: true }); }
      if (act.vfx) game.addEffect({ kind: act.vfx, follow: 'player', life: dur, palette: c.palette });
      game.statsDirty = true;
      break;
    }
    case 'mark': {
      const list = [];
      game.grid.query(p.x, p.z, act.range, (e) => { if (!e.dying && e.team === 'enemy' && dist2(p.x, p.z, e.x, e.z) < act.range * act.range) list.push(e); });
      list.sort((a, b) => (b.boss ? 1e9 : 0) + b.maxHp - ((a.boss ? 1e9 : 0) + a.maxHp));
      for (const e of list.slice(0, act.count)) {
        e.status.mark = { t: act.dur * st.durMult, vuln: act.vulnerable || 0, alwaysCrit: act.alwaysCrit, explode: act.explode };
        if (act.dps) e.status.doom = { t: act.dur * st.durMult, dps: act.dps, tick: 0.5, explode: act.explode };
        if (act.silence) e.status.silence = { t: act.dur * st.durMult };
        game.addEffect({ kind: act.vfx || 'doomMark', follow: e.uid, life: act.dur * st.durMult, palette: c.palette });
      }
      break;
    }
    case 'wall': {
      const perp = act.perpendicular;
      const off = act.offset || 1.5;
      const cx = p.x + Math.sin(angle) * (perp ? off : off + act.length / 2), cz = p.z + Math.cos(angle) * (perp ? off : off + act.length / 2);
      const wa = perp ? angle + Math.PI / 2 : angle;
      const half = act.length / 2;
      const wall = { uid: game.uid++, x1: cx - Math.sin(wa) * half, z1: cz - Math.cos(wa) * half, x2: cx + Math.sin(wa) * half, z2: cz + Math.cos(wa) * half, r: act.width / 2, t: act.dur * st.durMult };
      game.walls.push(wall);
      game.addEffect({ kind: act.vfx || 'fissure', x: cx, z: cz, angle: wa, length: act.length, width: act.width, life: wall.t, palette: c.palette });
      hitShape(game, { shape: 'line', length: act.length, width: act.width + 1.5, back: false }, wall.x1, wall.z1, wa, act.dmg, { ...base, stun: act.stun, kb: 3, fromX: cx, fromZ: cz });
      emit(game, { type: 'shake', a: act.shake || 0.4 });
      break;
    }
    case 'tether': {
      const list = [];
      game.grid.query(p.x, p.z, act.range, (e) => { if (!e.dying && e.team === 'enemy' && dist2(p.x, p.z, e.x, e.z) < act.range * act.range) list.push(e); });
      list.sort((a, b) => dist2(p.x, p.z, a.x, a.z) - dist2(p.x, p.z, b.x, b.z));
      const targets = list.slice(0, act.count);
      if (!targets.length) break;
      game.tethers.push({ uid: game.uid++, targets, t: 0, dur: act.dur, tick: act.tick, tickT: 0, act, base });
      for (const e of targets) game.addEffect({ kind: act.vfx || 'drain', follow: e.uid, from: 'player', life: act.dur, palette: c.palette });
      break;
    }
    case 'traps': {
      for (let i = 0; i < act.count; i++) {
        const a = game.rng.angle(), d = 1.5 + game.rng.next() * act.r;
        game.traps.push({ uid: game.uid++, x: p.x + Math.sin(a) * d, z: p.z + Math.cos(a) * d, t: act.dur, trigger: act.trigger, blast: act.blast * st.areaMult, dmg: act.dmg, base });
      }
      break;
    }
    case 'corpses': {
      const recent = game.corpses.filter((k) => game.time - k.t < 20 && dist2(p.x, p.z, k.x, k.z) < act.r * act.r).slice(-act.count);
      const spots = recent.length ? recent : [];
      if (!spots.length) { const e = nearestEnemy(game, p.x, p.z, act.r); if (e) spots.push({ x: e.x, z: e.z }); }
      spots.forEach((k, i) => schedule(game, i * 0.06, () => { areaDamage(game, k.x, k.z, act.blast, act.dmg, { ...base, kb: 4, vfx: act.vfx || 'corpseBlast', palette: 'shadow' }); }));
      game.corpses = game.corpses.filter((k) => !recent.includes(k));
      if (spots.length) emit(game, { type: 'shake', a: 0.5 });
      break;
    }
    default: break;
  }
}

/** Damage every enemy inside a shape; returns hit count. */
export function hitShape(game, shape, x, z, face, coef, o) {
  let hits = 0;
  const reach = (shape.r ?? shape.range ?? shape.length ?? 3) + (shape.width ?? 0) + 2;
  const cx = shape.shape === 'line' ? x + Math.sin(face) * (shape.length / 2) : x, cz = shape.shape === 'line' ? z + Math.cos(face) * (shape.length / 2) : z;
  const r = shape.shape === 'line' ? shape.length / 2 + shape.width : reach;
  const targets = [];
  game.grid.query(cx, cz, r, (e) => { if (!e.dying && e.team === 'enemy' && inShape(shape, x, z, face, e.x, e.z, e.radius)) targets.push(e); });
  for (const e of targets) {
    if (o.execute && !isElite(e) && e.hp / e.maxHp < o.execute) { damageEnemy(game, e, 0, { ...o, raw: e.hp + 1, color: '#ff4a5e' }); hits++; continue; }
    if (o.petrify && !e.boss) e.petrified = 2.5;
    damageEnemy(game, e, coef, o); hits++;
  }
  return hits;
}

export function spawnProjectile(game, a) {
  const pr = {
    uid: game.uid++, team: a.team || 'player', x: a.x, z: a.z, y: a.y ?? 1.1, angle: a.angle, speed: a.speed, range: a.range, traveled: 0, radius: (a.radius || 0.5) * (a.team === 'enemy' ? 1 : Math.sqrt(game.stats?.areaMult || 1)),
    pierce: a.pierce || 0, hit: new Set(), dmg: a.dmg, kind: a.kind, homing: a.homing || 0, status: a.status, explode: a.explode, lifesteal: a.lifesteal, kb: a.kb,
    source: a.source || 'skill', tags: a.tags, palette: a.palette || a.tags?.[0], returns: a.returns, returning: false, emit: a.emit ? { ...a.emit, timer: 0 } : null,
    emitChain: a.emitChain ? { ...a.emitChain, timer: 0 } : null, chainOnHit: a.chainOnHit, life: a.life || 8, owner: a.owner, enemyDmg: a.enemyDmg, noProc: a.noProc,
  };
  game.projectiles.push(pr);
  return pr;
}

export function fireChain(game, from, jumps, coef, o = {}) {
  const p = game.player;
  const hit = new Set();
  let cur = from;
  const points = [from ? { x: from.x, z: from.z } : { x: p.x, z: p.z }];
  if (!cur) { cur = nearestEnemy(game, p.x, p.z, o.range || 10); if (!cur) return; }
  let mult = 1, extra = 0;
  const sc = game.procIndex?.superconduct;
  let total = jumps;
  for (let i = 0; i <= total && cur; i++) {
    hit.add(cur.uid);
    points.push({ x: cur.x, z: cur.z, y: cur.height * 0.6 });
    let m = mult;
    if (sc && (cur.status.freeze || cur.status.slow)) { if (!extra) { total += sc.jumps; extra = 1; } m *= 1 + sc.dmg; }
    damageEnemy(game, cur, coef * m, { ...o, stun: o.stun, status: o.status, fromX: cur.x, fromZ: cur.z, tags: o.tags || ['storm'], noProc: o.noProc });
    mult *= o.falloff || 0.9;
    const prev = cur;
    cur = nearestEnemy(game, prev.x, prev.z, o.jumpR || 5, (e) => !hit.has(e.uid));
    if (o.fork && i < 3 && cur) { const f2 = nearestEnemy(game, prev.x, prev.z, o.jumpR || 5, (e) => !hit.has(e.uid) && e !== cur); if (f2) { hit.add(f2.uid); damageEnemy(game, f2, coef * mult, { ...o, fromX: f2.x, fromZ: f2.z, tags: o.tags || ['storm'] }); game.addEffect({ kind: o.vfx || 'chainBolt', points: [{ x: prev.x, z: prev.z }, { x: f2.x, z: f2.z }], life: 0.35, palette: o.palette || 'storm' }); } }
  }
  game.addEffect({ kind: o.vfx || 'chainBolt', points, life: 0.4, palette: o.palette || 'storm' });
}

export function addZone(game, z) {
  const zone = { uid: game.uid++, x: z.x, z: z.z, r: z.r, dur: z.dur, t: 0, tick: z.tick || 0.5, tickT: 0, dmg: z.dmg || 0, status: z.status, pull: z.pull, follow: z.follow, heal: z.heal,
    timeStop: z.timeStop, vulnerable: z.vulnerable, strike: z.strike, end: z.end, buff: z.buff, stun: z.stun, execute: z.execute, lifesteal: z.lifesteal, onlyMoving: z.onlyMoving,
    source: z.source || 'skill', tags: z.tags, palette: z.palette || z.tags?.[0], vfx: z.vfx, small: z.small, noProc: z.noProc };
  game.zones.push(zone);
  game.addEffect({ kind: z.vfx || 'zone', x: z.x, z: z.z, r: z.r, life: z.dur, follow: z.follow ? 'player' : null, zone: zone.uid, palette: zone.palette });
  return zone;
}

export function summonUnits(game, unitId, count, dur, power, x, z, vfx) {
  const def = ALLIES[unitId]; if (!def) return;
  const cap = 40;
  for (let i = 0; i < count; i++) {
    if (game.allies.length >= cap) { const oldest = game.allies.reduce((a, b) => (a.t > b.t ? a : b)); oldest.hp = 0; }
    const a = game.rng.angle(), d = 1.5 + game.rng.next() * 2;
    const pw = power * game.stats.summonMult;
    game.allies.push({ uid: game.uid++, team: 'ally', def, unit: unitId, model: def.model === 'self' ? game.hero.model : def.model, x: x + Math.sin(a) * d, z: z + Math.cos(a) * d, y: 0, vx: 0, vz: 0, vy: 0,
      face: game.player.face, hp: def.hp * pw * (1 + game.run.level * 0.05), maxHp: def.hp * pw * (1 + game.run.level * 0.05), power: pw, dur, t: 0, atkCd: 0.3, radius: def.radius, state: 'spawn', stateT: 0, target: null, flash: 0, scale: def.scale || 1, hero: def.hero });
    game.addEffect({ kind: vfx || 'summonCircle', x: x + Math.sin(a) * d, z: z + Math.cos(a) * d, r: 1.4, life: 0.8, palette: 'shadow' });
  }
  if (game.allies.length > game.run.maxSummons) game.run.maxSummons = game.allies.length;
}

// ---------------------------------------------------------------- per-step updates
export function updateSkillEntities(game, dt) {
  const st = game.stats, p = game.player;
  // scheduled
  if (game.scheduled.length) {
    const due = [];
    game.scheduled = game.scheduled.filter((s) => (s.t <= game.time ? (due.push(s), false) : true));
    for (const s of due) s.fn();
  }
  // cooldowns + autos
  for (const [id, s] of game.skills.owned) {
    const def = SKILL[id];
    if (s.cd > 0) s.cd = Math.max(0, s.cd - dt * (p.mods?.cdRate ?? 1));
    if (def.kind !== 'auto' || def.act.do === 'orbit') continue;
    if (def.act.onlyMoving && p.movedThisStep < 0.02) continue;
    s.timer = (s.timer ?? 0.5) - dt * (p.mods?.cdRate ?? 1);
    if (s.timer <= 0 && !p.dead) {
      s.timer = Math.max(0.1, skillCooldown(game, def));
      const act = scaleAction(def.act, def.up, s.lv, st);
      castAction(game, act, { source: 'skill', skillId: id, angle: aimAngle(game), palette: def.faction });
    }
  }
  // triads
  for (const t of game.triads || []) {
    const def = SKILL[t.skill];
    const s = (game.triadTimers[t.id] ??= { timer: 4 });
    s.timer -= dt;
    if (s.timer <= 0) { s.timer = def.cd * (1 - st.cdrTotal * 0.5); castAction(game, def.act, { source: 'skill', angle: p.face }); emit(game, { type: 'banner', text: t.name, sub: '三派系组合', style: 'triad' }); }
  }
  syncOrbits(game);
  updateOrbits(game, dt);
  updateProjectiles(game, dt);
  updateWaves(game, dt);
  updateRings(game, dt);
  updateZones(game, dt);
  updateBeams(game, dt);
  updateTethers(game, dt);
  updateTraps(game, dt);
  for (const w of game.walls) w.t -= dt;
  game.walls = game.walls.filter((w) => w.t > 0);
}

function syncOrbits(game) {
  for (const [id, s] of game.skills.owned) {
    const def = SKILL[id];
    if (def.act?.do !== 'orbit') continue;
    const act = scaleAction(def.act, def.up, s.lv, game.stats);
    let o = game.orbits.find((x) => x.skillId === id);
    if (!o) { o = { uid: game.uid++, skillId: id, angle: game.rng.angle(), effect: null }; game.orbits.push(o); }
    Object.assign(o, { count: act.count + Math.floor(game.stats.projectiles), r: act.r * Math.sqrt(game.stats.areaMult), speed: act.speed, dmg: act.dmg, size: act.size * Math.sqrt(game.stats.areaMult), hitCd: act.hitCd, status: act.status, vfx: act.vfx, palette: def.faction, tags: act.tags, volley: act.volley, wobble: act.wobble });
    if (!o.effect || !game.effectsById.has(o.effect)) o.effect = game.addEffect({ kind: 'orbit', orbit: o.uid, vfx: act.vfx, life: 1e9, palette: def.faction }).id;
  }
  game.orbits = game.orbits.filter((o) => game.skills.owned.has(o.skillId) && SKILL[o.skillId].act?.do === 'orbit');
}

function updateOrbits(game, dt) {
  const p = game.player;
  for (const o of game.orbits) {
    o.angle += o.speed * dt;
    o.points = [];
    for (let i = 0; i < o.count; i++) {
      const a = o.angle + (i / o.count) * Math.PI * 2;
      const r = o.r * (o.wobble ? 1 + Math.sin(game.time * 3 + i) * o.wobble * 0.3 : 1);
      const x = p.x + Math.sin(a) * r, z = p.z + Math.cos(a) * r;
      o.points.push({ x, z, a });
      game.grid.query(x, z, o.size + 1.2, (e) => {
        if (e.dying || e.team !== 'enemy') return;
        if (dist2(x, z, e.x, e.z) > (o.size + e.radius) ** 2) return;
        const key = o.uid;
        e.orbitHit ??= {};
        if ((e.orbitHit[key] || 0) > game.time) return;
        e.orbitHit[key] = game.time + o.hitCd;
        damageEnemy(game, e, o.dmg, { source: 'skill', status: o.status, tags: o.tags, fromX: p.x, fromZ: p.z, kb: 1.2 });
      });
    }
    if (o.volley) {
      o.volleyT = (o.volleyT ?? o.volley.every) - dt;
      if (o.volleyT <= 0) { o.volleyT = o.volley.every; for (const pt of o.points) spawnProjectile(game, { x: pt.x, z: pt.z, angle: pt.a, speed: 26, range: 12, radius: 0.9, pierce: 99, dmg: o.volley.dmg, kind: 'sword', tags: o.tags }); }
    }
  }
}

function updateProjectiles(game, dt) {
  const p = game.player;
  for (const pr of game.projectiles) {
    if (pr.dead) continue;
    pr.life -= dt;
    if (pr.homing && pr.team === 'player') {
      const t = nearestEnemy(game, pr.x, pr.z, 11, (e) => !pr.hit.has(e.uid));
      if (t) { const want = Math.atan2(t.x - pr.x, t.z - pr.z); const d = wrapAngle(want - pr.angle); pr.angle += clamp(d, -pr.homing * dt, pr.homing * dt); }
    } else if (pr.homing && pr.team === 'enemy') {
      const want = Math.atan2(p.x - pr.x, p.z - pr.z); const d = wrapAngle(want - pr.angle); pr.angle += clamp(d, -pr.homing * dt, pr.homing * dt);
    }
    if (pr.returning) { const want = Math.atan2(p.x - pr.x, p.z - pr.z); pr.angle = want; if (dist2(pr.x, pr.z, p.x, p.z) < 1.5) { pr.dead = true; continue; } }
    const step = pr.speed * dt;
    pr.x += Math.sin(pr.angle) * step; pr.z += Math.cos(pr.angle) * step; pr.traveled += step;
    if (pr.emit) { pr.emit.timer -= dt; if (pr.emit.timer <= 0) { pr.emit.timer = pr.emit.every; for (let i = 0; i < pr.emit.count; i++) spawnProjectile(game, { ...pr.emit, x: pr.x, z: pr.z, angle: game.rng.angle(), radius: 0.4, tags: pr.tags, source: pr.source }); } }
    if (pr.emitChain) { pr.emitChain.timer -= dt; if (pr.emitChain.timer <= 0) { pr.emitChain.timer = pr.emitChain.every; const t = nearestEnemy(game, pr.x, pr.z, 6); if (t) fireChain(game, t, pr.emitChain.jumps, pr.emitChain.dmg, { source: pr.source, tags: ['storm'] }); } }
    if (pr.team === 'player') {
      game.grid.query(pr.x, pr.z, pr.radius + 1.5, (e) => {
        if (pr.dead || e.dying || e.team !== 'enemy' || pr.hit.has(e.uid)) return;
        if (dist2(pr.x, pr.z, e.x, e.z) > (pr.radius + e.radius) ** 2) return;
        pr.hit.add(e.uid);
        damageEnemy(game, e, pr.dmg, { source: pr.source, status: pr.status, tags: pr.tags, lifesteal: pr.lifesteal, kb: pr.kb ?? 1.2, fromX: pr.x - Math.sin(pr.angle), fromZ: pr.z - Math.cos(pr.angle), kind: pr.kind, noProc: pr.noProc });
        if (pr.chainOnHit) fireChain(game, e, pr.chainOnHit.jumps, pr.chainOnHit.dmg, { source: pr.source, tags: ['storm'] });
        if (pr.explode) { explodeProjectile(game, pr); pr.dead = true; return; }
        if (pr.pierce-- <= 0) pr.dead = true;
      });
    } else {
      // enemy projectile vs allies then player
      for (const a of game.allies) {
        if (pr.dead || a.hp <= 0) continue;
        if (dist2(pr.x, pr.z, a.x, a.z) < (pr.radius + a.radius) ** 2) { a.hp -= pr.enemyDmg; a.flash = 1; pr.dead = true; }
      }
      if (!pr.dead && !p.dead && dist2(pr.x, pr.z, p.x, p.z) < (pr.radius + 0.5) ** 2) {
        damagePlayer(game, pr.enemyDmg, { x: pr.x, z: pr.z, kind: 'projectile', status: pr.status, enemy: pr.owner });
        pr.dead = true;
      }
    }
    if (!pr.dead && (pr.traveled >= pr.range || pr.life <= 0)) {
      if (pr.returns && !pr.returning) { pr.returning = true; pr.hit.clear(); pr.traveled = 0; pr.range = 99; }
      else { if (pr.explode) explodeProjectile(game, pr); pr.dead = true; }
    }
    if (Math.abs(pr.x) > game.arena.half + 4 || Math.abs(pr.z) > game.arena.half + 4) pr.dead = true;
  }
  game.projectiles = game.projectiles.filter((x) => !x.dead);
}

function explodeProjectile(game, pr) {
  const ex = pr.explode;
  if (ex.dmg) areaDamage(game, pr.x, pr.z, ex.r, ex.dmg, { source: pr.source, status: ex.status, stun: ex.stun, tags: pr.tags, kb: 3, vfx: `${pr.kind}Burst`, palette: pr.palette });
  if (ex.zone) addZone(game, { ...ex.zone, x: pr.x, z: pr.z, source: pr.source, tags: pr.tags });
  emit(game, { type: 'explode', x: pr.x, z: pr.z, kind: pr.kind });
}

function updateWaves(game, dt) {
  for (const w of game.waves) {
    w.traveled += w.speed * dt;
    const fx = Math.sin(w.angle), fz = Math.cos(w.angle);
    const k = Math.min(1, w.traveled / w.length);
    const width = w.width + (w.width2 - w.width) * k;
    const cx = w.x + fx * w.traveled, cz = w.z + fz * w.traveled;
    game.grid.query(cx, cz, width + 2, (e) => {
      if (e.dying || e.team !== 'enemy' || w.hit.has(e.uid)) return;
      const dx = e.x - w.x, dz = e.z - w.z, along = dx * fx + dz * fz, side = Math.abs(dx * fz - dz * fx);
      if (along < w.traveled - 2.2 || along > w.traveled + 0.8 || side > width / 2 + e.radius) return;
      w.hit.add(e.uid);
      damageEnemy(game, e, w.act.dmg, { ...w.base, kb: w.act.kb, status: w.act.status, launch: w.act.launch, fromX: e.x - fx, fromZ: e.z - fz });
    });
    if (w.traveled >= w.length) w.done = true;
  }
  game.waves = game.waves.filter((w) => !w.done);
}

function updateRings(game, dt) {
  for (const r of game.rings) {
    r.cur += r.speed * dt;
    game.grid.query(r.x, r.z, r.cur + 1.5, (e) => {
      if (e.dying || e.team !== 'enemy' || r.hit.has(e.uid)) return;
      const d = Math.sqrt(dist2(r.x, r.z, e.x, e.z));
      if (d > r.cur + e.radius || d < r.cur - r.width - e.radius) return;
      r.hit.add(e.uid);
      if (r.act.execute && !isElite(e) && e.hp / e.maxHp < r.act.execute) { damageEnemy(game, e, 0, { ...r.base, raw: e.hp + 1, color: '#ff4a5e' }); return; }
      damageEnemy(game, e, r.act.dmg, { ...r.base, status: r.act.status, kb: 2, fromX: r.x, fromZ: r.z });
    });
    if (r.cur >= r.r) r.done = true;
  }
  game.rings = game.rings.filter((r) => !r.done);
}

function updateZones(game, dt) {
  const p = game.player, st = game.stats;
  for (const z of game.zones) {
    z.t += dt;
    if (z.follow) { z.x = p.x; z.z = p.z; }
    if (z.pull) {
      game.grid.query(z.x, z.z, z.r + 1, (e) => {
        if (e.dying || e.team !== 'enemy' || e.boss) return;
        const dx = z.x - e.x, dz = z.z - e.z, d = Math.hypot(dx, dz);
        if (d > z.r + e.radius || d < 0.3) return;
        const f = z.pull * (z.small ? 0.6 : 1) / Math.sqrt(e.mass);
        e.vx += (dx / d) * f * dt * 6; e.vz += (dz / d) * f * dt * 6;
      });
    }
    z.tickT -= dt;
    if (z.tickT <= 0) {
      z.tickT += z.tick;
      if (z.strike) {
        const a = game.rng.angle(), d = Math.sqrt(game.rng.next()) * z.r;
        castAction(game, { do: 'strike', at: 'point', x: z.x + Math.sin(a) * d, z: z.z + Math.cos(a) * d, area: { shape: 'circle', r: 1.7 }, dmg: z.dmg, stun: z.stun, vfx: 'skyBolt', tags: z.tags }, { source: z.source, noProc: z.noProc });
      } else {
        let hits = 0;
        game.grid.query(z.x, z.z, z.r + 1.5, (e) => {
          if (e.dying || e.team !== 'enemy') return;
          if (dist2(z.x, z.z, e.x, e.z) > (z.r + e.radius) ** 2) return;
          if (z.timeStop && !e.boss) { e.status.timeStop = { t: z.tick + 0.08 }; e.status.chrono = { t: z.tick + 0.08, vuln: z.vulnerable || 0 }; }
          if (z.execute && !isElite(e) && e.hp / e.maxHp < z.execute) { damageEnemy(game, e, 0, { raw: e.hp + 1, source: z.source }); return; }
          if (z.dmg > 0) damageEnemy(game, e, z.dmg, { source: z.source, status: z.status, stun: z.stun, tags: z.tags, noReact: !z.stun, fromX: z.x, fromZ: z.z, lifesteal: z.lifesteal, noProc: z.noProc });
          else if (z.status) applyStatus(game, e, z.status);
          hits++;
        });
        if (z.heal && dist2(z.x, z.z, p.x, p.z) < z.r * z.r) healPlayer(game, st.maxHp * z.heal, true);
      }
      if (z.buff && dist2(z.x, z.z, p.x, p.z) < z.r * z.r) addBuff(game, { id: `zone${z.uid}`, dur: z.tick + 0.1, stats: z.buff });
    }
    if (z.t >= z.dur) {
      z.done = true;
      if (z.end) { areaDamage(game, z.x, z.z, z.end.r, z.end.dmg, { source: z.source, kb: z.end.kb, tags: z.tags, vfx: 'collapse', palette: z.palette }); emit(game, { type: 'shake', a: 0.5 }); }
      if (z.pull && game.procIndex?.starfire) { const sf = game.procIndex.starfire; areaDamage(game, z.x, z.z, z.r, sf.dmg, { source: 'proc', status: { burn: sf.burn }, tags: ['fire'], vfx: 'fireBurst' }); }
    }
  }
  game.zones = game.zones.filter((z) => !z.done);
}

function updateBeams(game, dt) {
  const p = game.player;
  for (const b of game.beams) {
    b.t += dt; b.tickT -= dt;
    if (b.tickT <= 0) { b.tickT += b.tick; hitShape(game, { shape: 'line', length: b.act.length, width: b.act.width * game.stats.areaMult }, p.x, p.z, p.face, b.act.dmg, { ...b.base, kb: b.act.kb, fromX: p.x, fromZ: p.z }); }
    if (b.t >= b.dur) b.done = true;
  }
  game.beams = game.beams.filter((b) => !b.done);
}

function updateTethers(game, dt) {
  for (const t of game.tethers) {
    t.t += dt; t.tickT -= dt;
    if (t.tickT <= 0) { t.tickT += t.tick; for (const e of t.targets) if (!e.dying) damageEnemy(game, e, t.act.dmg, { ...t.base, lifesteal: t.act.lifesteal, noReact: true }); }
    if (t.t >= t.dur) t.done = true;
  }
  game.tethers = game.tethers.filter((t) => !t.done);
}

function updateTraps(game, dt) {
  for (const tr of game.traps) {
    tr.t -= dt;
    let triggered = false;
    game.grid.query(tr.x, tr.z, tr.trigger + 1, (e) => { if (!triggered && !e.dying && e.team === 'enemy' && dist2(tr.x, tr.z, e.x, e.z) < tr.trigger * tr.trigger) triggered = true; });
    if (triggered) { areaDamage(game, tr.x, tr.z, tr.blast, tr.dmg, { ...tr.base, kb: 4, launch: 4, vfx: 'fireBurst', palette: 'fire' }); tr.t = 0; emit(game, { type: 'shake', a: 0.25 }); }
  }
  game.traps = game.traps.filter((t) => t.t > 0);
}

export function updateOmnislash(game, dt) {
  const p = game.player, o = p.omni;
  if (!o) return;
  o.t -= dt;
  if (o.t > 0) return;
  o.t = o.interval;
  const target = nearestEnemy(game, p.x, p.z, o.range, (e) => !o.hit.has(e.uid)) || nearestEnemy(game, p.x, p.z, o.range);
  if (!target || o.left <= 0) { p.omni = null; p.state = 'idle'; p.invuln = 0.3; emit(game, { type: 'omniEnd' }); return; }
  o.hit.add(target.uid); if (o.hit.size > 6) o.hit.clear();
  const a = game.rng.angle();
  const fx = p.x, fz = p.z;
  p.x = target.x + Math.sin(a) * 1.2; p.z = target.z + Math.cos(a) * 1.2;
  p.face = Math.atan2(target.x - p.x, target.z - p.z);
  game.addEffect({ kind: 'omnislash', x: fx, z: fz, ex: p.x, ez: p.z, life: 0.35, palette: o.palette || 'blade' });
  damageEnemy(game, target, o.dmg, { ...o.base, crit: o.crit, kb: 2, fromX: p.x, fromZ: p.z });
  emit(game, { type: 'slash', x: target.x, z: target.z, angle: p.face });
  o.left--;
}
