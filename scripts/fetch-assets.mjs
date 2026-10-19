#!/usr/bin/env node
// Downloads the pinned KayKit CC0 source files into art/source/kaykit/ (gitignored).
// Each file is verified against the git blob SHA-1 from the pinned commit's tree, and a
// sha256 lock (art/kaykit-lock.json, committed) records exactly what the pipeline consumed.
import { createHash } from 'node:crypto';
import { mkdir, writeFile, readFile, stat } from 'node:fs/promises';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outRoot = join(root, 'art/source/kaykit');

const PACKS = [
  {
    id: 'adventurers', repo: 'KayKit-Character-Pack-Adventures-1.0', commit: '672074b73ba276876a19e8816ecdc5241817ab47',
    base: 'addons/kaykit_character_pack_adventures/',
    files: [
      ...['Barbarian', 'Knight', 'Mage', 'Rogue', 'Rogue_Hooded'].map((n) => `Characters/gltf/${n}.glb`),
      ...['barbarian', 'knight', 'mage', 'rogue'].map((n) => `Characters/gltf/${n}_texture.png`),
      ...['arrow', 'arrow_bundle', 'axe_1handed', 'axe_2handed', 'crossbow_1handed', 'crossbow_2handed', 'dagger', 'quiver', 'shield_badge', 'shield_badge_color', 'shield_round', 'shield_round_barbarian', 'shield_round_color', 'shield_spikes', 'shield_spikes_color', 'shield_square', 'shield_square_color', 'smokebomb', 'spellbook_closed', 'spellbook_open', 'staff', 'sword_1handed', 'sword_2handed', 'sword_2handed_color', 'wand']
        .flatMap((n) => [`Assets/gltf/${n}.gltf`, `Assets/gltf/${n}.bin`]),
      ...['barbarian', 'knight', 'mage', 'rogue'].map((n) => `Assets/gltf/${n}_texture.png`),
    ],
  },
  {
    id: 'skeletons', repo: 'KayKit-Character-Pack-Skeletons-1.0', commit: '15b62b9bad122f72926c10fb14d622c73819fa54',
    base: 'addons/kaykit_character_pack_skeletons/',
    files: [
      ...['Mage', 'Minion', 'Rogue', 'Warrior'].map((n) => `Characters/gltf/Skeleton_${n}.glb`),
      'Characters/gltf/skeleton_texture.png',
      ...['Arrow', 'Axe', 'Blade', 'Crossbow', 'Quiver', 'Shield_Large_A', 'Shield_Large_B', 'Shield_Small_A', 'Shield_Small_B', 'Staff']
        .flatMap((n) => [`Assets/gltf/Skeleton_${n}.gltf`, `Assets/gltf/Skeleton_${n}.bin`]),
      'Assets/gltf/skeleton_texture.png',
    ],
  },
  {
    id: 'dungeon', repo: 'KayKit-Dungeon-Remastered-1.0', commit: 'b0ca9bd96a8072ab36a3a5464f00ed1e06a16d07',
    base: 'addons/kaykit_dungeon_remastered/',
    props: ['wall', 'wall_arched', 'wall_broken', 'wall_corner', 'wall_cracked', 'wall_doorway', 'wall_half', 'wall_pillar', 'wall_gated',
      'pillar', 'pillar_decorated', 'column', 'barrier', 'barrier_column', 'barrier_corner', 'barrier_half', 'rubble_half', 'rubble_large',
      'barrel_large', 'barrel_large_decorated', 'barrel_small', 'barrel_small_stack', 'box_large', 'box_small', 'crates_stacked', 'chest', 'chest_gold',
      'coin', 'coin_stack_small', 'coin_stack_large', 'torch_lit', 'torch_mounted', 'candle_triple', 'floor_tile_large', 'floor_tile_large_rocks',
      'floor_tile_small_broken_A', 'floor_dirt_large', 'floor_dirt_large_rocky', 'floor_tile_big_spikes', 'sword_shield_broken', 'keg', 'table_long_broken',
      'trunk_large_A', 'banner_patternA_red', 'banner_patternA_blue', 'banner_shield_red', 'banner_shield_green', 'banner_thin_blue'],
  },
];

const gitBlobSha = (buf) => createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex');
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

async function getJson(url) {
  const headers = { 'User-Agent': 'realm-rampage-fetch', Accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

async function exists(path, size) {
  try { return (await stat(path)).size === size; } catch { return false; }
}

const lock = { generated: new Date().toISOString(), packs: {} };
let downloaded = 0, skipped = 0, bytes = 0;
for (const pack of PACKS) {
  const tree = await getJson(`https://api.github.com/repos/KayKit-Game-Assets/${pack.repo}/git/trees/${pack.commit}?recursive=1`);
  const blobs = new Map(tree.tree.filter((t) => t.type === 'blob').map((t) => [t.path, t]));
  const wanted = [...(pack.files || []).map((f) => pack.base + f)];
  for (const p of pack.props || []) {
    const hit = [`${p}.gltf.glb`, `${p}.glb`].map((s) => `${pack.base}Assets/gltf/${s}`).find((k) => blobs.has(k));
    if (!hit) throw new Error(`${pack.id}: prop not found: ${p}`);
    wanted.push(hit);
  }
  const license = [...blobs.keys()].find((k) => /(^|\/)LICENSE\.txt$/.test(k));
  if (license) wanted.push(license);
  lock.packs[pack.id] = { repo: pack.repo, commit: pack.commit, license: 'CC0-1.0', files: {} };
  for (const path of wanted) {
    const blob = blobs.get(path);
    if (!blob) throw new Error(`${pack.id}: missing ${path}`);
    const rel = path.startsWith(pack.base) ? path.slice(pack.base.length) : basename(path);
    const dest = join(outRoot, pack.id, rel);
    let buf;
    if (await exists(dest, blob.size) && gitBlobSha(buf = await readFile(dest)) === blob.sha) { skipped++; }
    else {
      const url = `https://raw.githubusercontent.com/KayKit-Game-Assets/${pack.repo}/${pack.commit}/${path}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
      buf = Buffer.from(await res.arrayBuffer());
      if (gitBlobSha(buf) !== blob.sha) throw new Error(`hash mismatch for ${path}`);
      await mkdir(dirname(dest), { recursive: true });
      await writeFile(dest, buf);
      downloaded++; bytes += buf.length;
    }
    lock.packs[pack.id].files[rel] = { size: buf.length, sha256: sha256(buf) };
  }
}
await mkdir(join(root, 'art'), { recursive: true });
await writeFile(join(root, 'art/kaykit-lock.json'), JSON.stringify(lock, null, 2) + '\n');
console.log(`KayKit sources: ${downloaded} downloaded (${(bytes / 1048576).toFixed(1)} MB), ${skipped} already present -> art/source/kaykit/`);
