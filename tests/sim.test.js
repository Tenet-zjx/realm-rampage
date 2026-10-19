import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, updateGame, actions } from '../src/game/sim.js';
import { createRng } from '../src/game/rng.js';
import { addSkill } from '../src/game/draft.js';
import { castSkill } from '../src/game/skills.js';
import { addEnemy, hostileStrike, updateHostile } from '../src/game/enemies.js';
import { inShape } from '../src/game/util.js';

function run(game, seconds, script = () => ({})) {
  const dt = 1 / 60; let t = 0;
  while (t < seconds) {
    updateGame(game, dt, script(t, game) || {});
    if (game.status === 'draft') actions.chooseCard(game, 0);
    t += dt;
  }
  return game;
}
const spam = (t) => ({ move: { x: Math.sin(t), z: Math.cos(t) }, pressed: { light: Math.floor(t * 10) % 2 === 0, skill0: Math.floor(t * 3) % 5 === 0 } });

test('rng is deterministic per seed', () => {
  const a = createRng(5), b = createRng(5), c = createRng(6);
  const sa = Array.from({ length: 5 }, () => a.next()), sb = Array.from({ length: 5 }, () => b.next()), sc = Array.from({ length: 5 }, () => c.next());
  assert.deepEqual(sa, sb); assert.notDeepEqual(sa, sc);
});

test('same seed and inputs replay the same run', () => {
  const g1 = run(createGame({ mode: 'endless', hero: 'knight', seed: 11 }), 20, spam);
  const g2 = run(createGame({ mode: 'endless', hero: 'knight', seed: 11 }), 20, spam);
  assert.equal(g1.run.kills, g2.run.kills);
  assert.equal(Math.round(g1.player.hp), Math.round(g2.player.hp));
  assert.ok(g1.run.kills > 20, `kills ${g1.run.kills}`);
});

test('light chain advances through 5 hits and heavy after n lights is Cn+1', () => {
  const g = createGame({ mode: 'endless', hero: 'knight', seed: 3, starter: false, forceAllCharges: true });
  const seen = [];
  run(g, 4, (t, game) => {
    for (const ev of game.events) if (ev.type === 'attack') seen.push(`${ev.kind}${ev.index}`);
    return { pressed: { light: seen.length < 2 && t > 0.05 && Math.floor(t * 20) % 2 === 0, heavy: seen.length === 2 } };
  });
  assert.deepEqual(seen.slice(0, 3), ['light0', 'light1', 'charge2']);
});

test('musou consumes the gauge, grants invulnerability and kills crowds', () => {
  const g = createGame({ mode: 'endless', hero: 'barbarian', seed: 4, starter: false });
  run(g, 3);
  for (let i = 0; i < 20; i++) addEnemy(g, 'skel_minion', g.player.x + Math.sin(i) * 3, g.player.z + Math.cos(i) * 3, { noSpawnAnim: true });
  g.player.musou = 100;
  const before = g.run.kills;
  run(g, 0.2, () => ({ pressed: { musou: true } }));
  assert.equal(g.player.state, 'musou');
  assert.ok(g.player.musou < 100);
  run(g, 4);
  assert.ok(g.run.kills - before >= 15, `musou kills ${g.run.kills - before}`);
});

test('faction tiers, synergies and triads activate from owned skills', () => {
  const g = createGame({ mode: 'endless', hero: 'mage', seed: 9, starter: false });
  addSkill(g, 'fire_strike_array'); addSkill(g, 'fire_kindle');
  assert.ok(g.factionTiers.some((t) => t.faction === 'fire' && t.n === 2));
  addSkill(g, 'frost_nova'); addSkill(g, 'frost_armor');
  assert.ok(g.synergies.some((s) => s.id === 'syn_thermal'));
  addSkill(g, 'storm_chain'); addSkill(g, 'storm_conductor');
  assert.ok(g.triads.some((t) => t.id === 'tri_elemental'));
});

test('evolution card appears when the base skill is maxed and the partner is owned', () => {
  const g = createGame({ mode: 'endless', hero: 'mage', seed: 9, starter: false });
  for (let i = 0; i < 5; i++) addSkill(g, 'fire_dragon_wave');
  addSkill(g, 'u_area');
  g.status = 'playing';
  g.addXp(g.xpToNext());
  for (let i = 0; i < 60 && g.status !== 'draft'; i++) updateGame(g, 1 / 60, {});
  const opts = g.draft.options || [];
  assert.ok(opts.some((c) => c.id === 'fire_dragon_roar'), opts.map((c) => c.id).join());
  actions.chooseCard(g, opts.findIndex((c) => c.id === 'fire_dragon_roar'));
  assert.ok(g.skills.owned.has('fire_dragon_roar') && !g.skills.owned.has('fire_dragon_wave'));
  assert.ok(g.skills.slots.includes('fire_dragon_roar'));
});

test('active skills go on cooldown scaled by cdr and damage enemies', () => {
  const g = createGame({ mode: 'endless', hero: 'mage', seed: 2, starter: false });
  addSkill(g, 'frost_nova');
  run(g, 2.5);
  for (let i = 0; i < 8; i++) addEnemy(g, 'skel_warrior', g.player.x + Math.sin(i) * 2.5, g.player.z + Math.cos(i) * 2.5, { noSpawnAnim: true });
  run(g, 0.05);
  const hp = g.enemies.reduce((s, e) => s + e.hp, 0);
  assert.ok(castSkill(g, 'frost_nova'));
  run(g, 0.1);
  assert.ok(g.enemies.reduce((s, e) => s + Math.max(0, e.hp), 0) < hp);
  assert.ok(g.enemies.some((e) => e.status.freeze));
  assert.ok(g.skills.owned.get('frost_nova').cd > 6);
  assert.equal(castSkill(g, 'frost_nova'), false);
});

test('hostile telegraphs hit exactly where they are drawn', () => {
  const g = createGame({ mode: 'endless', hero: 'knight', seed: 1, starter: false });
  run(g, 2.5);
  const p = g.player; p.invuln = 0;
  const hp0 = p.hp;
  hostileStrike(g, { kind: 'circle', x: p.x + 5, z: p.z, r: 3, windup: 0.2, dmg: 50 });
  for (let i = 0; i < 30; i++) { g.events = []; g.time += 0.02; updateHostile(g, 0.02); }
  assert.equal(p.hp, hp0, 'outside the circle: no damage');
  const fx = g.effects.find((f) => f.kind === 'danger');
  assert.ok(!fx || fx.r === 3);
  hostileStrike(g, { kind: 'arc', x: p.x, z: p.z - 2, angle: 0, r: 4, arc: 90, windup: 0.2, dmg: 50 });
  for (let i = 0; i < 30; i++) { g.events = []; g.time += 0.02; updateHostile(g, 0.02); }
  assert.ok(p.hp < hp0, 'inside the arc: damaged');
  assert.ok(inShape({ shape: 'line', length: 10, width: 2 }, 0, 0, 0, 0, 5, 0));
  assert.ok(!inShape({ shape: 'line', length: 10, width: 2 }, 0, 0, 0, 3, 5, 0));
});

test('difficulty scales enemy health and spawn caps hold', () => {
  const easy = createGame({ mode: 'endless', difficulty: 'easy', seed: 1, maxEnemies: 120 });
  const hell = createGame({ mode: 'endless', difficulty: 'hell', seed: 1, maxEnemies: 120 });
  run(easy, 25, spam); run(hell, 25, spam);
  const avg = (g) => g.enemies.filter((e) => !e.elite && e.id === 'skel_minion').reduce((s, e, _, a) => s + e.maxHp / a.length, 0);
  assert.ok(avg(hell) > avg(easy) * 3);
  assert.ok(easy.enemies.length <= 140 && hell.enemies.length <= 140);
});

test('adventure chapter can be cleared end to end by a scripted bot', () => {
  const g = createGame({ mode: 'adventure', hero: 'knight', difficulty: 'easy', chapter: 1, seed: 42 });
  let t = 0;
  const dt = 1 / 30;
  while (t < 1500 && !['chapterClear', 'lost'].includes(g.status)) {
    switch (g.status) {
      case 'map': actions.enterNode(g, g.map.available[0]); break;
      case 'draft': actions.chooseCard(g, 0); break;
      case 'event': actions.eventOption(g, g.currentEvent.options.length - 1); break;
      case 'eventDone': actions.eventDone(g); break;
      case 'rest': actions.restChoice(g, 'heal'); break;
      case 'treasure': actions.claimTreasure(g); break;
      case 'shopNode': actions.closeShop(g); break;
      default: {
        const ot = g.stage?.objective?.type;
        let move = { x: Math.sin(t * 0.4), z: Math.cos(t * 0.4) };
        if (ot === 'capture' || ot === 'escape') { const o = g.objectivePoint(); const dx = o.x - g.player.x, dz = o.z - g.player.z, d = Math.hypot(dx, dz) || 1; move = d > 1 ? { x: dx / d, z: dz / d } : { x: 0, z: 0 }; }
        updateGame(g, dt, { move, pressed: { light: true, skill0: true, skill1: true, musou: true, heavy: Math.floor(t * 4) % 6 === 0 } });
      }
    }
    t += dt;
  }
  assert.equal(g.status, 'chapterClear', `ended ${g.status} at node ${g.map.current}`);
});
