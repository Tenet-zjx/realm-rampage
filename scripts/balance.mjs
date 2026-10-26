// Balance sweep (pure simulation, no browser): a scripted bot plays adventure chapters on each difficulty.
// node scripts/balance.mjs [chapters=1,3,5] [difficulties=easy,normal,hard,hell] [heroes=knight,barbarian] [seed=42]
// The bot circles while attacking, walks to capture/escape objectives, uses skills and musou, and dodges
// out of telegraphs that are about to resolve (and right before a time bomb detonates). It never defends the crystal.
import { createGame, updateGame, actions } from '../src/game/sim.js';
import { inShape } from '../src/game/util.js';

const [chs = '1,3,5', diffs = 'easy,normal,hard,hell', heroes = 'knight,barbarian', seed = '42'] = process.argv.slice(2);

function inDanger(g) {
  const p = g.player;
  for (const h of g.hostile) {
    if (h.windup - h.t > 0.3) continue;
    const shape = h.kind === 'circle' ? { shape: 'circle', r: h.r } : h.kind === 'ring' ? { shape: 'ring', r: h.r, inner: h.inner } : h.kind === 'arc' ? { shape: 'arc', range: h.r, angle: h.arc } : h.kind === 'line' ? { shape: 'line', length: h.length, width: h.width } : null;
    if (shape && inShape(shape, h.x, h.z, h.angle || 0, p.x, p.z, 0.4)) return h;
  }
  return null;
}

function play(hero, difficulty, chapter) {
  const g = createGame({ mode: 'adventure', hero, difficulty, chapter, seed: +seed });
  let t = 0, minHp = 1;
  const dt = 1 / 30, debuffs = {};
  while (t < 2400 && !['chapterClear', 'lost'].includes(g.status)) {
    switch (g.status) {
      case 'map': actions.enterNode(g, g.map.available[0]); break;
      case 'draft': actions.chooseCard(g, 0); break;
      case 'event': actions.eventOption(g, g.currentEvent.options.length - 1); break;
      case 'eventDone': actions.eventDone(g); break;
      case 'rest': actions.restChoice(g, 'heal'); break;
      case 'treasure': actions.claimTreasure(g); break;
      case 'shopNode': actions.closeShop(g); break;
      default: {
        const p = g.player, ot = g.stage?.objective?.type;
        let move = { x: Math.sin(t * 0.4), z: Math.cos(t * 0.4) };
        if (ot === 'capture' || ot === 'escape') { const o = g.objectivePoint(); const dx = o.x - p.x, dz = o.z - p.z, d = Math.hypot(dx, dz) || 1; move = d > 1 ? { x: dx / d, z: dz / d } : { x: 0, z: 0 }; }
        const h = inDanger(g);
        const bomb = p.debuffs?.bomb?.t > 0 && p.debuffs.bomb.t < 0.2;
        let dodge = false;
        if (h || bomb) { const a = h ? Math.atan2(p.x - h.x, p.z - h.z) : t; move = { x: Math.sin(a), z: Math.cos(a) }; dodge = true; }
        updateGame(g, dt, { move, pressed: { light: true, skill0: true, skill1: true, skill2: true, musou: true, dodge, belt0: p.hp < g.stats.maxHp * 0.35, heavy: Math.floor(t * 4) % 6 === 0 } });
        for (const ev of g.events) if (ev.type === 'debuff') debuffs[ev.id] = (debuffs[ev.id] || 0) + 1;
        if (g.stats) minHp = Math.min(minHp, Math.max(0, p.hp) / g.stats.maxHp);
      }
    }
    t += dt;
  }
  return { hero, difficulty, chapter, result: g.status === 'chapterClear' ? 'CLEAR' : g.status === 'lost' ? 'LOST' : `TIMEOUT(${g.status})`, node: g.map.current, minHp: Math.round(minHp * 100), minutes: +(t / 60).toFixed(1), kills: g.run.kills, debuffs };
}

for (const ch of chs.split(',').map(Number)) for (const d of diffs.split(',')) for (const h of heroes.split(',')) {
  const r = play(h, d, ch);
  const top = Object.entries(r.debuffs).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k}:${v}`).join(' ');
  console.log(`ch${ch} ${d.padEnd(6)} ${h.padEnd(9)} ${r.result.padEnd(8)} node ${String(r.node).padEnd(3)} minHP ${String(r.minHp).padStart(3)}%  ${String(r.minutes).padStart(5)}min  KO ${String(r.kills).padStart(5)}  ${top}`);
}
