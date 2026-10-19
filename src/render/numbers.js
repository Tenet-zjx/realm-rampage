import * as THREE from 'three';

// Floating combat numbers rendered as instanced glyph quads from a canvas digit atlas (hundreds on screen cheaply).
const GLYPHS = '0123456789+-.KM!';
const CELL = 64;

function atlas() {
  const c = document.createElement('canvas'); c.width = CELL * GLYPHS.length; c.height = CELL + 16;
  const g = c.getContext('2d');
  g.font = `900 ${CELL - 6}px "Arial Black", "Helvetica Neue", Arial, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let i = 0; i < GLYPHS.length; i++) {
    const x = i * CELL + CELL / 2, y = (CELL + 16) / 2;
    g.lineWidth = 10; g.strokeStyle = 'rgba(0,0,0,0.85)'; g.strokeText(GLYPHS[i], x, y);
    g.fillStyle = '#ffffff'; g.fillText(GLYPHS[i], x, y);
  }
  const t = new THREE.CanvasTexture(c); t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  return t;
}

const VERT = /* glsl */`
attribute vec3 aPos; attribute vec2 aOff; attribute float aGlyph; attribute vec4 aColor; attribute float aSize;
uniform float uGlyphs;
varying vec2 vUv; varying vec4 vColor;
void main() {
  vColor = aColor;
  vUv = vec2( ( aGlyph + uv.x ) / uGlyphs, uv.y );
  vec4 mv = modelViewMatrix * vec4( aPos, 1.0 );
  mv.xy += ( position.xy * vec2( 0.62, 0.78 ) + aOff ) * aSize;
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = /* glsl */`
uniform sampler2D uMap; varying vec2 vUv; varying vec4 vColor;
void main() { vec4 t = texture2D( uMap, vUv ); float lum = t.r; vec3 c = mix( vec3( 0.0 ), vColor.rgb, lum ); float a = t.a * vColor.a; if ( a < 0.02 ) discard; gl_FragColor = vec4( c, a ); }`;

export function createNumbers(scene, capacity = 1400) {
  const geo = new THREE.InstancedBufferGeometry();
  const base = new THREE.PlaneGeometry(1, 1);
  geo.index = base.index; geo.setAttribute('position', base.attributes.position); geo.setAttribute('uv', base.attributes.uv);
  const mk = (n) => new THREE.InstancedBufferAttribute(new Float32Array(capacity * n), n).setUsage(THREE.DynamicDrawUsage);
  const aPos = mk(3), aOff = mk(2), aGlyph = mk(1), aColor = mk(4), aSize = mk(1);
  geo.setAttribute('aPos', aPos); geo.setAttribute('aOff', aOff); geo.setAttribute('aGlyph', aGlyph); geo.setAttribute('aColor', aColor); geo.setAttribute('aSize', aSize);
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: { uMap: { value: atlas() }, uGlyphs: { value: GLYPHS.length } }, transparent: true, depthWrite: false, depthTest: false });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 20; scene.add(mesh);
  const items = [];
  const color = new THREE.Color();
  let budget = 0;
  const fmt = (v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e4 ? `${(v / 1e3).toFixed(1)}K` : `${Math.round(v)}`);
  return {
    enabled: true,
    add(x, y, z, value, { crit = false, hex = '#ffffff', big = false, prefix = '', small = false, force = false } = {}) {
      if (!this.enabled) return;
      if (!force && !crit && !big) { if (budget <= 0) return; budget--; }
      if (items.length > 160) items.shift();
      color.set(crit ? '#ffcf3a' : hex);
      items.push({ x: x + (Math.random() - 0.5) * 0.8, y: y + 0.3, z: z + (Math.random() - 0.5) * 0.8, text: prefix + fmt(value), r: color.r, g: color.g, b: color.b, t: 0,
        life: crit ? 0.95 : 0.75, size: crit ? 1.25 : big ? 1.0 : small ? 0.55 : 0.72, crit, vx: (Math.random() - 0.5) * 1.2, vy: crit ? 3.2 : 2.4 });
    },
    update(dt) {
      budget = Math.min(30, budget + dt * 60);
      let n = 0;
      for (let i = items.length - 1; i >= 0; i--) { const it = items[i]; it.t += dt; if (it.t >= it.life) items.splice(i, 1); }
      for (const it of items) {
        const k = it.t / it.life;
        const pop = it.t < 0.1 ? 1 + (1 - it.t / 0.1) * (it.crit ? 0.9 : 0.5) : 1;
        const shake = it.crit && it.t < 0.15 ? (Math.random() - 0.5) * 0.08 : 0;
        it.x += it.vx * dt; it.y += it.vy * dt; it.vy -= 4 * dt;
        const a = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
        const len = it.text.length;
        for (let c = 0; c < len && n < capacity; c++) {
          const gi = GLYPHS.indexOf(it.text[c]); if (gi < 0) continue;
          aPos.array[n * 3] = it.x; aPos.array[n * 3 + 1] = it.y; aPos.array[n * 3 + 2] = it.z;
          aOff.array[n * 2] = (c - (len - 1) / 2) * 0.56 + shake; aOff.array[n * 2 + 1] = 0;
          aGlyph.array[n] = gi;
          aColor.array[n * 4] = it.r; aColor.array[n * 4 + 1] = it.g; aColor.array[n * 4 + 2] = it.b; aColor.array[n * 4 + 3] = a;
          aSize.array[n] = it.size * pop;
          n++;
        }
      }
      geo.instanceCount = n;
      aPos.needsUpdate = true; aOff.needsUpdate = true; aGlyph.needsUpdate = true; aColor.needsUpdate = true; aSize.needsUpdate = true;
    },
    clear() { items.length = 0; },
  };
}
