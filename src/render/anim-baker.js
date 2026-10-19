import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

// Bakes skinned animation clips into a bone-matrix texture so hundreds of crowd instances can be skinned
// on the GPU from one InstancedMesh. Each texel row = one frame; 3 RGBA texels per bone (rows of a 3x4 matrix).
export const BAKE_FPS = 30;

export function bakeClips(gltfScene, clips, { fps = BAKE_FPS } = {}) {
  const root = cloneSkinned(gltfScene);
  let mesh = null;
  root.traverse((o) => { if (o.isSkinnedMesh && !mesh) mesh = o; });
  if (!mesh) throw new Error('bakeClips: no skinned mesh');
  root.updateMatrixWorld(true);
  const skeleton = mesh.skeleton, bones = skeleton.bones, nb = bones.length;
  const mixer = new THREE.AnimationMixer(root);
  const ranges = {};
  let total = 0;
  const list = clips.filter(Boolean);
  for (const clip of list) { const frames = Math.max(1, Math.ceil(clip.duration * fps)); ranges[clip.name] = { start: total, frames, duration: clip.duration }; total += frames; }
  const width = nb * 3, height = Math.max(1, total);
  const data = new Float32Array(width * height * 4);
  const m = new THREE.Matrix4(), tmp = new THREE.Matrix4();
  const bindM = mesh.bindMatrix, bindInv = mesh.bindMatrixInverse;
  for (const clip of list) {
    const r = ranges[clip.name];
    mixer.stopAllAction();
    const action = mixer.clipAction(clip);
    action.reset(); action.play(); action.setLoop(THREE.LoopRepeat, Infinity);
    for (let f = 0; f < r.frames; f++) {
      action.time = Math.min(clip.duration - 1e-4, f / fps);
      mixer.update(0);
      root.updateMatrixWorld(true);
      const row = r.start + f;
      for (let b = 0; b < nb; b++) {
        tmp.multiplyMatrices(bones[b].matrixWorld, skeleton.boneInverses[b]);
        m.multiplyMatrices(bindInv, tmp).multiply(bindM);
        const e = m.elements, o = (row * width + b * 3) * 4;
        data[o] = e[0]; data[o + 1] = e[4]; data[o + 2] = e[8]; data[o + 3] = e[12];
        data[o + 4] = e[1]; data[o + 5] = e[5]; data[o + 6] = e[9]; data[o + 7] = e[13];
        data[o + 8] = e[2]; data[o + 9] = e[6]; data[o + 10] = e[10]; data[o + 11] = e[14];
      }
    }
    action.stop();
  }
  const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.FloatType);
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.needsUpdate = true;
  return { texture: tex, ranges, fps, width, height, geometry: mesh.geometry, material: mesh.material, boneCount: nb };
}

const VERT_PARS = /* glsl */`
uniform highp sampler2D uBones;
attribute vec4 skinIndex;
attribute vec4 skinWeight;
attribute float aFrame;
attribute vec4 aTint;
attribute vec4 aFx;
varying vec4 vTint;
varying vec4 vFx;
varying vec3 vWorldPos;
mat4 rrBone( float i, float frame ) {
  int x = int( i ) * 3; int y = int( frame );
  vec4 r0 = texelFetch( uBones, ivec2( x, y ), 0 );
  vec4 r1 = texelFetch( uBones, ivec2( x + 1, y ), 0 );
  vec4 r2 = texelFetch( uBones, ivec2( x + 2, y ), 0 );
  return mat4( vec4( r0.x, r1.x, r2.x, 0.0 ), vec4( r0.y, r1.y, r2.y, 0.0 ), vec4( r0.z, r1.z, r2.z, 0.0 ), vec4( r0.w, r1.w, r2.w, 1.0 ) );
}`;

/** Material for a baked crowd: vertex-colour encoding (see character-material.js) + per-instance tint/flash/fx. */
export function createCrowdMaterial(baked, { map = null } = {}) {
  const mat = new THREE.MeshStandardMaterial({ map, roughness: 0.8, metalness: 0.05, vertexColors: true });
  if (map) map.colorSpace = THREE.SRGBColorSpace;
  const uniforms = { uBones: { value: baked.texture }, uGlow: { value: 2.0 }, uTime: { value: 0 } };
  mat.userData.rr = uniforms;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_PARS}`)
      .replace('#include <skinnormal_vertex>', `mat4 rrSkin = skinWeight.x * rrBone( skinIndex.x, aFrame ) + skinWeight.y * rrBone( skinIndex.y, aFrame ) + skinWeight.z * rrBone( skinIndex.z, aFrame ) + skinWeight.w * rrBone( skinIndex.w, aFrame );
      objectNormal = ( rrSkin * vec4( objectNormal, 0.0 ) ).xyz;`)
      .replace('#include <skinning_vertex>', `transformed = ( rrSkin * vec4( transformed, 1.0 ) ).xyz; vTint = aTint; vFx = aFx;`)
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>\n vWorldPos = ( modelMatrix * instanceMatrix * vec4( transformed, 1.0 ) ).xyz;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uGlow; uniform float uTime;
varying vec4 vTint; varying vec4 vFx; varying vec3 vWorldPos;
float rrHash( vec3 p ) { p = fract( p * 0.3183099 + 0.1 ); p *= 17.0; return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) ); }`)
      .replace('#include <color_fragment>', `
#if defined( USE_COLOR_ALPHA )
  float rrFlat = step( 0.01, vColor.a );
  float rrGlow = clamp( ( vColor.a - 0.5 ) * 2.0, 0.0, 1.0 );
  diffuseColor.rgb = mix( diffuseColor.rgb * vColor.rgb, vColor.rgb, rrFlat );
#else
  float rrGlow = 0.0;
#endif
  diffuseColor.rgb *= mix( vec3( 1.0 ), vTint.rgb, 0.85 );
  // freeze (vFx.y) -> icy blue, status tint (vFx.z: >0 burn orange, <0 poison green)
  diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.55, 0.85, 1.0 ), vFx.y * 0.75 );
  if ( vFx.z > 0.0 ) diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 1.0, 0.45, 0.15 ), vFx.z * 0.45 );
  if ( vFx.z < 0.0 ) diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.45, 1.0, 0.35 ), -vFx.z * 0.45 );`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  totalEmissiveRadiance += diffuseColor.rgb * rrGlow * uGlow;
  totalEmissiveRadiance += vec3( 1.0, 0.95, 0.9 ) * vTint.a * 0.55;
  totalEmissiveRadiance += vec3( 0.4, 0.75, 1.0 ) * vFx.y * 0.35;
  float rrRim = pow( 1.0 - saturate( dot( normalize( vViewPosition ), normal ) ), 3.0 );
  totalEmissiveRadiance += mix( vec3( 1.0, 0.85, 0.7 ), vTint.rgb, step( 0.5, vFx.w ) ) * rrRim * ( 0.1 + vFx.w * 0.6 );
  if ( vFx.x > 0.0 ) {
    float n = rrHash( floor( vWorldPos * 9.0 ) );
    if ( n < vFx.x ) discard;
    totalEmissiveRadiance += vec3( 1.0, 0.5, 0.15 ) * smoothstep( vFx.x + 0.15, vFx.x, n ) * 5.0;
  }`);
  };
  mat.customProgramCacheKey = () => 'rr-crowd';
  return mat;
}
