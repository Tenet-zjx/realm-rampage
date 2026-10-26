import * as THREE from 'three';

// Small non-colliding ground detail per biome (grass, bones, ice shards, lava rocks, crystals, candles…),
// instanced and seeded from the stage so it is stable. Grass-like items sway in the wind.
const g = {
  tuft: () => { const parts = []; for (let i = 0; i < 5; i++) { const c = new THREE.ConeGeometry(0.035, 0.45 + (i % 3) * 0.12, 3); c.translate(0, 0.22, 0); c.rotateZ((i - 2) * 0.22); c.rotateY(i * 1.3); parts.push(c); } return merge(parts); },
  bone: () => { const c = new THREE.CylinderGeometry(0.035, 0.035, 0.42, 5); c.rotateZ(Math.PI / 2); const a = new THREE.SphereGeometry(0.06, 5, 4); a.translate(0.21, 0, 0); const b = new THREE.SphereGeometry(0.06, 5, 4); b.translate(-0.21, 0, 0); const m = merge([c, a, b]); m.translate(0, 0.05, 0); return m; },
  skull: () => { const s = new THREE.SphereGeometry(0.13, 7, 5); s.scale(1, 0.85, 1.1); s.translate(0, 0.11, 0); const j = new THREE.BoxGeometry(0.14, 0.05, 0.1); j.translate(0, 0.03, 0.08); return merge([s, j]); },
  stone: () => { const b = new THREE.BoxGeometry(0.42, 0.62, 0.12); b.translate(0, 0.3, 0); const t = new THREE.CylinderGeometry(0.21, 0.21, 0.12, 8, 1, false, 0, Math.PI); t.rotateX(Math.PI / 2); t.rotateZ(Math.PI / 2); t.translate(0, 0.61, 0); return merge([b, t]); },
  mushroom: () => { const s = new THREE.CylinderGeometry(0.03, 0.04, 0.16, 5); s.translate(0, 0.08, 0); const c = new THREE.SphereGeometry(0.09, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2); c.translate(0, 0.15, 0); return merge([s, c]); },
  shard: () => { const o = new THREE.OctahedronGeometry(0.16, 0); o.scale(0.6, 2.4, 0.6); o.translate(0, 0.3, 0); const o2 = new THREE.OctahedronGeometry(0.1, 0); o2.scale(0.6, 2, 0.6); o2.rotateZ(0.5); o2.translate(0.14, 0.15, 0.05); return merge([o, o2]); },
  mound: () => { const s = new THREE.SphereGeometry(0.5, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2); s.scale(1, 0.25, 0.8); return s; },
  rock: () => { const r = new THREE.IcosahedronGeometry(0.22, 0); r.scale(1, 0.6, 0.9); r.translate(0, 0.08, 0); return r; },
  vent: () => { const c = new THREE.ConeGeometry(0.16, 0.22, 6); c.translate(0, 0.11, 0); return c; },
  crystal: () => { const parts = []; for (let i = 0; i < 3; i++) { const o = new THREE.OctahedronGeometry(0.12, 0); o.scale(0.7, 2.6 - i * 0.6, 0.7); o.rotateZ((i - 1) * 0.35); o.translate((i - 1) * 0.1, 0.25 - i * 0.04, 0); parts.push(o); } return merge(parts); },
  spike: () => { const c = new THREE.ConeGeometry(0.08, 0.7, 4); c.translate(0, 0.35, 0); c.rotateZ(0.2); return c; },
  candle: () => { const c = new THREE.CylinderGeometry(0.04, 0.045, 0.22, 6); c.translate(0, 0.11, 0); return c; },
  flame: () => { const s = new THREE.SphereGeometry(0.04, 5, 4); s.scale(1, 1.6, 1); s.translate(0, 0.27, 0); return s; },
  flower: () => { const s = new THREE.CylinderGeometry(0.012, 0.012, 0.22, 3); s.translate(0, 0.11, 0); const h = new THREE.SphereGeometry(0.05, 6, 4); h.translate(0, 0.23, 0); return merge([s, h]); },
};
function merge(list) {
  const flat = list.map((x) => (x.index ? x.toNonIndexed() : x));
  let n = 0; for (const x of flat) n += x.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); const idx = []; let o = 0;
  for (const geo of flat) {
    geo.computeVertexNormals();
    pos.set(geo.attributes.position.array, o * 3); nor.set(geo.attributes.normal.array, o * 3);
    for (let i = 0; i < geo.attributes.position.count; i++) idx.push(o + i);
    o += geo.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos.slice(0, o * 3), 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor.slice(0, o * 3), 3)); out.setIndex(idx);
  return out;
}

// [geometry, colour, emissive, emissiveIntensity, count per 1000 m², scale range, sway]
const SETS = {
  graveyard: [['tuft', '#6a8a48', null, 0, 40, [1.3, 2.2], 1], ['bone', '#d8d0bc', null, 0, 6, [0.8, 1.3]], ['skull', '#e0d8c4', null, 0, 3, [0.9, 1.3]], ['stone', '#5a5a66', null, 0, 2, [0.8, 1.2]], ['mushroom', '#c06aa0', '#c040a0', 0.6, 8, [1.2, 2.4]]],
  frostkeep: [['shard', '#bfefff', '#3a8acc', 0.35, 10, [0.7, 1.5]], ['mound', '#e8f2ff', null, 0, 10, [0.6, 1.5]], ['tuft', '#a8c4d4', null, 0, 22, [1.1, 1.8], 1], ['rock', '#6a7a8c', null, 0, 5, [0.8, 1.6]]],
  inferno: [['rock', '#2a1a14', '#ff4a10', 0.25, 12, [0.8, 1.8]], ['vent', '#3a1a10', '#ff6a1a', 0.9, 5, [0.8, 1.4]], ['bone', '#3a2a22', null, 0, 5, [0.8, 1.2]], ['spike', '#1a1418', null, 0, 6, [0.6, 1.3]]],
  shadowcourt: [['crystal', '#b08aff', '#7a3aff', 0.6, 7, [0.7, 1.5]], ['tuft', '#6a5a7a', null, 0, 24, [1.1, 1.9], 1], ['candle', '#e8dcc0', null, 0, 6, [0.8, 1.3]], ['flame', '#ffd080', '#ffb040', 2.0, 6, [0.8, 1.3]], ['skull', '#c8c0d0', null, 0, 3, [0.8, 1.2]]],
  abyss: [['crystal', '#ff6ab0', '#ff2a8a', 0.7, 8, [0.7, 1.6]], ['spike', '#1a1024', null, 0, 10, [0.7, 1.6]], ['bone', '#a898a8', null, 0, 5, [0.8, 1.2]], ['rock', '#241830', '#ff3b8e', 0.15, 6, [0.8, 1.6]]],
  skytemple: [['tuft', '#d8c070', null, 0, 30, [1.2, 2.0], 1], ['flower', '#ffffff', '#ffe8b0', 0.3, 14, [0.8, 1.4], 1], ['rock', '#e8e4dc', null, 0, 5, [0.7, 1.3]], ['shard', '#fff0c0', '#ffd76a', 0.3, 3, [0.6, 1.0]]],
};

export function createScatter(root) {
  const meshes = [];
  const uniforms = { uTime: { value: 0 } };
  const geos = new Map();
  const geo = (k) => geos.get(k) || geos.set(k, g[k]()).get(k);
  function material(color, emissive, ei, sway) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, flatShading: true, emissive: emissive || 0x000000, emissiveIntensity: ei || 0 });
    if (sway) {
      m.onBeforeCompile = (sh) => {
        sh.uniforms.uTime = uniforms.uTime;
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
          .replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef USE_INSTANCING
  vec3 rrIp = instanceMatrix[3].xyz;
  float rrS = sin( uTime * 1.9 + rrIp.x * 0.6 + rrIp.z * 0.45 ) + sin( uTime * 3.1 + rrIp.z * 0.9 ) * 0.4;
  transformed.x += rrS * position.y * position.y * 0.55; transformed.z += rrS * position.y * position.y * 0.25;
#endif`);
      };
      m.customProgramCacheKey = () => 'rr-sway';
    }
    return m;
  }
  return {
    build(game) {
      for (const m of meshes) { root.remove(m); m.material.dispose(); }
      meshes.length = 0;
      const set = SETS[game.biomeId] || SETS.graveyard;
      const half = game.arena.half + 4, area = (half * 2) ** 2 / 1000;
      let s = (game.seed * 31 + (game.stageIndex || 0) * 977 + 7) % 2147483647 || 3;
      const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
      const pairs = [];
      for (const [k, color, emissive, ei, density, [s0, s1], sway] of set) {
        const n = Math.round(density * area);
        const inst = new THREE.InstancedMesh(geo(k), material(color, emissive, ei, sway), n);
        let placed = 0;
        for (let i = 0; i < n * 3 && placed < n; i++) {
          // flames sit on top of the matching candles
          const pair = k === 'flame' ? pairs[placed] : null;
          const x = pair ? pair.x : (rnd() * 2 - 1) * half, z = pair ? pair.z : (rnd() * 2 - 1) * half;
          if (!pair && game.obstacles.some((o) => (o.x - x) ** 2 + (o.z - z) ** 2 < (o.r + 0.7) ** 2)) continue;
          const k2 = pair ? pair.s : s0 + rnd() * (s1 - s0);
          q.setFromAxisAngle(up, pair ? 0 : rnd() * Math.PI * 2); sc.set(k2, k2, k2); p.set(x, 0, z);
          inst.setMatrixAt(placed++, m4.compose(p, q, sc));
          if (k === 'candle') pairs.push({ x, z, s: k2 });
        }
        inst.count = placed; inst.castShadow = k === 'stone' || k === 'crystal' || k === 'shard'; inst.receiveShadow = true;
        root.add(inst); meshes.push(inst);
      }
    },
    update(t) { uniforms.uTime.value = t; },
  };
}

// See-through props: fragments between the camera and the hero are screen-door dithered away.
export const seeThrough = { uSeeCam: { value: new THREE.Vector3() }, uSeeHero: { value: new THREE.Vector3() }, uSeeR: { value: 2.3 } };
const patched = new WeakSet();
export function patchSeeThrough(material) {
  if (patched.has(material)) return; patched.add(material);
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (sh, r) => {
    prev?.(sh, r);
    Object.assign(sh.uniforms, seeThrough);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vSeeW;')
      .replace('#include <project_vertex>', `#include <project_vertex>
  vec4 rrW = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
  rrW = instanceMatrix * rrW;
#endif
  vSeeW = ( modelMatrix * rrW ).xyz;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vSeeW; uniform vec3 uSeeCam; uniform vec3 uSeeHero; uniform float uSeeR;
float rrBayer( vec2 p ) { vec2 q = mod( floor( p ), 4.0 ); float i = q.x + q.y * 4.0;
  return mod( i * 7.0 + floor( i / 4.0 ) * 3.0, 16.0 ) / 16.0; }`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
  { vec3 rrD = uSeeHero - uSeeCam; float rrL = length( rrD ); vec3 rrN = rrD / rrL;
    float rrT = dot( vSeeW - uSeeCam, rrN ); float rrP = length( vSeeW - uSeeCam - rrN * rrT );
    float rrK = ( 1.0 - smoothstep( uSeeR * 0.45, uSeeR, rrP ) ) * ( 1.0 - smoothstep( rrL - 1.4, rrL - 0.2, rrT ) ) * step( 0.6, vSeeW.y );
    if ( rrK * 0.82 > rrBayer( gl_FragCoord.xy ) ) discard; }`);
  };
  const key = material.customProgramCacheKey?.bind(material);
  material.customProgramCacheKey = () => `${key ? key() : ''}rr-see`;
  material.needsUpdate = true;
}
