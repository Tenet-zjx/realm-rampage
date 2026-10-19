import * as THREE from 'three';

// Vertex colour "Col" written by scripts/blender/kk.py encodes the look of every character part:
//   a == 0      -> texture * rgb (KayKit atlas)
//   0 < a <= .5 -> flat rgb (procedural accessories / original monsters)
//   a > .5      -> flat rgb + emissive glow of (a - .5) * 2
// Individual characters (heroes, bosses) also get a hit-flash, a status tint and a dissolve.
const COLOR_CHUNK = /* glsl */`
#if defined( USE_COLOR_ALPHA )
  float rrFlat = step( 0.01, vColor.a );
  float rrGlow = clamp( ( vColor.a - 0.5 ) * 2.0, 0.0, 1.0 );
  diffuseColor.rgb = mix( diffuseColor.rgb * vColor.rgb, vColor.rgb, rrFlat );
#else
  float rrGlow = 0.0;
#endif
`;

export function patchCharacterMaterial(material, { glow = 2.4, rim = 0.35, rimColor = 0xfff1d6 } = {}) {
  const uniforms = {
    uFlash: { value: new THREE.Vector4(1, 1, 1, 0) },      // rgb + amount
    uTint: { value: new THREE.Vector4(1, 1, 1, 0) },       // status tint rgb + amount (freeze, burn, poison)
    uDissolve: { value: 0 },
    uGlow: { value: glow },
    uRim: { value: new THREE.Vector4(...new THREE.Color(rimColor).toArray(), rim) },
  };
  material.userData.rr = uniforms;
  material.vertexColors = true;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform vec4 uFlash; uniform vec4 uTint; uniform float uDissolve; uniform float uGlow; uniform vec4 uRim;
float rrHash( vec3 p ) { p = fract( p * 0.3183099 + 0.1 ); p *= 17.0; return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) ); }`)
      .replace('#include <color_fragment>', COLOR_CHUNK + `
  diffuseColor.rgb = mix( diffuseColor.rgb, diffuseColor.rgb * uTint.rgb * 1.4, uTint.a );`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  totalEmissiveRadiance += diffuseColor.rgb * rrGlow * uGlow;
  float rrRim = pow( 1.0 - saturate( dot( normalize( vViewPosition ), normal ) ), 3.0 );
  totalEmissiveRadiance += uRim.rgb * rrRim * uRim.a;
  totalEmissiveRadiance += uFlash.rgb * uFlash.a * 1.6;
  totalEmissiveRadiance += uTint.rgb * uTint.a * 0.25;
  if ( uDissolve > 0.0 ) {
    float n = rrHash( floor( vViewPosition * 18.0 ) );
    if ( n < uDissolve ) discard;
    totalEmissiveRadiance += vec3( 1.0, 0.45, 0.1 ) * smoothstep( uDissolve + 0.12, uDissolve, n ) * 4.0;
  }`);
  };
  material.customProgramCacheKey = () => 'rr-character';
  material.needsUpdate = true;
  return uniforms;
}

export function prepareCharacterMaterials(root, options) {
  const mats = new Map();
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    const list = Array.isArray(o.material) ? o.material : [o.material];
    const out = list.map((m) => {
      if (mats.has(m)) return mats.get(m);
      const std = new THREE.MeshStandardMaterial({ map: m.map, roughness: 0.78, metalness: 0.05, vertexColors: true });
      if (std.map) { std.map.colorSpace = THREE.SRGBColorSpace; std.map.anisotropy = 4; }
      patchCharacterMaterial(std, options);
      mats.set(m, std);
      m.dispose();
      return std;
    });
    o.material = Array.isArray(o.material) ? out : out[0];
  });
  return [...mats.values()];
}
