import * as THREE from 'three';

// Arena environment: procedural ground, instanced KayKit props, biome lighting/fog, ambient particles, objective markers.
function groundTexture(colors, seed = 1) {
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = colors[0]; g.fillRect(0, 0, S, S);
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  // flagstones
  const tile = 64;
  for (let y = 0; y < S; y += tile) for (let x = 0; x < S; x += tile) {
    const off = (y / tile) % 2 ? tile / 2 : 0;
    g.fillStyle = rnd() < 0.5 ? colors[1] : colors[2];
    g.globalAlpha = 0.35 + rnd() * 0.3;
    g.fillRect(((x + off) % S) + 2, y + 2, tile - 4, tile - 4);
  }
  g.globalAlpha = 1;
  // grime and speckles
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.05)';
    const r = 1 + rnd() * 5; g.beginPath(); g.arc(rnd() * S, rnd() * S, r, 0, Math.PI * 2); g.fill();
  }
  // cracks
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1.5;
  for (let i = 0; i < 40; i++) { g.beginPath(); let x = rnd() * S, y = rnd() * S; g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (rnd() - 0.5) * 40; y += (rnd() - 0.5) * 40; g.lineTo(x, y); } g.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

const AMBIENT = {
  motes: { color: 0xb8ffcc, size: 0.12, speed: 0.4, rise: 0.3, count: 260 },
  snow: { color: 0xffffff, size: 0.14, speed: 0.6, rise: -1.4, count: 520 },
  embers: { color: 0xff8a3a, size: 0.12, speed: 0.6, rise: 1.6, count: 420 },
  wisps: { color: 0xc58cff, size: 0.16, speed: 0.5, rise: 0.4, count: 300 },
  void: { color: 0xff5ab0, size: 0.13, speed: 0.4, rise: 0.8, count: 360 },
  feathers: { color: 0xfff4d8, size: 0.16, speed: 0.5, rise: -0.6, count: 300 },
};

export function createArena(scene, assets, renderer) {
  const root = new THREE.Group(); scene.add(root);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x404050, 1.25); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 2.6);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.04;
  Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 80 });
  scene.add(sun); scene.add(sun.target);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; root.add(ground);
  const outer = new THREE.Mesh(new THREE.RingGeometry(1, 3, 64, 1), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55, depthWrite: false }));
  outer.rotation.x = -Math.PI / 2; outer.position.y = 0.02; root.add(outer);
  const border = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }));
  const propMeshes = [];
  let ambient = null, biomeId = null, layoutKey = '';
  const markers = new THREE.Group(); scene.add(markers);
  let propLib = null;

  async function loadProps() {
    if (propLib) return propLib;
    const gltf = await assets.gltf('props');
    propLib = new Map();
    for (const node of gltf.scene.children) {
      const parts = [];
      node.updateMatrixWorld(true);
      const inv = new THREE.Matrix4().copy(node.matrixWorld).invert();
      node.traverse((o) => { if (o.isMesh) { const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld); parts.push({ geometry: o.geometry, material: o.material, matrix: m }); } });
      propLib.set(node.name.replace(/\.\d+$/, ''), parts);
    }
    return propLib;
  }

  function buildProps(game) {
    for (const m of propMeshes) { root.remove(m); m.dispose?.(); }
    propMeshes.length = 0;
    if (!propLib) return;
    const placements = [...game.obstacles.map((o) => ({ ...o, solid: true })), ...game.decor];
    const byProp = new Map();
    for (const pl of placements) { if (!propLib.has(pl.prop)) continue; (byProp.get(pl.prop) || byProp.set(pl.prop, []).get(pl.prop)).push(pl); }
    const tmp = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3();
    for (const [prop, list] of byProp) {
      for (const part of propLib.get(prop)) {
        const inst = new THREE.InstancedMesh(part.geometry, part.material, list.length);
        list.forEach((pl, i) => {
          const s = (pl.scale || 1) * (pl.solid ? 1.1 : 1.0);
          q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), pl.rot || 0); sc.set(s, s, s); pos.set(pl.x, 0, pl.z);
          tmp.compose(pos, q, sc).multiply(part.matrix);
          inst.setMatrixAt(i, tmp);
        });
        inst.castShadow = true; inst.receiveShadow = true;
        root.add(inst); propMeshes.push(inst);
      }
    }
  }

  function setAmbient(kind) {
    if (ambient) { scene.remove(ambient.points); ambient.points.geometry.dispose(); }
    const A = AMBIENT[kind] || AMBIENT.motes;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(A.count * 3), seed = new Float32Array(A.count);
    for (let i = 0; i < A.count; i++) { pos[i * 3] = (Math.random() - 0.5) * 60; pos[i * 3 + 1] = Math.random() * 14; pos[i * 3 + 2] = (Math.random() - 0.5) * 60; seed[i] = Math.random(); }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    const mat = new THREE.PointsMaterial({ color: A.color, size: A.size, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, map: dotTexture(), sizeAttenuation: true });
    const points = new THREE.Points(geo, mat); points.frustumCulled = false;
    scene.add(points);
    ambient = { points, A, pos, seed };
  }

  return {
    async setBiome(game) {
      const b = game.biome;
      await loadProps();
      if (biomeId !== game.biomeId) {
        biomeId = game.biomeId;
        scene.background = new THREE.Color(b.sky);
        scene.fog = new THREE.Fog(b.fog, 26 + b.fogNear * 0.4, 58 + b.fogFar * 0.45);
        hemi.color.set(b.light); hemi.groundColor.set(b.ground[1]); hemi.intensity = 1.0;
        sun.color.set(b.sun); sun.intensity = 2.2;
        const tex = groundTexture(b.ground, game.seed % 997 + 3);
        ground.material.map?.dispose(); ground.material.map = tex; ground.material.needsUpdate = true;
        setAmbient(b.ambient);
      }
      const half = game.arena.half;
      ground.scale.set(half * 2 + 70, half * 2 + 70, 1);
      ground.material.map.repeat.set((half * 2 + 70) / 8, (half * 2 + 70) / 8);
      outer.scale.set(half * 1.42, half * 1.42, 1);
      const key = `${game.stageIndex}-${game.biomeId}-${game.obstacles.length}`;
      if (key !== layoutKey) { layoutKey = key; buildProps(game); }
    },
    update(game, dt, camera) {
      const p = game.player;
      sun.position.set(p.x + 14, 28, p.z + 10); sun.target.position.set(p.x, 0, p.z);
      if (ambient) {
        const { pos, seed, A } = ambient, n = A.count;
        for (let i = 0; i < n; i++) {
          let x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
          y += A.rise * dt * (0.5 + seed[i]);
          x += Math.sin(game.time * 0.7 + seed[i] * 10) * A.speed * dt;
          z += Math.cos(game.time * 0.5 + seed[i] * 7) * A.speed * dt;
          if (y > 14) y = 0; if (y < 0) y = 14;
          if (x - p.x > 30) x -= 60; if (x - p.x < -30) x += 60; if (z - p.z > 30) z -= 60; if (z - p.z < -30) z += 60;
          pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
        }
        ambient.points.geometry.attributes.position.needsUpdate = true;
      }
    },
    markers, sun,
  };
}

let _dot = null;
export function dotTexture() {
  if (_dot) return _dot;
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d'); const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.35, 'rgba(255,255,255,0.6)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 32, 32);
  _dot = new THREE.CanvasTexture(c);
  return _dot;
}
