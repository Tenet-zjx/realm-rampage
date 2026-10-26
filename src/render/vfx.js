import * as THREE from 'three';
import { createDecals, createParticles, createMeshPool, createBolts, createLights, PALETTES, pal, col, SHAPE } from './vfx-core.js';

// Effect recipes: every game.effects descriptor (kind + palette) maps to a layered visual (decals, particles,
// energy meshes, lightning, lights). Shapes follow the real gameplay geometry so effects stay readable.
const TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);

export function createVfx(scene, { quality = 'high' } = {}) {
  const decalsAdd = createDecals(scene, 900, true);
  const decalsDark = createDecals(scene, 300, false);
  const parts = createParticles(scene, quality === 'low' ? 2500 : 6000, true);
  const smoke = createParticles(scene, 1200, false);
  const pool = createMeshPool(scene);
  const bolts = createBolts(scene);
  const lights = createLights(scene, quality === 'low' ? 3 : 6);
  const handles = new Map();
  const transient = []; // { meshes, life, update(dt, k) }
  const particleScale = quality === 'low' ? 0.45 : quality === 'medium' ? 0.7 : 1;

  // ---------------------------------------------------------------- helpers
  const P = (name) => { const p = pal(name); return { core: col(p.core), main: col(p.main), dark: col(p.dark), shape: SHAPE[p.shape] ?? 0, name }; };
  const n = (x) => Math.max(1, Math.round(x * particleScale));
  function burst(x, y, z, pp, { count = 20, speed = 8, up = 3, size = 0.35, life = 0.6, gravity = 6, shape, spread = 1, stretch = 0, color, color2, drag = 2.5, ring = 0 } = {}) {
    for (let i = 0; i < n(count); i++) {
      const a = Math.random() * TAU, s = speed * (0.4 + Math.random() * 0.8) * spread;
      const r = ring ? ring * (0.85 + Math.random() * 0.3) : 0;
      parts.emit({ x: x + Math.sin(a) * r, y: y + Math.random() * 0.3, z: z + Math.cos(a) * r, vx: Math.sin(a) * s, vy: up * (0.5 + Math.random()), vz: Math.cos(a) * s, life: life * (0.6 + Math.random() * 0.6),
        size: size * (0.6 + Math.random() * 0.8), size1: size * 0.1, color: color || (Math.random() < 0.35 ? pp.core : pp.main), color2: color2 || pp.dark, gravity, drag, shape: shape ?? pp.shape, stretch });
    }
  }
  function rise(x, z, r, pp, { count = 16, speed = 4, size = 0.3, life = 0.8, shape } = {}) {
    for (let i = 0; i < n(count); i++) { const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * r; parts.emit({ x: x + Math.sin(a) * d, y: 0.1, z: z + Math.cos(a) * d, vx: 0, vy: speed * (0.5 + Math.random()), vz: 0, life: life * (0.6 + Math.random() * 0.6), size, color: Math.random() < 0.4 ? pp.core : pp.main, color2: pp.dark, drag: 1, shape: shape ?? pp.shape }); }
  }
  function smokePuff(x, y, z, color, { count = 8, size = 1.2, life = 1.0, speed = 2, up = 1 } = {}) {
    for (let i = 0; i < n(count); i++) { const a = Math.random() * TAU, s = speed * Math.random(); smoke.emit({ x, y, z, vx: Math.sin(a) * s, vy: up * Math.random(), vz: Math.cos(a) * s, life: life * (0.7 + Math.random() * 0.5), size: size * 0.6, size1: size * 1.6, color, alpha: 0.55, drag: 2, shape: 5 }); }
  }
  function mesh(kind, o, life, update) { const m = pool.get(kind, o); transient.push({ m, life, max: life, update }); return m; }
  function pillar(x, z, r, h, pp, life = 0.55, o = {}) {
    mesh('cylinder', { core: pp.core, main: pp.main, alpha: 1, scroll: 3, fres: 1.2 }, life, (m, k) => { const g = Math.min(1, k * 6); m.position.set(x, 0, z); m.scale.set(r * (1 - k * 0.3), h * g, r * (1 - k * 0.3)); m.material.uniforms.uAlpha.value = (1 - k) * (o.alpha ?? 1); });
  }
  function shock(x, y, z, r, pp, life = 0.5, thick = 1) {
    mesh('torus', { core: pp.core, main: pp.main, alpha: 1, noise: 0.2, fres: 0.5 }, life, (m, k) => { const e = 1 - Math.pow(1 - k, 3); m.position.set(x, y, z); m.scale.set(r * e, thick * (1 - k) * 3 + 0.3, r * e); m.material.uniforms.uAlpha.value = 1 - k; });
  }
  function sphere(x, y, z, r, pp, life = 0.45, o = {}) {
    mesh(o.dome ? 'dome' : 'sphere', { core: pp.core, main: pp.main, alpha: 1, noise: o.noise ?? 0.5, fres: o.fres ?? 2 }, life, (m, k) => { const e = o.grow === false ? 1 : 1 - Math.pow(1 - k, 2.5); m.position.set(x, y, z); m.scale.setScalar(r * (o.from ?? 0.3) + r * (1 - (o.from ?? 0.3)) * e); m.material.uniforms.uAlpha.value = (o.alpha ?? 1) * (1 - k); });
  }
  function slash(x, y, z, angle, r, arc, pp, life = 0.28, tilt = 0, mirror = false, width = 1) {
    mesh('slash', { core: pp.core, main: pp.main }, life, (m, k) => {
      m.position.set(x, y, z); m.rotation.set(0, angle, 0); m.rotateZ((tilt || 0) * Math.PI / 180 * (mirror ? -1 : 1));
      const sx = r * (arc / 180), s = r;
      m.scale.set(s * Math.max(0.35, arc / 180) * width, 1, s);
      m.material.uniforms.uProg.value = Math.min(1.6, k * 3.2); m.material.uniforms.uAlpha.value = k < 0.5 ? 1.4 : (1 - k) * 2.8;
    });
  }
  function spikes(x, z, count, r, h, pp, life, kind = 'spike', lit = false) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU, d = r * Math.sqrt(Math.random()), sx = x + Math.sin(a) * d, sz = z + Math.cos(a) * d, hh = h * rnd(0.6, 1.2), tilt = rnd(-0.35, 0.35), tz = rnd(-0.35, 0.35);
      const o = lit ? { color: pp.main, emissive: pp.dark, emissiveIntensity: 0.6, lit: true } : { core: pp.core, main: pp.main, scroll: 0.5, noise: 0.2 };
      mesh(kind, o, life, (m, k) => { const g = k < 0.15 ? k / 0.15 : k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1; m.position.set(sx, -0.2 + 0.2 * g, sz); m.rotation.set(tilt, a, tz); m.scale.set(0.5 * hh * 0.5 + 0.2, hh * g, 0.5 * hh * 0.5 + 0.2); if (m.material.uniforms) m.material.uniforms.uAlpha.value = g; });
    }
  }
  const flash = (x, y, z, pp, power = 30, life = 0.25, dist = 12) => lights.flash(x, y, z, pp.main, power, life, dist);

  // ---------------------------------------------------------------- recipes (one-shot at creation unless persistent)
  const R = {};
  // generic shapes
  R.burst = (f, pp) => { burst(f.x, 0.6, f.z, pp, { count: 24, speed: 7 }); shock(f.x, 0.2, f.z, f.r || 2.5, pp, 0.4); flash(f.x, 1, f.z, pp, 20); };
  R.nova = (f, pp, o = {}) => { shock(f.x, 0.25, f.z, f.r, pp, o.life || 0.55, o.thick || 1.2); burst(f.x, 0.5, f.z, pp, { count: o.count || 40, speed: f.r * 2.8, up: 2, size: o.size || 0.4, ring: 0.5, shape: o.shape, stretch: o.stretch || 0 }); flash(f.x, 1.2, f.z, pp, 35, 0.3, f.r * 2); decalOnce(f, pp, { type: 6, life: 1.2, r: f.r * 0.9, alpha: 0.5, dark: true }); };
  R.pillar = (f, pp) => { pillar(f.x, f.z, f.r * 0.75, 7, pp, 0.6); burst(f.x, 0.3, f.z, pp, { count: 30, speed: 4, up: 9, size: 0.4, gravity: 4 }); shock(f.x, 0.2, f.z, f.r * 1.1, pp, 0.45); flash(f.x, 2, f.z, pp, 45, 0.35); decalOnce(f, pp, { type: 6, life: 2.2, r: f.r, alpha: 0.6, dark: true }); };
  R.flamePillar = (f, pp) => { R.pillar(f, pp); rise(f.x, f.z, f.r * 0.7, pp, { count: 30, speed: 8, size: 0.5, life: 0.9 }); smokePuff(f.x, 2, f.z, col('#2a1a14'), { count: 6, size: 2, up: 4 }); };
  R.fireBurst = (f, pp) => { sphere(f.x, 0.8, f.z, (f.r || 2.5) * 0.8, P('fire'), 0.4); burst(f.x, 0.6, f.z, P('fire'), { count: 28, speed: 9, up: 4 }); smokePuff(f.x, 1, f.z, col('#2a1a14'), { count: 5 }); flash(f.x, 1, f.z, P('fire'), 30); };
  R.fireballBurst = R.fireBurst; R.bombBurst = (f) => { R.fireBurst(f, P('fire')); shock(f.x, 0.2, f.z, f.r || 4, P('fire'), 0.5); };
  R.meteor = (f, pp) => {
    const h = 16, sx = f.x - 6, sz = f.z - 4, delay = Math.max(0.2, f.delay || 0.6);
    const rock = mesh('rock', { color: col('#3a1a10'), emissive: pp.main, emissiveIntensity: 1.5 }, delay, (m, k) => {
      m.position.set(sx + (f.x - sx) * k, h * (1 - k) + 0.5, sz + (f.z - sz) * k); m.scale.setScalar(1.6 + (f.r || 3) * 0.25); m.rotation.x += 0.2;
      for (let i = 0; i < 3; i++) parts.emit({ x: m.position.x + rnd(-0.4, 0.4), y: m.position.y + rnd(-0.4, 0.4), z: m.position.z + rnd(-0.4, 0.4), vx: rnd(-1, 1), vy: 2, vz: rnd(-1, 1), life: 0.5, size: 0.8, color: pp.core, color2: pp.dark, drag: 2, shape: 0 });
    });
    rock.castShadow = true;
    telegraphFriendly(f, pp, delay);
    later(delay, () => { sphere(f.x, 0.6, f.z, f.r * 0.9, pp, 0.5); shock(f.x, 0.3, f.z, f.r * 1.3, pp, 0.6, 1.6); burst(f.x, 0.6, f.z, pp, { count: 50, speed: 12, up: 8, size: 0.5 }); burst(f.x, 0.5, f.z, P('earth'), { count: 14, speed: 9, up: 9, size: 0.35, shape: 7, gravity: 22 }); smokePuff(f.x, 1, f.z, col('#2a1810'), { count: 10, size: 2.5, up: 3 }); flash(f.x, 2, f.z, pp, 80, 0.45, 20); decalOnce(f, pp, { type: 6, life: 3, r: f.r * 1.1, alpha: 0.75, dark: true }); });
  };
  R.starMeteor = (f, pp) => { const p2 = P('arcane'); const delay = Math.max(0.15, f.delay || 0.4); const sx = f.x + 5, sz = f.z - 6, h = 14;
    mesh('sphere', { core: p2.core, main: p2.main, noise: 0.2, fres: 1 }, delay, (m, k) => { m.position.set(sx + (f.x - sx) * k, h * (1 - k) + 0.5, sz + (f.z - sz) * k); m.scale.setScalar(0.7); for (let i = 0; i < 2; i++) parts.emit({ x: m.position.x, y: m.position.y, z: m.position.z, vx: rnd(-1, 1), vy: rnd(-1, 1), vz: rnd(-1, 1), life: 0.45, size: 0.6, color: p2.core, color2: p2.main, shape: 4 }); });
    telegraphFriendly(f, p2, delay);
    later(delay, () => { sphere(f.x, 0.5, f.z, f.r, p2, 0.45); shock(f.x, 0.25, f.z, f.r * 1.2, p2, 0.5); burst(f.x, 0.6, f.z, p2, { count: 40, speed: 10, up: 6, shape: 4, size: 0.45 }); flash(f.x, 1.5, f.z, p2, 60, 0.35, 16); }); };
  R.frostNova = (f, pp) => { const p2 = P('frost'); R.nova(f, p2, { shape: 2, size: 0.45, count: 50, stretch: 1.2 }); smokePuff(f.x, 0.5, f.z, col('#cfefff'), { count: 10, size: 1.8, speed: f.r }); decalOnce(f, p2, { type: 1, life: 0.9, r: f.r, alpha: 0.5 }); };
  R.arcaneNova = (f) => R.nova(f, P('arcane'), { shape: 4 });
  R.boneNova = (f) => { R.nova(f, P('shadow'), { shape: 7 }); };
  R.darkPulse = (f) => R.nova(f, P('shadow'), { shape: 5, count: 30 });
  R.haloPulse = (f) => { shock(f.x, 0.3, f.z, f.r, P('holy'), 0.45, 0.7); burst(f.x, 0.4, f.z, P('holy'), { count: 14, speed: f.r * 3, up: 1, shape: 4, ring: f.r * 0.3 }); };
  R.staticPulse = (f) => { const p2 = P('storm'); shock(f.x, 0.4, f.z, f.r, p2, 0.35, 0.6); for (let i = 0; i < 5; i++) { const a = Math.random() * TAU; arc(f.x, 1, f.z, f.x + Math.sin(a) * f.r, 0.4, f.z + Math.cos(a) * f.r, p2, 0.18, 0.12); } };
  R.iceBurst = (f) => { const p2 = P('frost'); spikes(f.x, f.z, 4, (f.r || 1.6) * 0.6, 1.4, p2, 0.6, 'crystal', true); burst(f.x, 0.5, f.z, p2, { count: 14, speed: 5, up: 4, shape: 2 }); smokePuff(f.x, 0.4, f.z, col('#d8f4ff'), { count: 4, size: 1.2 }); };
  R.iceSpike = (f) => { const p2 = P('frost'); spikes(f.x, f.z, 3, f.r * 0.5, 2.4 * (f.size || 1), p2, 1.0, 'crystal', true); burst(f.x, 0.5, f.z, p2, { count: 10, speed: 4, up: 6, shape: 2 }); flash(f.x, 1, f.z, p2, 12, 0.2); };
  R.absoluteZero = (f) => { const p2 = P('frost'); shock(f.x, 0.3, f.z, f.r, p2, 0.9, 2); sphere(f.x, 0, f.z, f.r, p2, 1.4, { dome: true, alpha: 0.35, noise: 0.8, from: 0.1 }); burst(f.x, 0.6, f.z, p2, { count: 80, speed: f.r * 2, up: 3, shape: 2, size: 0.5, ring: 1 }); decalOnce(f, p2, { type: 0, life: 3, r: f.r, alpha: 0.35 }); flash(f.x, 3, f.z, p2, 90, 0.6, 30); };
  R.shatter = (f) => { const p2 = P('frost'); burst(f.x, 1, f.z, p2, { count: 90, speed: f.r * 1.6, up: 6, shape: 2, size: 0.55, gravity: 14, ring: f.r * 0.4 }); shock(f.x, 0.4, f.z, f.r, p2, 0.5); flash(f.x, 2, f.z, p2, 60, 0.3, 30); };
  R.frostRing = R.ring = (f, pp) => ringWave(f, pp);
  R.poisonNova = (f) => ringWave(f, P('poison'), { shape: 0, smoke: '#4a8a2a' });
  R.bloodScythe = (f) => { const p2 = P('blood'); ringWave(f, p2, { shape: 1, stretch: 2 }); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; later(0, () => slash(f.x, 0.8, f.z, a, f.r * 0.9, 120, p2, f.r / 16 + 0.3, 0)); } };
  R.chainBolt = (f, pp) => { /* drawn while alive */ if (f.points) for (const pt of f.points) burst(pt.x, (pt.y || 1) , pt.z, P(f.palette || 'storm'), { count: 6, speed: 5, up: 3, shape: 1, stretch: 1.5, size: 0.25 }); };
  R.zap = (f) => { const p2 = P('storm'); arc(f.fromX ?? f.x, 1.2, f.fromZ ?? f.z, f.x, 1, f.z, p2, 0.22, 0.14); burst(f.x, 1, f.z, p2, { count: 8, speed: 5, shape: 1, stretch: 1.5, size: 0.2 }); };
  R.skyBolt = (f) => { const p2 = P(f.palette === 'holy' ? 'holy' : 'storm'); const d = f.delay || 0; if (d > 0) telegraphFriendly(f, p2, d); later(d, () => { arc(f.x + rnd(-1, 1), 14, f.z + rnd(-1, 1), f.x, 0.2, f.z, p2, 0.3, 0.35, 1.5, 12); shock(f.x, 0.2, f.z, (f.r || 1.2) * 1.4, p2, 0.3, 0.6); burst(f.x, 0.4, f.z, p2, { count: 16, speed: 7, up: 6, shape: 1, stretch: 2, size: 0.25 }); flash(f.x, 3, f.z, p2, 60, 0.18, 14); decalOnce(f, p2, { type: 6, life: 1, r: (f.r || 1.2) * 1.2, alpha: 0.5, dark: true }); }); };
  R.lightSpear = (f) => { const p2 = P('holy'); const d = f.delay || 0.25; telegraphFriendly(f, p2, d); mesh('cylinder', { core: p2.core, main: p2.main, scroll: 4 }, d, (m, k) => { m.position.set(f.x - 4 * (1 - k), 12 * (1 - k), f.z); m.rotation.set(0, 0, 0.32); m.scale.set(0.18, 4, 0.18); }); later(d, () => { pillar(f.x, f.z, 0.5, 5, p2, 0.35); shock(f.x, 0.2, f.z, (f.r || 1.6) * 1.2, p2, 0.35); burst(f.x, 0.3, f.z, p2, { count: 14, speed: 6, up: 5, shape: 4 }); flash(f.x, 2, f.z, p2, 40, 0.2); }); };
  R.sunStrike = (f) => { const p2 = P('holy'); telegraphFriendly(f, P('fire'), f.delay || 1); later(f.delay || 1, () => { pillar(f.x, f.z, f.r * 0.9, 18, P('fire'), 0.7); pillar(f.x, f.z, f.r * 0.45, 18, p2, 0.6); shock(f.x, 0.2, f.z, f.r * 1.6, P('fire'), 0.5); burst(f.x, 0.3, f.z, P('fire'), { count: 40, speed: 5, up: 12 }); flash(f.x, 3, f.z, P('fire'), 90, 0.4, 20); decalOnce(f, P('fire'), { type: 6, life: 3, r: f.r * 1.3, alpha: 0.7, dark: true }); }); };
  R.holyHammer = (f) => { const p2 = P('holy'); const d = f.delay || 0.6; telegraphFriendly(f, p2, d);
    const hm = mesh('box', { color: col('#f8e8b0'), emissive: p2.main, emissiveIntensity: 1.6 }, d + 0.15, (m, k) => { const kk = Math.min(1, k * (d + 0.15) / d); m.position.set(f.x, 0.5 + 12 * (1 - kk * kk), f.z); m.scale.set(1.6, 1.2, 2.6); m.rotation.set(0, 0.6, 0); });
    later(d, () => { shock(f.x, 0.3, f.z, f.r * 1.3, p2, 0.6, 1.6); burst(f.x, 0.6, f.z, p2, { count: 40, speed: 10, up: 6, shape: 4 }); pillar(f.x, f.z, f.r * 0.6, 8, p2, 0.5); flash(f.x, 2, f.z, p2, 70, 0.35, 18); decalOnce(f, p2, { type: 7, life: 1.4, r: f.r * 1.2, alpha: 0.8 }); }); };
  R.raze = (f) => { const p2 = P('shadow'); pillar(f.x, f.z, f.r * 0.8, 4, p2, 0.5); shock(f.x, 0.2, f.z, f.r * 1.1, p2, 0.45); burst(f.x, 0.4, f.z, p2, { count: 26, speed: 5, up: 7, shape: 5, size: 0.6 }); smokePuff(f.x, 0.5, f.z, col('#140820'), { count: 8, size: 2 }); decalOnce(f, p2, { type: 6, life: 2, r: f.r, alpha: 0.7, dark: true }); flash(f.x, 1.5, f.z, p2, 30); };
  R.shadowBurst = (f) => { sphere(f.x, 0.8, f.z, f.r || 3, P('shadow'), 0.4); burst(f.x, 0.8, f.z, P('shadow'), { count: 30, speed: 8, up: 3, shape: 5, size: 0.5 }); };
  R.corpseBlast = (f) => { sphere(f.x, 0.6, f.z, f.r || 3, P('poison'), 0.4); burst(f.x, 0.6, f.z, P('shadow'), { count: 26, speed: 9, up: 6, shape: 7, gravity: 16 }); burst(f.x, 0.6, f.z, P('poison'), { count: 18, speed: 6, up: 4 }); smokePuff(f.x, 0.5, f.z, col('#2a3a14'), { count: 6 }); };
  R.bloodNova = (f) => { const p2 = P('blood'); sphere(f.x, 0.6, f.z, f.r * 0.9, p2, 0.45); shock(f.x, 0.3, f.z, f.r, p2, 0.5, 1.4); burst(f.x, 0.8, f.z, p2, { count: 60, speed: f.r * 2.5, up: 6, gravity: 18, size: 0.35 }); decalOnce(f, p2, { type: 0, life: 3, r: f.r * 0.8, alpha: 0.65, dark: true }); flash(f.x, 1, f.z, p2, 50, 0.3, 16); };
  R.infernoNova = (f) => { R.bloodNova(f); R.nova(f, P('fire'), { count: 60 }); };
  R.bloodRite = (f) => { const p2 = P('blood'); const d = f.delay || 1.3; runeTelegraph(f, p2, d); later(d, () => { pillar(f.x, f.z, f.r * 0.7, 6, p2, 0.6); burst(f.x, 0.4, f.z, p2, { count: 50, speed: 6, up: 12, gravity: 20 }); shock(f.x, 0.3, f.z, f.r * 1.2, p2, 0.5); flash(f.x, 1.5, f.z, p2, 50, 0.3); }); };
  R.runeBlast = (f) => { const p2 = P('arcane'); const d = f.delay || 0.8; runeTelegraph(f, p2, d); later(d, () => { R.nova({ ...f }, p2, { shape: 4, count: 36 }); }); };
  R.bloodSpike = (f) => { const p2 = P('blood'); spikes(f.x, f.z, 4, (f.r || 1.4) * 0.6, 1.8, p2, 0.6, 'spike', true); burst(f.x, 0.5, f.z, p2, { count: 12, speed: 4, up: 7, gravity: 18 }); };
  R.tendril = (f) => { const p2 = P('shadow'); spikes(f.x, f.z, 3, 0.5, 2.2, p2, 0.7); burst(f.x, 0.5, f.z, p2, { count: 10, speed: 3, up: 5, shape: 5 }); };
  R.rockSpike = (f) => { const p2 = P('earth'); spikes(f.x, f.z, 3, f.r * 0.45, 2.2 * (f.size || 1), p2, 1.0, 'spike', true); smokePuff(f.x, 0.3, f.z, col('#6a5038'), { count: 3, size: 1.2 }); burst(f.x, 0.5, f.z, p2, { count: 8, speed: 4, up: 6, shape: 7, gravity: 18 }); };
  R.boneSpike = (f) => { spikes(f.x, f.z, 3, f.r * 0.4, 2.2, { main: col('#f0ead8'), dark: col('#6a5a4a') }, 0.9, 'spike', true); burst(f.x, 0.5, f.z, P('shadow'), { count: 8, speed: 3, up: 5, shape: 5 }); };
  R.roots = R.rootsCircle = (f) => { const p2 = P('nature'); spikes(f.x, f.z, 10, f.r * 0.8, 1.6, { main: col('#5a3a1a'), dark: col('#2a5a10') }, 1.6, 'spike', true); burst(f.x, 0.5, f.z, p2, { count: 24, speed: 4, up: 4, shape: 6, ring: f.r * 0.5 }); decalOnce(f, p2, { type: 6, life: 2, r: f.r, alpha: 0.45, dark: true }); };
  R.natureStomp = (f) => { const p2 = P('nature'); shock(f.x, 0.3, f.z, f.r, p2, 0.6, 2); shock(f.x, 0.3, f.z, f.r * 0.6, P('earth'), 0.5, 1.5); burst(f.x, 0.4, f.z, P('earth'), { count: 26, speed: 10, up: 8, shape: 7, gravity: 22 }); burst(f.x, 0.6, f.z, p2, { count: 30, speed: 8, up: 5, shape: 6 }); decalOnce(f, P('earth'), { type: 6, life: 3, r: f.r * 0.8, alpha: 0.8, dark: true }); flash(f.x, 2, f.z, p2, 40); };
  R.echoSlam = R.quake = R.quakeRing = R.slam = (f) => { const p2 = P('earth'); shock(f.x, 0.3, f.z, f.r, p2, 0.55, 1.5); later(0.12, () => shock(f.x, 0.3, f.z, f.r * 0.75, p2, 0.45, 1)); burst(f.x, 0.4, f.z, p2, { count: 24, speed: f.r * 2, up: 7, shape: 7, gravity: 22 }); smokePuff(f.x, 0.4, f.z, col('#7a6048'), { count: 10, size: 1.8, speed: f.r * 1.2, up: 0.5 }); decalOnce(f, p2, { type: 6, life: 2.5, r: f.r * 0.8, alpha: 0.7, dark: true }); };
  R.dustRing = (f) => { smokePuff(f.x, 0.3, f.z, col('#7a6048'), { count: 4, size: 1, speed: 3, up: 0.3 }); };
  R.warcry = (f) => { const p2 = P('blood'); for (let i = 0; i < 3; i++) later(i * 0.12, () => shock(f.x, 1, f.z, f.r * (0.5 + i * 0.25), p2, 0.5, 0.8)); };
  R.steamBurst = (f) => { smokePuff(f.x, 0.8, f.z, col('#e8f4ff'), { count: 14, size: 2, speed: 5, up: 3 }); R.fireBurst(f); };
  R.phoenixBurst = (f) => { R.nova({ ...f, r: f.r || 7 }, P('fire'), { count: 90 }); pillar(f.x, f.z, 2, 14, P('fire'), 1); };
  R.collapse = (f, pp) => { sphere(f.x, 1, f.z, f.r, pp, 0.35, { from: 1, grow: false }); later(0.15, () => R.nova(f, pp, { count: 40 })); };
  R.explosion = R.burst;
  R.hammerBurst = (f) => { const p2 = P('storm'); shock(f.x, 0.3, f.z, f.r || 3, p2, 0.4); for (let i = 0; i < 6; i++) { const a = Math.random() * TAU; arc(f.x, 1, f.z, f.x + Math.sin(a) * (f.r || 3), 0.3, f.z + Math.cos(a) * (f.r || 3), p2, 0.25, 0.14); } burst(f.x, 1, f.z, p2, { count: 20, speed: 8, shape: 1, stretch: 2 }); flash(f.x, 1, f.z, p2, 40); };
  R.sporeBurst = (f) => { burst(f.x, 0.5, f.z, P('poison'), { count: 12, speed: 3, up: 2 }); };
  R.boulderBurst = R.rockBurst = (f) => burst(f.x, 0.5, f.z, P('earth'), { count: 10, speed: 6, up: 5, shape: 7, gravity: 20 });
  R.blink = (f, pp) => { const p2 = P(f.palette || 'arcane'); for (const [x, z] of [[f.x, f.z], [f.ex ?? f.x, f.ez ?? f.z]]) { burst(x, 1, z, p2, { count: 18, speed: 4, up: 3, shape: 4, size: 0.35 }); smokePuff(x, 0.8, z, p2.dark.clone().multiplyScalar(0.4), { count: 4, size: 1.2 }); } streak(f.x, f.z, f.ex ?? f.x, f.ez ?? f.z, p2, 0.3, 0.6); };
  R.dashTrail = R.phantomDash = R.shadowDash = R.phaseDash = R.shieldCharge = R.charge = R.rush = (f, pp) => { const p2 = P(f.palette || 'blade'); streak(f.x, f.z, f.ex ?? f.x + Math.sin(f.angle || 0) * 6, f.ez ?? f.z + Math.cos(f.angle || 0) * 6, p2, 0.4, f.width || 1.6); };
  R.ballLightning = (f) => { const p2 = P('storm'); streak(f.x, f.z, f.ex, f.ez, p2, 0.45, 2.2); for (let i = 0; i < 5; i++) { const t = i / 4; arc(f.x + (f.ex - f.x) * t, 1, f.z + (f.ez - f.z) * t, f.x + (f.ex - f.x) * t + rnd(-2, 2), 0.3, f.z + (f.ez - f.z) * t + rnd(-2, 2), p2, 0.3, 0.15); } sphere(f.ex, 1, f.ez, 1.4, p2, 0.35); };
  R.omnislash = (f) => { const p2 = P('blade'); streak(f.x, f.z, f.ex, f.ez, p2, 0.3, 0.5); slash(f.ex, 1, f.ez, Math.atan2(f.ex - f.x, f.ez - f.z), 2.2, 160, p2, 0.22, rnd(-60, 60)); burst(f.ex, 1, f.ez, p2, { count: 14, speed: 8, up: 2, shape: 1, stretch: 2, size: 0.3 }); flash(f.ex, 1, f.ez, p2, 25, 0.15); };
  R.crossSlash = (f) => { const p2 = P('blade'); slash(f.x, 1, f.z, rnd(0, TAU), f.r || 2.6, 150, p2, 0.25, 45); slash(f.x, 1, f.z, rnd(0, TAU), f.r || 2.6, 150, p2, 0.25, -45); burst(f.x, 1, f.z, p2, { count: 16, speed: 8, shape: 1, stretch: 2 }); };
  R.phantomSlash = (f) => { const p2 = P('blade'); slash(f.x, 1, f.z, rnd(0, TAU), (f.r || 2.6) * 1.1, 200, P('arcane'), 0.3, rnd(-30, 30)); burst(f.x, 1, f.z, p2, { count: 10, speed: 7, shape: 1, stretch: 2 }); };
  R.cleave = (f) => slash(f.x, 0.9, f.z, f.angle, f.r, 200, P('blade'), 0.25, 0, false, 1.1);
  R.slashArc = (f) => heroSlash(f);
  R.shieldBash = (f) => { heroSlash({ ...f, arc: 140 }); const p2 = P('holy'); burst(f.x + Math.sin(f.angle) * 2, 1, f.z + Math.cos(f.angle) * 2, p2, { count: 20, speed: 8, shape: 4 }); shock(f.x + Math.sin(f.angle) * 1.8, 1, f.z + Math.cos(f.angle) * 1.8, 2, p2, 0.3, 0.6); };
  R.launcher = (f) => { heroSlash({ ...f, tilt: 80 }); burst(f.x + Math.sin(f.angle) * 2, 0.5, f.z + Math.cos(f.angle) * 2, P(f.palette), { count: 18, speed: 3, up: 12, shape: 1, stretch: 2 }); };
  R.whirl = R.cyclone = R.bladeDance = (f) => { const p2 = P(f.palette || 'blade'); slash(f.x, 0.9, f.z, f.angle, f.r, 360, p2, 0.3, 0); burst(f.x, 1, f.z, p2, { count: 14, speed: 9, up: 1, shape: 1, stretch: 2, ring: f.r * 0.6 }); };
  R.holyWave = (f, pp) => waveFx(f, P('holy'), { shape: 4 });
  R.flameWedge = (f) => waveFx(f, P('fire'), { shape: 0, dense: 2 });
  R.wave = (f, pp) => waveFx(f, pp, {});
  R.judgement = (f) => { const p2 = P('holy'); pillar(f.x + Math.sin(f.angle) * 1.5, f.z + Math.cos(f.angle) * 1.5, f.r * 0.6, 10, p2, 0.6); R.nova({ x: f.x + Math.sin(f.angle) * 1.5, z: f.z + Math.cos(f.angle) * 1.5, r: f.r }, p2, { shape: 4, count: 50 }); };
  R.quake2 = R.quake;
  // v1.1 special-enemy attacks
  R.venomSplash = (f) => { const p2 = P('poison'); burst(f.x, 0.6, f.z, p2, { count: 34, speed: f.r * 3, up: 6, gravity: 16, size: 0.38 }); smokePuff(f.x, 0.6, f.z, col('#3a7a20'), { count: 8, size: 1.6, speed: f.r }); decalOnce(f, P('acid'), { type: 0, life: 1.4, r: f.r, alpha: 0.55 }); flash(f.x, 1, f.z, p2, 22); };
  R.fearScream = (f) => { const p2 = P('shadow'); for (let i = 0; i < 3; i++) later(i * 0.1, () => shock(f.x, 1.5, f.z, f.r * (0.55 + i * 0.22), p2, 0.5, 0.55)); burst(f.x, 1.7, f.z, p2, { count: 34, speed: f.r * 2.2, up: 0.6, shape: 5, size: 0.65, gravity: 0 }); smokePuff(f.x, 1.2, f.z, col('#24143a'), { count: 10, size: 1.8, speed: f.r }); decalOnce(f, p2, { type: 7, life: 0.8, r: f.r, alpha: 0.75 }); flash(f.x, 2, f.z, p2, 35, 0.3, f.r * 2); };
  R.sporeBlast = (f) => { const p2 = P('spore'); smokePuff(f.x, 0.9, f.z, col('#b050b8'), { count: 16, size: 2.2, speed: f.r * 1.3, up: 1.5 }); burst(f.x, 0.8, f.z, p2, { count: 40, speed: f.r * 2, up: 3, shape: 3, size: 0.3, gravity: 1 }); shock(f.x, 0.3, f.z, f.r, p2, 0.45, 0.8); flash(f.x, 1, f.z, p2, 20); };
  R.nullBurst = (f) => { const p2 = P('arcane'); shock(f.x, 0.4, f.z, f.r, p2, 0.45, 1); decalOnce(f, p2, { type: 5, life: 0.9, r: f.r, alpha: 1, spin: -1 }); burst(f.x, 1, f.z, p2, { count: 30, speed: f.r * 2.5, up: 2, shape: 4 }); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; arc(f.x, 1.3, f.z, f.x + Math.sin(a) * f.r, 0.3, f.z + Math.cos(a) * f.r, p2, 0.25, 0.12); } flash(f.x, 1.5, f.z, p2, 40, 0.25); };
  R.chronoBurst = (f) => { const p2 = P('chrono'); decalOnce(f, p2, { type: 9, life: 0.8, r: f.r, alpha: 0.7, spin: 1 }); shock(f.x, 0.3, f.z, f.r, p2, 0.5, 0.8); sphere(f.x, 0, f.z, f.r, p2, 0.7, { dome: true, alpha: 0.35, from: 0.2 }); burst(f.x, 0.6, f.z, p2, { count: 24, speed: 3, up: 2, shape: 4 }); flash(f.x, 1.5, f.z, p2, 30); };
  R.hookThrow = (f) => { const p2 = P('chain'); const L = f.length || 12, ex = f.x + Math.sin(f.angle) * L, ez = f.z + Math.cos(f.angle) * L; arc(f.x, 1.2, f.z, ex, 0.9, ez, p2, 0.45, 0.16, 0.04, 16); later(0.05, () => arc(f.x, 1.2, f.z, ex, 0.9, ez, P('danger'), 0.2, 0.08, 0.02, 8)); burst(ex, 0.9, ez, p2, { count: 12, speed: 5, up: 2, shape: 1, stretch: 1.5, size: 0.25 }); flash(ex, 1, ez, P('danger'), 14, 0.15); };
  R.bombBlast = (f) => { const p2 = P('fire'); sphere(f.x, 0.8, f.z, f.r * 0.85, p2, 0.45); shock(f.x, 0.3, f.z, f.r * 1.1, p2, 0.55, 1.6); burst(f.x, 0.8, f.z, p2, { count: 60, speed: 12, up: 7, size: 0.5 }); burst(f.x, 0.5, f.z, P('earth'), { count: 16, speed: 9, up: 9, shape: 7, gravity: 22 }); smokePuff(f.x, 1.2, f.z, col('#2a1a14'), { count: 12, size: 2.4, up: 3 }); decalOnce(f, p2, { type: 6, life: 2.5, r: f.r, alpha: 0.75, dark: true }); flash(f.x, 2, f.z, p2, 90, 0.4, 18); };
  R.webPatch = R.acidPool = R.sporeCloud = R.chronoField = 'zone';
  R.assassinate = R.snipe = R.pierceBolt = R.laser = (f) => { const p2 = P(f.kind === 'assassinate' ? 'blood' : f.palette || 'blade'); const L = f.length || (f.r || 8); const ex = f.x + Math.sin(f.angle) * L, ez = f.z + Math.cos(f.angle) * L; streak(f.x, f.z, ex, ez, p2, 0.35, f.width || 1.2, 1.1); burst(ex, 1, ez, p2, { count: 14, speed: 6, shape: 1, stretch: 2 }); flash(f.x, 1, f.z, p2, 30, 0.2); };
  R.vortex = R.blackHole = R.gravityWell = R.rift = R.abyssGate = 'zone';
  R.holySpin = (f) => { const p2 = P('holy'); slash(f.x, 1, f.z, Math.random() * TAU, f.r * 0.7, 360, p2, 0.25, rnd(-20, 20)); burst(f.x, 1, f.z, p2, { count: 16, speed: 10, up: 2, shape: 4, ring: f.r * 0.4 }); };
  R.bloodCyclone = (f) => { const p2 = P('blood'); slash(f.x, 1, f.z, Math.random() * TAU, f.r * 0.75, 360, p2, 0.25, rnd(-25, 25)); burst(f.x, 1, f.z, p2, { count: 16, speed: 10, up: 3, ring: f.r * 0.4 }); mesh('cone', { core: p2.core, main: p2.main, scroll: 4 }, 0.3, (m, k) => { m.position.set(f.x, 0, f.z); m.scale.set(f.r * 0.6, 6, f.r * 0.6); m.rotation.y += 0.5; m.material.uniforms.uAlpha.value = 0.6 * (1 - k); }); };
  R.musou_pillar = (f) => { const p2 = P('holy'); pillar(f.x, f.z, f.r * 0.5, 22, p2, 1.0); R.nova(f, p2, { count: 120, shape: 4, life: 0.8, thick: 3 }); for (let i = 0; i < 8; i++) later(i * 0.05, () => { const a = i / 8 * TAU; pillar(f.x + Math.sin(a) * f.r * 0.7, f.z + Math.cos(a) * f.r * 0.7, 1, 10, p2, 0.6); }); };
  R.musou_slam = (f) => { const p2 = P('blood'); R.echoSlam(f); R.nova(f, p2, { count: 100, life: 0.8, thick: 3 }); pillar(f.x, f.z, 3, 12, p2, 0.7); };
  R.musou_nova = (f) => { const p2 = P('arcane'); sphere(f.x, 1, f.z, f.r, p2, 0.8, { noise: 0.9 }); R.nova(f, p2, { count: 120, shape: 4, life: 0.9, thick: 3 }); };
  R.musou_crossSlash = (f) => { const p2 = P('blade'); for (let i = 0; i < 6; i++) later(i * 0.04, () => slash(f.x, 1.2, f.z, i * (TAU / 6), f.r * 1.2, 200, p2, 0.4, 45 * (i % 2 ? 1 : -1))); R.nova(f, p2, { count: 80, shape: 1, stretch: 2 }); };
  R.musou_bigBolt = (f) => { const p2 = P('shadow'); const ex = f.x + Math.sin(f.angle) * 22, ez = f.z + Math.cos(f.angle) * 22; streak(f.x, f.z, ex, ez, p2, 0.6, 4, 1.4); burst(ex, 1, ez, p2, { count: 60, speed: 12 }); R.nova(f, p2, { count: 40 }); };
  R.musou_darkNova = (f) => { const p2 = P('shadow'); R.nova(f, p2, { count: 100, shape: 5, life: 0.9, thick: 3 }); R.nova(f, P('poison'), { count: 40 }); sphere(f.x, 0, f.z, f.r, p2, 1, { dome: true, alpha: 0.5 }); };
  R.genesis = (f) => { const p2 = P('holy'); pillar(f.x, f.z, f.r * 0.4, 30, p2, 1.4); R.nova(f, p2, { count: 140, shape: 4, life: 1.2, thick: 4 }); flash(f.x, 4, f.z, p2, 120, 1, 40); };
  R.hostileImpact = (f) => { const p2 = P(f.palette && f.palette !== 'danger' ? f.palette : 'danger'); const sh = f.shape; if (sh === 'line') { streak(f.x, f.z, f.x + Math.sin(f.angle) * f.length, f.z + Math.cos(f.angle) * f.length, p2, 0.35, f.width, 1); } else { shock(f.x, 0.3, f.z, f.r || 2, p2, 0.4, 1); burst(f.x, 0.5, f.z, p2, { count: 16, speed: (f.r || 2) * 2.5, up: 4 }); } };
  R.darkCircle = R.pillarDark = (f) => { const p2 = P('shadow'); pillar(f.x, f.z, (f.r || 2) * 0.7, 5, p2, 0.45); burst(f.x, 0.4, f.z, p2, { count: 18, speed: 4, up: 6, shape: 5 }); };
  R.iceCircle = (f) => R.iceBurst({ ...f, r: f.r || 2.5 });
  R.eruption = (f) => { const p2 = P('fire'); const L = f.length || 12; for (let i = 0; i < 6; i++) { const t = (i + 0.5) / 6; later(i * 0.03, () => { const x = f.x + Math.sin(f.angle) * L * t, z = f.z + Math.cos(f.angle) * L * t; pillar(x, z, (f.width || 2) * 0.5, 4, p2, 0.45); burst(x, 0.4, z, p2, { count: 8, speed: 3, up: 8 }); }); } };
  R.apocalypse = (f) => { const p2 = P('danger'); flash(f.x, 6, f.z, p2, 120, 0.8, 50); for (let i = 0; i < 18; i++) { const a = Math.random() * TAU, d = Math.random() * 16; later(Math.random() * 0.4, () => { pillar(f.x + Math.sin(a) * d, f.z + Math.cos(a) * d, 1.6, 9, p2, 0.6); }); } };
  R.spawnPortal = (f) => { const p2 = P('shadow'); decalOnce(f, p2, { type: 4, life: 1.2, r: f.r, alpha: 0.9, spin: 1 }); rise(f.x, f.z, f.r * 0.6, p2, { count: 12, speed: 4, shape: 5, size: 0.5 }); };
  R.summonCircle = R.summonGrove = R.summonRock = R.summonStar = (f) => { const p2 = P(f.kind === 'summonGrove' ? 'nature' : f.kind === 'summonRock' ? 'earth' : f.kind === 'summonStar' ? 'arcane' : 'poison'); decalOnce(f, p2, { type: 5, life: 1.0, r: (f.r || 1.4) * 1.3, alpha: 1, spin: 1 }); rise(f.x, f.z, f.r || 1.4, p2, { count: 20, speed: 5, size: 0.35 }); flash(f.x, 1, f.z, p2, 20); };
  R.allyFade = (f) => burst(f.x, 1, f.z, P('shadow'), { count: 10, speed: 2, up: 3, shape: 5 });
  R.telegraphFriendly = (f, pp) => telegraphFriendly(f, pp, f.life);
  R.smoke = (f) => { smokePuff(f.x, 0.6, f.z, col('#5a5a66'), { count: 18, size: 2.4, speed: (f.r || 4) * 0.8, up: 1, life: 2 }); burst(f.x, 1, f.z, P('shadow'), { count: 10, speed: 5, shape: 4 }); };
  R.tornado = (f) => { const p2 = P('storm'); mesh('cone', { core: col('#ffffff'), main: col('#b0c8e0'), scroll: 6, noise: 0.8 }, 2.4, (m, k) => { m.position.set(f.x, 0, f.z); m.rotation.y += 0.6; m.scale.set((f.r || 4) * (1 - k * 0.3), 7, (f.r || 4) * (1 - k * 0.3)); m.material.uniforms.uAlpha.value = 0.55 * Math.sin(Math.min(1, k * 1.2) * Math.PI); }); };
  R.trap = 'zone';
  R.dashTrail2 = R.dashTrail;
  R.stormCloud = 'zone'; R.emberGround = 'zone'; R.holyWard = 'zone'; R.poisonCloud = 'zone'; R.bloodPool = 'zone'; R.lavaPool = 'zone'; R.poisonBog = 'zone'; R.frostOrbHazard = 'zone'; R.zone = 'zone'; R.chrono = 'zone'; R.arrowRain = 'zone'; R.banner = 'zone'; R.bloodMist = 'zone';
  R.fissure = R.boneWall = (f) => { const p2 = f.kind === 'boneWall' ? { main: col('#f0ead8'), dark: col('#5a4a3a'), core: col('#ffffff') } : P('earth'); const L = f.length || 12, segs = Math.round(L / 0.9);
    for (let i = 0; i < segs; i++) { const t = (i + 0.5) / segs - 0.5, x = f.x + Math.sin(f.angle) * L * t, z = f.z + Math.cos(f.angle) * L * t; const life = Math.min(8, f.life || 4); later(i * 0.015, () => mesh('rock', { color: p2.main, emissive: p2.dark, emissiveIntensity: 0.3 }, life, (m, k) => { const g = k < 0.05 ? k / 0.05 : k > 0.9 ? (1 - k) / 0.1 : 1; m.position.set(x, 0.6 * g, z); m.scale.set(1.3, 2.2 * g + 0.1, 1.1); m.rotation.y = i * 1.7; })); }
    shock(f.x, 0.3, f.z, L * 0.5, P('earth'), 0.45, 1); smokePuff(f.x, 0.4, f.z, col('#7a6048'), { count: 10, size: 1.6, speed: 5 }); };

  // persistent recipes: return { update(f, dt), dispose() }
  const ZONES = {
    zone: { decal: 0, alpha: 0.35, parts: 'rise' },
    emberGround: { decal: 6, alpha: 0.6, parts: 'embers', dark: true },
    holyWard: { decal: 5, alpha: 0.85, parts: 'rise', spin: 0.4 },
    poisonCloud: { decal: 0, alpha: 0.35, parts: 'smoke', smokeColor: '#4a8a2a', palette: 'poison' },
    poisonBog: { decal: 0, alpha: 0.5, parts: 'bubbles', palette: 'poison', danger: true },
    bloodPool: { decal: 0, alpha: 0.55, parts: 'rise', palette: 'blood', dark: true },
    lavaPool: { decal: 6, alpha: 0.75, parts: 'embers', palette: 'fire' },
    frostOrbHazard: { decal: 1, alpha: 0.6, parts: 'rise', palette: 'frost', danger: true },
    blackHole: { decal: 4, alpha: 1, parts: 'suck', spin: 1.2, core: 'sphere' },
    vortex: { decal: 4, alpha: 1, parts: 'suck', spin: 1.4, core: 'sphere' },
    gravityWell: { decal: 4, alpha: 0.7, parts: 'suck', spin: 1 },
    rift: { decal: 4, alpha: 0.9, parts: 'suck', spin: -1 },
    abyssGate: { decal: 4, alpha: 1, parts: 'suck', spin: 0.8, core: 'pillar', palette: 'shadow' },
    chrono: { decal: 5, alpha: 0.9, core: 'dome', spin: 0.15 },
    stormCloud: { decal: 0, alpha: 0.25, parts: 'cloud', palette: 'storm' },
    arrowRain: { decal: 1, alpha: 0.4, parts: 'arrows', palette: 'blade' },
    banner: { decal: 5, alpha: 0.6, parts: 'rise', palette: 'holy', spin: 0.3, core: 'banner' },
    bloodMist: { decal: 0, alpha: 0.2, parts: 'mist', palette: 'blood' },
    trap: { decal: 5, alpha: 0.6, palette: 'fire' },
    webPatch: { decal: 8, alpha: 0.75, palette: 'web' },
    acidPool: { decal: 0, alpha: 0.55, parts: 'bubbles', palette: 'acid', danger: true },
    sporeCloud: { decal: 0, alpha: 0.28, parts: 'smoke', smokeColor: '#b050b8', palette: 'spore' },
    chronoField: { decal: 9, alpha: 0.55, core: 'dome', spin: 0.3, palette: 'chrono' },
  };
  function zoneHandle(f) {
    const z = ZONES[f.kind] || ZONES.zone;
    const pp = P(z.palette || f.palette || 'arcane');
    let core = null;
    if (z.core === 'sphere') core = pool.get('sphere', { core: col('#000000'), main: pp.main, noise: 0.3, fres: 1.2 });
    if (z.core === 'dome') core = pool.get('dome', { core: pp.core, main: pp.main, noise: 0.7, fres: 2.2 });
    if (z.core === 'pillar') core = pool.get('cylinder', { core: pp.core, main: pp.main, scroll: 2 });
    let acc = 0;
    return {
      update(f, dt, game) {
        const k = f.maxLife > 0 ? f.t / f.maxLife : 0;
        const fade = Math.min(1, f.t * 4) * Math.min(1, (f.life) * 3);
        let x = f.x, zz = f.z;
        if (f.follow === 'player') { x = game.player.x; zz = game.player.z; }
        const r = f.r || 3;
        (z.dark || z.danger ? decalsDark : decalsAdd).push(x, 0.04, zz, (z.spin || 0) * f.t * 2, r * 2, r * 2, z.danger ? (z.palette === 'acid' ? col('#c8ff2a') : col('#a0ff60')) : pp.main, z.dark ? 0.75 : 0.9, z.decal, 0.82, 0, 0.12, 0, f.t, z.alpha * fade, z.spin || 0);
        if (z.core === 'sphere') decalsDark.push(x, 0.05, zz, 0, r * 1.1, r * 1.1, col('#000000'), 0.9 * fade, 0, 0, 0, 0.5, 0, f.t, 1, 0);
        if (core) {
          if (z.core === 'sphere') { core.position.set(x, 1.2, zz); core.scale.setScalar(r * 0.22 * fade + 0.01); core.material.uniforms.uAlpha.value = fade; }
          if (z.core === 'dome') { core.position.set(x, 0, zz); core.scale.setScalar(r); core.material.uniforms.uAlpha.value = 0.4 * fade; }
          if (z.core === 'pillar') { core.position.set(x, 0, zz); core.scale.set(r * 0.4, 14, r * 0.4); core.material.uniforms.uAlpha.value = 0.7 * fade; }
        }
        acc += dt;
        const rate = z.parts === 'suck' ? 0.02 : z.parts === 'arrows' ? 0.03 : 0.07;
        while (acc > rate) {
          acc -= rate;
          const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * r;
          const px = x + Math.sin(a) * d, pz = zz + Math.cos(a) * d;
          switch (z.parts) {
            case 'rise': parts.emit({ x: px, y: 0.1, z: pz, vy: rnd(1, 3), life: 0.9, size: 0.25, color: pp.main, color2: pp.dark, drag: 0.5, shape: pp.shape }); break;
            case 'embers': parts.emit({ x: px, y: 0.1, z: pz, vy: rnd(2, 4), vx: rnd(-0.5, 0.5), life: 0.8, size: 0.18, color: col('#ffb060'), color2: col('#ff3000'), drag: 0.5, shape: 0 }); break;
            case 'smoke': smoke.emit({ x: px, y: 0.4, z: pz, vy: 0.3, life: 1.6, size: 1.2, size1: 2.2, color: col(z.smokeColor), alpha: 0.35, drag: 1, shape: 5 }); break;
            case 'bubbles': parts.emit({ x: px, y: 0.1, z: pz, vy: rnd(0.5, 1.5), life: 0.7, size: 0.22, color: col('#a0ff60'), color2: col('#205010'), drag: 0.5, shape: 3 }); break;
            case 'suck': { const rr = r * 1.3; const sx = x + Math.sin(a) * rr, sz = zz + Math.cos(a) * rr; parts.emit({ x: sx, y: rnd(0.2, 2), z: sz, vx: (x - sx) * 2.2 + Math.cos(a) * 3, vy: 0, vz: (zz - sz) * 2.2 - Math.sin(a) * 3, life: 0.5, size: 0.28, color: pp.core, color2: pp.main, drag: 0.2, shape: 1, stretch: 1.5 }); break; }
            case 'cloud': smoke.emit({ x: px, y: 6.5, z: pz, vx: rnd(-0.5, 0.5), life: 1.4, size: 2, size1: 3, color: col('#2a2a3a'), alpha: 0.5, drag: 1, shape: 5 }); break;
            case 'arrows': parts.emit({ x: px, y: 9, z: pz, vy: -26, life: 0.35, size: 0.3, color: col('#ffffff'), color2: col('#c0b090'), drag: 0, shape: 1, stretch: 3 }); break;
            case 'mist': smoke.emit({ x: px, y: 0.6, z: pz, vy: 0.3, life: 1, size: 0.8, size1: 1.6, color: col('#801020'), alpha: 0.3, drag: 1, shape: 5 }); break;
            default: break;
          }
        }
      },
      dispose() { if (core) pool.release(core); },
    };
  }

  // ---------------------------------------------------------------- persistent kinds
  function followHandle(f) {
    // buff/mark visuals following the player or an enemy (by uid)
    const pp = P(f.palette || ({ angelWings: 'holy', seraphWings: 'holy', godStrength: 'holy', bloodRage: 'blood', goldenAura: 'holy', thornShell: 'nature', windTrail: 'storm', shieldBubble: 'frost', healAura: 'nature', lichForm: 'shadow', frostAura: 'frost', bladeFury: 'blade', doomMark: 'shadow', huntMark: 'blood', drain: 'blood', staticPulse: 'storm' }[f.kind] || 'arcane'));
    let shell = null, acc = 0;
    if (['shieldBubble', 'goldenAura', 'lichForm'].includes(f.kind)) shell = pool.get('sphere', { core: pp.core, main: pp.main, noise: 0.5, fres: 2.5 });
    if (f.kind === 'bladeFury') shell = pool.get('cone', { core: col('#ffffff'), main: pp.dark, scroll: 6, noise: 0.7 });
    return {
      update(f, dt, game) {
        let x, y = 0, z;
        if (f.follow === 'player') { x = game.player.x; z = game.player.z; y = game.player.y; }
        else { const e = game.enemyById?.get(f.follow); if (!e) { x = f.lx; z = f.lz; } else { x = e.x; z = e.z; y = e.y; f.lx = x; f.lz = z; } }
        if (x == null) return;
        const fade = Math.min(1, f.t * 5) * Math.min(1, f.life * 3);
        if (shell) {
          if (f.kind === 'bladeFury') { shell.position.set(x, 0, z); shell.rotation.y += dt * 18; shell.scale.set(3.2, 2.4, 3.2); shell.material.uniforms.uAlpha.value = 0.55 * fade; }
          else { shell.position.set(x, y + 1.1, z); shell.scale.setScalar(1.6); shell.material.uniforms.uAlpha.value = 0.4 * fade; }
        }
        acc += dt;
        while (acc > 0.05) {
          acc -= 0.05;
          const a = Math.random() * TAU;
          switch (f.kind) {
            case 'doomMark': case 'huntMark': decalsAdd.push(x, 0.05, z, f.t * 2, 2.6, 2.6, pp.main, 1, 5, 0, 0, 0.1, 0, f.t, fade * 0.8, 0); parts.emit({ x: x + rnd(-0.4, 0.4), y: y + 2.6, z: z + rnd(-0.4, 0.4), vy: 1.5, life: 0.5, size: 0.35, color: pp.main, color2: pp.dark, shape: 5 }); break;
            case 'angelWings': case 'seraphWings': for (const s of [-1, 1]) parts.emit({ x: x + Math.sin(game.player.face + s * 1.9) * rnd(0.6, 1.8), y: y + rnd(1.4, 2.8), z: z + Math.cos(game.player.face + s * 1.9) * rnd(0.6, 1.8), vy: 0.6, life: 0.5, size: 0.4, color: pp.core, color2: pp.main, shape: 4 }); break;
            case 'drain': { const pl = game.player; parts.emit({ x, y: y + 1, z, vx: (pl.x - x) * 3, vy: 0, vz: (pl.z - z) * 3, life: 0.33, size: 0.3, color: pp.main, color2: pp.core, drag: 0, shape: 1, stretch: 1.2 }); break; }
            case 'bladeFury': parts.emit({ x: x + Math.sin(a) * 2.8, y: y + 1, z: z + Math.cos(a) * 2.8, vx: Math.cos(a) * 9, vz: -Math.sin(a) * 9, life: 0.2, size: 0.3, color: col('#ffffff'), color2: pp.dark, shape: 1, stretch: 2 }); break;
            default: parts.emit({ x: x + Math.sin(a) * 0.9, y: y + rnd(0.2, 2), z: z + Math.cos(a) * 0.9, vy: rnd(0.8, 2.4), life: 0.55, size: 0.28, color: pp.main, color2: pp.dark, shape: pp.shape }); break;
          }
        }
        if (f.kind === 'drain') { const pl = game.player; bolts.bolt(x, y + 1, z, pl.x, pl.y + 1.1, pl.z, pp.main, 0.6 * fade, 0.15, 0.3, 6); }
      },
      dispose() { if (shell) pool.release(shell); },
    };
  }

  const DANGER = col('#ff2a1a'), DANGER_EDGE = col('#ff6a3a'), SAFE = col('#50ff9a');
  function dangerHandle(f) {
    return {
      update(f, dt, game) {
        let x = f.x, z = f.z, ang = f.angle || 0;
        if (f.follow) { const e = game.enemyById?.get(f.follow); if (e) { x = e.x; z = e.z; ang = e.face; } }
        const prog = Math.min(1, f.t / Math.max(0.05, f.windup || f.maxLife));
        const pulse = 0.85 + Math.sin(f.t * 18) * 0.15 * prog;
        const a = (f.small ? 0.55 : 0.9) * pulse;
        switch (f.shape) {
          case 'circle': decalsDark.push(x, 0.05, z, 0, f.r * 2, f.r * 2, DANGER, a, 0, 0, 0, 0.06, Math.max(0.01, prog)); break;
          case 'ring': decalsDark.push(x, 0.05, z, 0, f.r * 2, f.r * 2, DANGER, a, 1, f.inner / f.r, 0, 0.04, Math.max(0.01, prog)); break;
          case 'arc': decalsDark.push(x, 0.05, z, ang, f.r * 2, f.r * 2, DANGER, a, 2, 0, (f.arc * Math.PI / 180) / 2, 0.05, Math.max(0.01, prog)); break;
          case 'line': { const L = f.length; decalsDark.push(x + Math.sin(ang) * L / 2, 0.05, z + Math.cos(ang) * L / 2, ang, f.width, L, DANGER, a, 3, 0, 0, 0.08, Math.max(0.01, prog)); break; }
          case 'safe': {
            decalsDark.push(x, 0.04, z, 0, 60, 60, DANGER, 0.35 * pulse, 0, 0, 0, 0.02, 0);
            for (const s of f.safe) decalsAdd.push(s.x, 0.06, s.z, f.t, s.r * 2, s.r * 2, SAFE, 1, 5, 0, 0, 0.1, 0, f.t, 1, 0.5);
            break;
          }
          default: break;
        }
        if (prog > 0.8 && !f.small && Math.random() < 0.3) parts.emit({ x: x + rnd(-1, 1), y: 0.1, z: z + rnd(-1, 1), vy: 2, life: 0.3, size: 0.25, color: DANGER_EDGE, color2: DANGER, shape: 0 });
      },
      dispose() {},
    };
  }

  // soul tether beam (wraith -> hero) and its aiming flicker
  function tetherHandle(f) {
    const pp = P('tether');
    let acc = 0;
    return {
      update(f, dt, game) {
        const e = game.enemyById?.get(f.follow), p = game.player;
        if (!e || e.dying || p.dead) return;
        const ex = e.x, ey = 1.6, ez = e.z, px = p.x, py = p.y + 1.1, pz = p.z;
        if (f.kind === 'tetherAim') {
          const k = Math.min(1, f.t / Math.max(0.05, f.windup || 0.6));
          bolts.bolt(ex, ey, ez, ex + (px - ex) * k, py, ez + (pz - ez) * k, pp.main, 0.35 + 0.4 * k, 0.07, 0.5, 8);
          return;
        }
        if (p.debuffs?.tether?.src !== f.follow) return;
        const fade = Math.min(1, f.t * 5);
        bolts.bolt(ex, ey, ez, px, py, pz, pp.main, 0.75 * fade, 0.3, 0.6, 10);
        bolts.bolt(ex, ey, ez, px, py, pz, pp.core, 0.6 * fade, 0.1, 0.9, 10);
        decalsAdd.push(px, 0.05, pz, game.time * 2, 2.2, 2.2, pp.main, 0.7, 5, 0, 0, 0.1, 0, game.time, fade, 1);
        acc += dt;
        while (acc > 0.035) { acc -= 0.035; const t = Math.random(); parts.emit({ x: px + (ex - px) * t, y: py + (ey - py) * t, z: pz + (ez - pz) * t, vx: (ex - px) * 1.4, vy: rnd(-0.3, 0.3), vz: (ez - pz) * 1.4, life: 0.35, size: 0.32, color: pp.core, color2: pp.main, shape: 5, drag: 0.5 }); }
      },
      dispose() {},
    };
  }

  // basilisk gaze: the telegraph is the exact cone that fills the hero's petrify meter
  const GAZE = col('#ffb02a'), GAZE_HOT = col('#ff5a1a');
  function gazeHandle(f) {
    return {
      update(f, dt, game) {
        const e = game.enemyById?.get(f.follow);
        if (!e || e.dying) return;
        const prog = Math.min(1, f.t / Math.max(0.05, f.windup));
        const live = f.t >= f.windup;
        const hot = live && game.player.gazedBy == null && (game.player.gaze || 0) > 0.05;
        const pulse = 0.8 + Math.sin(f.t * 14) * 0.2;
        decalsDark.push(e.x, 0.05, e.z, e.face, f.r * 2, f.r * 2, hot ? GAZE_HOT : GAZE, (live ? 0.6 : 0.4) * pulse, 2, 0, (f.arc * Math.PI / 180) / 2, 0.05, live ? 1 : Math.max(0.01, prog));
        if (live && Math.random() < 0.7) {
          const a = e.face + (Math.random() - 0.5) * f.arc * Math.PI / 180, d = Math.random() * f.r;
          parts.emit({ x: e.x + Math.sin(a) * d, y: 0.2, z: e.z + Math.cos(a) * d, vy: rnd(0.5, 1.5), life: 0.5, size: 0.3, color: col('#ffe0a0'), color2: col('#806040'), shape: 7 });
        }
        if (live) for (const s of [-1, 1]) { const hx = e.x + Math.sin(e.face) * 1.0 + Math.cos(e.face) * s * 0.17, hz = e.z + Math.cos(e.face) * 1.0 - Math.sin(e.face) * s * 0.17; bolts.bolt(hx, 0.95, hz, hx + Math.sin(e.face) * 3, 0.5, hz + Math.cos(e.face) * 3, GAZE, 0.45, 0.06, 0.1, 4); }
      },
      dispose() {},
    };
  }

  function bossBeamsHandle(f) {
    const pp = P('holy');
    const beams = [];
    for (let i = 0; i < f.count; i++) beams.push(pool.get('cylinder', { core: pp.core, main: pp.main, scroll: 6, noise: 0.4, fadeTop: 0 }));
    return {
      update(f, dt, game) {
        const e = game.enemyById?.get(f.follow); if (!e) return;
        const active = f.t >= f.windup;
        const prog = active ? (f.t - f.windup) / f.dur : 0;
        beams.forEach((m, i) => {
          const a = f.base + (i / f.count) * TAU + prog * f.rotate * Math.PI / 180;
          m.position.set(e.x, 1.2, e.z); m.rotation.set(Math.PI / 2, 0, 0); m.rotation.y = 0;
          m.rotation.set(0, a, 0); m.rotateX(Math.PI / 2);
          const w = active ? f.width * 0.5 : 0.1;
          m.scale.set(w, f.length, w);
          m.material.uniforms.uAlpha.value = active ? 0.9 : 0.35;
          if (!active) { const L = f.length; decalsDark.push(e.x + Math.sin(a) * L / 2, 0.05, e.z + Math.cos(a) * L / 2, a, f.width, L, DANGER, 0.7, 3, 0, 0, 0.08, f.t / f.windup); }
        });
      },
      dispose() { for (const m of beams) pool.release(m); },
    };
  }

  function beamHandle(f) {
    const pp = P(f.palette || 'arcane');
    const m = pool.get('cylinder', { core: pp.core, main: pp.main, scroll: 8, noise: 0.4, fadeTop: 0 });
    return {
      update(f, dt, game) {
        const p = game.player;
        m.position.set(p.x + Math.sin(p.face) * 0.8, 1.2, p.z + Math.cos(p.face) * 0.8);
        m.rotation.set(0, p.face, 0); m.rotateX(Math.PI / 2);
        m.scale.set(f.width * 0.45, f.length, f.width * 0.45);
        m.material.uniforms.uAlpha.value = Math.min(1, f.life * 4);
        if (Math.random() < 0.6) { const t = Math.random() * f.length; parts.emit({ x: p.x + Math.sin(p.face) * t, y: 1.2, z: p.z + Math.cos(p.face) * t, vy: rnd(-1, 1), vx: rnd(-2, 2), life: 0.3, size: 0.3, color: pp.core, color2: pp.main, shape: 4 }); }
      },
      dispose() { pool.release(m); },
    };
  }

  function waveHandle(f) {
    const pp = P(f.palette || (f.kind === 'flameWedge' ? 'fire' : f.kind === 'holyWave' ? 'holy' : 'arcane'));
    return {
      update(f, dt) {
        const traveled = Math.min(f.length, f.t * f.speed);
        const k = traveled / f.length;
        const width = f.width + (f.width2 - f.width) * k;
        const fx = Math.sin(f.angle), fz = Math.cos(f.angle);
        const cx = f.x + fx * traveled, cz = f.z + fz * traveled;
        const fade = Math.min(1, f.life * 3);
        decalsAdd.push(f.x + fx * traveled / 2, 0.05, f.z + fz * traveled / 2, f.angle, (f.width + width) / 2, Math.max(0.5, traveled), pp.main, 0.55 * fade, 3, 0, 0, 0.5, 0, f.t, 1, 0);
        const count = f.kind === 'flameWedge' ? 10 : 6;
        for (let i = 0; i < n(count); i++) {
          const s = (Math.random() - 0.5) * width;
          parts.emit({ x: cx + fz * s, y: rnd(0.2, 1.5), z: cz - fx * s, vx: fx * f.speed * 0.4 + rnd(-1, 1), vy: rnd(1, 4), vz: fz * f.speed * 0.4 + rnd(-1, 1), life: rnd(0.35, 0.7), size: rnd(0.4, 0.9), color: Math.random() < 0.4 ? pp.core : pp.main, color2: pp.dark, drag: 2, shape: f.kind === 'holyWave' ? 4 : pp.shape });
        }
      },
      dispose() {},
    };
  }

  function ringHandle(f) {
    const pp = P(f.palette || (f.kind === 'poisonNova' ? 'poison' : f.kind === 'bloodScythe' ? 'blood' : f.kind === 'frostRing' ? 'frost' : 'arcane'));
    return {
      update(f) {
        const speed = f.r / Math.max(0.1, f.maxLife - 0.25);
        const cur = Math.min(f.r, f.t * speed);
        const fade = Math.min(1, f.life * 4);
        decalsAdd.push(f.x, 0.06, f.z, 0, cur * 2 + 0.1, cur * 2 + 0.1, pp.main, fade, 1, Math.max(0, 1 - (f.width || 1.4) / Math.max(0.5, cur)), 0, 0.1, 0, f.t, 1, 0);
        for (let i = 0; i < n(6); i++) { const a = Math.random() * TAU; parts.emit({ x: f.x + Math.sin(a) * cur, y: 0.4, z: f.z + Math.cos(a) * cur, vx: Math.sin(a) * 2, vy: rnd(1, 3), vz: Math.cos(a) * 2, life: 0.4, size: 0.35, color: pp.main, color2: pp.dark, shape: pp.shape }); }
      },
      dispose() {},
    };
  }

  function chainHandle(f) {
    const pp = P(f.palette || 'storm');
    return {
      update(f) {
        const pts = f.points; if (!pts || pts.length < 2) return;
        const fade = Math.min(1, f.life / Math.max(0.05, f.maxLife) * 2);
        for (let i = 0; i < pts.length - 1; i++) {
          const a = pts[i], b = pts[i + 1];
          bolts.bolt(a.x, (a.y ?? 1.2), a.z, b.x, (b.y ?? 1.2), b.z, pp.main, fade, 0.22, 0.7, 7);
          bolts.bolt(a.x, (a.y ?? 1.2), a.z, b.x, (b.y ?? 1.2), b.z, pp.core, fade * 0.8, 0.08, 0.9, 7);
        }
      },
      dispose() {},
    };
  }

  function orbitHandle(f) {
    const vfx = f.vfx;
    const pp = P(vfx === 'bee' ? 'nature' : vfx === 'sword' ? 'blade' : vfx === 'fireOrb' ? 'fire' : f.palette || 'arcane');
    const meshes = [];
    return {
      update(f, dt, game) {
        const o = game.orbits.find((x) => x.uid === f.orbit);
        if (!o || !o.points) { meshes.forEach((m) => (m.visible = false)); return; }
        while (meshes.length < o.points.length) meshes.push(vfx === 'sword' ? pool.get('blade', { core: col('#ffffff'), main: pp.dark, noise: 0.1, fadeTop: 0 }) : pool.get('sphere', { core: pp.core, main: pp.main, noise: 0.5, fres: 1.4 }));
        o.points.forEach((pt, i) => {
          const m = meshes[i]; m.visible = true;
          if (vfx === 'sword') { m.position.set(pt.x, 1.1, pt.z); m.rotation.set(0, pt.a + Math.PI / 2, 0); m.rotateX(Math.PI / 2); m.scale.set(0.35, 1.6 * o.size, 1); }
          else { m.position.set(pt.x, 1.1 + Math.sin(game.time * 6 + i) * 0.15, pt.z); m.scale.setScalar(o.size * (vfx === 'bee' ? 0.6 : 0.9)); }
          if (Math.random() < 0.6) parts.emit({ x: pt.x, y: 1.1, z: pt.z, vy: 0.5, life: 0.35, size: o.size * 0.8, color: pp.main, color2: pp.dark, shape: vfx === 'sword' ? 1 : pp.shape, stretch: vfx === 'sword' ? 1 : 0 });
        });
        for (let i = o.points.length; i < meshes.length; i++) meshes[i].visible = false;
      },
      dispose() { meshes.forEach((m) => pool.release(m)); },
    };
  }

  // ---------------------------------------------------------------- small utilities used by recipes
  const timers = [];
  function later(t, fn) { if (t <= 0) fn(); else timers.push({ t, fn }); }
  const trails = [];
  function arc(ax, ay, az, bx, by, bz, pp, life = 0.2, width = 0.15, jag = 0.8, segs = 8) { arcs.push({ ax, ay, az, bx, by, bz, pp, life, max: life, width, jag, segs }); }
  const arcs = [];
  function streak(x1, z1, x2, z2, pp, life = 0.35, width = 1.2, y = 1) {
    const L = Math.hypot(x2 - x1, z2 - z1) || 0.1, ang = Math.atan2(x2 - x1, z2 - z1);
    streaks.push({ x: (x1 + x2) / 2, z: (z1 + z2) / 2, ang, L, width, pp, life, max: life, y });
    for (let i = 0; i < n(12); i++) { const t = Math.random(); parts.emit({ x: x1 + (x2 - x1) * t, y: y * rnd(0.5, 1.4), z: z1 + (z2 - z1) * t, vx: Math.sin(ang) * 6, vz: Math.cos(ang) * 6, vy: rnd(-0.5, 1), life: rnd(0.2, 0.45), size: 0.3, color: pp.core, color2: pp.main, shape: 1, stretch: 2 }); }
  }
  const streaks = [];
  function decalOnce(f, pp, { type = 0, life = 1, r = 2, alpha = 0.6, dark = false, spin = 0 } = {}) { decalOnces.push({ x: f.x, z: f.z, type, life, max: life, r, alpha, dark, pp, spin, t: 0 }); }
  const decalOnces = [];
  function telegraphFriendly(f, pp, d) { decalOnces.push({ x: f.x, z: f.z, type: 5, life: d, max: d, r: f.r || 2, alpha: 0.85, dark: false, pp, spin: 0.6, t: 0, fill: true }); }
  function runeTelegraph(f, pp, d) { telegraphFriendly(f, pp, d); }
  function ringWave(f, pp, o = {}) { /* drawn by ringHandle while alive */ }
  function waveFx() {}
  function heroSlash(f) {
    const pp = P(f.palette || 'blade');
    if (f.shape === 'line') { streak(f.x, f.z, f.x + Math.sin(f.angle) * f.length, f.z + Math.cos(f.angle) * f.length, pp, 0.22, (f.width || 1.6) * 0.8, 1.1); return; }
    if (f.shape === 'circle') { slash(f.x, 0.9, f.z, f.angle, f.r, 360, pp, 0.3, 0); burst(f.x, 1, f.z, pp, { count: 10, speed: 9, up: 1, shape: 1, stretch: 2, ring: f.r * 0.5 }); return; }
    slash(f.x, 1.0, f.z, f.angle, f.r * 0.95, f.arc || 150, pp, f.kind2 === 'charge' ? 0.32 : 0.24, f.tilt || 0, f.mirror, 1);
    if (f.kind2 === 'charge') slash(f.x, 1.0, f.z, f.angle, f.r * 1.05, (f.arc || 150) * 1.05, P(f.palette === 'blade' ? 'holy' : f.palette), 0.32, (f.tilt || 0) + 8, f.mirror, 1);
  }

  // ---------------------------------------------------------------- main sync
  function handleFor(f) {
    if (f.kind === 'danger') return dangerHandle(f);
    if (f.kind === 'bossBeams') return bossBeamsHandle(f);
    if (f.kind === 'tether' || f.kind === 'tetherAim') return tetherHandle(f);
    if (f.kind === 'gazeCone') return gazeHandle(f);
    if (f.kind === 'orbit') return orbitHandle(f);
    if (f.kind === 'chainBolt' || f.kind === 'drain' && !f.follow) return chainHandle(f);
    if (['flameWedge', 'holyWave', 'wave'].includes(f.kind)) return waveHandle(f);
    if (['frostRing', 'poisonNova', 'bloodScythe', 'ring'].includes(f.kind) && f.width) return ringHandle(f);
    if (['beam', 'starBeam'].includes(f.kind)) return beamHandle(f);
    if (f.zone || R[f.kind] === 'zone') return zoneHandle(f);
    if (f.follow != null) return followHandle(f);
    return null;
  }

  return {
    sync(game, dt) {
      const t = game.time;
      decalsAdd.uniforms.uTime.value = t; decalsDark.uniforms.uTime.value = t;
      if (!game.enemyById || game.enemyById.frame !== game.time) { game.enemyById = new Map(game.enemies.map((e) => [e.uid, e])); game.enemyById.frame = game.time; }
      const seen = new Set();
      for (const f of game.effects) {
        seen.add(f.id);
        let h = handles.get(f.id);
        if (!h) {
          h = handleFor(f);
          if (!h) {
            const fn = R[f.kind] && R[f.kind] !== 'zone' ? R[f.kind] : f.kind?.endsWith('Burst') ? R.burst : f.points ? R.chainBolt : f.r ? R.nova : null;
            if (fn) fn(f, P(f.palette || 'arcane'));
            h = { update() {}, dispose() {}, once: true };
            if (f.kind === 'chainBolt') h = chainHandle(f);
          }
          handles.set(f.id, h);
        }
        h.update(f, dt, game);
      }
      for (const [id, h] of handles) if (!seen.has(id)) { h.dispose(); handles.delete(id); }
      // timers
      for (let i = timers.length - 1; i >= 0; i--) { timers[i].t -= dt; if (timers[i].t <= 0) { const fn = timers[i].fn; timers.splice(i, 1); fn(); } }
      // transient meshes
      for (let i = transient.length - 1; i >= 0; i--) {
        const tr = transient[i]; tr.life -= dt;
        if (tr.life <= 0) { pool.release(tr.m); transient.splice(i, 1); continue; }
        tr.update?.(tr.m, 1 - tr.life / tr.max);
      }
      // arcs, streaks, one-shot decals, trails
      for (let i = arcs.length - 1; i >= 0; i--) { const a = arcs[i]; a.life -= dt; if (a.life <= 0) { arcs.splice(i, 1); continue; } const k = a.life / a.max; bolts.bolt(a.ax, a.ay, a.az, a.bx, a.by, a.bz, a.pp.main, k, a.width * 1.6, a.jag, a.segs); bolts.bolt(a.ax, a.ay, a.az, a.bx, a.by, a.bz, a.pp.core, k, a.width * 0.6, a.jag, a.segs); }
      for (let i = streaks.length - 1; i >= 0; i--) { const s = streaks[i]; s.life -= dt; if (s.life <= 0) { streaks.splice(i, 1); continue; } const k = s.life / s.max; decalsAdd.push(s.x, 0.07, s.z, s.ang, s.width, s.L, s.pp.main, k, 3, 0, 0, 0.6, 0, 0, 1, 0); }
      for (let i = decalOnces.length - 1; i >= 0; i--) { const d = decalOnces[i]; d.life -= dt; d.t += dt; if (d.life <= 0) { decalOnces.splice(i, 1); continue; } const k = d.life / d.max; (d.dark ? decalsDark : decalsAdd).push(d.x, 0.045, d.z, d.spin * d.t * 2, d.r * 2, d.r * 2, d.dark ? d.pp.dark.clone().multiplyScalar(0.3) : d.pp.main, d.alpha * Math.min(1, k * 2), d.type, 0.8, 0, 0.12, d.fill ? Math.max(0.01, 1 - k) : 0, d.t, 1, d.spin); }
      for (let i = trails.length - 1; i >= 0; i--) { const tr = trails[i]; tr.t += dt; if (tr.t >= tr.dur) { trails.splice(i, 1); continue; } }
      parts.update(dt); smoke.update(dt); lights.update(dt); pool.tick(t);
    },
    /** Decals and lightning are immediate-mode: everything pushed between begin() and end() draws this frame. */
    begin() { decalsAdd.begin(); decalsDark.begin(); bolts.begin(); },
    end() { decalsAdd.end(); decalsDark.end(); bolts.end(); },
    burst, smokePuff, shock, flash, slash, sphere, pillar, streak, arc: (...a) => arc(...a), P, parts, decalsAdd, decalsDark, bolts, pool, lights,
    clear() { for (const [, h] of handles) h.dispose(); handles.clear(); parts.clear(); smoke.clear(); for (const tr of transient) pool.release(tr.m); transient.length = 0; timers.length = 0; arcs.length = 0; streaks.length = 0; decalOnces.length = 0; },
    stats: () => ({ particles: parts.count, smoke: smoke.count, handles: handles.size, meshes: pool.live.size }),
  };
}
