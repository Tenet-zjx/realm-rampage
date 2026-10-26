import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { DRAFTABLE, FACTION_SKILLS, UNIVERSAL_PASSIVES, EVOLUTION_SKILLS, HERO_SKILLS, SKILL, INTERNAL } from '../src/game/content/skills.js';
import { FACTIONS, SYNERGIES, TRIADS } from '../src/game/content/factions.js';
import { COMPONENTS, CRAFTED, ARTIFACTS, CONSUMABLES, NEUTRALS, RUNES, META_ITEMS, ITEM } from '../src/game/content/items.js';
import { ENEMIES, BOSSES, AFFIXES, ALLIES } from '../src/game/content/enemies.js';
import { CHAPTERS, EVENTS, BIOMES } from '../src/game/content/stages.js';
import { TALENTS, ACHIEVEMENTS } from '../src/game/content/meta.js';
import { HEROES } from '../src/game/content/heroes.js';
import { RARITIES } from '../src/game/content/rarities.js';
import { DIFFICULTIES } from '../src/game/content/difficulties.js';

const manifest = JSON.parse(readFileSync(new URL('../public/assets/models/manifest.json', import.meta.url)));
const clips = new Set(manifest.assets.anims.clips);

test('content volume matches the published design', () => {
  assert.equal(HEROES.length, 6);
  assert.equal(FACTIONS.length, 10);
  for (const f of FACTIONS) assert.equal(FACTION_SKILLS.filter((s) => s.faction === f.id).length, 10, f.id);
  for (const f of FACTIONS) { const list = FACTION_SKILLS.filter((s) => s.faction === f.id); assert.equal(list.filter((s) => s.kind === 'passive').length, 3, f.id); }
  assert.equal(UNIVERSAL_PASSIVES.length, 30);
  assert.equal(EVOLUTION_SKILLS.length, 25);
  assert.equal(HERO_SKILLS.length, 18);
  assert.equal(DRAFTABLE.length, 173);
  assert.equal(SYNERGIES.length, 20);
  assert.equal(TRIADS.length, 6);
  assert.equal(COMPONENTS.length, 30);
  assert.equal(CRAFTED.length + ARTIFACTS.length, 45);
  assert.equal(ARTIFACTS.length, 12);
  assert.equal(CONSUMABLES.length, 16);
  assert.equal(NEUTRALS.length, 40);
  for (let t = 1; t <= 5; t++) assert.equal(NEUTRALS.filter((n) => n.tier === t).length, 8);
  assert.equal(RUNES.length, 8);
  assert.equal(META_ITEMS.length, 20);
  assert.equal(ENEMIES.length, 33);
  assert.equal(AFFIXES.length, 10);
  assert.equal(BOSSES.length, 9); // 8 bosses; the twin generals are two units of one encounter
  assert.equal(CHAPTERS.length, 6);
  assert.equal(EVENTS.length, 24);
  assert.equal(TALENTS.length, 40);
  assert.equal(ACHIEVEMENTS.length, 50);
  assert.equal(RARITIES.length, 8);
  assert.equal(DIFFICULTIES.length, 4);
});

test('ids are unique and every skill is complete', () => {
  const ids = new Set();
  for (const s of [...DRAFTABLE, ...INTERNAL]) { assert.ok(!ids.has(s.id), `dup ${s.id}`); ids.add(s.id); }
  for (const s of DRAFTABLE) {
    assert.ok(s.name && s.desc, `${s.id} text`);
    assert.ok(RARITIES.some((r) => r.id === s.rarity), `${s.id} rarity`);
    if (s.kind === 'passive') assert.ok(s.stats || s.procs, `${s.id} stats`); else assert.ok(s.act?.do, `${s.id} action`);
    if (s.evolve) { assert.ok(SKILL[s.evolve.with], `${s.id} evolve.with`); assert.equal(SKILL[s.evolve.into].from, s.id); }
  }
  for (const t of TRIADS) assert.ok(SKILL[t.skill], t.id);
  for (const h of HEROES) { for (const x of h.exclusive) assert.equal(SKILL[x].hero, h.id, x); for (const c of h.charges) if (c.cast) assert.ok(SKILL[c.cast.skill], c.cast.skill); }
});

test('every recipe part exists and recipes are acyclic', () => {
  for (const it of [...CRAFTED, ...ARTIFACTS]) {
    for (const p of it.parts) assert.ok(ITEM[p], `${it.id} part ${p}`);
    if (it.upgrade) assert.ok(ARTIFACTS.some((a) => a.id === it.upgrade && a.parts.includes(it.id)), `${it.id} upgrade`);
  }
  for (const it of [...CRAFTED, ...ARTIFACTS]) assert.ok(!it.parts.includes(it.id));
  for (const it of Object.values(ITEM)) assert.ok(it.name && it.id, it.id);
});

test('every model referenced by content exists in the model manifest with matching hash', () => {
  const models = new Set([...HEROES.map((h) => h.model), ...ENEMIES.map((e) => e.model), ...BOSSES.map((b) => b.model), ...Object.values(ALLIES).filter((a) => a.model !== 'self').map((a) => a.model)]);
  for (const m of models) assert.ok(manifest.assets[m], `manifest missing ${m}`);
  for (const [id, a] of Object.entries(manifest.assets)) {
    const path = new URL(`../public/assets/models/${a.file}`, import.meta.url);
    assert.ok(existsSync(path), `${id} file`);
    assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'), a.sha256, `${id} hash`);
    if (a.triangles) assert.ok(a.triangles < 12000, `${id} triangle budget`);
  }
});

test('animation clips used by heroes and KayKit enemies exist in the shared library', () => {
  for (const h of HEROES) {
    for (const k of Object.values(h.clips)) assert.ok(clips.has(k), `${h.id} ${k}`);
    for (const m of [...h.light, ...h.charges]) assert.ok(clips.has(m.clip), `${h.id} ${m.clip}`);
    for (const c of h.musou.clips) assert.ok(clips.has(c), `${h.id} musou ${c}`);
  }
  for (const e of ENEMIES) if (!e.rig) for (const c of Object.values(e.clips)) assert.ok(clips.has(c), `${e.id} ${c}`);
  for (const b of BOSSES) if (b.kk) for (const p of b.patterns) assert.ok(clips.has(p.clip), `${b.id} ${p.clip}`);
  for (const b of BOSSES) if (b.og) for (const p of b.patterns) assert.ok(manifest.assets[b.model].clips.includes(p.clip), `${b.id} ${p.clip}`);
});

test('chapters reference valid enemies, bosses and biomes', () => {
  for (const ch of CHAPTERS) {
    assert.ok(BIOMES[ch.biome]);
    assert.ok(BOSSES.some((b) => b.id === ch.boss));
    for (const [id] of ch.spawn) assert.ok(ENEMIES.some((e) => e.id === id), id);
    for (const id of ch.elites) assert.ok(ENEMIES.some((e) => e.id === id), id);
  }
});
