import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { createArena } from './arena.js';
import { createCrowdRenderer } from './crowd.js';
import { createUnitRenderer } from './units.js';
import { createVfx } from './vfx.js';
import { createEntities } from './entities.js';
import { createNumbers } from './numbers.js';
import { createHeroFx } from './hero-fx.js';
import { createGradePass } from './grade.js';
import { col, pal } from './vfx-core.js';
import { DEBUFF } from '../game/content/debuffs.js';

const QUALITY = {
  high: { pixelRatio: 2, bloom: true, shadows: true, particles: 'high', shadowSize: 2048 },
  medium: { pixelRatio: 1.5, bloom: true, shadows: true, particles: 'medium', shadowSize: 1024 },
  low: { pixelRatio: 1, bloom: false, shadows: false, particles: 'low', shadowSize: 512 },
};

export function createRenderer(canvas, assets, { quality = 'high', onFrameStats } = {}) {
  const Q = QUALITY[quality] || QUALITY.high;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality !== 'low', powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.92;
  renderer.shadowMap.enabled = Q.shadows; renderer.shadowMap.type = THREE.PCFShadowMap;
  let pixelRatio = Math.min(window.devicePixelRatio || 1, Q.pixelRatio);
  renderer.setPixelRatio(pixelRatio);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 220);
  const arena = createArena(scene, assets, renderer);
  arena.sun.castShadow = Q.shadows; arena.sun.shadow.mapSize.set(Q.shadowSize, Q.shadowSize);
  const crowd = createCrowdRenderer(scene, assets);
  const units = createUnitRenderer(scene, assets);
  const vfx = createVfx(scene, { quality: Q.particles });
  const entities = createEntities(scene, vfx);
  const numbers = createNumbers(scene);
  const heroFx = createHeroFx(scene, vfx);
  // post: bloom (medium/high) -> tone map -> colour grade. Low quality keeps the grade but skips bloom.
  const composer = new EffectComposer(renderer);
  let bloom = null;
  composer.addPass(new RenderPass(scene, camera));
  if (Q.bloom) { bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.5, 0.5, 0.86); composer.addPass(bloom); }
  composer.addPass(new OutputPass());
  const grade = createGradePass();
  composer.addPass(grade.pass);
  const cam = { x: 0, z: 0, dist: 19, trauma: 0, fovKick: 0, zoom: 1, targetZoom: 1, lookY: 1 };
  const tmpV = new THREE.Vector3();
  let width = 1, height = 1, frameAvg = 16, lastAdapt = 0;

  function resize() {
    width = canvas.clientWidth || window.innerWidth; height = canvas.clientHeight || window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.fov = width < height ? 58 : 42;
    camera.updateProjectionMatrix();
    composer.setSize(width, height);
    bloom?.setSize(width * 0.5, height * 0.5);
  }
  resize();
  window.addEventListener('resize', resize);

  let adaptFrom = performance.now() + 4000;
  function adapt(ms) {
    if (ms > 200) return;
    frameAvg = frameAvg * 0.95 + ms * 0.05;
    const now = performance.now();
    if (now < adaptFrom || now - lastAdapt < 1500) return;
    const max = Math.min(window.devicePixelRatio || 1, Q.pixelRatio);
    if (frameAvg > 26 && pixelRatio > 0.75) { pixelRatio = Math.max(0.75, pixelRatio - 0.15); renderer.setPixelRatio(pixelRatio); resize(); lastAdapt = now; }
    else if (frameAvg < 18 && pixelRatio < max) { pixelRatio = Math.min(max, pixelRatio + 0.1); renderer.setPixelRatio(pixelRatio); resize(); lastAdapt = now; }
  }

  function handleEvents(game) {
    const p = game.player;
    for (const ev of game.events) {
      switch (ev.type) {
        case 'hit': {
          const hex = ev.color || '#ffffff';
          if (ev.source !== 'dot') {
            const pp = { core: col('#ffffff'), main: col(hex), dark: col(hex).clone().multiplyScalar(0.3) };
            vfx.burst(ev.x, ev.y * 0.55, ev.z, { ...pp, shape: 1 }, { count: ev.crit ? 10 : 4, speed: ev.crit ? 9 : 6, up: 2, size: ev.crit ? 0.45 : 0.28, life: 0.25, stretch: 2.2, shape: 1, gravity: 4 });
            if (ev.crit) vfx.flash(ev.x, 1.2, ev.z, pp, 14, 0.12, 6);
          }
          numbers.add(ev.x, ev.y, ev.z, ev.amount, { crit: ev.crit, hex: ev.source === 'dot' ? hex : ev.color || '#ffffff', big: ev.elite, small: ev.source === 'dot' || ev.source === 'proc' && !ev.crit });
          break;
        }
        case 'kill': {
          const big = ev.elite || ev.boss;
          const sc = ev.model && stainOf(ev.model);
          if (sc) vfx.stain(ev.x, ev.z, big ? 2.2 : 1.1 + Math.random() * 0.4, sc, big ? 9 : 6, 0);
          vfx.burst(ev.x, 1, ev.z, { core: col('#ffffff'), main: col('#f0e6d0'), dark: col('#6a5a4a') }, { count: big ? 26 : 8, speed: big ? 9 : 6, up: 6, size: 0.28, life: 0.7, gravity: 20, shape: 7 });
          vfx.burst(ev.x, 1, ev.z, pal2('soul'), { count: big ? 14 : 3, speed: 1.5, up: 4, size: 0.45, life: 0.9, gravity: -1, shape: 0 });
          if (big) { vfx.shock(ev.x, 0.3, ev.z, 4, pal2('holy'), 0.5); vfx.flash(ev.x, 1.5, ev.z, pal2('holy'), 40, 0.3, 12); }
          break;
        }
        case 'shake': cam.trauma = Math.min(1.2, cam.trauma + ev.a * 0.55 * api.shake); break;
        case 'hitstop': if (ev.t > 0.08) cam.fovKick = Math.max(cam.fovKick, ev.t * 18); break;
        case 'playerHit': cam.trauma = Math.min(1, cam.trauma + Math.min(0.4, ev.amount / Math.max(1, game.stats.maxHp) * 3) * api.shake); break;
        case 'levelup': vfx.pillar(p.x, p.z, 1.3, 9, pal2('holy'), 0.8); vfx.burst(p.x, 1, p.z, pal2('holy'), { count: 40, speed: 5, up: 7, shape: 4, size: 0.45 }); vfx.shock(p.x, 0.3, p.z, 5, pal2('holy'), 0.6); break;
        case 'musou': if (ev.phase === 'start') { cam.targetZoom = 0.72; cam.fovKick = 6; vfx.shock(p.x, 0.4, p.z, 8, pal2(ev.palette), 0.7, 2); vfx.flash(p.x, 2, p.z, pal2(ev.palette), 80, 0.5, 20); } else if (ev.phase === 'finish') { cam.fovKick = 10; } else if (ev.phase === 'end') cam.targetZoom = 1; break;
        case 'heal': if (ev.amount > 5) vfx.burst(p.x, 0.5, p.z, pal2('nature'), { count: 8, speed: 1.5, up: 3, shape: 4, size: 0.35, gravity: -1 }); break;
        case 'gold': numbers.add(ev.x, 1.2, ev.z, ev.amount, { hex: '#ffd76a', prefix: '+', small: true }); break;
        case 'dodge': vfx.smokePuff(p.x, 0.5, p.z, col('#8a8aa0'), { count: 4, size: 0.9, speed: 2, up: 0.3, life: 0.5 }); vfx.burst(p.x, 1, p.z, pal2('storm'), { count: 8, speed: 3, up: 1, shape: 1, stretch: 1.5, size: 0.25 }); break;
        case 'cast': { const pp = pal2(ev.faction || game.hero.palette); vfx.burst(p.x, 1.4, p.z, pp, { count: 14, speed: 4, up: 3, shape: 4, size: 0.35 }); vfx.decalsAdd && castCircles.push({ x: p.x, z: p.z, t: 0, pp }); break; }
        case 'guardBreak': vfx.burst(ev.x, 1.2, ev.z, pal2('frost'), { count: 18, speed: 8, up: 4, shape: 2, size: 0.4 }); break;
        case 'blocked': vfx.burst(ev.x, 1.2, ev.z, pal2('blade'), { count: 4, speed: 5, up: 2, shape: 1, stretch: 2, size: 0.25 }); break;
        case 'execute': vfx.slash(ev.x, 1, ev.z, Math.random() * 6.28, 2, 160, pal2('blood'), 0.25, 30); break;
        case 'land': if (Math.random() < 0.3) vfx.smokePuff(ev.x, 0.2, ev.z, col('#7a6a58'), { count: 2, size: 0.8, speed: 2, up: 0.2, life: 0.5 }); break;
        case 'bossSpawn': cam.trauma = 1; break;
        case 'status': if (ev.kind === 'freeze') vfx.burst(ev.x, 1, ev.z, pal2('frost'), { count: 4, speed: 2, up: 2, shape: 2, size: 0.3 }); break;
        case 'revive': vfx.pillar(p.x, p.z, 2, 14, pal2('holy'), 1.2); vfx.shock(p.x, 0.3, p.z, 9, pal2('holy'), 0.8, 2); break;
        case 'petrified': heroFx.burstPetrify(p.x, p.z); cam.trauma = Math.min(1, cam.trauma + 0.4 * api.shake); break;
        case 'debuff': if (ev.fresh) heroFx.burstDebuff(p.x, p.z, DEBUFF[ev.id]?.color || '#ffffff'); break;
        case 'debuffBurst': heroFx.burstDebuff(p.x, p.z, ev.id === 'webbed' ? '#ffffff' : '#8fe3ff'); vfx.shock(p.x, 0.3, p.z, 2.4, pal2(ev.id === 'webbed' ? 'blade' : 'frost'), 0.4); break;
        case 'cleanse': vfx.pillar(p.x, p.z, 1.2, 6, pal2('holy'), 0.6); vfx.burst(p.x, 1, p.z, pal2('holy'), { count: 24, speed: 4, up: 4, shape: 4 }); break;
        case 'tetherBreak': vfx.burst(p.x, 1.2, p.z, pal2('tether'), { count: 20, speed: 6, up: 2, shape: 5, size: 0.4 }); break;
        case 'dispel': vfx.shock(p.x, 1, p.z, 2.5, pal2('arcane'), 0.4, 0.6); break;
        case 'bombExplode': if (ev.dodged) vfx.burst(p.x, 1, p.z, pal2('storm'), { count: 20, speed: 6, up: 3, shape: 1, stretch: 2 }); break;
        default: break;
      }
    }
  }
  // dirt erupting where enemies claw out of the ground, and short-lived stains where they fall
  const spawned = new WeakSet();
  function spawnBursts(game) {
    let n = 0;
    for (const e of game.enemies) {
      if (e.state !== 'spawn' || spawned.has(e) || e.boss) continue;
      spawned.add(e);
      if (e.def.archetype === 'flyer' || e.def.fly || ++n > 6) continue;
      const r = e.radius * (e.scale > 1.4 ? 1.6 : 1.1);
      vfx.burst(e.x, 0.2, e.z, DIRT, { count: 7 + Math.round(r * 4), speed: 2.5 + r, up: 6, size: 0.24, gravity: 22, shape: 7, life: 0.7 });
      vfx.smokePuff(e.x, 0.3, e.z, DIRT.main.clone().multiplyScalar(0.55), { count: 2, size: 0.9 + r * 0.6, speed: 1.2, up: 0.4, life: 0.8 });
      vfx.stain(e.x, e.z, r * 1.5, STAIN.dirt, 2.4, 6);
    }
  }
  const DIRT = { core: col('#a08a6a'), main: col('#6a5440'), dark: col('#2a2018'), shape: 7 };
  const STAIN = { dirt: col('#1e1810'), bone: col('#2a2622'), slime: col('#1c4a10'), acid: col('#4a6000'), scorch: col('#1a0a04'), ichor: col('#183a10'), blood: col('#4a0a10'), stone: col('#262428'), void: col('#2a0a30') };
  const stainOf = (model) => /slime/.test(model) ? (model === 'acid_slime' ? STAIN.acid : STAIN.slime) : /lava|hellfire|ember|bomber/.test(model) ? STAIN.scorch : /spider/.test(model) ? STAIN.ichor
    : /wolf|bat|berserker/.test(model) ? STAIN.blood : /gargoyle|basilisk|giant/.test(model) ? STAIN.stone : /wraith|banshee/.test(model) ? null : /shadow|null|hex|time/.test(model) ? STAIN.void : STAIN.bone;
  const pal2 = (name) => { const pp = pal(name === 'soul' ? 'shadow' : name || 'arcane'); return { core: col(pp.core), main: col(name === 'soul' ? '#9ad8ff' : pp.main), dark: col(pp.dark), shape: 0 }; };
  const castCircles = [];
  // objective markers (capture points, defend crystal, escape portal)
  const markerMeshes = new Map();
  const getMarker = (key, kind, o) => { let m = markerMeshes.get(key); if (!m) { m = vfx.pool.get(kind, o); markerMeshes.set(key, m); } return m; };
  function syncMarkers(game) {
    const st = game.stage, t = game.time, used = new Set();
    if (st?.points) for (const pt of st.points) {
      const c = pt.captured ? col('#6fdc5a') : col('#ffd76a');
      vfx.decalsAdd.push(pt.x, 0.05, pt.z, t * 0.3, pt.r * 2, pt.r * 2, c, 0.9, 5, 0, 0, 0.1, 0, t, 1, 0.3);
      vfx.decalsAdd.push(pt.x, 0.055, pt.z, 0, pt.r * 2, pt.r * 2, c, 0.6, 1, 0.9, 0, 0.05, Math.max(0.01, pt.progress), t, 1, 0);
      const key = `pt${pt.id}`; used.add(key);
      const m = getMarker(key, 'cylinder', { core: c, main: c, scroll: 1.5, noise: 0.5 });
      m.position.set(pt.x, 0, pt.z); m.scale.set(0.6, 14, 0.6); m.material.uniforms.uAlpha.value = pt.captured ? 0.25 : 0.55;
      m.material.uniforms.uMain.value.copy(c); m.material.uniforms.uCore.value.copy(c);
    }
    if (st?.crystal) {
      const cr = st.crystal; used.add('crystal'); used.add('crystalAura');
      const m = getMarker('crystal', 'crystal', { color: col('#b08aff'), emissive: col('#7a3aff'), emissiveIntensity: 1.4 });
      m.position.set(cr.x, 0.4 + Math.sin(t * 2) * 0.15, cr.z); m.rotation.y = t * 0.8; m.scale.setScalar(2.4);
      const k = Math.max(0, cr.hp / cr.maxHp);
      m.material.emissive.setRGB(0.48 * k + (cr.hitT > 0 ? 0.6 : 0), 0.23 * k, 1.0 * k);
      if (cr.hitT > 0) cr.hitT -= 0.016;
      const aura = getMarker('crystalAura', 'cylinder', { core: col('#e8d8ff'), main: col('#a35cff'), scroll: 1 });
      aura.position.set(cr.x, 0, cr.z); aura.scale.set(1.8, 6, 1.8); aura.material.uniforms.uAlpha.value = 0.35 * k + 0.1;
      vfx.decalsAdd.push(cr.x, 0.05, cr.z, t, 7, 7, col('#a35cff'), 0.8, 5, 0, 0, 0.1, 0, t, 1, 0.5);
    }
    if (st?.portal) {
      const pt = st.portal; used.add('portal');
      vfx.decalsAdd.push(pt.x, 0.05, pt.z, t, pt.r * 2.4, pt.r * 2.4, col('#6fd8ff'), 1, 4, 0, 0, 0.1, 0, t, 1, 1.2);
      const m = getMarker('portal', 'cylinder', { core: col('#ffffff'), main: col('#6fd8ff'), scroll: 3 });
      m.position.set(pt.x, 0, pt.z); m.scale.set(pt.r * 0.8, 16, pt.r * 0.8); m.material.uniforms.uAlpha.value = 0.6;
    }
    for (const [key, m] of markerMeshes) if (!used.has(key)) { vfx.pool.release(m); markerMeshes.delete(key); }
  }

  function updateCamera(game, dt) {
    const p = game.player;
    const lead = 0.25;
    const tx = p.x + Math.sin(p.face) * lead, tz = p.z + Math.cos(p.face) * lead;
    const k = 1 - Math.exp(-dt * 7);
    cam.x += (tx - cam.x) * k; cam.z += (tz - cam.z) * k;
    const bossZoom = game.bosses?.length ? 1.12 : 1;
    cam.zoom += (cam.targetZoom * bossZoom - cam.zoom) * (1 - Math.exp(-dt * 4));
    cam.trauma = Math.max(0, cam.trauma - dt * 1.8);
    cam.fovKick = Math.max(0, cam.fovKick - dt * 30);
    const portrait = width < height;
    const dist = cam.dist * cam.zoom * (portrait ? 1.25 : 1);
    const sh = cam.trauma * cam.trauma * 0.7, t = game.time * 40;
    const sx = (Math.sin(t * 1.3) + Math.sin(t * 2.7) * 0.5) * sh, sy = (Math.sin(t * 1.7 + 1) + Math.sin(t * 3.1) * 0.5) * sh;
    camera.position.set(cam.x + sx, dist * 0.82 + sy, cam.z + dist * 0.62);
    camera.lookAt(cam.x + sx * 0.5, cam.lookY, cam.z + sy * 0.3);
    camera.fov = (portrait ? 58 : 42) - cam.fovKick * 0.35;
    camera.updateProjectionMatrix();
  }

  let lastBiomeKey = '';
  const api = {
    shake: 1,
    renderer, scene, camera, vfx, crowd, units, numbers, arena, composer,
    async prepare(game, models) {
      await arena.setBiome(game);
      await crowd.prepare(models);
    },
    resize,
    resetForStage(game) { adaptFrom = performance.now() + 4000; for (const [, m] of markerMeshes) vfx.pool.release(m); markerMeshes.clear(); vfx.clear(); numbers.clear(); units.reset(); cam.x = game.player.x; cam.z = game.player.z; cam.targetZoom = 1; cam.zoom = 1; },
    frame(game, dt, rawMs) {
      const key = `${game.stageIndex}-${game.biomeId}-${game.obstacles.length}`;
      if (key !== lastBiomeKey) { lastBiomeKey = key; arena.setBiome(game); grade.setBiome(game.biomeId); }
      vfx.begin();
      handleEvents(game);
      crowd.sync(game, dt);
      spawnBursts(game);
      units.sync(game, dt);
      vfx.sync(game, dt);
      heroFx.sync(game, dt);
      // cast circles under the hero
      for (let i = castCircles.length - 1; i >= 0; i--) { const c = castCircles[i]; c.t += dt; if (c.t > 0.5) { castCircles.splice(i, 1); continue; } vfx.decalsAdd.push(c.x, 0.06, c.z, c.t * 3, 3.2, 3.2, c.pp.main, 1 - c.t * 2, 5, 0, 0, 0.1, 0, c.t, 1, 0); }
      syncMarkers(game);
      entities.sync(game, dt, units);
      vfx.end();
      numbers.update(dt);
      arena.update(game, dt, camera);
      updateCamera(game, dt);
      grade.update(game.time, dt, { trauma: cam.trauma, aspect: width / height });
      composer.render();
      if (rawMs) adapt(rawMs);
    },
    /** World -> CSS pixel position for DOM overlays. */
    project(x, y, z, out = {}) {
      tmpV.set(x, y, z).project(camera);
      out.x = (tmpV.x * 0.5 + 0.5) * width; out.y = (-tmpV.y * 0.5 + 0.5) * height; out.visible = tmpV.z < 1 && tmpV.z > -1;
      return out;
    },
    /** Screen (CSS px) -> ground point (y = 0). */
    unproject(sx, sy) {
      const v = new THREE.Vector3((sx / width) * 2 - 1, -(sy / height) * 2 + 1, 0.5).unproject(camera);
      const dir = v.sub(camera.position).normalize();
      const t = -camera.position.y / dir.y;
      return { x: camera.position.x + dir.x * t, z: camera.position.z + dir.z * t };
    },
    get pixelRatio() { return pixelRatio; },
    stats() { return { ...vfx.stats(), pixelRatio, frameMs: Math.round(frameAvg * 10) / 10, programs: renderer.info.programs?.length, geometries: renderer.info.memory.geometries }; },
  };
  return api;
}
