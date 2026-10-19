import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { prepareCharacterMaterials } from './character-material.js';

const BASE = `${import.meta.env?.BASE_URL ?? '/'}assets/models/`;

export function createAssetLibrary(opts = {}) {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const cache = new Map();
  let manifest = null, clips = null;
  const textureLoader = new THREE.TextureLoader();
  let loaded = 0, total = 0;

  const fetchGltf = (file) => {
    if (!cache.has(file)) {
      total++;
      cache.set(file, loader.loadAsync(BASE + file).then((g) => { loaded++; (api.onProgress || opts.onProgress)?.(loaded, total, file); return g; }));
    }
    return cache.get(file);
  };

  const api = {
    async init() {
      manifest = await (await fetch(BASE + 'manifest.json')).json();
      const anims = await fetchGltf(manifest.assets.anims.file);
      clips = new Map(anims.animations.map((c) => [c.name, c]));
      return manifest;
    },
    get manifest() { return manifest; },
    clip(name) { return clips.get(name); },
    clips() { return clips; },
    has(id) { return !!manifest?.assets[id]; },
    preload(ids) { return Promise.all(ids.filter((id) => manifest.assets[id]).map((id) => fetchGltf(manifest.assets[id].file))); },
    /** Raw gltf (shared, do not mutate). */
    async gltf(id) { return fetchGltf(manifest.assets[id].file); },
    /** Independent skinned character instance with its own materials (heroes, bosses, previews). */
    async character(id, { skin = 0, glow, rim } = {}) {
      const gltf = await fetchGltf(manifest.assets[id].file);
      const root = cloneSkinned(gltf.scene);
      const materials = prepareCharacterMaterials(root, { glow, rim });
      const skinInfo = manifest.assets[id].skins?.[skin];
      if (skinInfo?.file) {
        const tex = await textureLoader.loadAsync(BASE + skinInfo.file);
        tex.flipY = false; tex.colorSpace = THREE.SRGBColorSpace;
        materials[0].map = tex; materials[0].needsUpdate = true;
      }
      const ownClips = gltf.animations?.length ? gltf.animations : null;
      return { root, materials, clips: ownClips ? new Map(ownClips.map((c) => [c.name, c])) : clips };
    },
  };
  return api;
}
