// Spawn director + stage objectives (adventure battles, endless waves, daily trial).
import { ENEMY, BOSS, OFFICER_NAMES, OFFICER_TITLES } from './content/enemies.js';
import { CHAPTERS, ENDLESS, MUTATIONS, OBJECTIVES } from './content/stages.js';
import { RUNES } from './content/items.js';
import { addEnemy, rollAffixes } from './enemies.js';
import { emit, isElite } from './combat.js';
import { dist2, clamp } from './util.js';

export function computeScaling(game) {
  const d = game.diff, ch = game.chapter || CHAPTERS[0];
  const curse = game.chapterCurse || {};
  const mods = game.runMods || {};
  let hp = d.hp * ch.hpScale * (1 + (game.nodeDepth || 0) * 0.13) * (1 + (curse.enemyHp || 0)) * (1 + (mods.enemyHp || 0));
  let dmg = d.dmg * ch.dmgScale * (1 + (game.nodeDepth || 0) * 0.07) * (1 + (mods.enemyDmg || 0));
  if (game.mode !== 'adventure') {
    const w = game.wave || 1;
    hp = d.hp * Math.pow(1.14, w - 1) * (1 + (mods.enemyHp || 0));
    dmg = d.dmg * Math.pow(1.075, w - 1) * (1 + (mods.enemyDmg || 0));
  }
  const timeRamp = 1 + Math.min(0.6, game.stageTime / 300);
  game.scaling = { hp: hp * timeRamp, dmg: dmg * (1 + (timeRamp - 1) * 0.5), speed: 1 + (mods.enemySpeed || 0), def: (mods.enemyDef || 0), bossHp: (game.mode === 'adventure' ? 3.6 : 2.6) * (d.id === 'easy' ? 0.75 : 1) };
}

export function arenaFor(game) {
  const half = game.mode === 'endless' || game.mode === 'daily' ? 38 : game.stage?.objective?.type === 'escape' ? 34 : 30;
  return { half };
}

/** Build obstacle layout (prop circles) for the arena; kept clear around spawn and objective points. */
export function layoutArena(game, biome) {
  const rng = game.rng.fork();
  const half = game.arena.half;
  const obstacles = [];
  const keepClear = [{ x: 0, z: 0, r: 9 }, ...(game.stage?.points || []).map((p) => ({ x: p.x, z: p.z, r: 7 }))];
  const n = Math.round(half * 0.55);
  for (let i = 0; i < n * 3 && obstacles.length < n; i++) {
    const x = rng.range(-half + 3, half - 3), z = rng.range(-half + 3, half - 3);
    if (keepClear.some((k) => dist2(k.x, k.z, x, z) < k.r * k.r)) continue;
    if (obstacles.some((o) => dist2(o.x, o.z, x, z) < 49)) continue;
    const prop = rng.pick(biome.props);
    const r = /wall|barrier/.test(prop) ? 1.6 : /rubble|pillar|column|trunk|crates|keg|barrel/.test(prop) ? 1.1 : 0.8;
    obstacles.push({ x, z, r, prop, rot: rng.angle(), scale: rng.range(0.9, 1.25) });
  }
  // decorative-only props near the border (no collision)
  const decor = [];
  for (let i = 0; i < half * 1.2; i++) {
    const side = rng.int(0, 3), t = rng.range(-half, half), off = half + rng.range(1, 6);
    const x = side === 0 ? t : side === 1 ? t : side === 2 ? off : -off, z = side === 0 ? off : side === 1 ? -off : t;
    decor.push({ x, z, prop: rng.pick(biome.props), rot: rng.angle(), scale: rng.range(0.85, 1.3) });
  }
  game.obstacles = obstacles;
  game.decor = decor;
}

// ---------------------------------------------------------------- stages
export function createStage(game, node) {
  const ch = game.chapter;
  const type = node.type === 'boss' ? 'boss' : node.type === 'elite' ? 'elite' : node.objective || 'slay';
  const depth = game.nodeDepth || 0;
  const obj = { type };
  const half = 30;
  if (type === 'slay') obj.count = Math.round((850 + depth * 140) * game.diff.density);
  if (type === 'officers') obj.count = 4 + Math.floor(depth / 2);
  if (type === 'capture') obj.count = 3;
  if (type === 'defend') obj.time = 75 + depth * 5;
  if (type === 'survive') obj.time = 90 + depth * 6;
  if (type === 'boss') { obj.boss = ch.boss; obj.bossName = BOSS[ch.boss].name; }
  const stage = { node, objective: obj, progress: 0, points: [], spawnT: 1.5, officerT: 12, runeT: 35, cleared: false, introT: 2.2 };
  if (type === 'capture') {
    const pts = [[-half * 0.55, half * 0.45], [half * 0.6, half * 0.2], [-half * 0.1, -half * 0.6]];
    stage.points = pts.map(([x, z], i) => ({ x, z, r: 5.5, progress: 0, captured: false, id: i, guarded: false }));
  }
  if (type === 'defend') stage.crystal = { x: 0, z: 2, hp: 3000 * game.scaling?.hp || 3000, maxHp: 0, r: 1.6 };
  if (type === 'escape') stage.portal = { x: 0, z: 30, r: 3.5 };
  return stage;
}

export function startStage(game, stage) {
  game.stage = stage;
  game.stageTime = 0;
  game.killsThisStage = 0;
  game.stageIndex = (game.stageIndex || 0) + 1;
  game.arena = arenaFor(game);
  if (stage.objective.type === 'escape') { stage.portal.z = game.arena.half - 5; game.player.x = 0; game.player.z = -game.arena.half + 5; }
  else { game.player.x = 0; game.player.z = stage.objective.type === 'defend' ? -2 : 0; }
  computeScaling(game);
  if (stage.crystal) { stage.crystal.maxHp = 260 * game.scaling.dmg * (1 + (game.nodeDepth || 0) * 0.15) * 12; stage.crystal.hp = stage.crystal.maxHp; }
  layoutArena(game, game.biome);
  const o = stage.objective;
  emit(game, { type: 'stageStart', name: OBJECTIVES[o.type].name, desc: OBJECTIVES[o.type].desc(o), glyph: OBJECTIVES[o.type].icon });
  if (o.type === 'boss') game.scheduleBoss(2.2, () => spawnBoss(game, o.boss));
  if (o.type === 'elite') game.scheduleBoss(2, () => spawnEliteBoss(game));
  if (o.type === 'capture') for (const pt of stage.points) game.scheduleBoss(1, () => { spawnOfficer(game, pt.x, pt.z); spawnSquad(game, 8, pt.x, pt.z); });
}

export function spawnBoss(game, id) {
  const p = game.player, a = game.rng.angle();
  const b = addEnemy(game, id, clamp(p.x + Math.sin(a) * 12, -game.arena.half + 4, game.arena.half - 4), clamp(p.z + Math.cos(a) * 12, -game.arena.half + 4, game.arena.half - 4));
  if (BOSS[id].twin) { const t = addEnemy(game, BOSS[id].twin, b.x + 4, b.z + 4); t.twinOf = b; b.twinOf = t; }
  emit(game, { type: 'banner', text: BOSS[id].name, sub: BOSS[id].title, style: 'bossIntro' });
  game.bossFightStart = game.time;
  game.run.bossHits = 0;
  return b;
}

function spawnEliteBoss(game) {
  const ch = game.chapter;
  const id = game.rng.pick(ch.elites);
  const p = game.player, a = game.rng.angle();
  const e = addEnemy(game, id, p.x + Math.sin(a) * 11, p.z + Math.cos(a) * 11, { elite: true, officer: { name: `精英首领·${game.rng.pick(OFFICER_NAMES)}` }, affixes: rollAffixes(game, Math.max(1, game.diff.affixes[1] + 1)), hpMult: 1.8 });
  game.stage.eliteBoss = e;
  emit(game, { type: 'banner', text: '精英首领出现', sub: e.officer.name, style: 'danger' });
}

function spawnOfficer(game, x, z) {
  const ch = game.chapter || CHAPTERS[0];
  const id = game.rng.pick(ch?.elites || ['bone_giant']);
  const name = `${game.rng.pick(OFFICER_TITLES)}·${game.rng.pick(OFFICER_NAMES)}`;
  const nAff = game.diff.affixes[0] + (game.rng.next() < 0.5 ? 1 : 0);
  return addEnemy(game, id, x, z, { officer: { name }, affixes: rollAffixes(game, nAff) });
}

function spawnPoint(game, near) {
  const p = game.player, half = game.arena.half - 1.5;
  for (let i = 0; i < 12; i++) {
    const a = game.rng.angle(), d = near ? game.rng.range(2, 6) : game.rng.range(17, 26);
    const cx = near ? near.x : p.x, cz = near ? near.z : p.z;
    const x = clamp(cx + Math.sin(a) * d, -half, half), z = clamp(cz + Math.cos(a) * d, -half, half);
    if (!near && dist2(x, z, p.x, p.z) < 100) continue;
    if (game.obstacles.some((o) => dist2(o.x, o.z, x, z) < (o.r + 1.5) ** 2)) continue;
    return { x, z };
  }
  return { x: clamp(p.x + 20, -half, half), z: clamp(p.z, -half, half) };
}

function pickEnemy(game) {
  const table = game.spawnTable;
  const t = game.mode === 'adventure' ? game.stageTime + (game.nodeDepth || 0) * 30 : (game.wave || 1) * 25;
  const rows = table.filter((r) => r[1] <= t);
  return game.rng.weighted(rows, (r) => r[2])[0];
}

function spawnSquad(game, size, cx, cz) {
  const center = cx != null ? { x: cx, z: cz } : spawnPoint(game);
  const kind = pickEnemy(game);
  const eliteChance = 0.035 * game.diff.elite * (1 + (game.runMods?.elite || 0)) * (game.mode === 'adventure' ? 1 + (game.nodeDepth || 0) * 0.1 : 1 + (game.wave || 1) * 0.04);
  for (let i = 0; i < size; i++) {
    if (game.enemies.length >= game.caps.enemies) break;
    const a = game.rng.angle(), r = Math.sqrt(game.rng.next()) * (1.5 + size * 0.18);
    const id = i < size * 0.7 ? kind : pickEnemy(game);
    const elite = game.rng.next() < eliteChance;
    const [lo, hi] = game.diff.affixes;
    addEnemy(game, id, center.x + Math.sin(a) * r, center.z + Math.cos(a) * r, elite ? { elite: true, affixes: rollAffixes(game, game.rng.int(lo, hi)) } : {});
  }
  game.addEffect({ kind: 'spawnPortal', x: center.x, z: center.z, r: 2.4, life: 1.2, palette: 'danger' });
}

function targetCount(game) {
  const base = game.mode === 'adventure' ? 70 + (game.nodeDepth || 0) * 12 + Math.min(80, game.stageTime * 0.6) : 80 + Math.min(160, (game.wave || 1) * 9);
  return Math.min(game.caps.enemies, Math.round(base * game.diff.density * (1 + (game.runMods?.density || 0))));
}

export function updateDirector(game, dt) {
  const st = game.stage;
  if (!st || st.cleared) return;
  game.stageTime += dt;
  if (st.introT > 0) { st.introT -= dt; return; }
  if (Math.floor(game.stageTime) % 5 === 0 && Math.floor(game.stageTime - dt) % 5 !== 0) computeScaling(game);
  // queued spawns from summons / splits
  for (const q of game.spawnQueue.splice(0)) if (game.enemies.length < game.caps.enemies + 20) addEnemy(game, q.id, q.x, q.z, { split: q.split, splitAffix: q.splitAffix, noSpawnAnim: q.noSpawnAnim, hpMult: q.hpMult, elite: q.elite });
  const o = st.objective;
  const fighting = o.type !== 'boss' || game.bosses.length > 0;
  // regular squads
  st.spawnT -= dt;
  const want = targetCount(game) * (o.type === 'boss' ? 0.45 : o.type === 'elite' ? 0.6 : 1);
  const alive = game.enemies.filter((e) => !e.dying && !e.boss).length;
  if (st.spawnT <= 0 && alive < want && fighting) {
    st.spawnT = game.rng.range(0.6, 1.3);
    let near = null;
    if (o.type === 'capture') { const open = st.points.filter((p) => !p.captured); if (open.length && game.rng.next() < 0.5) near = game.rng.pick(open); }
    if (o.type === 'escape' && game.rng.next() < 0.5) { const p = game.player; near = { x: p.x + game.rng.range(-10, 10), z: Math.min(st.portal.z - 3, p.z + 14) }; }
    spawnSquad(game, Math.round(game.rng.range(6, 13) * (want - alive > 40 ? 1.4 : 1)), near?.x, near?.z);
  }
  // officers
  st.officerT -= dt;
  if (st.officerT <= 0 && fighting) {
    st.officerT = o.type === 'officers' ? 18 : 55;
    if (o.type !== 'officers' || (st.officersSpawned || 0) < o.count) { const sp = spawnPoint(game); spawnOfficer(game, sp.x, sp.z); spawnSquad(game, 10, sp.x, sp.z); st.officersSpawned = (st.officersSpawned || 0) + 1; }
  }
  // runes
  st.runeT -= dt;
  if (st.runeT <= 0) { st.runeT = 50; spawnRune(game); }
  updateObjective(game, dt);
}

export function spawnRune(game) {
  const p = game.player, half = game.arena.half - 3;
  const a = game.rng.angle(), d = game.rng.range(8, 16);
  const rune = game.rng.pick(RUNES);
  game.pickups.push({ uid: game.uid++, kind: 'rune', item: rune.id, x: clamp(p.x + Math.sin(a) * d, -half, half), z: clamp(p.z + Math.cos(a) * d, -half, half), y: 0.8, vx: 0, vz: 0, vy: 0, t: 0, value: 0, persistent: true });
  emit(game, { type: 'runeSpawn', name: rune.name, color: rune.color });
}

function updateObjective(game, dt) {
  const st = game.stage, o = st.objective, p = game.player;
  switch (o.type) {
    case 'slay': st.progress = game.killsThisStage / o.count; break;
    case 'officers': st.progress = (st.officersKilled || 0) / o.count; break;
    case 'capture': {
      for (const pt of st.points) {
        if (pt.captured) continue;
        const inside = dist2(pt.x, pt.z, p.x, p.z) < pt.r * pt.r;
        let crowd = 0; game.grid.query(pt.x, pt.z, pt.r, (e) => { if (!e.dying && e.team === 'enemy' && dist2(pt.x, pt.z, e.x, e.z) < pt.r * pt.r) crowd++; });
        if (inside) pt.progress = Math.min(1, pt.progress + dt / (12 + Math.min(12, crowd * 0.35)));
        else pt.progress = Math.max(0, pt.progress - dt * 0.05);
        if (pt.progress >= 1) { pt.captured = true; emit(game, { type: 'banner', text: '据点攻占！', sub: `${st.points.filter((x) => x.captured).length} / ${st.points.length}`, style: 'objective' }); game.addXp(game.xpToNext() * 0.25); }
      }
      st.progress = st.points.filter((x) => x.captured).length / st.points.length;
      break;
    }
    case 'defend': {
      const c = st.crystal;
      st.progress = game.stageTime / o.time;
      game.grid.query(c.x, c.z, 3.4, (e) => { if (!e.dying && e.team === 'enemy' && e.state === 'attack' && e.stateT < dt * 1.5) { c.hp -= e.dmg * 0.25; c.hitT = 0.2; } });
      if (c.hp <= 0) { emit(game, { type: 'banner', text: '水晶被摧毁', sub: '守护失败', style: 'danger' }); game.fail('crystal'); }
      break;
    }
    case 'survive': st.progress = game.stageTime / o.time; break;
    case 'escape': {
      const start = -game.arena.half + 5;
      st.progress = clamp((p.z - start) / (st.portal.z - start), 0, 1);
      if (dist2(p.x, p.z, st.portal.x, st.portal.z) < st.portal.r * st.portal.r) st.progress = 1;
      break;
    }
    case 'elite': st.progress = st.eliteBoss ? 1 - Math.max(0, st.eliteBoss.hp) / st.eliteBoss.maxHp : 0; if (st.eliteBoss?.dying) st.progress = 1; break;
    case 'boss': { const b = game.bosses; st.progress = game.bossesKilled ? 1 : b.length ? 1 - b.reduce((s, x) => s + Math.max(0, x.hp), 0) / b.reduce((s, x) => s + x.maxHp, 0) : 0; if (game.stageTime > 4 && !b.length && game.bossesKilled) st.progress = 1; break; }
    default: break;
  }
  if (st.progress >= 1 && !st.cleared) clearStage(game);
}

export function clearStage(game) {
  const st = game.stage;
  st.cleared = true;
  game.clearAt = game.time + 2.6;
  const reward = Math.round((180 + (game.nodeDepth || 0) * 60) * game.diff.reward * (1 + game.stats.goldGain) * (st.objective.type === 'boss' ? 3 : st.objective.type === 'elite' ? 1.6 : 1));
  game.inventory.gold += reward; game.run.goldEarned += reward;
  emit(game, { type: 'banner', text: st.objective.type === 'boss' ? '首领讨伐成功！' : '关卡完成！', sub: `+${reward} 金币`, style: 'clear' });
  emit(game, { type: 'stageClear' });
  for (const e of game.enemies) if (!e.dying && !e.boss) { e.hp = 0; e.dying = true; e.state = 'dying'; e.stateT = 0; e.deathStyle = 1; }
  for (const pk of game.pickups) pk.vacuum = true;
  game.hostile.length = 0; game.hazards.length = 0;
  game.addXp(game.xpToNext() * 0.35);
}

// ---------------------------------------------------------------- endless / daily
export function updateEndless(game, dt) {
  const w = game.endless;
  game.stageTime += dt;
  w.t += dt;
  for (const q of game.spawnQueue.splice(0)) if (game.enemies.length < game.caps.enemies + 20) addEnemy(game, q.id, q.x, q.z, { split: q.split, splitAffix: q.splitAffix, noSpawnAnim: q.noSpawnAnim, hpMult: q.hpMult, elite: q.elite });
  if (game.mode === 'daily') { game.stage.progress = game.stageTime / 600; if (game.stageTime >= 600 && !game.stage.cleared) { clearStage(game); game.dailyWon = true; } }
  if (w.t >= ENDLESS.waveTime && !game.bosses.length) {
    w.t = 0; game.wave++;
    computeScaling(game);
    emit(game, { type: 'wave', wave: game.wave });
    if (game.wave % ENDLESS.mutateEvery === 0) {
      const m = game.rng.pick(MUTATIONS.filter((x) => !w.mutations.includes(x.id)));
      if (m) { w.mutations.push(m.id); for (const k in m.mod) game.runMods[k] = (game.runMods[k] || 0) + m.mod[k]; emit(game, { type: 'banner', text: `变异：${m.name}`, sub: m.desc, style: 'danger' }); }
    }
    if (game.wave % 6 === 0) { const biome = ENDLESS.biomeCycle[Math.floor(game.wave / 6) % ENDLESS.biomeCycle.length]; game.setBiome?.(biome); }
    if (game.wave % ENDLESS.bossEvery === 0) { const id = ENDLESS.bosses[Math.floor(game.wave / ENDLESS.bossEvery - 1) % ENDLESS.bosses.length]; spawnBoss(game, id); }
    for (const pk of game.pickups) if (pk.kind === 'xp' || pk.kind === 'gold') pk.vacuum = true;
  }
  const st = game.stage;
  st.spawnT -= dt;
  const want = targetCount(game) * (game.bosses.length ? 0.5 : 1);
  const alive = game.enemies.filter((e) => !e.dying && !e.boss).length;
  if (st.spawnT <= 0 && alive < want) { st.spawnT = game.rng.range(0.5, 1.1); spawnSquad(game, Math.round(game.rng.range(7, 14))); }
  st.officerT -= dt;
  if (st.officerT <= 0) { st.officerT = 40; const sp = spawnPoint(game); spawnOfficer(game, sp.x, sp.z); }
  st.runeT -= dt;
  if (st.runeT <= 0) { st.runeT = 45; spawnRune(game); }
}

export { isElite, ENEMY };
