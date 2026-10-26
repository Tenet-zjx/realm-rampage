import * as THREE from 'three';
import { bakeClips, createCrowdMaterial } from './anim-baker.js';
import { AFFIX } from '../game/content/enemies.js';

// Crowd renderer: one InstancedMesh per enemy/ally model, skinned on the GPU from baked clip textures.
const KK_CLIPS = ['Idle_Combat', 'Idle_B', 'Idle', 'Walking_D_Skeletons', 'Walking_A', 'Walking_B', 'Running_C', 'Running_A', '1H_Melee_Attack_Chop', '2H_Melee_Attack_Chop',
  'Dualwield_Melee_Attack_Chop', 'Dualwield_Melee_Attack_Stab', 'Dualwield_Melee_Attack_Slice', '1H_Melee_Attack_Stab', '1H_Ranged_Shoot', 'Spellcast_Shoot', 'Spellcast_Summon', 'Spellcast_Raise',
  'Hit_A', 'Hit_B', 'Death_C_Skeletons', 'Death_A', 'Death_B', 'Skeletons_Awaken_Floor', 'Jump_Idle', 'Taunt', 'Cheer', 'Blocking', 'Spellcast_Long'];
const LOOP = new Set(['Idle_Combat', 'Idle_B', 'Idle', 'Walking_D_Skeletons', 'Walking_A', 'Walking_B', 'Running_C', 'Running_A', 'Jump_Idle', 'Blocking', 'Walk']);
const HIT_FRAC = 0.48; // fraction of an attack clip where the blow lands

export function createCrowdRenderer(scene, assets, { capacity = 380 } = {}) {
  const groups = new Map();
  let kkBake = null;
  const shadowGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const shadowTex = radialTexture();
  const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.55, color: 0x000000 });
  const shadows = new THREE.InstancedMesh(shadowGeo, shadowMat, capacity * 2);
  shadows.frustumCulled = false; shadows.renderOrder = 1; shadows.count = 0;
  scene.add(shadows);
  const animState = new WeakMap();
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e3 = new THREE.Euler(), s3 = new THREE.Vector3(), p3 = new THREE.Vector3();

  async function ensureGroup(model) {
    if (groups.has(model)) return groups.get(model);
    const pending = { ready: false, promise: null };
    groups.set(model, pending);
    pending.promise = (async () => {
      const gltf = await assets.gltf(model);
      const own = gltf.animations?.length;
      let baked;
      if (own) baked = bakeClips(gltf.scene, gltf.animations);
      else {
        if (!kkBake) kkBake = bakeClips(gltf.scene, KK_CLIPS.map((n) => assets.clip(n)).filter(Boolean));
        baked = { ...kkBake };
        let mesh; gltf.scene.traverse((o) => { if (o.isSkinnedMesh && !mesh) mesh = o; });
        baked.geometry = mesh.geometry; baked.material = mesh.material;
      }
      const geo = baked.geometry.clone();
      const mat = createCrowdMaterial(baked, { map: (Array.isArray(baked.material) ? baked.material[0] : baked.material).map });
      const inst = new THREE.InstancedMesh(geo, mat, capacity);
      inst.frustumCulled = false; inst.count = 0;
      const aFrame = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1); aFrame.setUsage(THREE.DynamicDrawUsage);
      const aTint = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4); aTint.setUsage(THREE.DynamicDrawUsage);
      const aFx = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4); aFx.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute('aFrame', aFrame); geo.setAttribute('aTint', aTint); geo.setAttribute('aFx', aFx);
      inst.castShadow = false; inst.receiveShadow = false;
      scene.add(inst);
      Object.assign(pending, { ready: true, inst, baked, aFrame, aTint, aFx, n: 0, mat });
      return pending;
    })();
    return pending;
  }

  function frameFor(g, ent, clipName, t, loop, speed = 1) {
    const r = g.baked.ranges[clipName] || g.baked.ranges.Idle_Combat || g.baked.ranges.Idle || Object.values(g.baked.ranges)[0];
    const time = t * speed;
    let f = Math.floor(time * g.baked.fps);
    if (loop) f %= r.frames; else f = Math.min(r.frames - 1, f);
    return r.start + Math.max(0, f);
  }

  function clipLen(g, name) { return g.baked.ranges[name]?.duration || 1; }

  function pose(g, ent, dt, isAlly) {
    const clips = ent.def.clips || {};
    let st = animState.get(ent);
    if (!st) { st = { clip: '', t: ent.seed ? ent.seed * 2 : 0 }; animState.set(ent, st); }
    let clip = clips.idle || 'Idle', loop = true, speed = 1, t;
    const frozen = ent.status?.freeze || ent.status?.timeStop || ent.petrified > 0;
    const state = ent.state;
    if (ent.dying) { clip = ent.deathStyle === 2 ? (clips.death2 || clips.death) : clips.death; loop = false; t = ent.deathT * 1.4; }
    else if (state === 'spawn') { clip = clips.spawn || clips.idle; loop = false; t = (ent.stateT / Math.max(0.2, ent.spawnDur || 0.8)) * clipLen(g, clip); }
    else if (ent.airborne) { clip = clips.air || clips.hit; loop = true; }
    else if (ent.stagger > 0) { clip = ent.uid % 2 ? clips.hit : (clips.hit2 || clips.hit); loop = false; t = (0.3 - ent.stagger) * 2.2; }
    else if (state === 'windup') { clip = clips.attack; loop = false; t = (ent.stateT / Math.max(0.1, ent.windupDur || 0.5)) * clipLen(g, clip) * HIT_FRAC; }
    else if (state === 'attack') { clip = clips.attack; loop = false; t = clipLen(g, clip) * HIT_FRAC + ent.stateT * 1.3; }
    else if (state === 'cast') { clip = clips.cast || clips.attack; loop = false; t = Math.min(ent.stateT / Math.max(0.3, ent.castDur || 0.9), 1) * clipLen(g, clips.cast || clips.attack) * 0.62; }
    else if (state === 'channel') { clip = clips.cast || clips.attack; loop = false; t = clipLen(g, clip) * (0.5 + Math.sin(ent.stateT * 6) * 0.04); }
    else if (state === 'charging') { clip = clips.run || clips.move; speed = 1.8; }
    else if (state === 'run') { clip = clips.run || clips.move; speed = 1.1; }
    else if (state === 'move') { clip = clips.move; speed = Math.max(0.7, (ent.speed || ent.def.speed || 3) / 2.6); }
    else if (isAlly && state === 'attack') { clip = clips.attack; loop = false; }
    if (t == null) {
      if (st.clip !== clip) { st.clip = clip; st.t = 0; }
      if (!frozen) st.t += dt * speed;
      t = st.t;
      return frameFor(g, ent, clip, t, loop || LOOP.has(clip));
    }
    st.clip = clip;
    if (frozen && st.frozenFrame != null) return st.frozenFrame;
    const f = frameFor(g, ent, clip, t, false);
    st.frozenFrame = frozen ? f : null;
    return f;
  }

  return {
    preload: (models) => Promise.all(models.map((m) => ensureGroup(m).then?.((g) => g) ?? ensureGroup(m).promise)),
    async prepare(models) { for (const m of models) { const g = await ensureGroup(m); if (!g.ready) await g.promise; } },
    sync(game, dt) {
      for (const g of groups.values()) if (g.ready) g.n = 0;
      let sn = 0;
      const writeShadow = (x, z, r, y) => {
        if (sn >= capacity * 2) return;
        const s = r * 2.6 * Math.max(0.35, 1 - y * 0.12);
        m4.makeScale(s, 1, s); m4.setPosition(x, 0.03, z);
        shadows.setMatrixAt(sn++, m4);
      };
      const draw = (ent, isAlly) => {
        const g = groups.get(ent.model);
        if (!g) { ensureGroup(ent.model); return; }
        if (!g.ready || g.n >= capacity) return;
        const i = g.n++;
        const frame = pose(g, ent, dt, isAlly);
        g.aFrame.array[i] = frame;
        // transform
        let yaw = ent.face, tilt = 0, roll = 0;
        if (ent.airborne) { tilt = Math.min(1.2, Math.abs(ent.vy) * 0.08) * (ent.vy > 0 ? -1 : 1); roll = Math.sin((ent.uid % 7) + ent.y * 2) * 0.6; }
        if (ent.dying && ent.deathStyle === 'launch') tilt = -0.6;
        e3.set(tilt, yaw, roll, 'YXZ'); q.setFromEuler(e3);
        const sc = (ent.scale || 1) * (ent.state === 'spawn' && !ent.def.clips?.spawn ? Math.min(1, ent.stateT * 3) : 1) * (ent.flash > 0.5 ? 1.05 : 1);
        s3.set(sc, sc, sc);
        p3.set(ent.x, ent.y + (ent.def.fly || 0), ent.z);
        m4.compose(p3, q, s3);
        g.inst.setMatrixAt(i, m4);
        // tint / flash
        const ti = i * 4;
        let r = 1, gg = 1, b = 1;
        if (isAlly) { const t = ent.def.tint || [0.4, 1, 0.6]; r = t[0]; gg = t[1]; b = t[2]; }
        else if (ent.affixes?.length) { const c = new THREE.Color(AFFIX[ent.affixes[0]].color); r = 0.75 + c.r * 0.35; gg = 0.75 + c.g * 0.35; b = 0.75 + c.b * 0.35; }
        else if (ent.officer) { r = 1.15; gg = 1.0; b = 0.8; }
        g.aTint.array[ti] = r; g.aTint.array[ti + 1] = gg; g.aTint.array[ti + 2] = b; g.aTint.array[ti + 3] = Math.min(1, (ent.flash || 0) * (ent.flash || 0) * 0.8);
        const st = ent.status || {};
        const dissolve = ent.dying ? Math.max(0, (ent.deathT - (ent.boss ? 2.6 : 0.65)) / 0.55) : 0;
        g.aFx.array[ti] = dissolve;
        g.aFx.array[ti + 1] = st.freeze || st.timeStop ? 1 : ent.petrified > 0 ? 0.6 : st.slow ? 0.25 : 0;
        g.aFx.array[ti + 2] = st.burn ? 0.8 : st.poison ? -0.8 : 0;
        g.aFx.array[ti + 3] = isAlly ? 1 : ent.officer ? 0.9 : ent.elite ? 0.6 : 0;
        if (!ent.dying || ent.deathT < 1) writeShadow(ent.x, ent.z, ent.radius * (ent.scale > 1.5 ? 0.8 : 1), ent.y + (ent.def.fly || 0));
      };
      for (const e of game.enemies) if (!e.boss) draw(e, false);
      for (const a of game.allies) if (!a.hero) draw(a, true);
      for (const g of groups.values()) {
        if (!g.ready) continue;
        g.inst.count = g.n;
        if (g.n) { g.inst.instanceMatrix.needsUpdate = true; g.aFrame.needsUpdate = true; g.aTint.needsUpdate = true; g.aFx.needsUpdate = true; }
        g.mat.userData.rr.uTime.value = game.time;
      }
      shadows.count = sn; shadows.instanceMatrix.needsUpdate = true;
      this.shadowWriter = writeShadow;
      this.shadowCount = () => sn;
      this.shadowCommit = (n) => { shadows.count = n; shadows.instanceMatrix.needsUpdate = true; };
      return sn;
    },
    addShadow(x, z, r, y) { /* used by hero/bosses after sync */ },
    shadows,
    groups,
  };
}

export function radialTexture(inner = 0.0, outer = 0.5) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 32 * inner, 32, 32, 32 * outer * 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.5, 'rgba(255,255,255,0.5)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  return t;
}
