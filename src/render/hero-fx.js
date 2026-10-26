import * as THREE from 'three';
import { col } from './vfx-core.js';

// Debuff visuals attached to the hero: the time bomb (with a ground ring that is its exact blast radius),
// webs / clock face underfoot, and particle signatures for poison, bleed, confusion, fear, blindness, etc.
const BOMB_R = 3.6;
const rnd = (a, b) => a + Math.random() * (b - a);

export function createHeroFx(scene, vfx) {
  const bomb = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 1), new THREE.MeshStandardMaterial({ color: 0x26222a, roughness: 0.45, metalness: 0.4, flatShading: true }));
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.04, 6, 18), new THREE.MeshStandardMaterial({ color: 0x8a6a40, roughness: 0.6 }));
  band.rotation.x = Math.PI / 2;
  const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.25, 6), new THREE.MeshStandardMaterial({ color: 0xa08a60 }));
  fuse.position.y = 0.42;
  const spark = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffc040, toneMapped: false }));
  spark.position.y = 0.58;
  bomb.add(shell, band, fuse, spark); bomb.visible = false; scene.add(bomb);
  const C = {
    danger: col('#ff2a1a'), web: col('#ece6d6'), chrono: col('#ffd76a'), silence: col('#c27aff'), poison: col('#86ff3a'), poison2: col('#1a5a10'), blood: col('#ff2a3a'), blood2: col('#5a0010'),
    acid: col('#d4ff3a'), acid2: col('#4a6a00'), pink: col('#ff7ad8'), pink2: col('#7a2a9a'), fear: col('#9a5aff'), fear2: col('#1a0030'), smoke: col('#16141e'), frost: col('#bfefff'), frost2: col('#2a6cff'),
    ember: col('#ffb060'), ember2: col('#ff3000'), stone: col('#c8bca4'), stone2: col('#5a5040'),
  };
  let acc = 0, lastBeep = 0;
  return {
    sync(game, dt) {
      const p = game.player, D = p.debuffs || {}, t = game.time;
      const has = (id) => (D[id]?.t || 0) > 0, st = (id) => (has(id) ? D[id].stacks : 0);
      const x = p.x, z = p.z, head = p.y + 2.2;
      // time bomb: hovering bomb + blast-radius ring that fills as the fuse burns
      if (has('bomb') && !p.dead) {
        const d = D.bomb, k = 1 - d.t / Math.max(0.01, d.dur);
        bomb.visible = true; bomb.position.set(x, head + 0.4 + Math.sin(t * 6) * 0.06, z); bomb.rotation.y = t * 2;
        const blink = Math.sin(t * (6 + k * 26)) > 0;
        spark.material.color.set(blink ? 0xffffff : 0xff6020); spark.scale.setScalar(1 + k * 0.8 + (blink ? 0.3 : 0));
        vfx.decalsDark.push(x, 0.05, z, 0, BOMB_R * 2, BOMB_R * 2, C.danger, (0.65 + (blink ? 0.3 : 0)) * (0.6 + k * 0.4), 0, 0, 0, 0.06, Math.max(0.01, k));
        vfx.decalsAdd.push(x, 0.055, z, 0, BOMB_R * 2, BOMB_R * 2, C.danger, 0.6, 1, 0.94, 0, 0.04, 0, t, 1, 0);
        if (Math.random() < 0.8) vfx.parts.emit({ x: x + rnd(-0.05, 0.05), y: head + 1.0, z: z + rnd(-0.05, 0.05), vx: rnd(-1.5, 1.5), vy: rnd(1, 3), vz: rnd(-1.5, 1.5), life: 0.3, size: 0.18, color: C.ember, color2: C.ember2, shape: 1, stretch: 1, gravity: 6 });
        if (blink && t - lastBeep > 0.3) { lastBeep = t; vfx.lights.flash(x, head + 1, z, C.danger, 10 + k * 20, 0.12, 6); }
      } else bomb.visible = false;
      if (p.dead) return;
      if (has('webbed')) vfx.decalsAdd.push(x, 0.06, z, 0.4, 2 + st('webbed') * 0.7, 2 + st('webbed') * 0.7, C.web, 0.35 + st('webbed') * 0.18, 8, 0, 0, 0.1, 0, t, 1, 0);
      if (has('timeslow')) vfx.decalsAdd.push(x, 0.06, z, 0, 3.4, 3.4, C.chrono, 0.85, 9, 0, 0, 0.1, 0, t * 0.4, 1, 0);
      if (has('silence')) vfx.decalsAdd.push(x, 0.06, z, -t, 2.4, 2.4, C.silence, 0.8, 5, 0, 0, 0.1, 0, t, 1, -1);
      if (has('petrify')) vfx.decalsDark.push(x, 0.05, z, 0, 2.4, 2.4, C.stone2, 0.6, 6, 0, 0, 0.2, 0, t, 1, 0);
      if (has('hooked')) { const e = game.enemyById?.get(D.hooked.src); if (e) vfx.bolts.bolt(e.x, 1.3, e.z, x, p.y + 1.1, z, col('#b8bcc8'), 0.9, 0.12, 0.05, 12); }
      acc += dt;
      while (acc > 0.05) {
        acc -= 0.05;
        const a = Math.random() * Math.PI * 2;
        if (has('confuse')) for (let i = 0; i < 3; i++) { const b = t * 5 + i * 2.09; vfx.parts.emit({ x: x + Math.sin(b) * 0.55, y: head + 0.25, z: z + Math.cos(b) * 0.55, vx: 0, vy: 0, vz: 0, life: 0.12, size: 0.38, color: C.pink, color2: C.pink2, shape: 4 }); }
        if (has('fear')) vfx.parts.emit({ x: x + rnd(-0.5, 0.5), y: p.y + rnd(0.5, 2), z: z + rnd(-0.5, 0.5), vy: rnd(1, 2.5), life: 0.6, size: 0.5, color: C.fear, color2: C.fear2, shape: 5, drag: 1 });
        if (has('blind')) vfx.smokePuff(x + rnd(-0.3, 0.3), head - 0.2, z + rnd(-0.3, 0.3), C.smoke, { count: 1, size: 0.9, life: 0.6, speed: 0.6, up: 0.4 });
        if (st('poison') && Math.random() < 0.25 + st('poison') * 0.06) vfx.parts.emit({ x: x + rnd(-0.4, 0.4), y: p.y + rnd(0.3, 1.8), z: z + rnd(-0.4, 0.4), vy: rnd(0.6, 1.6), life: 0.6, size: 0.24, color: C.poison, color2: C.poison2, shape: 3, drag: 0.5 });
        if (st('bleed') && Math.random() < 0.2 + st('bleed') * 0.12 * (p.state === 'move' ? 2 : 1)) vfx.parts.emit({ x: x + rnd(-0.3, 0.3), y: p.y + rnd(0.8, 1.6), z: z + rnd(-0.3, 0.3), vx: rnd(-0.5, 0.5), vy: rnd(0, 1), vz: rnd(-0.5, 0.5), life: 0.5, size: 0.2, color: C.blood, color2: C.blood2, shape: 0, gravity: 14 });
        if (st('corrode') && Math.random() < 0.15 + st('corrode') * 0.08) vfx.parts.emit({ x: x + rnd(-0.4, 0.4), y: p.y + rnd(0.6, 1.8), z: z + rnd(-0.4, 0.4), vy: -0.5, life: 0.5, size: 0.2, color: C.acid, color2: C.acid2, shape: 0, gravity: 10 });
        if (st('frostbite') && Math.random() < st('frostbite') * 0.12) vfx.parts.emit({ x: x + Math.sin(a) * 0.6, y: p.y + rnd(0.3, 2), z: z + Math.cos(a) * 0.6, vy: -0.3, life: 0.6, size: 0.22, color: C.frost, color2: C.frost2, shape: 2 });
        if (has('freeze') && Math.random() < 0.5) vfx.parts.emit({ x: x + Math.sin(a) * 0.7, y: p.y + rnd(0.1, 2.2), z: z + Math.cos(a) * 0.7, vy: 0.2, life: 0.5, size: 0.3, color: C.frost, color2: C.frost2, shape: 2 });
        if (has('burn') && Math.random() < 0.6) vfx.parts.emit({ x: x + rnd(-0.4, 0.4), y: p.y + rnd(0.3, 1.6), z: z + rnd(-0.4, 0.4), vy: rnd(1.5, 3), life: 0.45, size: 0.28, color: C.ember, color2: C.ember2, shape: 0 });
        if (has('timeslow') && Math.random() < 0.3) vfx.parts.emit({ x: x + Math.sin(a) * 1.4, y: 0.2, z: z + Math.cos(a) * 1.4, vy: 0.5, life: 1.2, size: 0.25, color: C.chrono, color2: col('#3a7aff'), shape: 4, drag: 2 });
        if (has('silence') && Math.random() < 0.3) vfx.parts.emit({ x: x + rnd(-0.3, 0.3), y: head + 0.2, z: z + rnd(-0.3, 0.3), vy: 0.6, life: 0.5, size: 0.3, color: C.silence, color2: col('#3a1060'), shape: 4 });
      }
    },
    burstPetrify(x, z) { vfx.burst(x, 1.2, z, { core: C.stone, main: C.stone, dark: C.stone2 }, { count: 30, speed: 5, up: 5, size: 0.3, shape: 7, gravity: 18 }); vfx.smokePuff(x, 1, z, col('#8a8070'), { count: 6, size: 1.4 }); },
    burstDebuff(x, z, color) { const c = col(color); vfx.burst(x, 1.4, z, { core: col('#ffffff'), main: c, dark: c.clone().multiplyScalar(0.3) }, { count: 14, speed: 4, up: 3, size: 0.3, shape: 4 }); },
  };
}
