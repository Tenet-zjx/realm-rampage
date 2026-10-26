import * as THREE from 'three';
import { pal, col } from './vfx-core.js';
import { ITEM, RUNES } from '../game/content/items.js';

// Projectiles, pickups and the hero weapon trail. Instanced by visual family, glow handled by the particle layer.
const PROJ = {
  star: { glow: 'arcane', size: 0.55, mesh: 'orb' }, missile: { glow: 'arcane', size: 0.5, mesh: 'orb' }, fireball: { glow: 'fire', size: 0.7, mesh: 'orb' },
  frostOrb: { glow: 'frost', size: 1.0, mesh: 'orb' }, soul: { glow: 'shadow', size: 0.75, mesh: 'orb', streak: true }, bat: { glow: 'shadow', size: 0.5, mesh: 'bat' }, spore: { glow: 'poison', size: 0.45, mesh: 'orb' },
  voidOrb: { glow: 'shadow', size: 1.1, mesh: 'orb', enemy: true }, enemyBolt: { glow: 'danger', size: 0.35, mesh: 'bolt', enemy: true }, fireBolt: { glow: 'fire', size: 0.4, mesh: 'bolt', enemy: true },
  iceLance: { glow: 'frost', size: 0.45, mesh: 'shard', enemy: true }, feather: { glow: 'holy', size: 0.4, mesh: 'blade', enemy: true }, darkCrescent: { glow: 'shadow', size: 1.4, mesh: 'crescent', enemy: true },
  bolt: { glow: 'blade', size: 0.35, mesh: 'bolt' }, knife: { glow: 'blade', size: 0.35, mesh: 'blade' }, bone: { glow: 'shadow', size: 0.4, mesh: 'bolt' }, iceShard: { glow: 'frost', size: 0.4, mesh: 'shard' },
  crescent: { glow: 'blade', size: 1.2, mesh: 'crescent' }, sword: { glow: 'blade', size: 0.7, mesh: 'blade' }, stormSword: { glow: 'storm', size: 0.8, mesh: 'blade' },
  hammer: { glow: 'storm', size: 0.9, mesh: 'hammer' }, boulder: { glow: 'earth', size: 1.5, mesh: 'rock' }, rock: { glow: 'earth', size: 0.45, mesh: 'rock' }, bomb: { glow: 'fire', size: 0.6, mesh: 'rock' },
  webShot: { glow: 'web', size: 0.75, mesh: 'orb', enemy: true, trail: 'web' }, frostSpit: { glow: 'frost', size: 0.5, mesh: 'shard', enemy: true, trail: 'frost' },
  hexBolt: { glow: 'hex', size: 0.8, mesh: 'orb', enemy: true, trail: 'hex', spin: true }, bombShot: { glow: 'fire', size: 0.55, mesh: 'rock', enemy: true, trail: 'fire', fuse: true },
  chronoBolt: { glow: 'chrono', size: 0.45, mesh: 'orb', enemy: true },
};

export function createEntities(scene, vfx) {
  const geos = {
    orb: new THREE.IcosahedronGeometry(0.5, 1), bolt: new THREE.CylinderGeometry(0.06, 0.06, 1, 6).rotateX(Math.PI / 2), blade: new THREE.BoxGeometry(0.12, 0.04, 1),
    shard: new THREE.OctahedronGeometry(0.5, 0).scale(0.35, 0.35, 1.4), crescent: crescentGeo(), hammer: new THREE.BoxGeometry(0.7, 0.5, 0.5), rock: new THREE.IcosahedronGeometry(0.5, 0), bat: batGeo(),
  };
  const meshes = {};
  const make = (key, geo, mat, cap = 400) => { const m = new THREE.InstancedMesh(geo, mat, cap); m.frustumCulled = false; m.count = 0; m.setColorAt(0, new THREE.Color(1, 1, 1)); scene.add(m); meshes[key] = { m, n: 0, cap }; return meshes[key]; };
  const glowMat = (c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  for (const [k, g] of Object.entries(geos)) {
    if (k === 'rock' || k === 'hammer') make(k, g, new THREE.MeshStandardMaterial({ color: k === 'hammer' ? 0x9aa6c0 : 0x6a5038, roughness: 0.7, flatShading: true }), 120);
    else make(k, g, new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: false, toneMapped: false }), 500);
  }
  // pickups
  const gemGeo = new THREE.OctahedronGeometry(0.22, 0), coinGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.06, 12).rotateX(Math.PI / 2), crossGeo = new THREE.OctahedronGeometry(0.3, 1), chestGeo = new THREE.BoxGeometry(0.7, 0.5, 0.5), runeGeo = new THREE.IcosahedronGeometry(0.45, 0);
  make('gem', gemGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), 600);
  make('coin', coinGeo, new THREE.MeshStandardMaterial({ color: 0xffd36a, emissive: 0x8a5a00, emissiveIntensity: 0.8, roughness: 0.25, metalness: 0.9 }), 400);
  make('heal', crossGeo, new THREE.MeshStandardMaterial({ color: 0xff4a5a, emissive: 0xff2030, emissiveIntensity: 1.2 }), 60);
  make('chest', chestGeo, new THREE.MeshStandardMaterial({ color: 0x8a5a2a, emissive: 0xffb040, emissiveIntensity: 0.6, roughness: 0.5 }), 60);
  make('rune', runeGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), 20);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e3 = new THREE.Euler(), s3 = new THREE.Vector3(), p3 = new THREE.Vector3(), c3 = new THREE.Color();
  const put = (key, x, y, z, yaw, sx, sy, sz, color, pitch = 0, roll = 0) => {
    const b = meshes[key]; if (b.n >= b.cap) return;
    e3.set(pitch, yaw, roll, 'YXZ'); q.setFromEuler(e3); s3.set(sx, sy, sz); p3.set(x, y, z); m4.compose(p3, q, s3);
    b.m.setMatrixAt(b.n, m4); if (color) b.m.setColorAt(b.n, color); b.n++;
  };
  // weapon trail ribbon
  const TRAIL = 18;
  const trailGeo = new THREE.BufferGeometry();
  const tPos = new Float32Array(TRAIL * 2 * 3), tAlpha = new Float32Array(TRAIL * 2);
  trailGeo.setAttribute('position', new THREE.BufferAttribute(tPos, 3).setUsage(THREE.DynamicDrawUsage));
  trailGeo.setAttribute('alpha', new THREE.BufferAttribute(tAlpha, 1).setUsage(THREE.DynamicDrawUsage));
  const idx = []; for (let i = 0; i < TRAIL - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } trailGeo.setIndex(idx);
  const trailMat = new THREE.ShaderMaterial({ uniforms: { uColor: { value: new THREE.Color() }, uCore: { value: new THREE.Color() } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'attribute float alpha; varying float vA; void main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 uColor; uniform vec3 uCore; varying float vA; void main(){ vec3 c = mix(uColor, uCore, vA*vA); gl_FragColor = vec4(c * vA, vA); }' });
  const trail = new THREE.Mesh(trailGeo, trailMat); trail.frustumCulled = false; trail.renderOrder = 9; scene.add(trail);
  const hist = [];
  const hand = new THREE.Vector3(), tip = new THREE.Vector3();

  return {
    sync(game, dt, units) {
      for (const k in meshes) meshes[k].n = 0;
      // projectiles
      for (const pr of game.projectiles) {
        const def = PROJ[pr.kind] || { glow: pr.palette || 'arcane', size: 0.5, mesh: 'orb' };
        const p = pal(pr.team === 'enemy' && !def.enemy ? 'danger' : pr.palette && !def.enemy && pr.kind !== 'star' && pr.kind !== 'missile' ? pr.palette : def.glow);
        const color = col(p.main);
        const len = def.mesh === 'bolt' ? 1.4 : def.mesh === 'blade' ? 1.2 : 1;
        if (def.mesh === 'crescent') put('crescent', pr.x, pr.y, pr.z, pr.angle, def.size, 1, def.size, color);
        else if (def.mesh === 'rock' || def.mesh === 'hammer') put(def.mesh, pr.x, pr.y + (def.mesh === 'rock' ? def.size * 0.3 : 0), pr.z, pr.angle, def.size, def.size, def.size, null, pr.traveled * 2, 0);
        else if (def.mesh === 'bat') put('bat', pr.x, pr.y, pr.z, pr.angle, 0.7, 0.7 + Math.sin(game.time * 30 + pr.uid) * 0.3, 0.7, col('#4a2050'));
        else put(def.mesh, pr.x, pr.y, pr.z, pr.angle, def.size, def.size, def.mesh === 'orb' ? def.size : len, col(p.core));
        if (def.trail && Math.random() < 0.7) { const tp = pal(def.trail); vfx.parts.emit({ x: pr.x + (Math.random() - 0.5) * def.size, y: pr.y + (Math.random() - 0.5) * def.size, z: pr.z + (Math.random() - 0.5) * def.size, vx: 0, vy: def.fuse ? 1.5 : -0.4, vz: 0, life: 0.45, size: def.size * 0.6, size1: 0.05, color: col(def.fuse ? '#ffd060' : tp.core), color2: col(tp.dark), shape: def.spin ? 4 : 0, drag: 2 }); }
        // glow + trail
        vfx.parts.emit({ x: pr.x, y: pr.y, z: pr.z, vx: -Math.sin(pr.angle) * 2, vy: 0, vz: -Math.cos(pr.angle) * 2, life: def.mesh === 'orb' ? 0.25 : 0.18, size: def.size * (def.mesh === 'orb' ? 2.4 : 1.4), size1: def.size * 0.4, color: col(p.main), color2: col(p.dark), alpha: 0.9, shape: def.streak ? 1 : 0, stretch: def.streak ? 2 : 0, drag: 4 });
      }
      // pickups
      const t = game.time;
      for (const pk of game.pickups) {
        const bob = pk.y + Math.sin(t * 4 + pk.uid) * 0.08;
        switch (pk.kind) {
          case 'xp': { const v = pk.value; c3.set(v >= 40 ? '#ffcf4a' : v >= 10 ? '#c070ff' : v >= 3 ? '#4ab0ff' : '#5aff8a'); const s = v >= 40 ? 2 : v >= 10 ? 1.5 : v >= 3 ? 1.2 : 1; put('gem', pk.x, bob + 0.2, pk.z, t * 2 + pk.uid, s, s * 1.3, s, c3); break; }
          case 'gold': put('coin', pk.x, bob + 0.25, pk.z, t * 5 + pk.uid, 1, 1, 1, null); break;
          case 'heal': put('heal', pk.x, bob + 0.4, pk.z, t * 2, 1, 1, 1, null); if (Math.random() < 0.2) vfx.parts.emit({ x: pk.x, y: 0.6, z: pk.z, vy: 1, life: 0.6, size: 0.4, color: col('#ff6a7a'), shape: 4 }); break;
          case 'neutral': case 'component': { put('chest', pk.x, 0.3, pk.z, t, 1, 1, 1, null); if (Math.random() < 0.3) vfx.parts.emit({ x: pk.x + (Math.random() - 0.5), y: 0.4, z: pk.z + (Math.random() - 0.5), vy: 3, life: 0.8, size: 0.35, color: col(pk.kind === 'neutral' ? '#c070ff' : '#ffd76a'), shape: 4 }); break; }
          case 'rune': { const r = RUNES.find((x) => x.id === pk.item); c3.set(r?.color || '#ffffff'); put('rune', pk.x, 1.2 + Math.sin(t * 3) * 0.2, pk.z, t * 2, 1, 1.4, 1, c3); vfx.decalsAdd.push(pk.x, 0.05, pk.z, t, 3, 3, c3, 0.8, 5, 0, 0, 0.1, 0, t, 1, 1); if (Math.random() < 0.5) vfx.parts.emit({ x: pk.x + (Math.random() - 0.5) * 1.5, y: 0.2, z: pk.z + (Math.random() - 0.5) * 1.5, vy: 3, life: 0.8, size: 0.35, color: c3, shape: 4 }); break; }
          default: break;
        }
      }
      for (const k in meshes) { const b = meshes[k]; b.m.count = b.n; if (b.n) { b.m.instanceMatrix.needsUpdate = true; if (b.m.instanceColor) b.m.instanceColor.needsUpdate = true; } }
      // weapon trail during attacks / musou
      const hv = units.hero();
      const p = game.player;
      const swinging = (p.state === 'attack' && p.move && !p.move.def.proj) || p.state === 'musou' || p.state === 'omnislash';
      if (hv && swinging) {
        units.handWorld(hv, hand, 0); units.handWorld(hv, tip, game.hero.weaponTip || 1);
        hist.unshift([hand.x, hand.y, hand.z, tip.x, tip.y, tip.z]);
      } else hist.unshift(null);
      if (hist.length > TRAIL) hist.length = TRAIL;
      const pp = pal(game.hero.palette);
      trailMat.uniforms.uColor.value.set(pp.main); trailMat.uniforms.uCore.value.set(pp.core);
      let last = null;
      for (let i = 0; i < TRAIL; i++) {
        const h = hist[i] || last;
        const a = hist[i] && hist[Math.max(0, i - 1)] ? Math.pow(1 - i / TRAIL, 2) * 0.55 : 0;
        if (h) { tPos.set(h.slice(0, 3), i * 6); tPos.set(h.slice(3, 6), i * 6 + 3); last = h; }
        tAlpha[i * 2] = a * 0.2; tAlpha[i * 2 + 1] = a;
      }
      trailGeo.attributes.position.needsUpdate = true; trailGeo.attributes.alpha.needsUpdate = true;
      trail.visible = hist.some(Boolean);
    },
  };
}

function crescentGeo() {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, 1, Math.PI * 0.15, Math.PI * 0.85, false);
  shape.absarc(0, -0.35, 0.85, Math.PI * 0.8, Math.PI * 0.2, true);
  const g = new THREE.ShapeGeometry(shape, 12).rotateX(-Math.PI / 2).rotateY(Math.PI);
  return g;
}
function batGeo() {
  const g = new THREE.BufferGeometry();
  const v = new Float32Array([0, 0, 0.3, -0.9, 0.1, -0.1, 0, 0, -0.3, 0, 0, 0.3, 0.9, 0.1, -0.1, 0, 0, -0.3]);
  g.setAttribute('position', new THREE.BufferAttribute(v, 3)); g.computeVertexNormals();
  return g;
}
export { ITEM };
