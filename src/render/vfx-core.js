import * as THREE from 'three';

// Low-level VFX primitives: ground decals, billboard particles, energy meshes, lightning ribbons and flash lights.
export const PALETTES = {
  fire: { core: '#fff2c0', main: '#ff7a20', dark: '#b02000', shape: 'ember' },
  frost: { core: '#ffffff', main: '#7fdcff', dark: '#2a6cff', shape: 'shard' },
  storm: { core: '#ffffff', main: '#9ec8ff', dark: '#4a5cff', shape: 'spark' },
  shadow: { core: '#f0d8ff', main: '#a35cff', dark: '#2a0050', shape: 'wisp' },
  holy: { core: '#ffffff', main: '#ffd76a', dark: '#ff9a20', shape: 'star' },
  nature: { core: '#f0ffd0', main: '#6fdc5a', dark: '#1a7a20', shape: 'leaf' },
  blade: { core: '#ffffff', main: '#e8eef8', dark: '#ffcf4a', shape: 'spark' },
  arcane: { core: '#ffe8ff', main: '#ff5cd6', dark: '#7a20c0', shape: 'star' },
  earth: { core: '#fff0c8', main: '#d9a05b', dark: '#6a4020', shape: 'chip' },
  blood: { core: '#ffd0d0', main: '#ff3b4e', dark: '#6a0010', shape: 'drop' },
  danger: { core: '#ffd8c8', main: '#ff3a20', dark: '#600000', shape: 'ember' },
  poison: { core: '#e8ffd0', main: '#8cff4a', dark: '#2a6a10', shape: 'drop' },
};
const C = {};
export const col = (hex) => (C[hex] ??= new THREE.Color(hex));
export const pal = (name) => PALETTES[name] || PALETTES.arcane;
export const SHAPE = { dot: 0, spark: 1, shard: 2, ring: 3, star: 4, smoke: 5, leaf: 6, chip: 7, ember: 0, wisp: 5, drop: 0 };

// ------------------------------------------------------------------ decals
const DECAL_VERT = /* glsl */`
attribute vec4 aColor; attribute vec4 aShape; attribute vec4 aAnim;
varying vec4 vColor; varying vec4 vShape; varying vec4 vAnim; varying vec2 vUv;
void main() { vColor = aColor; vShape = aShape; vAnim = aAnim; vUv = uv * 2.0 - 1.0;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4( position, 1.0 ); }`;
const DECAL_FRAG = /* glsl */`
uniform float uTime;
varying vec4 vColor; varying vec4 vShape; varying vec4 vAnim; varying vec2 vUv;
float hash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
float noise( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( hash( i ), hash( i + vec2( 1, 0 ) ), f.x ), mix( hash( i + vec2( 0, 1 ) ), hash( i + vec2( 1, 1 ) ), f.x ), f.y ); }
void main() {
  float type = vShape.x; float r = length( vUv ); float a = atan( vUv.x, vUv.y );
  float soft = max( 0.01, vShape.w ); float alpha = 0.0; float edge = 0.0;
  float t = vAnim.y + uTime * vAnim.w;
  if ( type < 0.5 ) { // disc
    alpha = smoothstep( 1.0, 1.0 - soft, r ); edge = smoothstep( 1.0 - soft * 2.0, 1.0, r ) * alpha;
  } else if ( type < 1.5 ) { // ring
    float inner = vShape.y; alpha = smoothstep( inner - soft, inner, r ) * smoothstep( 1.0, 1.0 - soft, r ); edge = alpha;
  } else if ( type < 2.5 ) { // arc sector (half angle vShape.z)
    float ang = abs( a ); alpha = smoothstep( 1.0, 1.0 - soft, r ) * smoothstep( vShape.z + 0.02, vShape.z - 0.02, ang ) * step( vShape.y, r );
    edge = alpha * max( smoothstep( 0.85, 1.0, r ), smoothstep( vShape.z - 0.12, vShape.z, ang ) );
  } else if ( type < 3.5 ) { // rectangle (uv.y along length)
    float sx = smoothstep( 1.0, 1.0 - soft, abs( vUv.x ) ), sy = smoothstep( 1.0, 1.0 - soft * 0.5, abs( vUv.y ) );
    alpha = sx * sy; edge = alpha * max( smoothstep( 0.8, 1.0, abs( vUv.x ) ), smoothstep( 0.92, 1.0, abs( vUv.y ) ) );
  } else if ( type < 4.5 ) { // swirl (vortex)
    float s = sin( a * 3.0 + r * 9.0 - t * 4.0 ) * 0.5 + 0.5;
    alpha = smoothstep( 1.0, 0.6, r ) * ( 0.35 + s * 0.65 ) * smoothstep( 0.0, 0.25, r ); edge = s * alpha;
  } else if ( type < 5.5 ) { // rune circle
    float ring1 = smoothstep( 0.04, 0.0, abs( r - 0.92 ) ), ring2 = smoothstep( 0.03, 0.0, abs( r - 0.72 ) );
    float ticks = step( 0.86, fract( ( a + t * 0.6 ) * 3.8197 ) ) * step( 0.74, r ) * step( r, 0.9 );
    float star = smoothstep( 0.03, 0.0, abs( sin( a * 2.5 + t * 0.3 ) * 0.7 - r + 0.0 ) ) * step( r, 0.72 );
    alpha = max( max( ring1, ring2 ), max( ticks, star * 0.8 ) ) + smoothstep( 1.0, 0.0, r ) * 0.12; edge = alpha;
  } else if ( type < 6.5 ) { // cracks / scorch
    float n = noise( vUv * 4.0 + vShape.z ) ; float rays = pow( abs( sin( a * 7.0 + n * 3.0 ) ), 18.0 );
    alpha = smoothstep( 1.0, 0.1, r ) * ( 0.45 * smoothstep( 0.9, 0.0, r ) + rays * smoothstep( 1.0, 0.3, r ) ); edge = rays;
  } else { // burst rays
    float rays = pow( abs( sin( a * 6.0 + t ) ), 6.0 );
    alpha = smoothstep( 1.0, 0.0, r ) * ( 0.25 + rays ); edge = rays * smoothstep( 1.0, 0.2, r );
  }
  // telegraph fill: radial progress vAnim.x (> 0 enables)
  if ( vAnim.x > 0.0 ) {
    float fill = type > 2.5 && type < 3.5 ? step( ( vUv.y * 0.5 + 0.5 ), vAnim.x ) : step( r, vAnim.x * ( 1.0 - 0.0 ) );
    float shell = edge;
    alpha = alpha * ( 0.18 + 0.42 * fill ) + shell * 0.55;
  }
  float n = noise( vUv * 6.0 + t * 0.5 );
  vec3 c = vColor.rgb * ( 0.8 + 0.4 * n ) + vColor.rgb * edge * 0.6;
  float outA = clamp( alpha * vColor.a * vAnim.z, 0.0, 1.0 );
  if ( outA < 0.004 ) discard;
  gl_FragColor = vec4( c * outA, outA );
}`;

export function createDecals(scene, capacity = 700, additive = true) {
  const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const aColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(THREE.DynamicDrawUsage);
  const aShape = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(THREE.DynamicDrawUsage);
  const aAnim = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aColor', aColor); geo.setAttribute('aShape', aShape); geo.setAttribute('aAnim', aAnim);
  const mat = new THREE.ShaderMaterial({ vertexShader: DECAL_VERT, fragmentShader: DECAL_FRAG, uniforms: { uTime: { value: 0 } }, transparent: true, depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, polygonOffset: true, polygonOffsetFactor: -2 });
  const mesh = new THREE.InstancedMesh(geo, mat, capacity);
  mesh.frustumCulled = false; mesh.count = 0; mesh.renderOrder = additive ? 3 : 2;
  scene.add(mesh);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), s = new THREE.Vector3(), p = new THREE.Vector3();
  let n = 0;
  return {
    mesh, uniforms: mat.uniforms,
    begin() { n = 0; },
    /** push(x, y, z, angle, sx, sz, color(THREE.Color), alpha, type, inner, halfArc, soft, fill, time, alphaMult, spin) */
    push(x, y, z, angle, sx, sz, color, alpha, type, inner = 0, halfArc = 0, soft = 0.1, fill = 0, time = 0, alphaMult = 1, spin = 0) {
      if (n >= capacity) return;
      q.setFromAxisAngle(up, angle); s.set(sx, 1, sz); p.set(x, y, z);
      m4.compose(p, q, s); mesh.setMatrixAt(n, m4);
      const i = n * 4;
      aColor.array[i] = color.r; aColor.array[i + 1] = color.g; aColor.array[i + 2] = color.b; aColor.array[i + 3] = alpha;
      aShape.array[i] = type; aShape.array[i + 1] = inner; aShape.array[i + 2] = halfArc; aShape.array[i + 3] = soft;
      aAnim.array[i] = fill; aAnim.array[i + 1] = time; aAnim.array[i + 2] = alphaMult; aAnim.array[i + 3] = spin;
      n++;
    },
    end() { mesh.count = n; mesh.instanceMatrix.needsUpdate = true; aColor.needsUpdate = true; aShape.needsUpdate = true; aAnim.needsUpdate = true; },
  };
}

// ------------------------------------------------------------------ particles
const PART_VERT = /* glsl */`
attribute vec3 aPos; attribute vec4 aColor; attribute vec4 aP; attribute vec3 aVel;
varying vec4 vColor; varying vec2 vUv; varying float vShape;
void main() {
  vColor = aColor; vUv = uv * 2.0 - 1.0; vShape = aP.z;
  vec4 mv = modelViewMatrix * vec4( aPos, 1.0 );
  vec2 q = position.xy;
  if ( aP.w > 0.0 ) {
    vec3 vv = ( modelViewMatrix * vec4( aVel, 0.0 ) ).xyz; float l = length( vv.xy ) + 1e-4; vec2 d = vv.xy / l; vec2 nrm = vec2( -d.y, d.x );
    q = d * q.y * ( 1.0 + aP.w * l * 0.06 ) + nrm * q.x * 0.4;
  } else { float c = cos( aP.y ), s = sin( aP.y ); q = vec2( c * q.x - s * q.y, s * q.x + c * q.y ); }
  mv.xy += q * aP.x;
  gl_Position = projectionMatrix * mv;
}`;
const PART_FRAG = /* glsl */`
varying vec4 vColor; varying vec2 vUv; varying float vShape;
void main() {
  float r = length( vUv ); float a = 0.0;
  if ( vShape < 0.5 ) a = smoothstep( 1.0, 0.0, r ) * smoothstep( 1.0, 0.2, r );
  else if ( vShape < 1.5 ) a = smoothstep( 1.0, 0.0, r ) * smoothstep( 1.0, 0.0, abs( vUv.x ) * 2.0 );
  else if ( vShape < 2.5 ) a = smoothstep( 1.0, 0.7, abs( vUv.x ) * 1.8 + abs( vUv.y ) * 0.9 );
  else if ( vShape < 3.5 ) a = smoothstep( 0.18, 0.0, abs( r - 0.75 ) );
  else if ( vShape < 4.5 ) a = max( smoothstep( 0.18, 0.0, abs( vUv.x ) ) * smoothstep( 1.0, 0.0, abs( vUv.y ) ), smoothstep( 0.18, 0.0, abs( vUv.y ) ) * smoothstep( 1.0, 0.0, abs( vUv.x ) ) ) + smoothstep( 0.5, 0.0, r );
  else if ( vShape < 5.5 ) a = smoothstep( 1.0, 0.1, r ) * 0.6;
  else if ( vShape < 6.5 ) a = smoothstep( 1.0, 0.85, abs( vUv.x ) * 1.6 + vUv.y * vUv.y * 0.9 );
  else a = step( abs( vUv.x ), 0.8 ) * step( abs( vUv.y ), 0.8 );
  a *= vColor.a;
  if ( a < 0.003 ) discard;
  gl_FragColor = vec4( vColor.rgb * a, a );
}`;

export function createParticles(scene, capacity = 5000, additive = true) {
  const geo = new THREE.InstancedBufferGeometry();
  const base = new THREE.PlaneGeometry(1, 1);
  geo.index = base.index; geo.setAttribute('position', base.attributes.position); geo.setAttribute('uv', base.attributes.uv);
  const aPos = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3).setUsage(THREE.DynamicDrawUsage);
  const aColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(THREE.DynamicDrawUsage);
  const aP = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(THREE.DynamicDrawUsage);
  const aVel = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aPos', aPos); geo.setAttribute('aColor', aColor); geo.setAttribute('aP', aP); geo.setAttribute('aVel', aVel);
  geo.instanceCount = 0;
  const mat = new THREE.ShaderMaterial({ vertexShader: PART_VERT, fragmentShader: PART_FRAG, transparent: true, depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = additive ? 6 : 5;
  scene.add(mesh);
  // CPU state (struct of arrays)
  const N = capacity;
  const px = new Float32Array(N), py = new Float32Array(N), pz = new Float32Array(N), vx = new Float32Array(N), vy = new Float32Array(N), vz = new Float32Array(N);
  const life = new Float32Array(N), max = new Float32Array(N), size0 = new Float32Array(N), size1 = new Float32Array(N), rot = new Float32Array(N), spin = new Float32Array(N);
  const cr = new Float32Array(N), cg = new Float32Array(N), cb = new Float32Array(N), alpha = new Float32Array(N), grav = new Float32Array(N), drag = new Float32Array(N), shape = new Float32Array(N), stretch = new Float32Array(N);
  const cr2 = new Float32Array(N), cg2 = new Float32Array(N), cb2 = new Float32Array(N);
  let count = 0;
  return {
    mesh,
    get count() { return count; },
    /** o: { x,y,z, vx,vy,vz, life, size, size1, color, color2, alpha, gravity, drag, shape, stretch, rot, spin } */
    emit(o) {
      if (count >= N) return;
      const i = count++;
      px[i] = o.x; py[i] = o.y; pz[i] = o.z; vx[i] = o.vx || 0; vy[i] = o.vy || 0; vz[i] = o.vz || 0;
      life[i] = max[i] = o.life || 0.6; size0[i] = o.size ?? 0.3; size1[i] = o.size1 ?? size0[i] * 0.2; rot[i] = o.rot ?? Math.random() * 6.28; spin[i] = o.spin || 0;
      const c = o.color, c2 = o.color2 || c;
      cr[i] = c.r; cg[i] = c.g; cb[i] = c.b; cr2[i] = c2.r; cg2[i] = c2.g; cb2[i] = c2.b; alpha[i] = o.alpha ?? 1;
      grav[i] = o.gravity || 0; drag[i] = o.drag ?? 1.5; shape[i] = o.shape || 0; stretch[i] = o.stretch || 0;
    },
    update(dt) {
      let w = 0;
      for (let i = 0; i < count; i++) {
        life[i] -= dt;
        if (life[i] <= 0) continue;
        if (w !== i) { px[w] = px[i]; py[w] = py[i]; pz[w] = pz[i]; vx[w] = vx[i]; vy[w] = vy[i]; vz[w] = vz[i]; life[w] = life[i]; max[w] = max[i]; size0[w] = size0[i]; size1[w] = size1[i]; rot[w] = rot[i]; spin[w] = spin[i];
          cr[w] = cr[i]; cg[w] = cg[i]; cb[w] = cb[i]; cr2[w] = cr2[i]; cg2[w] = cg2[i]; cb2[w] = cb2[i]; alpha[w] = alpha[i]; grav[w] = grav[i]; drag[w] = drag[i]; shape[w] = shape[i]; stretch[w] = stretch[i]; }
        const d = Math.exp(-drag[w] * dt);
        vx[w] *= d; vz[w] *= d; vy[w] = vy[w] * d - grav[w] * dt;
        px[w] += vx[w] * dt; py[w] += vy[w] * dt; pz[w] += vz[w] * dt;
        if (py[w] < 0.02 && grav[w] > 0) { py[w] = 0.02; vy[w] *= -0.3; vx[w] *= 0.6; vz[w] *= 0.6; }
        rot[w] += spin[w] * dt;
        w++;
      }
      count = w;
      const P = aPos.array, Cl = aColor.array, A = aP.array, V = aVel.array;
      for (let i = 0; i < count; i++) {
        const k = 1 - life[i] / max[i];
        const fade = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85;
        P[i * 3] = px[i]; P[i * 3 + 1] = py[i]; P[i * 3 + 2] = pz[i];
        Cl[i * 4] = cr[i] + (cr2[i] - cr[i]) * k; Cl[i * 4 + 1] = cg[i] + (cg2[i] - cg[i]) * k; Cl[i * 4 + 2] = cb[i] + (cb2[i] - cb[i]) * k; Cl[i * 4 + 3] = alpha[i] * Math.max(0, fade);
        A[i * 4] = size0[i] + (size1[i] - size0[i]) * k; A[i * 4 + 1] = rot[i]; A[i * 4 + 2] = shape[i]; A[i * 4 + 3] = stretch[i];
        V[i * 3] = vx[i]; V[i * 3 + 1] = vy[i]; V[i * 3 + 2] = vz[i];
      }
      geo.instanceCount = count;
      aPos.needsUpdate = true; aColor.needsUpdate = true; aP.needsUpdate = true; aVel.needsUpdate = true;
      aPos.addUpdateRange?.(0, count * 3);
    },
    clear() { count = 0; },
  };
}

// ------------------------------------------------------------------ energy meshes
const ENERGY_VERT = /* glsl */`
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main() { vUv = uv; vec4 mv = modelViewMatrix * vec4( position, 1.0 ); vN = normalize( normalMatrix * normal ); vV = normalize( -mv.xyz ); gl_Position = projectionMatrix * mv; }`;
const ENERGY_FRAG = /* glsl */`
uniform vec3 uCore; uniform vec3 uMain; uniform float uAlpha; uniform float uTime; uniform float uScroll; uniform float uFres; uniform float uNoise; uniform float uFadeTop;
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
float hash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
float noise( vec2 p ) { vec2 i = floor( p ), f = fract( p ); f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( hash( i ), hash( i + vec2( 1, 0 ) ), f.x ), mix( hash( i + vec2( 0, 1 ) ), hash( i + vec2( 1, 1 ) ), f.x ), f.y ); }
void main() {
  float n = noise( vec2( vUv.x * 8.0, vUv.y * 3.0 - uTime * uScroll ) ) * 0.6 + noise( vec2( vUv.x * 16.0, vUv.y * 6.0 - uTime * uScroll * 1.7 ) ) * 0.4;
  float fres = pow( 1.0 - abs( dot( vN, vV ) ), uFres );
  float body = mix( 1.0, n, uNoise );
  float top = mix( 1.0, smoothstep( 1.0, 0.55, vUv.y ), uFadeTop );
  vec3 c = mix( uCore, uMain, clamp( fres * 1.3 + ( 1.0 - n ) * 0.4, 0.0, 1.0 ) );
  float a = uAlpha * clamp( body * ( 0.45 + fres * 0.9 ), 0.0, 1.0 ) * top;
  if ( a < 0.004 ) discard;
  gl_FragColor = vec4( c * a, a );
}`;
const GEOS = {};
function geometry(kind) {
  if (GEOS[kind]) return GEOS[kind];
  let g;
  switch (kind) {
    case 'cylinder': g = new THREE.CylinderGeometry(1, 1, 1, 24, 1, true).translate(0, 0.5, 0); break;
    case 'cone': g = new THREE.ConeGeometry(1, 1, 16, 1, true).translate(0, 0.5, 0); break;
    case 'sphere': g = new THREE.SphereGeometry(1, 24, 16); break;
    case 'dome': g = new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2); break;
    case 'torus': g = new THREE.TorusGeometry(1, 0.08, 8, 48).rotateX(Math.PI / 2); break;
    case 'slash': g = slashGeometry(); break;
    case 'blade': g = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0); break;
    case 'spike': g = new THREE.ConeGeometry(0.5, 1, 5, 1).translate(0, 0.5, 0); break;
    case 'crystal': g = new THREE.OctahedronGeometry(0.5, 0).scale(0.6, 1.6, 0.6).translate(0, 0.6, 0); break;
    case 'rock': g = new THREE.IcosahedronGeometry(0.5, 0); break;
    case 'box': g = new THREE.BoxGeometry(1, 1, 1); break;
    default: g = new THREE.SphereGeometry(1, 12, 8);
  }
  GEOS[kind] = g;
  return g;
}
function slashGeometry() {
  // half-annulus crescent: uv.x along arc (0..1), uv.y across (inner 0 .. outer 1); spans angle [-0.5, 0.5] * arc set by scale.x hack in vertex positions
  const seg = 40, pos = [], uv = [], idx = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, a = (t - 0.5) * Math.PI;
    const thick = Math.sin(t * Math.PI);
    for (let j = 0; j <= 1; j++) { const r = j ? 1 : 1 - 0.32 * thick; pos.push(Math.sin(a) * r, 0, Math.cos(a) * r); uv.push(t, j); }
  }
  for (let i = 0; i < seg; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
const SLASH_FRAG = /* glsl */`
uniform vec3 uCore; uniform vec3 uMain; uniform float uAlpha; uniform float uTime; uniform float uProg;
varying vec2 vUv;
void main() {
  float head = smoothstep( uProg - 0.6, uProg, vUv.x ) * step( vUv.x, uProg + 0.02 );
  float edge = smoothstep( 0.0, 1.0, vUv.y );
  vec3 c = mix( uMain, uCore, pow( edge, 3.0 ) );
  float a = uAlpha * head * ( 0.25 + 0.75 * pow( edge, 1.5 ) );
  if ( a < 0.004 ) discard;
  gl_FragColor = vec4( c * a, a );
}`;

export function createMeshPool(scene) {
  const live = new Set();
  const free = {};
  function get(kind, o = {}) {
    const isSlash = kind === 'slash';
    const lit = kind === 'rock' || kind === 'crystal' || kind === 'box' || kind === 'spike' && o.lit;
    let m = (free[kind + (lit ? 'L' : '') + (isSlash ? 'S' : '')] ||= []).pop();
    if (!m) {
      const mat = lit ? new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.1, flatShading: true, transparent: true })
        : new THREE.ShaderMaterial({ vertexShader: ENERGY_VERT, fragmentShader: isSlash ? SLASH_FRAG : ENERGY_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
          uniforms: { uCore: { value: new THREE.Color() }, uMain: { value: new THREE.Color() }, uAlpha: { value: 1 }, uTime: { value: 0 }, uScroll: { value: 1.5 }, uFres: { value: 1.5 }, uNoise: { value: 0.6 }, uFadeTop: { value: 1 }, uProg: { value: 1 } } });
      m = new THREE.Mesh(geometry(kind), mat);
      m.frustumCulled = false;
      m.userData.poolKey = kind + (lit ? 'L' : '') + (isSlash ? 'S' : '');
      m.renderOrder = lit ? 1 : 7;
      if (lit) { m.castShadow = true; }
    }
    m.visible = true; m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); m.scale.set(1, 1, 1);
    const u = m.material.uniforms;
    if (u) {
      u.uCore.value.copy(o.core || col('#ffffff')); u.uMain.value.copy(o.main || col('#ffffff')); u.uAlpha.value = o.alpha ?? 1;
      u.uScroll.value = o.scroll ?? 1.5; u.uFres.value = o.fres ?? 1.5; u.uNoise.value = o.noise ?? 0.6; u.uFadeTop.value = o.fadeTop ?? 1; u.uProg.value = 1;
    } else {
      m.material.color.copy(o.color || col('#888888')); m.material.emissive = (o.emissive || col('#000000')).clone(); m.material.emissiveIntensity = o.emissiveIntensity ?? 1; m.material.opacity = 1;
    }
    scene.add(m); live.add(m);
    return m;
  }
  function release(m) { if (!m || !live.has(m)) return; live.delete(m); scene.remove(m); (free[m.userData.poolKey] ||= []).push(m); }
  return { get, release, tick(t) { for (const m of live) if (m.material.uniforms) m.material.uniforms.uTime.value = t; }, live };
}

// ------------------------------------------------------------------ lightning ribbons
const BOLT_VERT = /* glsl */`
attribute vec3 aA; attribute vec3 aB; attribute vec4 aColor; attribute float aW;
varying vec4 vColor; varying vec2 vUv;
void main() {
  vColor = aColor; vUv = uv * 2.0 - 1.0;
  vec4 a = modelViewMatrix * vec4( aA, 1.0 ), b = modelViewMatrix * vec4( aB, 1.0 );
  vec2 d = normalize( b.xy - a.xy + 1e-5 ); vec2 n = vec2( -d.y, d.x );
  vec4 p = mix( a, b, position.y + 0.5 ); p.xy += n * position.x * aW;
  gl_Position = projectionMatrix * p;
}`;
const BOLT_FRAG = /* glsl */`
varying vec4 vColor; varying vec2 vUv;
void main() { float x = abs( vUv.x ); float core = smoothstep( 0.35, 0.0, x ); float glow = smoothstep( 1.0, 0.0, x ) * 0.5;
  float a = ( core + glow ) * vColor.a; vec3 c = mix( vColor.rgb, vec3( 1.0 ), core * 0.7 );
  gl_FragColor = vec4( c * a, a ); }`;
export function createBolts(scene, capacity = 2400) {
  const geo = new THREE.InstancedBufferGeometry();
  const base = new THREE.PlaneGeometry(1, 1);
  geo.index = base.index; geo.setAttribute('position', base.attributes.position); geo.setAttribute('uv', base.attributes.uv);
  const aA = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3).setUsage(THREE.DynamicDrawUsage);
  const aB = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3).setUsage(THREE.DynamicDrawUsage);
  const aColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(THREE.DynamicDrawUsage);
  const aW = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aA', aA); geo.setAttribute('aB', aB); geo.setAttribute('aColor', aColor); geo.setAttribute('aW', aW);
  const mat = new THREE.ShaderMaterial({ vertexShader: BOLT_VERT, fragmentShader: BOLT_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 8; scene.add(mesh);
  let n = 0;
  return {
    begin() { n = 0; },
    seg(ax, ay, az, bx, by, bz, color, alpha, width) {
      if (n >= capacity) return; const i = n++;
      aA.array[i * 3] = ax; aA.array[i * 3 + 1] = ay; aA.array[i * 3 + 2] = az; aB.array[i * 3] = bx; aB.array[i * 3 + 1] = by; aB.array[i * 3 + 2] = bz;
      aColor.array[i * 4] = color.r; aColor.array[i * 4 + 1] = color.g; aColor.array[i * 4 + 2] = color.b; aColor.array[i * 4 + 3] = alpha; aW.array[i] = width;
    },
    /** Jagged lightning between two points. */
    bolt(ax, ay, az, bx, by, bz, color, alpha = 1, width = 0.18, jag = 0.6, segs = 8) {
      let px = ax, py = ay, pz = az;
      for (let s = 1; s <= segs; s++) {
        const t = s / segs, j = s === segs ? 0 : jag * Math.sin(t * Math.PI);
        const nx = ax + (bx - ax) * t + (Math.random() - 0.5) * j, ny = ay + (by - ay) * t + (Math.random() - 0.5) * j * 0.6, nz = az + (bz - az) * t + (Math.random() - 0.5) * j;
        this.seg(px, py, pz, nx, ny, nz, color, alpha, width);
        px = nx; py = ny; pz = nz;
      }
    },
    end() { geo.instanceCount = n; aA.needsUpdate = true; aB.needsUpdate = true; aColor.needsUpdate = true; aW.needsUpdate = true; },
  };
}

// ------------------------------------------------------------------ flash lights
export function createLights(scene, n = 6) {
  const pool = [];
  for (let i = 0; i < n; i++) { const l = new THREE.PointLight(0xffffff, 0, 10, 2); l.position.set(0, -50, 0); scene.add(l); pool.push({ l, life: 0, max: 1, power: 0 }); }
  let idx = 0;
  return {
    flash(x, y, z, color, power = 30, life = 0.25, dist = 12) {
      const p = pool[idx++ % n]; p.l.position.set(x, y, z); p.l.color.copy(color); p.l.distance = dist; p.power = power; p.life = p.max = life;
    },
    update(dt) { for (const p of pool) { if (p.life <= 0) { p.l.intensity = 0; continue; } p.life -= dt; p.l.intensity = p.power * Math.max(0, p.life / p.max); } },
  };
}
