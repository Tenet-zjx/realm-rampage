// Dev-only model viewer: /viewer.html?ids=knight,skel_minion&clip=Idle&t=0.3
import * as THREE from 'three';
import { createAssetLibrary } from '../render/assets.js';

const q = new URLSearchParams(location.search);
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('c'), antialias: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.shadowMap.enabled = true;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x2a2633);
const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.1, 200);
scene.add(new THREE.HemisphereLight(0xdde8ff, 0x3a2f2a, 1.4));
const sun = new THREE.DirectionalLight(0xfff0dd, 2.4); sun.position.set(6, 12, 8); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20 }); scene.add(sun);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0x3b3646 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

const lib = createAssetLibrary();
const manifest = await lib.init();
const ids = (q.get('ids') || Object.keys(manifest.assets).filter((k) => !['anims', 'props'].includes(k)).join(',')).split(',');
const mixers = [];
const cols = Math.ceil(Math.sqrt(ids.length * 1.6));
let i = 0;
for (const id of ids) {
  if (id === 'props') continue;
  const skin = +(q.get('skin') || 0);
  const ch = await lib.character(id, { skin });
  const x = (i % cols - (cols - 1) / 2) * 3.2, z = Math.floor(i / cols) * 3.6;
  ch.root.position.set(x, 0, z); scene.add(ch.root);
  const scale = +(q.get('scale') || 1); ch.root.scale.setScalar(id.startsWith('boss_') && !q.get('scale') ? 1 : scale);
  const clipName = q.get('clip') || (ch.clips.has('Idle') ? 'Idle' : [...ch.clips.keys()][0]);
  const clip = ch.clips.get(clipName) || ch.clips.get('Idle') || [...ch.clips.values()][0];
  if (clip) { const m = new THREE.AnimationMixer(ch.root); m.clipAction(clip).play(); m.setTime(+(q.get('t') || 0.4) * clip.duration); mixers.push(m); }
  const label = document.createElement('div'); label.textContent = id; label.dataset.x = x; label.dataset.z = z; label.className = 'lbl';
  label.style.cssText = 'position:fixed;color:#ffd76a;font-weight:600;text-shadow:0 1px 2px #000'; document.body.append(label);
  i++;
}
const rows = Math.ceil(i / cols);
const yaw = +(q.get('yaw') || 0) * Math.PI / 180;
const dist = (Math.max(cols * 3.4, rows * 4.2) * 1.25 + 4) * +(q.get('zoom') || 1);
camera.position.set(Math.sin(yaw) * dist, dist * 0.42, (rows - 1) * 1.8 + Math.cos(yaw) * dist); camera.lookAt(0, 1.0, (rows - 1) * 1.8);
document.getElementById('info').textContent = `${i} models · clip ${q.get('clip') || 'Idle'}`;
function frame() {
  for (const m of mixers) if (!q.get('freeze')) m.update(1 / 60);
  renderer.render(scene, camera);
  for (const el of document.querySelectorAll('.lbl')) { const v = new THREE.Vector3(+el.dataset.x, 0, +el.dataset.z).project(camera); el.style.left = `${(v.x + 1) / 2 * innerWidth - 30}px`; el.style.top = `${(1 - v.y) / 2 * innerHeight + 8}px`; }
  requestAnimationFrame(frame);
}
frame();
window.__viewerReady = true;
