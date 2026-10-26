import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

// Final colour grade in display space: per-biome lift/gamma/gain + saturation/contrast, a soft vignette,
// subtle film grain, and a brief chromatic split on heavy impacts.
const PRESETS = {
  graveyard: { lift: [0.02, 0.0, 0.04], gain: [1.0, 1.02, 1.06], sat: 1.12, contrast: 1.08 },
  frostkeep: { lift: [0.0, 0.02, 0.05], gain: [0.98, 1.03, 1.1], sat: 1.05, contrast: 1.06 },
  inferno: { lift: [0.04, 0.0, 0.0], gain: [1.1, 1.0, 0.92], sat: 1.18, contrast: 1.1 },
  shadowcourt: { lift: [0.03, 0.0, 0.05], gain: [1.03, 0.98, 1.1], sat: 1.12, contrast: 1.08 },
  abyss: { lift: [0.04, 0.0, 0.05], gain: [1.08, 0.96, 1.08], sat: 1.15, contrast: 1.1 },
  skytemple: { lift: [0.02, 0.02, 0.0], gain: [1.06, 1.04, 0.98], sat: 1.06, contrast: 1.04 },
};

const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uLift: { value: new THREE.Vector3() }, uGain: { value: new THREE.Vector3(1, 1, 1) }, uSat: { value: 1.1 }, uContrast: { value: 1.06 },
    uVignette: { value: 0.32 }, uGrain: { value: 0.035 }, uTime: { value: 0 }, uSplit: { value: 0 }, uAspect: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }',
  fragmentShader: /* glsl */`
uniform sampler2D tDiffuse; uniform vec3 uLift; uniform vec3 uGain; uniform float uSat; uniform float uContrast; uniform float uVignette; uniform float uGrain; uniform float uTime; uniform float uSplit; uniform float uAspect;
varying vec2 vUv;
float hash( vec2 p ) { return fract( sin( dot( p, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 ); }
void main() {
  vec2 d = vUv - 0.5;
  vec3 c;
  if ( uSplit > 0.001 ) { vec2 o = d * uSplit * 0.02; c = vec3( texture2D( tDiffuse, vUv + o ).r, texture2D( tDiffuse, vUv ).g, texture2D( tDiffuse, vUv - o ).b ); }
  else c = texture2D( tDiffuse, vUv ).rgb;
  c = c * uGain + uLift * ( 1.0 - c );
  float l = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) );
  c = mix( vec3( l ), c, uSat );
  c = ( c - 0.5 ) * uContrast + 0.5;
  d.x *= uAspect;
  float v = smoothstep( 0.95, 0.35, length( d ) );
  c *= mix( 1.0 - uVignette, 1.0, v );
  c += ( hash( vUv * 913.0 + fract( uTime * 7.3 ) ) - 0.5 ) * uGrain;
  gl_FragColor = vec4( clamp( c, 0.0, 1.0 ), 1.0 );
}`,
};

export function createGradePass() {
  const pass = new ShaderPass(GradeShader);
  const u = pass.uniforms;
  const target = { lift: new THREE.Vector3(), gain: new THREE.Vector3(1, 1, 1), sat: 1.1, contrast: 1.06 };
  return {
    pass,
    setBiome(id) { const p = PRESETS[id] || PRESETS.graveyard; target.lift.fromArray(p.lift); target.gain.fromArray(p.gain); target.sat = p.sat; target.contrast = p.contrast; },
    update(t, dt, { trauma = 0, aspect = 1 } = {}) {
      const k = 1 - Math.exp(-dt * 2);
      u.uLift.value.lerp(target.lift, k); u.uGain.value.lerp(target.gain, k);
      u.uSat.value += (target.sat - u.uSat.value) * k; u.uContrast.value += (target.contrast - u.uContrast.value) * k;
      u.uTime.value = t; u.uSplit.value = Math.max(0, trauma - 0.35) * 1.6; u.uAspect.value = aspect;
    },
  };
}
