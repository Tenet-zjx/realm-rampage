// Enemy, boss and ally AI plus hostile area attacks (always telegraphed with their exact geometry).
import { ENEMY, BOSS, AFFIX } from './content/enemies.js';
import { damagePlayer, damageEnemy, tickEnemyStatus, emit, isElite, applyStatus } from './combat.js';
import { spawnProjectile } from './skills.js';
import { runProcs } from './procs.js';
import { inShape, dist2, wrapAngle, turnTowards, clamp } from './util.js';

let UID = 1;
export function makeEnemy(game, id, x, z, o = {}) {
  const boss = BOSS[id];
  const def = boss || ENEMY[id];
  const sc = game.scaling;
  const hpMult = sc.hp * (o.hpMult || 1) * (o.elite ? 3.2 : 1) * (o.officer ? 9 : 1) * (boss ? sc.bossHp : 1);
  const e = {
    uid: game.uid++, id, def, team: 'enemy', model: def.model, x, z, y: 0, vx: 0, vz: 0, vy: 0, face: Math.atan2(game.player.x - x, game.player.z - z),
    hp: def.hp * hpMult, maxHp: def.hp * hpMult, dmg: def.dmg * sc.dmg * (o.elite ? 1.4 : 1) * (o.officer ? 1.7 : 1), armor: (def.def || 0) + sc.def,
    speed: def.speed * sc.speed * (o.elite ? 1.1 : 1) * (o.officer ? 1.05 : 1), radius: def.radius * (o.scale || 1) * (o.officer ? 1.3 : o.elite ? 1.15 : 1),
    mass: (def.mass || 1) * (o.officer ? 4 : o.elite ? 2 : 1), xp: boss ? 60 : (def.xp || 1) * (o.elite ? 6 : 1) * (o.officer ? 25 : 1), gold: boss ? 60 : (def.gold || 1) * (o.elite ? 5 : 1) * (o.officer ? 20 : 1),
    scale: (def.scale || 1) * (o.scale || 1) * (o.officer ? 1.45 : o.elite ? 1.18 : 1), height: 2.2 * (def.scale || 1) * (o.scale || 1) * (o.officer ? 1.45 : 1),
    state: o.noSpawnAnim ? 'idle' : 'spawn', stateT: 0, spawnDur: o.noSpawnAnim ? 0 : boss ? 1.8 : def.clips?.spawn === 'Skeletons_Awaken_Floor' ? 1.15 : 0.6,
    atkCd: 1 + game.rng.next() * 1.5, status: {}, flash: 0, elite: !!o.elite, officer: o.officer || null, boss: !!boss, affixes: o.affixes || [], shield: 0,
    airborne: false, stagger: 0, anim: { clip: 'idle', t: game.rng.next() * 2 }, isSplit: !!(o.split || o.splitAffix), wander: game.rng.angle(), seed: game.rng.next(),
    phase: 1, patternCd: 2, skillCd: {}, guardBroken: 0, dying: false, dead: false, deathT: 0, specialCd: 3 + game.rng.next() * 3,
  };
  if (o.split) { e.scale *= o.split.scale; e.radius *= o.split.scale; e.hp = e.maxHp = e.maxHp * o.split.hpMult; e.xp *= 0.5; }
  if (o.splitAffix) { e.affixes = e.affixes.filter((a) => a !== 'splitter'); }
  if (e.affixes.includes('shielded')) e.shield = e.maxHp * 0.3;
  if (e.affixes.includes('berserk')) { e.speed *= 1.3; e.dmg *= 1.25; }
  if (boss) { e.phases = (def.phases || 2) + game.diff.bossPhases; e.radius = def.radius; e.scale = def.scale; e.height = 2.3 * def.scale; e.mass = 50; }
  return e;
}

export function addEnemy(game, id, x, z, o) {
  const e = makeEnemy(game, id, x, z, o);
  game.enemies.push(e);
  if (e.boss) { game.bosses.push(e); emit(game, { type: 'bossSpawn', id: e.uid, name: e.def.name, title: e.def.title }); }
  if (e.officer) emit(game, { type: 'officerSpawn', name: e.officer.name, x, z });
  return e;
}

const telegraph = (game, h) => { h.id = game.uid++; h.t = 0; game.hostile.push(h); game.addEffect({ kind: 'danger', hostile: h.id, shape: h.kind, x: h.x, z: h.z, r: h.r, inner: h.inner, angle: h.angle, arc: h.arc, length: h.length, width: h.width, life: h.windup + 0.25, windup: h.windup, safe: h.safe }); return h; };

/** Hostile area attack: telegraph for `windup` seconds then hit the player (and allies) if inside. */
export function hostileStrike(game, o) {
  const tel = game.diff.telegraph;
  return telegraph(game, { ...o, windup: o.windup * tel });
}

function resolveHostile(game, h) {
  const p = game.player;
  const shape = h.kind === 'circle' ? { shape: 'circle', r: h.r } : h.kind === 'ring' ? { shape: 'ring', r: h.r, inner: h.inner } : h.kind === 'arc' ? { shape: 'arc', range: h.r, angle: h.arc } : h.kind === 'line' ? { shape: 'line', length: h.length, width: h.width } : null;
  let hitPlayer = false;
  if (h.kind === 'safe') {
    const safe = h.safe.some((s) => dist2(s.x, s.z, p.x, p.z) < s.r * s.r);
    hitPlayer = !safe;
  } else if (shape) hitPlayer = inShape(shape, h.x, h.z, h.angle || 0, p.x, p.z, 0.4);
  if (hitPlayer && !p.dead) {
    const dealt = damagePlayer(game, h.dmg, { x: h.x, z: h.z, kind: 'aoe', status: h.status, enemy: h.owner });
    if (dealt && h.launch) { p.forced = { sx: p.x, sz: p.z, ex: p.x, ez: p.z, t: 0, dur: 0.45, arc: 1.4 }; }
    if (dealt && h.kb && h.owner) { const a = Math.atan2(p.x - h.x, p.z - h.z); p.forced = { sx: p.x, sz: p.z, ex: clamp(p.x + Math.sin(a) * 3, -game.arena.half, game.arena.half), ez: clamp(p.z + Math.cos(a) * 3, -game.arena.half, game.arena.half), t: 0, dur: 0.25 }; }
    if (dealt && h.owner?.affixes?.includes('vampiric')) h.owner.hp = Math.min(h.owner.maxHp, h.owner.hp + dealt * 2);
    if (h.owner?.boss) game.run.bossHits++;
  }
  for (const a of game.allies) if (shape && inShape(shape, h.x, h.z, h.angle || 0, a.x, a.z, a.radius)) { a.hp -= h.dmg * 1.2; a.flash = 1; }
  game.addEffect({ kind: h.impact || 'hostileImpact', x: h.x, z: h.z, r: h.r || h.width, shape: h.kind, angle: h.angle, length: h.length, width: h.width, arc: h.arc, inner: h.inner, life: 0.5, palette: h.palette || 'danger' });
  if (h.lava) game.hazards.push({ x: h.x, z: h.z, r: h.lava.r, t: h.lava.dur, dmg: h.dmg * 0.15, tick: 0, kind: 'lava' });
  if (h.shake) emit(game, { type: 'shake', a: h.shake });
}

export function updateHostile(game, dt) {
  for (const h of game.hostile) {
    if (h.cancelled) { h.done = true; game.removeEffectWhere((f) => f.hostile === h.id); continue; }
    h.t += dt;
    if (h.moving) { h.x += h.moving.vx * dt; h.z += h.moving.vz * dt; game.updateEffect((f) => f.hostile === h.id, { x: h.x, z: h.z }); }
    if (h.t >= h.windup) { resolveHostile(game, h); h.done = true; }
  }
  game.hostile = game.hostile.filter((h) => !h.done);
  // hazards (poison bogs, lava pools)
  const p = game.player;
  for (const z of game.hazards) {
    z.t -= dt; z.tick -= dt;
    if (z.tick <= 0 && dist2(z.x, z.z, p.x, p.z) < z.r * z.r) { z.tick = 0.5; damagePlayer(game, z.dmg, { kind: 'dot', status: z.kind === 'lava' ? { burn: 1 } : z.kind === 'frost' ? { slow: 1 } : null }); }
    if (!z.fx) { z.fx = true; game.addEffect({ kind: z.kind === 'lava' ? 'lavaPool' : z.kind === 'frost' ? 'frostOrbHazard' : 'poisonBog', x: z.x, z: z.z, r: z.r, life: z.t, palette: 'danger' }); }
  }
  game.hazards = game.hazards.filter((z) => z.t > 0);
}

// ---------------------------------------------------------------- AI
function targetOf(game, e) {
  const p = game.player;
  if (e.status.fear) return null;
  let best = p.dead || p.stealthT > 0 ? null : { x: p.x, z: p.z, ally: null };
  let bd = best ? dist2(e.x, e.z, p.x, p.z) : 1e9;
  const c = game.stage?.crystal;
  if (c && c.hp > 0) { const dc = dist2(e.x, e.z, c.x, c.z); if (dc < 18 * 18 && (bd > 25 || dc < 9)) { best = { x: c.x, z: c.z, ally: null, crystal: true }; bd = dc; } }
  for (const a of game.allies) {
    if (a.hp <= 0) continue;
    const d = dist2(e.x, e.z, a.x, a.z);
    const taunt = a.def.taunt ? a.def.taunt * a.def.taunt : 0;
    if (d < taunt || (d < bd * 0.5 && d < 25)) { if (d < bd || d < taunt) { bd = d; best = { x: a.x, z: a.z, ally: a }; } }
  }
  return best;
}

function enemyAttack(game, e, tgt) {
  const at = e.def.attack, a = e.face;
  const dmg = e.dmg * (e.buffed ? 1.25 : 1);
  if (at.projectile) {
    const pr = spawnProjectile(game, { team: 'enemy', x: e.x, z: e.z, y: 1.2, angle: Math.atan2(tgt.x - e.x, tgt.z - e.z), speed: at.projectile.speed, range: at.range + 4, radius: at.projectile.radius, kind: at.projectile.kind, status: at.projectile.status, enemyDmg: dmg, owner: e, life: 4 });
    emit(game, { type: 'enemyShoot', x: e.x, z: e.z, kind: pr.kind });
    return;
  }
  if (at.explode) {
    hostileStrike(game, { kind: 'circle', x: e.x, z: e.z, r: at.explode.r, windup: 0.05, dmg: dmg, owner: e, impact: 'fireBurst', shake: 0.35 });
    e.hp = 0; e.dying = true; e.state = 'dying'; e.stateT = 0; e.deathStyle = 'burst'; game.corpses.push({ x: e.x, z: e.z, t: game.time });
    emit(game, { type: 'kill', id: e.uid, x: e.x, z: e.z, y: 0, model: e.model, by: 'self' });
    return;
  }
  if (at.aoe || at.cloud) return; // resolved at windup start via telegraph
  // melee: instant check at end of windup (the windup itself was the telegraph via animation + red arc)
  const shape = at.shape === 'circle' ? { shape: 'circle', r: at.r } : { shape: 'arc', range: at.r, angle: at.angle };
  let ox = e.x, oz = e.z;
  if (at.offset) { ox += Math.sin(a) * at.offset; oz += Math.cos(a) * at.offset; }
  const p = game.player;
  if (!tgt.ally && !tgt.crystal && inShape(shape, ox, oz, a, p.x, p.z, 0.45)) {
    const dealt = damagePlayer(game, dmg, { x: e.x, z: e.z, enemy: e, kind: 'melee', status: at.status });
    if (dealt && (at.lifesteal || e.affixes.includes('vampiric') || game.runMods?.enemyLifesteal)) e.hp = Math.min(e.maxHp, e.hp + dealt * (at.lifesteal || 1.5));
    if (dealt && p.staticShield) damageEnemy(game, e, p.staticShield, { source: 'proc', tags: ['storm'], noProc: true });
  }
  if (tgt.ally && inShape(shape, ox, oz, a, tgt.ally.x, tgt.ally.z, tgt.ally.radius)) { tgt.ally.hp -= dmg * 1.5; tgt.ally.flash = 1; }
}

function beginWindup(game, e, tgt) {
  const at = e.def.attack;
  e.state = 'windup'; e.stateT = 0;
  e.face = Math.atan2(tgt.x - e.x, tgt.z - e.z);
  const windup = at.windup * game.diff.telegraph;
  e.windupDur = windup;
  if (at.aoe) {
    const pt = at.aoe.at === 'player' ? { x: tgt.x, z: tgt.z } : { x: e.x + Math.sin(e.face) * (at.aoe.offset || 0), z: e.z + Math.cos(e.face) * (at.aoe.offset || 0) };
    hostileStrike(game, { kind: 'circle', x: pt.x, z: pt.z, r: at.aoe.r * (e.elite ? 1.2 : 1), windup: at.windup, dmg: e.dmg, status: at.aoe.status, owner: e, impact: at.aoe.vfx || 'hostileImpact', shake: e.mass > 3 ? 0.3 : 0 });
  } else if (at.cloud) {
    hostileStrike(game, { kind: 'circle', x: tgt.x, z: tgt.z, r: at.cloud.r, windup: at.windup, dmg: e.dmg * 0.5, owner: e, impact: 'poisonCloud' });
    game.hazards.push({ x: tgt.x, z: tgt.z, r: at.cloud.r, t: at.cloud.dur + at.windup, dmg: e.dmg * 0.25, tick: at.windup, kind: 'poison' });
  } else if (!at.projectile && !at.explode) {
    // melee telegraph: brief red arc so every hit is readable in the crowd
    if (e.elite || e.officer || e.mass >= 2) game.addEffect({ kind: 'danger', shape: at.shape === 'circle' ? 'circle' : 'arc', x: e.x, z: e.z, r: at.r, arc: at.angle, angle: e.face, life: windup + 0.1, windup, follow: e.uid, small: true });
  } else if (at.explode) {
    game.addEffect({ kind: 'danger', shape: 'circle', x: e.x, z: e.z, r: at.explode.r, life: windup + 0.1, windup, follow: e.uid });
  }
}

function enemySpecials(game, e, tgt, d2) {
  const def = e.def;
  e.specialCd -= game.dt;
  if (e.specialCd > 0 || e.status.silence) return false;
  if (def.charge && d2 < def.charge.range * def.charge.range && d2 > 9) {
    e.specialCd = def.charge.cd;
    e.face = Math.atan2(tgt.x - e.x, tgt.z - e.z);
    const len = def.charge.range;
    hostileStrike(game, { kind: 'line', x: e.x, z: e.z, angle: e.face, length: len, width: def.charge.width, windup: def.charge.windup, dmg: e.dmg * 1.3, owner: e, kb: 1 });
    e.state = 'charging'; e.stateT = 0; e.chargeInfo = { windup: def.charge.windup * game.diff.telegraph, speed: def.charge.speed, left: len };
    return true;
  }
  if (def.blink && d2 < def.blink.range * def.blink.range && d2 > 16) {
    e.specialCd = def.blink.cd;
    const p = game.player, a = p.face + Math.PI + game.rng.range(-0.6, 0.6);
    game.addEffect({ kind: 'blink', x: e.x, z: e.z, ex: p.x + Math.sin(a) * 1.8, ez: p.z + Math.cos(a) * 1.8, life: 0.4, palette: 'shadow' });
    e.x = p.x + Math.sin(a) * 1.8; e.z = p.z + Math.cos(a) * 1.8; e.face = Math.atan2(p.x - e.x, p.z - e.z);
    e.atkCd = 0.25;
    return true;
  }
  if (def.summon && game.enemies.length < game.caps.enemies) {
    e.specialCd = def.summon.cd;
    e.state = 'cast'; e.stateT = 0;
    for (let i = 0; i < def.summon.count; i++) { const a = game.rng.angle(); game.spawnQueue.push({ id: def.summon.unit, x: e.x + Math.sin(a) * 2, z: e.z + Math.cos(a) * 2 }); }
    return true;
  }
  if (e.affixes.includes('teleport') && d2 > 64) { e.specialCd = 7; const p = game.player, a = game.rng.angle(); e.x = p.x + Math.sin(a) * 3.5; e.z = p.z + Math.cos(a) * 3.5; game.addEffect({ kind: 'blink', x: e.x, z: e.z, ex: e.x, ez: e.z, life: 0.4, palette: 'arcane' }); return true; }
  if (e.affixes.includes('frozen')) { e.specialCd = 6; const p = game.player; for (let i = 0; i < 3; i++) { const a = game.rng.angle(), r = 2 + game.rng.next() * 4; hostileStrike(game, { kind: 'circle', x: p.x + Math.sin(a) * r, z: p.z + Math.cos(a) * r, r: 1.8, windup: 1.4, dmg: e.dmg * 0.6, status: { freeze: 1 }, owner: e, impact: 'iceBurst' }); } return false; }
  if (e.affixes.includes('chain')) { e.specialCd = 5; const p = game.player; hostileStrike(game, { kind: 'circle', x: p.x, z: p.z, r: 1.8, windup: 1.0, dmg: e.dmg * 0.7, owner: e, impact: 'skyBolt', palette: 'storm' }); return false; }
  if (e.affixes.includes('summoner')) { e.specialCd = 8; for (let i = 0; i < 3; i++) { const a = game.rng.angle(); game.spawnQueue.push({ id: 'skel_minion', x: e.x + Math.sin(a) * 2, z: e.z + Math.cos(a) * 2 }); } return false; }
  if (e.affixes.includes('shielded')) { e.specialCd = 9; e.shield = e.maxHp * 0.25; emit(game, { type: 'enemyShield', id: e.uid }); return false; }
  e.specialCd = 2;
  return false;
}

function updateEnemy(game, e, dt) {
  const p = game.player;
  e.flash = Math.max(0, e.flash - dt * 5);
  e.stateT += dt;
  if (e.dying) { e.deathT += dt; e.y = Math.max(0, e.y + e.vy * dt); e.vy -= 30 * dt; e.x += e.vx * dt; e.z += e.vz * dt; e.vx *= 0.9; e.vz *= 0.9; if (e.deathT > (e.boss ? 3.5 : 1.25)) e.dead = true; return; }
  tickEnemyStatus(game, e, dt);
  if (e.dying) return;
  if (game.runMods?.enemyRegen) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * game.runMods.enemyRegen * dt);
  if (e.affixes.includes('burning')) { e.trailT = (e.trailT || 0) - dt; if (e.trailT <= 0) { e.trailT = 0.6; game.hazards.push({ x: e.x, z: e.z, r: 1.3, t: 3, dmg: e.dmg * 0.2, tick: 0, kind: 'lava' }); } }
  // physics: knockback velocity, airborne
  e.x += e.vx * dt; e.z += e.vz * dt;
  const fr = Math.pow(0.0025, dt);
  e.vx *= fr; e.vz *= fr;
  if (e.airborne) {
    e.y += e.vy * dt; e.vy -= 26 * dt;
    if (e.y <= 0) { e.y = 0; e.vy = 0; e.airborne = false; e.stagger = 0.4; runProcs(game, 'land', { e }); emit(game, { type: 'land', id: e.uid, x: e.x, z: e.z }); }
    return;
  }
  if (e.petrified > 0) { e.petrified -= dt; return; }
  if (e.state === 'spawn') { if (e.stateT >= e.spawnDur) { e.state = 'idle'; e.stateT = 0; } return; }
  if (e.status.freeze || e.status.stun || e.status.timeStop) { if (e.state === 'windup') e.state = 'idle'; return; }
  if (e.stagger > 0) { e.stagger -= dt; if (e.state === 'windup' && !e.elite && !e.officer) e.state = 'idle'; return; }
  const tgt = targetOf(game, e);
  e.atkCd -= dt;
  const slow = e.status.slow ? 1 - e.status.slow.pct : 1;
  const buffMult = e.buffed ? 1.25 : 1;
  const speed = e.speed * slow * buffMult * (game.runMods?.enemySpeed || 1);
  if (e.state === 'windup') {
    if (e.stateT >= e.windupDur) {
      e.state = 'attack'; e.stateT = 0;
      if (tgt && !e.status.silence) enemyAttack(game, e, tgt);
      e.atkCd = e.def.attack.cd * (0.85 + game.rng.next() * 0.3);
    }
    return;
  }
  if (e.state === 'attack') { if (e.stateT >= (e.def.attack.recover || 0.5)) { e.state = 'idle'; e.stateT = 0; } return; }
  if (e.state === 'cast') { if (e.stateT >= 0.9) { e.state = 'idle'; e.stateT = 0; } return; }
  if (e.state === 'charging') {
    const c = e.chargeInfo;
    if (e.stateT < c.windup) return;
    const step = c.speed * dt;
    e.x += Math.sin(e.face) * step; e.z += Math.cos(e.face) * step; c.left -= step;
    if (c.left <= 0) { e.state = 'idle'; e.stateT = 0; e.atkCd = 0.6; }
    return;
  }
  if (!tgt) { // wander / flee
    const a = e.status.fear ? Math.atan2(e.x - p.x, e.z - p.z) : e.wander + Math.sin(game.time * 0.5 + e.seed * 10);
    e.x += Math.sin(a) * speed * 0.5 * dt; e.z += Math.cos(a) * speed * 0.5 * dt; e.face = a; e.state = 'move';
    return;
  }
  const dx = tgt.x - e.x, dz = tgt.z - e.z, d2 = dx * dx + dz * dz, d = Math.sqrt(d2);
  const want = Math.atan2(dx, dz);
  if (enemySpecials(game, e, tgt, d2)) return;
  const at = e.def.attack;
  if (e.def.archetype === 'exploder' && d < at.range) { if (e.state !== 'windup') beginWindup(game, e, tgt); return; }
  const inRange = d <= at.range + (tgt.ally ? tgt.ally.radius : 0);
  if (inRange && e.atkCd <= 0 && !e.status.silence && !(e.blind > 0 && game.rng.next() < 0.5)) { beginWindup(game, e, tgt); return; }
  e.blind = Math.max(0, (e.blind || 0) - dt);
  // movement
  let mvx = 0, mvz = 0;
  const keep = at.keep || 0;
  if (keep && d < keep) { mvx = -dx / d; mvz = -dz / d; }
  else if (!inRange || d > (at.r || 1.5) * 0.7) {
    // flank: crowd members orbit slightly so they surround rather than stack
    const side = ((e.seed * 2 - 1) * 0.7) * (d < 6 ? 1 : 0.3);
    const a = want + side;
    mvx = Math.sin(a); mvz = Math.cos(a);
  }
  if (e.status.root) { mvx = 0; mvz = 0; }
  if (mvx || mvz) { e.x += mvx * speed * dt; e.z += mvz * speed * dt; e.state = d > 9 && e.def.clips.run ? 'run' : 'move'; }
  else e.state = 'idle';
  e.face = turnTowards(e.face, want, 8 * dt);
}

function updateBoss(game, e, dt) {
  const def = e.def, p = game.player;
  // phase transitions
  const ratio = e.hp / e.maxHp;
  const phases = e.phases;
  const nextPhaseAt = 1 - e.phase / phases;
  if (e.phase < phases && ratio <= nextPhaseAt + 1e-6) {
    e.phase++;
    emit(game, { type: 'bossPhase', phase: e.phase, name: def.name });
    emit(game, { type: 'banner', text: e.phase === phases ? '首领狂暴！' : `第 ${e.phase} 阶段`, sub: def.name, style: 'boss' });
    emit(game, { type: 'hitstop', t: 0.2 }); game.slowmo = { t: 0.5, scale: 0.35 };
    e.speed *= 1.12; e.dmg *= 1.12; e.patternCd = 1.2;
    for (const h of game.hostile) if (h.owner === e) h.cancelled = true;
  }
  if (e.state === 'pattern') {
    const pt = e.pattern;
    if (pt.chargeRun && e.stateT >= pt.windup) {
      const step = pt.def.charge.speed * dt;
      e.x += Math.sin(e.face) * step; e.z += Math.cos(e.face) * step; pt.left -= step;
      const half = game.arena.half - 2; e.x = clamp(e.x, -half, half); e.z = clamp(e.z, -half, half);
      if (pt.left <= 0) { e.state = 'recover'; e.stateT = 0; }
      return true;
    }
    if (pt.dashes && e.stateT >= pt.next) {
      const dsh = pt.def.dashes;
      if (pt.dashI < dsh.count) {
        const a = Math.atan2(p.x - e.x, p.z - e.z);
        hostileStrike(game, { kind: 'line', x: e.x, z: e.z, angle: a, length: dsh.length, width: dsh.width, windup: dsh.gap, dmg: e.dmg * pt.def.dmg, owner: e, kb: 1 });
        pt.queue.push({ at: e.stateT + dsh.gap * game.diff.telegraph, a, len: dsh.length });
        pt.dashI++; pt.next = e.stateT + dsh.gap * game.diff.telegraph + 0.08;
      }
    }
    if (pt.queue?.length && e.stateT >= pt.queue[0].at) { const q = pt.queue.shift(); e.face = q.a; e.x = clamp(e.x + Math.sin(q.a) * q.len, -game.arena.half + 2, game.arena.half - 2); e.z = clamp(e.z + Math.cos(q.a) * q.len, -game.arena.half + 2, game.arena.half - 2); game.addEffect({ kind: 'dashTrail', x: e.x - Math.sin(q.a) * q.len, z: e.z - Math.cos(q.a) * q.len, ex: e.x, ez: e.z, life: 0.5, palette: 'shadow' }); }
    if (pt.beams && e.stateT < pt.beams.end) {
      pt.beams.tick -= dt;
      const prog = (e.stateT - pt.windup) / pt.def.beams.dur;
      if (e.stateT >= pt.windup && pt.beams.tick <= 0) {
        pt.beams.tick = 0.2;
        for (let i = 0; i < pt.def.beams.count; i++) {
          const a = pt.beams.base + (i / pt.def.beams.count) * Math.PI * 2 + prog * pt.def.beams.rotate * Math.PI / 180;
          if (inShape({ shape: 'line', length: pt.def.beams.length, width: pt.def.beams.width }, e.x, e.z, a, p.x, p.z, 0.4)) damagePlayer(game, e.dmg * pt.def.dmg, { x: e.x, z: e.z, kind: 'beam', enemy: e });
        }
      }
    }
    if (e.stateT >= pt.dur) { e.state = 'recover'; e.stateT = 0; }
    return true;
  }
  if (e.state === 'recover') { if (e.stateT >= 0.6) { e.state = 'idle'; e.stateT = 0; } return true; }
  e.patternCd -= dt;
  if (e.patternCd > 0 || e.state === 'spawn' || e.status.stun || e.status.silence) return false;
  const avail = def.patterns.filter((x) => (x.phase || 1) <= e.phase && (e.skillCd[x.id] || 0) <= game.time);
  if (!avail.length) return false;
  const pat = game.rng.weighted(avail, (x) => (x.phase === e.phase ? 2 : 1) * x.weight);
  startPattern(game, e, pat);
  return true;
}

function startPattern(game, e, pat) {
  const p = game.player, tel = game.diff.telegraph;
  const windup = pat.windup * tel;
  e.state = 'pattern'; e.stateT = 0;
  e.face = Math.atan2(p.x - e.x, p.z - e.z);
  e.skillCd[pat.id] = game.time + (pat.cd || 4);
  e.patternCd = (pat.cd ? Math.min(pat.cd, 3.2) : 2.4) / (0.85 + e.phase * 0.15);
  const dmg = e.dmg * (pat.dmg || 1);
  const P = { id: pat.id, def: pat, windup, dur: windup + (pat.recover || 0.8), clip: pat.clip };
  e.pattern = P;
  emit(game, { type: 'bossCast', name: pat.name, id: e.uid, clip: pat.clip, windup });
  const base = { owner: e, dmg, status: pat.status, launch: pat.launch, kb: pat.kb, palette: e.def.id.includes('frost') ? 'frost' : e.def.id.includes('lava') || e.def.id.includes('flame') ? 'fire' : 'danger' };
  if (pat.shapes) for (const s of pat.shapes) {
    const at = s.at === 'player' ? { x: p.x, z: p.z } : s.at === 'front' ? { x: e.x + Math.sin(e.face) * (s.offset || 0), z: e.z + Math.cos(e.face) * (s.offset || 0) } : { x: e.x, z: e.z };
    if (pat.leap) { e.leapTo = at; }
    const shape = s.shape === 'ring' ? { kind: 'ring', r: s.r, inner: s.inner } : s.shape === 'arc' ? { kind: 'arc', r: s.r, arc: s.angle } : { kind: 'circle', r: s.r };
    const hits = pat.hits || 1;
    for (let i = 0; i < hits; i++) hostileStrike(game, { ...base, ...shape, x: at.x, z: at.z, angle: e.face, windup: pat.windup + i * 0.45, shake: 0.5, lava: pat.after?.lava });
    if (pat.blink) { e.x = at.x + 2; e.z = at.z + 2; }
  }
  if (pat.leap && e.leapTo) { const t = e.leapTo; game.scheduleBoss?.(windup * 0.8, () => { e.x = t.x; e.z = t.z - 0.5; }); e.leapTo = null; }
  if (pat.charge) { hostileStrike(game, { ...base, kind: 'line', x: e.x, z: e.z, angle: e.face, length: pat.charge.length, width: pat.charge.width, windup: pat.windup }); P.chargeRun = true; P.left = pat.charge.length; P.dur = windup + pat.charge.length / pat.charge.speed + 0.2; }
  if (pat.fan) {
    const f = pat.fan;
    game.scheduleBoss(windup, () => {
      const a0 = Math.atan2(p.x - e.x, p.z - e.z), spread = f.spread * Math.PI / 180;
      for (let i = 0; i < f.count; i++) {
        const a = spread >= 6.2 ? (i / f.count) * Math.PI * 2 : a0 + (f.count > 1 ? (i / (f.count - 1) - 0.5) * spread : 0);
        spawnProjectile(game, { team: 'enemy', x: e.x, z: e.z, y: 1.5, angle: a, speed: f.speed, range: 26, radius: f.radius, kind: f.kind, homing: f.homing, life: f.life || 4, status: pat.status, enemyDmg: dmg, owner: e });
      }
    });
    game.addEffect({ kind: 'danger', shape: 'arc', x: e.x, z: e.z, r: 6, arc: Math.min(359, f.spread), angle: e.face, life: windup, windup, small: true });
  }
  if (pat.rain) {
    const r = pat.rain;
    for (let i = 0; i < r.count; i++) {
      const a = game.rng.angle(), d = i === 0 ? 0 : Math.sqrt(game.rng.next()) * r.area;
      const cx = r.around === 'player' ? p.x : e.x, cz = r.around === 'player' ? p.z : e.z;
      hostileStrike(game, { ...base, kind: 'circle', x: cx + Math.sin(a) * d, z: cz + Math.cos(a) * d, r: r.r, windup: pat.windup + r.delay + i * r.spread, impact: e.def.id.includes('lava') || e.def.id.includes('flame') ? 'meteor' : 'pillarDark' });
    }
    P.dur = windup + r.delay + r.count * r.spread + 0.4;
  }
  if (pat.rings) {
    const rg = pat.rings;
    for (let i = 0; i < rg.count; i++) for (let k = 1; k <= Math.ceil(rg.r / rg.width); k++) {
      const rad = k * rg.width;
      if (k % 2 === (i % 2)) continue;
      hostileStrike(game, { ...base, kind: 'ring', x: e.x, z: e.z, r: rad + rg.width / 2, inner: rad - rg.width / 2, windup: pat.windup + i * rg.gap + rad / rg.speed });
    }
    P.dur = windup + rg.count * rg.gap + rg.r / rg.speed;
  }
  if (pat.lines) {
    const ln = pat.lines;
    for (let i = 0; i < ln.count; i++) {
      const a = ln.aimed ? e.face + (i - (ln.count - 1) / 2) * 0.32 : (i / ln.count) * Math.PI * 2 + game.rng.range(0, 0.5);
      hostileStrike(game, { ...base, kind: 'line', x: e.x, z: e.z, angle: a, length: ln.length, width: ln.width, windup: pat.windup + i * 0.08, impact: 'eruption' });
    }
  }
  if (pat.cross) for (let i = 0; i < 4; i++) hostileStrike(game, { ...base, kind: 'line', x: e.x, z: e.z, angle: e.face + i * Math.PI / 2, length: pat.cross.length, width: pat.cross.width, windup: pat.windup, impact: 'eruption', shake: 0.6 });
  if (pat.safeZones) {
    const sz = pat.safeZones, safe = [];
    for (let i = 0; i < sz.count; i++) { const a = game.rng.angle(), d = 4 + game.rng.next() * sz.area; safe.push({ x: clamp(e.x + Math.sin(a) * d, -game.arena.half + 3, game.arena.half - 3), z: clamp(e.z + Math.cos(a) * d, -game.arena.half + 3, game.arena.half - 3), r: sz.r }); }
    hostileStrike(game, { ...base, kind: 'safe', x: e.x, z: e.z, safe, windup: pat.windup, shake: 1, impact: 'apocalypse' });
    emit(game, { type: 'banner', text: pat.name, sub: '躲进安全区！', style: 'danger' });
  }
  if (pat.beams) P.beams = { base: e.face, tick: 0, end: windup + pat.beams.dur }, P.dur = windup + pat.beams.dur + 0.3, game.addEffect({ kind: 'bossBeams', follow: e.uid, count: pat.beams.count, length: pat.beams.length, width: pat.beams.width, rotate: pat.beams.rotate, base: e.face, windup, dur: pat.beams.dur, life: windup + pat.beams.dur, palette: 'holy' });
  if (pat.dashes) { P.dashes = true; P.dashI = 0; P.next = 0; P.queue = []; P.dur = windup + pat.dashes.count * pat.dashes.gap * tel + 0.6; }
  if (pat.summon) {
    for (let i = 0; i < pat.summon.count; i++) { const a = (i / pat.summon.count) * Math.PI * 2; game.spawnQueue.push({ id: pat.summon.unit, x: e.x + Math.sin(a) * 4, z: e.z + Math.cos(a) * 4, elite: pat.summon.elite }); }
  }
}

// ---------------------------------------------------------------- allies
function updateAlly(game, a, dt) {
  a.t += dt; a.stateT += dt; a.flash = Math.max(0, a.flash - dt * 5);
  if (a.t >= a.dur) a.hp = 0;
  if (a.hp <= 0) return;
  if (a.state === 'spawn') { if (a.stateT > 0.6) { a.state = 'idle'; a.stateT = 0; } return; }
  const p = game.player;
  a.atkCd -= dt;
  // find target
  let best = null, bd = 196;
  game.grid.query(a.x, a.z, 14, (e) => { if (e.dying || e.team !== 'enemy') return; const d = dist2(a.x, a.z, e.x, e.z); if (d < bd) { bd = d; best = e; } });
  const leash = dist2(a.x, a.z, p.x, p.z) > 15 * 15;
  if (best && !leash) {
    const d = Math.sqrt(bd), at = a.def.attack;
    a.face = turnTowards(a.face, Math.atan2(best.x - a.x, best.z - a.z), 10 * dt);
    if (at && d <= at.range + best.radius) {
      a.state = 'attack';
      if (a.atkCd <= 0) {
        a.atkCd = at.cd; a.stateT = 0;
        const coef = a.def.dmg * a.power;
        if (at.projectile) spawnProjectile(game, { x: a.x, z: a.z, angle: a.face, speed: 24, range: 13, radius: 0.5, homing: 3, dmg: coef, kind: 'star', source: 'summon', tags: ['arcane'] });
        else {
          const shape = at.angle >= 360 ? { shape: 'circle', r: at.r } : { shape: 'arc', range: at.r, angle: at.angle };
          game.grid.query(a.x, a.z, at.r + 2, (e) => { if (!e.dying && e.team === 'enemy' && inShape(shape, a.x, a.z, a.face, e.x, e.z, e.radius)) { damageEnemy(game, e, coef, { source: 'summon', kb: 1.5, stun: at.stun, status: at.status, fromX: a.x, fromZ: a.z }); if (game.procIndex?.beastLightning && game.rng.next() < 0.3) damageEnemy(game, e, game.procIndex.beastLightning.dmg, { source: 'proc', tags: ['storm'], noProc: true }); } });
        }
        emit(game, { type: 'allyAttack', id: a.uid });
      }
    } else if (a.def.speed > 0) { a.state = 'move'; a.x += Math.sin(a.face) * a.def.speed * dt; a.z += Math.cos(a.face) * a.def.speed * dt; }
  } else if (a.def.speed > 0) {
    const d = Math.sqrt(dist2(a.x, a.z, p.x, p.z));
    if (d > 3.5) { a.face = turnTowards(a.face, Math.atan2(p.x - a.x, p.z - a.z), 8 * dt); a.x += Math.sin(a.face) * a.def.speed * 1.2 * dt; a.z += Math.cos(a.face) * a.def.speed * 1.2 * dt; a.state = 'move'; }
    else a.state = 'idle';
  }
}

// ---------------------------------------------------------------- separation & bookkeeping
export function updateEnemies(game, dt) {
  const p = game.player;
  // banner aura
  for (const e of game.enemies) e.buffed = false;
  for (const e of game.enemies) if (e.def.aura && !e.dying) game.grid.query(e.x, e.z, e.def.aura.r, (o) => { if (o !== e && o.team === 'enemy' && dist2(e.x, e.z, o.x, o.z) < e.def.aura.r ** 2) o.buffed = true; });
  for (const e of game.enemies) {
    if (e.boss && !e.dying) {
      e.flash = Math.max(0, e.flash - dt * 5); e.stateT += dt; tickEnemyStatus(game, e, dt);
      if (e.dying) continue;
      if (e.state === 'spawn') { if (e.stateT > e.spawnDur) { e.state = 'idle'; e.stateT = 0; } continue; }
      if (!updateBoss(game, e, dt)) {
        const d = Math.sqrt(dist2(e.x, e.z, p.x, p.z));
        e.face = turnTowards(e.face, Math.atan2(p.x - e.x, p.z - e.z), 4 * dt);
        if (d > 3.2 && !e.status.stun) { const sp = e.speed * (e.status.slow ? 0.7 : 1); e.x += Math.sin(e.face) * sp * dt; e.z += Math.cos(e.face) * sp * dt; e.state = 'move'; } else e.state = 'idle';
      }
      continue;
    }
    updateEnemy(game, e, dt);
  }
  for (const a of game.allies) updateAlly(game, a, dt);
  game.allies = game.allies.filter((a) => { if (a.hp <= 0) { game.addEffect({ kind: 'allyFade', x: a.x, z: a.z, life: 0.5, palette: 'shadow' }); return false; } return true; });
  // separation (enemies vs enemies, vs player, vs obstacles, vs walls)
  const half = game.arena.half - 0.5;
  for (const e of game.enemies) {
    if (e.dying) continue;
    let px = 0, pz = 0;
    game.grid.query(e.x, e.z, e.radius + 1.6, (o) => {
      if (o === e || o.dying || o.team !== 'enemy') return;
      const dx = e.x - o.x, dz = e.z - o.z, rr = e.radius + o.radius, d2 = dx * dx + dz * dz;
      if (d2 >= rr * rr || d2 < 1e-6) return;
      const d = Math.sqrt(d2), push = (rr - d) * (o.mass / (e.mass + o.mass));
      px += (dx / d) * push; pz += (dz / d) * push;
    });
    e.x += px * 0.6; e.z += pz * 0.6;
    if (!e.airborne) {
      const dx = e.x - p.x, dz = e.z - p.z, rr = e.radius + 0.55, d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 1e-6 && !p.dead) { const d = Math.sqrt(d2); e.x = p.x + (dx / d) * rr; e.z = p.z + (dz / d) * rr; }
    }
    if (!e.def.fly) {
      for (const o of game.obstacles) { const dx = e.x - o.x, dz = e.z - o.z, rr = o.r + e.radius, d2 = dx * dx + dz * dz; if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2); e.x = o.x + (dx / d) * rr; e.z = o.z + (dz / d) * rr; } }
      for (const w of game.walls) pushFromSegment(e, w);
    }
    if (e.x < -half) e.x = -half; if (e.x > half) e.x = half; if (e.z < -half) e.z = -half; if (e.z > half) e.z = half;
  }
  game.enemies = game.enemies.filter((e) => !e.dead);
  game.bosses = game.bosses.filter((b) => !b.dead);
}

function pushFromSegment(e, w) {
  const vx = w.x2 - w.x1, vz = w.z2 - w.z1, len2 = vx * vx + vz * vz;
  const t = clamp(((e.x - w.x1) * vx + (e.z - w.z1) * vz) / len2, 0, 1);
  const cx = w.x1 + vx * t, cz = w.z1 + vz * t;
  const dx = e.x - cx, dz = e.z - cz, rr = w.r + e.radius, d2 = dx * dx + dz * dz;
  if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2); e.x = cx + (dx / d) * rr; e.z = cz + (dz / d) * rr; }
}

export function rollAffixes(game, n) {
  const ids = game.rng.shuffle(Object.keys(AFFIX));
  return ids.slice(0, n);
}
export { isElite, applyStatus };
