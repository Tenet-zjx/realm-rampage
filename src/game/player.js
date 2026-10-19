// Hero controller: movement, light chains, Cn charge attacks, dodge, musou, buffs, item actives and consumables.
import { SKILL } from './content/skills.js';
import { ITEM } from './content/items.js';
import { MASTERY } from './content/meta.js';
import { damageEnemy, healPlayer, emit, addMusou, isElite, areaDamage } from './combat.js';
import { castAction, castSkill, spawnProjectile, hitShape, summonUnits, updateOmnislash, aimAngle, clusterPoint } from './skills.js';
import { runProcs, addBuff } from './procs.js';
import { inShape, dist2, wrapAngle, clamp, turnTowards } from './util.js';

export function createPlayer(hero) {
  return {
    x: 0, z: 0, y: 0, vy: 0, face: 0, hp: 1, shield: 0, shieldT: 0, musou: 0, state: 'idle', stateT: 0, move: null, comboIndex: 0, buffer: null,
    dodgeCd: 0, invuln: 1.2, buffInvuln: 0, buffCcImmune: 0, buffs: [], slowT: 0, frozenT: 0, rootT: 0, burnT: 0, stillT: 0, movedThisStep: 0,
    castAnim: null, forced: null, channelT: 0, omni: null, guaranteedCrits: 0, nextHitMult: 0, spellShield: false, stealthT: 0, revives: 0,
    souls: 0, spellbladeT: 0, hurtFlash: 0, aim: null, musouState: null, armorState: false, dead: false, attackId: 0, hero: hero.id,
  };
}

const chargeLimit = (game) => {
  const ml = game.meta?.mastery || 1;
  let n = MASTERY.baseCharges;
  for (let l = 2; l <= ml; l++) if (MASTERY.unlocks[l]?.charges) n = MASTERY.unlocks[l].charges;
  return Math.min(game.hero.charges.length, game.forceAllCharges ? 6 : n);
};

function nearestFront(game, range, cone) {
  const p = game.player; let best = null, bd = range * range;
  game.grid.query(p.x, p.z, range, (e) => {
    if (e.dying || e.team !== 'enemy') return;
    const d = dist2(p.x, p.z, e.x, e.z); if (d > bd) return;
    if (cone < Math.PI && Math.abs(wrapAngle(Math.atan2(e.x - p.x, e.z - p.z) - p.face)) > cone) return;
    bd = d; best = e;
  });
  return best;
}

function attackFacing(game, input) {
  const p = game.player;
  if (p.aim) return Math.atan2(p.aim.x - p.x, p.aim.z - p.z);
  if (input.move && (input.move.x || input.move.z)) {
    const want = Math.atan2(input.move.x, input.move.z);
    const t = nearestFront(game, 7, 0.9);
    if (t) { const a = Math.atan2(t.x - p.x, t.z - p.z); if (Math.abs(wrapAngle(a - want)) < 0.7) return a; }
    return want;
  }
  const t = nearestFront(game, 7.5, Math.PI);
  return t ? Math.atan2(t.x - p.x, t.z - p.z) : p.face;
}

function startMove(game, kind, index, input) {
  const p = game.player, hero = game.hero;
  const def = kind === 'light' ? hero.light[index] : hero.charges[index];
  if (!def) return false;
  const rate = game.stats.attackRate;
  const dur = kind === 'light' ? def.dur / rate : def.dur / (1 + (rate - 1) * 0.5);
  p.face = attackFacing(game, input);
  p.state = 'attack'; p.stateT = 0;
  p.move = { kind, index, def, t: 0, dur, done: new Set(), projDone: false, castDone: false, id: ++p.attackId, swung: false, hitAny: false };
  p.armorState = !!def.armor || kind === 'charge';
  if (def.invuln) p.invuln = Math.max(p.invuln, dur * 0.85);
  if (kind === 'light') p.comboIndex = index + 1;
  emit(game, { type: 'attack', kind, index, name: def.name, clip: def.clip, from: def.from, to: def.to, dur, mirror: def.mirror, slash: def.slash, vfx: def.vfx, palette: hero.palette });
  if (kind === 'charge') emit(game, { type: 'chargeName', name: `C${index + 1} · ${def.name}` });
  return true;
}

function resolveHit(game, hit, mv) {
  const p = game.player, st = game.stats;
  const areaS = Math.sqrt(st.areaMult);
  const shape = { ...hit };
  if (shape.shape === 'arc') shape.range = hit.range * areaS;
  if (shape.shape === 'circle') shape.r = hit.r * areaS;
  if (shape.shape === 'line') { shape.length = hit.length * (1 + (areaS - 1) * 0.6); shape.width = hit.width * areaS; }
  let ox = p.x, oz = p.z;
  if (hit.offset) { ox += Math.sin(p.face) * hit.offset; oz += Math.cos(p.face) * hit.offset; }
  if (hit.back) { ox = p.x - Math.sin(p.face) * hit.length; oz = p.z - Math.cos(p.face) * hit.length; }
  const source = mv.kind === 'light' ? 'light' : 'charge';
  const o = { source, kb: hit.kb, launch: hit.launch, stun: hit.stun, status: hit.status, guardBreak: hit.guardBreak, critBonus: hit.critBonus, tags: hit.tags, fromX: p.x, fromZ: p.z, execute: hit.execute };
  const hits = hitShape(game, shape, ox, oz, p.face, hit.dmg, o);
  if (hits) {
    mv.hitAny = true;
    const hs = mv.def.hitstop || (source === 'charge' ? 0.06 : 0.035) + Math.min(0.03, hits * 0.002);
    emit(game, { type: 'hitstop', t: hs });
    if (source === 'charge' || mv.def.shake) emit(game, { type: 'shake', a: mv.def.shake || 0.22 });
  }
  // cleave / nth-hit artifacts
  const cleave = game.procIndex?.cleave;
  if (cleave && hits) {
    const c = { shape: 'arc', range: (shape.range || shape.r || shape.length || 3) + cleave.r * 0.5, angle: 200 };
    hitShape(game, c, p.x, p.z, p.face, hit.dmg * cleave.pct, { source: 'proc', noProc: true, fromX: p.x, fromZ: p.z, kb: 1 });
    game.addEffect({ kind: 'cleave', x: p.x, z: p.z, angle: p.face, r: c.range, life: 0.3, palette: 'blade' });
  }
  const nq = game.procIndex?.nthQuake;
  if (nq && hits) { const s = (game.procState.nthQuake ??= { n: 0 }); s.n++; if (s.n % nq.n === 0) areaDamage(game, p.x + Math.sin(p.face) * 2, p.z + Math.cos(p.face) * 2, nq.r, nq.dmg, { source: 'proc', vfx: 'quake', launch: 4, tags: ['earth'] }); }
  game.addEffect({ kind: mv.def.vfx || 'slashArc', x: ox, z: oz, angle: p.face, r: shape.range || shape.r || shape.length, shape: shape.shape, width: shape.width, length: shape.length, arc: shape.angle, life: 0.32, palette: hit.tags?.[0] || game.hero.palette, tilt: mv.def.slash?.tilt, mirror: mv.def.mirror, kind2: mv.kind });
}

function updateAttack(game, dt, input) {
  const p = game.player, mv = p.move, def = mv.def;
  mv.t += dt;
  const f = mv.t / mv.dur;
  // lunge (first 45%)
  if (def.lunge && f < 0.45) {
    const step = (def.lunge / (mv.dur * 0.45)) * dt;
    tryMove(game, Math.sin(p.face) * step, Math.cos(p.face) * step);
  }
  if (def.leap) p.y = Math.sin(clamp(f / 0.62, 0, 1) * Math.PI) * def.leap;
  if (def.move && input.move && (input.move.x || input.move.z)) {
    const sp = game.stats.speed * def.move * dt;
    tryMove(game, input.move.x * sp, input.move.z * sp);
    p.face = turnTowards(p.face, Math.atan2(input.move.x, input.move.z), 6 * dt);
  }
  if (!mv.swung && f >= 0.2) { mv.swung = true; if (mv.kind === 'light') runProcs(game, 'swing', {}); }
  for (let i = 0; i < (def.hits || []).length; i++) {
    const h = def.hits[i];
    if (!mv.done.has(i) && f >= h.t) { mv.done.add(i); resolveHit(game, h, mv); }
  }
  if (def.proj && !mv.projDone && f >= def.proj.t) {
    mv.projDone = true;
    const pr = def.proj, extra = Math.floor(game.stats.projectiles / (mv.kind === 'light' ? 2 : 1));
    const count = pr.count + extra, spread = (pr.spread || 0) * Math.PI / 180 + extra * 0.08;
    for (let i = 0; i < count; i++) {
      const a = p.face + (count > 1 ? (i / (count - 1) - 0.5) * spread : 0);
      spawnProjectile(game, { x: p.x + Math.sin(p.face) * 0.6, z: p.z + Math.cos(p.face) * 0.6, angle: a, speed: pr.speed, range: pr.range, radius: pr.radius, pierce: (pr.pierce || 0) + game.stats.pierce, homing: pr.homing, dmg: pr.dmg, kind: pr.kind, explode: pr.explode, source: mv.kind === 'light' ? 'light' : 'charge', tags: pr.tags, palette: game.hero.palette, kb: 1.4 });
    }
    emit(game, { type: 'shoot', kind: pr.kind });
  }
  if (def.cast && !mv.castDone && f >= 0.45) {
    mv.castDone = true;
    const sk = SKILL[def.cast.skill];
    castAction(game, sk.act, { source: 'charge', angle: p.face, palette: game.hero.palette });
    emit(game, { type: 'hitstop', t: 0.04 });
  }
  // chaining
  const canChain = f >= (mv.kind === 'light' ? 0.55 : 0.8);
  const buf = p.buffer && game.time - p.buffer.at < 0.4 ? p.buffer : null;
  if (canChain && buf) {
    p.buffer = null;
    if (buf.type === 'light' && mv.kind === 'light' && mv.index + 1 < game.hero.light.length) return startMove(game, 'light', mv.index + 1, input);
    if (buf.type === 'light' && mv.kind === 'light') return startMove(game, 'light', 0, input);
    if (buf.type === 'light' && mv.kind === 'charge') return startMove(game, 'light', 0, input);
    if (buf.type === 'heavy' && mv.kind === 'light') { const n = Math.min(chargeLimit(game) - 1, mv.index + 1); return startMove(game, 'charge', n, input); }
  }
  if (f >= 1) {
    p.state = 'idle'; p.move = null; p.armorState = false; p.y = 0;
    if (mv.kind === 'charge' || mv.index >= game.hero.light.length - 1) p.comboIndex = 0;
    p.comboReset = 0.6;
  }
}

export function tryMove(game, dx, dz) {
  const p = game.player, half = game.arena.half - 0.6;
  let nx = clamp(p.x + dx, -half, half), nz = clamp(p.z + dz, -half, half);
  for (const o of game.obstacles) {
    const ddx = nx - o.x, ddz = nz - o.z, rr = o.r + 0.5, d2 = ddx * ddx + ddz * ddz;
    if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2); nx = o.x + (ddx / d) * rr; nz = o.z + (ddz / d) * rr; }
  }
  p.movedThisStep += Math.hypot(nx - p.x, nz - p.z);
  p.x = nx; p.z = nz;
}

function startDodge(game, input) {
  const p = game.player;
  let a = p.face + Math.PI;
  if (input.move && (input.move.x || input.move.z)) a = Math.atan2(input.move.x, input.move.z);
  p.state = 'dodge'; p.stateT = 0; p.dodgeDir = a; p.face = a; p.move = null; p.armorState = false; p.y = 0;
  p.invuln = Math.max(p.invuln, game.stats.iframeTime);
  p.dodgeCd = game.stats.dodgeCd;
  p.comboIndex = 0;
  emit(game, { type: 'dodge', x: p.x, z: p.z, angle: a });
}

function startMusou(game) {
  const p = game.player, m = game.hero.musou, st = game.stats;
  p.musou -= 100;
  const isTrue = p.hp / st.maxHp < 0.25 + st.trueMusou;
  const dur = m.dur * (1 + st.musouDur) * (isTrue ? 1.2 : 1);
  p.state = 'musou'; p.stateT = 0; p.move = null; p.y = 0;
  p.trueMusou = isTrue; p.musouAwakened = (game.meta?.mastery || 1) >= 5;
  p.musouState = { t: 0, dur, hits: Math.round(m.hits * (isTrue ? 1.3 : 1)), done: 0, finished: false, pattern: m.pattern };
  game.run.musous++;
  if (isTrue) game.run.trueMusous++;
  emit(game, { type: 'musou', phase: 'start', name: isTrue ? m.true : m.name, true: isTrue, palette: m.palette });
  emit(game, { type: 'shake', a: 0.6 });
  // clear nearby threats
  for (const h of game.hostile) if (dist2(h.x, h.z, p.x, p.z) < 64) h.cancelled = true;
}

function updateMusou(game, dt, input) {
  const p = game.player, ms = p.musouState, m = game.hero.musou, st = game.stats;
  ms.t += dt;
  const r = m.r * Math.sqrt(st.areaMult);
  if (['tornado', 'raiseArmy', 'barrage'].includes(ms.pattern) && input.move && (input.move.x || input.move.z)) {
    const sp = st.speed * (ms.pattern === 'tornado' ? 1.15 : 0.7) * dt;
    tryMove(game, input.move.x * sp, input.move.z * sp);
  }
  const interval = (ms.dur * 0.82) / ms.hits;
  while (ms.done < ms.hits && ms.t >= ms.done * interval + 0.15) {
    ms.done++;
    const o = { source: 'musou', tags: [m.palette], fromX: p.x, fromZ: p.z };
    switch (ms.pattern) {
      case 'spinStrikes': case 'tornado':
        p.face += 1.7;
        areaDamage(game, p.x, p.z, ms.pattern === 'tornado' ? r * 0.75 : r * 0.7, m.dmg, { ...o, kb: 2.5, launch: ms.done % 3 === 0 ? 5 : 0, vfx: ms.pattern === 'tornado' ? 'bloodCyclone' : 'holySpin', palette: m.palette });
        emit(game, { type: 'hitstop', t: 0.025 });
        break;
      case 'meteorRain': {
        const c = clusterPoint(game, p.x, p.z, r) || { x: p.x, z: p.z };
        const a = game.rng.angle(), d = game.rng.next() * 3.5;
        castAction(game, { do: 'strike', at: 'point', x: c.x + Math.sin(a) * d, z: c.z + Math.cos(a) * d, delay: 0.35, area: { shape: 'circle', r: 3.2 }, dmg: m.dmg, launch: 5, vfx: 'starMeteor', tags: ['arcane'] }, { source: 'musou' });
        break;
      }
      case 'omnislash': {
        const t = nearestFront(game, r, Math.PI);
        if (t) { const a = game.rng.angle(); const fx = p.x, fz = p.z; p.x = t.x + Math.sin(a) * 1.3; p.z = t.z + Math.cos(a) * 1.3; p.face = Math.atan2(t.x - p.x, t.z - p.z); game.addEffect({ kind: 'omnislash', x: fx, z: fz, ex: p.x, ez: p.z, life: 0.3, palette: 'blade' }); areaDamage(game, t.x, t.z, 2.6, m.dmg, { ...o, kb: 2, vfx: 'crossSlash', palette: 'blade' }); emit(game, { type: 'hitstop', t: 0.035 }); }
        break;
      }
      case 'barrage': {
        const t = nearestFront(game, r, Math.PI);
        const a = t ? Math.atan2(t.x - p.x, t.z - p.z) : p.face; p.face = a;
        for (let i = 0; i < 3; i++) spawnProjectile(game, { x: p.x, z: p.z, angle: a + (i - 1) * 0.12, speed: 40, range: 16, radius: 0.6, pierce: 4, dmg: m.dmg, kind: 'bolt', source: 'musou', tags: ['shadow'] });
        break;
      }
      case 'raiseArmy':
        if (ms.done % 3 === 1) summonUnits(game, 'ally_skeleton', 2, 14, 1.0, p.x, p.z, 'summonCircle');
        areaDamage(game, p.x, p.z, r * 0.6, m.dmg, { ...o, kb: 2, vfx: 'darkPulse', palette: 'shadow' });
        break;
      default: break;
    }
  }
  if (!ms.finished && ms.t >= ms.dur * 0.86) {
    ms.finished = true;
    const fin = { source: 'musou', tags: [m.palette], kb: 7, launch: 8, fromX: p.x, fromZ: p.z };
    const big = m.finishDmg * (p.trueMusou ? 1.4 : 1);
    if (m.finish === 'bigBolt' || m.finish === 'crossSlash') hitShape(game, m.finish === 'bigBolt' ? { shape: 'line', length: 22, width: 4 } : { shape: 'circle', r: r }, p.x, p.z, p.face, big, fin);
    else hitShape(game, { shape: 'circle', r: r * 1.15 }, p.x, p.z, p.face, big, fin);
    game.addEffect({ kind: `musou_${m.finish}`, x: p.x, z: p.z, r: r * 1.15, angle: p.face, life: 1.2, palette: m.palette, true: p.trueMusou });
    emit(game, { type: 'musou', phase: 'finish', palette: m.palette, true: p.trueMusou });
    emit(game, { type: 'shake', a: 1.2 });
    emit(game, { type: 'hitstop', t: 0.16 });
    game.slowmo = { t: 0.55, scale: 0.3 };
  }
  if (ms.t >= ms.dur) {
    p.state = 'idle'; p.musouState = null; p.invuln = Math.max(p.invuln, 0.6);
    emit(game, { type: 'musou', phase: 'end' });
    runProcs(game, 'musouEnd', {});
  }
}

export function useItemActive(game, slotIndex) {
  const id = game.inventory.items[slotIndex];
  const it = id && ITEM[id];
  if (!it?.active) return false;
  const cds = game.inventory.cds;
  if ((cds[id] || 0) > 0) return false;
  const a = it.active, p = game.player;
  if (a.special === 'refresh') {
    for (const s of game.skills.owned.values()) s.cd = 0;
    for (const k in cds) if (k !== id) cds[k] = 0;
    emit(game, { type: 'banner', text: '刷新！', sub: '所有冷却已重置', style: 'buff' });
  } else if (a.special === 'transmute') {
    let best = null, bd = 144;
    game.grid.query(p.x, p.z, 12, (e) => { if (!e.dying && e.team === 'enemy' && !isElite(e)) { const d = dist2(p.x, p.z, e.x, e.z); if (d < bd) { bd = d; best = e; } } });
    if (!best) return false;
    damageEnemy(game, best, 0, { raw: best.hp + 1, source: 'proc', color: '#ffd76a' });
    game.inventory.gold += a.gold; game.run.goldEarned += a.gold;
    emit(game, { type: 'gold', amount: a.gold, x: best.x, z: best.z });
  } else castAction(game, a.act, { source: 'skill', angle: aimAngle(game), palette: 'arcane' });
  cds[id] = a.cd * (1 - game.stats.cdrTotal * 0.5);
  emit(game, { type: 'itemUse', id });
  return true;
}

export function useConsumable(game, slot) {
  const belt = game.inventory.belt, entry = belt[slot];
  if (!entry || entry.count <= 0) return false;
  const it = ITEM[entry.id], u = it.use, p = game.player, st = game.stats;
  if (u.heal) healPlayer(game, st.maxHp * u.heal);
  if (u.hot) addBuff(game, { id: `hot_${it.id}`, dur: u.dur || 5, hotRate: (st.maxHp * u.hot) / (u.dur || 5) });
  if (u.musou) addMusou(game, u.musou);
  if (u.buff) castAction(game, { do: 'buff', ...u.buff }, { source: 'skill' });
  if (u.rerolls) game.draft.rerolls += u.rerolls;
  if (u.banishes) game.draft.banishes += u.banishes;
  if (u.levelUp) game.addXp(game.xpToNext() - game.run.xp + 0.01);
  if (u.cooldownCut) for (const s of game.skills.owned.values()) s.cd *= 1 - u.cooldownCut;
  if (u.luckyDraft) game.draft.lucky = (game.draft.lucky || 0) + 1;
  if (u.act) castAction(game, u.act, { source: 'skill', angle: aimAngle(game) });
  if (u.teleport) { const tgt = game.objectivePoint?.() || { x: -p.x * 0.6, z: -p.z * 0.6 }; game.addEffect({ kind: 'blink', x: p.x, z: p.z, ex: tgt.x, ez: tgt.z, life: 0.5, palette: 'arcane' }); p.x = tgt.x; p.z = tgt.z; p.invuln = 1; }
  entry.count--;
  if (entry.count <= 0) belt[slot] = null;
  emit(game, { type: 'consume', id: it.id });
  return true;
}

export function updatePlayer(game, dt, input) {
  const p = game.player, st = game.stats;
  p.movedThisStep = 0;
  if (input.aim) p.aim = input.aim; else p.aim = null;
  p.hurtFlash = Math.max(0, p.hurtFlash - dt * 3);
  p.invuln = Math.max(0, p.invuln - dt);
  p.buffInvuln = Math.max(0, p.buffInvuln - dt);
  p.buffCcImmune = Math.max(0, p.buffCcImmune - dt);
  p.dodgeCd = Math.max(0, p.dodgeCd - dt);
  p.slowT = Math.max(0, p.slowT - dt); p.frozenT = Math.max(0, p.frozenT - dt); p.rootT = Math.max(0, p.rootT - dt);
  p.stealthT = Math.max(0, p.stealthT - dt); p.spellbladeT = Math.max(0, p.spellbladeT - dt); p.channelT = Math.max(0, p.channelT - dt);
  if (p.comboReset > 0) { p.comboReset -= dt; if (p.comboReset <= 0 && p.state !== 'attack') p.comboIndex = 0; }
  if (p.shieldT > 0) { p.shieldT -= dt; if (p.shieldT <= 0) p.shield = 0; }
  if (p.castAnim) { p.castAnim.t += dt; if (p.castAnim.t >= p.castAnim.dur) p.castAnim = null; }
  for (const k in game.inventory.cds) if (game.inventory.cds[k] > 0) game.inventory.cds[k] = Math.max(0, game.inventory.cds[k] - dt);
  if (p.dead) { p.stateT += dt; return; }
  // regen & dots
  if (st.regenPct > 0) healPlayer(game, st.maxHp * st.regenPct * dt, true);
  if (p.burnT > 0) { p.burnT -= dt; p.burnTick = (p.burnTick || 0) - dt; if (p.burnTick <= 0) { p.burnTick = 0.5; game.damagePlayer(st.maxHp * 0.008, { kind: 'dot' }); } }
  // buffs
  let expired = false;
  for (const b of p.buffs) {
    b.t -= dt;
    if (b.hotRate) healPlayer(game, b.hotRate * dt, true);
    if (b.aura) { b.aura.t -= dt; if (b.aura.t <= 0) { b.aura.t = b.aura.every; areaDamage(game, p.x, p.z, b.aura.r, b.aura.dmg, { source: 'skill', status: b.aura.status, vfx: b.aura.vfx, tags: b.aura.tags }); } }
    if (b.t <= 0) { expired = true; if (b.stats) game.statsDirty = true; }
  }
  if (expired) p.buffs = p.buffs.filter((b) => b.t > 0);
  p.staticShield = p.buffs.find((b) => b.staticShield)?.staticShield || 0;
  // forced movement (dash / leap)
  if (p.forced) {
    const f = p.forced; f.t += dt;
    const k = clamp(f.t / f.dur, 0, 1);
    const ease = 1 - (1 - k) * (1 - k);
    const nx = f.sx + (f.ex - f.sx) * ease, nz = f.sz + (f.ez - f.sz) * ease;
    p.movedThisStep += Math.hypot(nx - p.x, nz - p.z);
    p.x = nx; p.z = nz;
    p.y = f.arc ? Math.sin(k * Math.PI) * f.arc : 0;
    if (f.invuln) p.invuln = Math.max(p.invuln, 0.05);
    if (k >= 1) { p.forced = null; p.y = 0; }
    return;
  }
  if (p.state === 'omnislash') { updateOmnislash(game, dt); return; }
  if (p.state === 'musou') { updateMusou(game, dt, input); return; }

  const pressed = input.pressed || {};
  // musou
  if (pressed.musou && p.musou >= 100 && p.frozenT <= 0) { startMusou(game); return; }
  // skills
  for (let i = 0; i < game.skills.slots.length; i++) if (pressed[`skill${i}`] && game.skills.slots[i]) { if (castSkill(game, game.skills.slots[i])) { if (p.state === 'attack') { p.state = 'idle'; p.move = null; } } }
  for (let i = 0; i < 3; i++) if (pressed[`item${i}`]) { const slot = game.activeItemSlots()[i]; if (slot != null) useItemActive(game, slot); }
  for (let i = 0; i < 4; i++) if (pressed[`belt${i}`]) useConsumable(game, i);
  // dodge
  if (pressed.dodge && p.dodgeCd <= 0 && p.frozenT <= 0 && p.rootT <= 0 && p.state !== 'dodge') startDodge(game, input);
  if (p.state === 'dodge') {
    p.stateT += dt;
    const D = 0.34, dist = 6.4;
    const sp = (dist / D) * (1 - p.stateT / D) * 2 * dt;
    tryMove(game, Math.sin(p.dodgeDir) * sp, Math.cos(p.dodgeDir) * sp);
    if (p.stateT >= D) { p.state = 'idle'; p.stateT = 0; }
    if (pressed.light) p.buffer = { type: 'light', at: game.time };
    if (pressed.heavy) p.buffer = { type: 'heavy', at: game.time };
    return;
  }
  if (p.frozenT > 0) return;
  // attacks
  if (pressed.light) p.buffer = { type: 'light', at: game.time };
  if (pressed.heavy) p.buffer = { type: 'heavy', at: game.time };
  if (p.state === 'attack') { updateAttack(game, dt, input); if (p.state === 'attack') return; }
  const buf = p.buffer && game.time - p.buffer.at < 0.4 ? p.buffer : null;
  if (buf) {
    p.buffer = null;
    if (buf.type === 'light') { const idx = p.comboIndex < game.hero.light.length && p.comboReset > 0 ? p.comboIndex : 0; startMove(game, 'light', idx, input); return; }
    if (buf.type === 'heavy') { const n = p.comboReset > 0 && p.comboIndex > 0 ? Math.min(chargeLimit(game) - 1, p.comboIndex) : 0; startMove(game, 'charge', n, input); return; }
  }
  // locomotion
  const mx = input.move?.x || 0, mz = input.move?.z || 0;
  if ((mx || mz) && p.rootT <= 0) {
    const speed = st.speed * (p.slowT > 0 ? 0.6 : 1) * (p.channelT > 0 ? 0.45 : 1);
    tryMove(game, mx * speed * dt, mz * speed * dt);
    p.face = turnTowards(p.face, Math.atan2(mx, mz), 14 * dt);
    p.state = 'move'; p.stillT = 0;
  } else { p.state = 'idle'; p.stillT += dt; }
  if (p.channelT > 0 && p.aim) p.face = Math.atan2(p.aim.x - p.x, p.aim.z - p.z);
}
