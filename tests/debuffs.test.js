import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createGame, updateGame } from '../src/game/sim.js';
import { addEnemy } from '../src/game/enemies.js';
import { applyDebuff, hasDebuff, debuffStacks } from '../src/game/debuffs.js';
import { DEBUFFS, DEBUFF } from '../src/game/content/debuffs.js';
import { ENEMIES } from '../src/game/content/enemies.js';
import { CHAPTERS } from '../src/game/content/stages.js';
import { ICON_COVERAGE } from '../src/ui/icons.js';

const manifest = JSON.parse(readFileSync(new URL('../public/assets/models/manifest.json', import.meta.url)));

// Quiet arena: no director spawns, hero standing at the origin.
function arena(seed = 1, o = {}) {
  const g = createGame({ mode: 'endless', hero: 'knight', seed, starter: false, difficulty: 'normal', ...o });
  g.caps.enemies = 0;
  updateGame(g, 1 / 60, {});
  g.player.invuln = 0; g.player.x = 0; g.player.z = 0; g.player.hp = g.stats.maxHp;
  return g;
}
function step(g, seconds, input = () => ({})) {
  const dt = 1 / 60;
  for (let t = 0; t < seconds; t += dt) { updateGame(g, dt, input(t, g) || {}); if (g.status === 'draft') g.status = 'playing'; }
  return g;
}
const special = ENEMIES.filter((e) => e.special);

test('special enemies: content, models, clips, icons and chapter placement', () => {
  assert.equal(special.length, 15);
  const spawned = new Set(CHAPTERS.flatMap((c) => c.spawn.map((r) => r[0])));
  for (const e of special) {
    assert.ok(e.debuffs?.length, `${e.id} lists its debuffs`);
    for (const d of e.debuffs) assert.ok(DEBUFF[d], `${e.id} debuff ${d}`);
    assert.ok(spawned.has(e.id), `${e.id} appears in a chapter`);
    assert.ok(ICON_COVERAGE.enemies[e.id], `${e.id} icon`);
    assert.ok(manifest.assets[e.model], `${e.id} model`);
    if (e.rig === 'og') for (const k of ['idle', 'move', 'attack', 'hit', 'death', 'spawn', 'cast']) assert.ok(manifest.assets[e.model].clips.includes(e.clips[k]), `${e.id} clip ${e.clips[k]}`);
  }
  for (const d of DEBUFFS) assert.ok(ICON_COVERAGE.debuffs[d.id], `debuff icon ${d.id}`);
});

test('stacking debuffs convert at max stacks: webs bind, frostbite freezes', () => {
  const g = arena();
  for (let i = 0; i < 3; i++) applyDebuff(g, 'webbed', 1);
  assert.ok(hasDebuff(g.player, 'root'));
  assert.equal(debuffStacks(g.player, 'webbed'), 0);
  for (let i = 0; i < 5; i++) applyDebuff(g, 'frostbite', 1);
  assert.ok(hasDebuff(g.player, 'freeze'));
  applyDebuff(g, 'poison', 30);
  assert.equal(debuffStacks(g.player, 'poison'), DEBUFF.poison.max);
});

test('crowd-control immunity blocks CC debuffs; musou breaks them; holy water cleanses everything', () => {
  const g = arena();
  g.player.buffCcImmune = 5;
  assert.equal(applyDebuff(g, 'fear', 2), false);
  assert.equal(applyDebuff(g, 'poison', 2), true);
  g.player.buffCcImmune = 0;
  applyDebuff(g, 'hex', 2);
  g.player.musou = 100;
  step(g, 0.1, () => ({ pressed: { musou: true } }));
  assert.ok(!hasDebuff(g.player, 'hex'));
  assert.equal(g.player.state, 'musou');
  const h = arena(2);
  applyDebuff(h, 'bomb', 1, { dmg: 50 }); applyDebuff(h, 'poison', 3); applyDebuff(h, 'silence', 3);
  h.inventory.belt[0] = { id: 'k_holy_water', count: 1 };
  step(h, 0.05, () => ({ pressed: { belt0: true } }));
  assert.deepEqual(Object.keys(h.player.debuffs), []);
});

test('time bomb hurts on detonation unless the hero is dodging at that moment', () => {
  const g = arena(3);
  const hp0 = g.player.hp;
  applyDebuff(g, 'bomb', 1, { dmg: 120 });
  step(g, DEBUFF.bomb.dur + 0.2);
  assert.ok(g.player.hp < hp0 - 20, `bomb hit ${hp0 - g.player.hp}`);
  const h = arena(3);
  const hp1 = h.player.hp;
  applyDebuff(h, 'bomb', 1, { dmg: 120 });
  step(h, DEBUFF.bomb.dur + 0.2, (t) => ({ move: { x: 1, z: 0 }, pressed: { dodge: t > DEBUFF.bomb.dur - 0.12 && t < DEBUFF.bomb.dur - 0.08 } }));
  assert.ok(h.player.hp > hp1 - 5, `dodged bomb ${hp1 - h.player.hp}`);
});

test('confusion inverts movement; hex blocks attacks', () => {
  const g = arena(4);
  applyDebuff(g, 'confuse', 3);
  step(g, 0.5, () => ({ move: { x: 1, z: 0 } }));
  assert.ok(g.player.x < -0.5, `confused x ${g.player.x}`);
  const h = arena(5);
  applyDebuff(h, 'hex', 2);
  const seen = [];
  step(h, 0.4, (t, game) => { for (const ev of game.events) if (ev.type === 'attack') seen.push(ev); return { pressed: { light: true } }; });
  assert.equal(seen.length, 0);
});

test('basilisk gaze petrifies a hero who stays in the cone; leaving the cone avoids it', () => {
  const g = arena(6);
  const b = addEnemy(g, 'basilisk', 0, 6, { noSpawnAnim: true }); b.abCd = 0; b.atkCd = 99;
  const fx = [];
  step(g, 3.2, (t, game) => { for (const f of game.effects) if (f.kind === 'gazeCone' && !fx.includes(f)) fx.push(f); });
  assert.ok(fx.length && fx[0].r === b.def.ability.r && fx[0].arc === b.def.ability.angle, 'gaze telegraph matches its hit cone');
  assert.ok(g.events.length >= 0 && (hasDebuff(g.player, 'petrify') || g.player.gazeImmune > 0), 'petrified');
  const h = arena(6);
  const c = addEnemy(h, 'basilisk', 0, 6, { noSpawnAnim: true }); c.abCd = 0; c.atkCd = 99;
  step(h, 3.2, (t) => ({ move: t > 0.3 ? { x: 1, z: -1 } : { x: 0, z: 0 } }));
  assert.ok(!hasDebuff(h.player, 'petrify') && !(h.player.gazeImmune > 0), 'escaped the gaze');
});

test('soul tether drains musou and breaks at range; jailer hook pulls; banshee scream fears', () => {
  const g = arena(7);
  const w = addEnemy(g, 'soul_wraith', 0, 5, { noSpawnAnim: true }); w.abCd = 0; w.atkCd = 99;
  g.player.musou = 80;
  step(g, 1.6);
  assert.ok(hasDebuff(g.player, 'tether'), 'tethered');
  assert.ok(g.player.musou < 80, `musou drained ${g.player.musou}`);
  g.player.x = 30; g.player.z = 0;
  step(g, 0.2);
  assert.ok(!hasDebuff(g.player, 'tether'), 'tether broke at range');

  const h = arena(8);
  const j = addEnemy(h, 'chain_jailer', 0, 9, { noSpawnAnim: true }); j.abCd = 0; j.atkCd = 99;
  step(h, 1.4);
  assert.ok(Math.hypot(h.player.x - j.x, h.player.z - j.z) < 3.5, `pulled to ${h.player.x.toFixed(2)},${h.player.z.toFixed(2)} jailer ${j.x.toFixed(2)},${j.z.toFixed(2)}`);

  const k = arena(9);
  const s = addEnemy(k, 'banshee', 0, 3.5, { noSpawnAnim: true }); s.abCd = 0; s.atkCd = 99;
  step(k, 1.3);
  assert.ok(hasDebuff(k.player, 'fear'), 'feared');
  const z0 = k.player.z;
  step(k, 0.5);
  assert.ok(k.player.z < z0 - 0.5, 'flees away from the banshee');
});
