// Dev-only icon gallery: /icons.html?set=skills|items|misc|threats
import '../ui/style.css';
import { DRAFTABLE } from '../game/content/skills.js';
import { ALL_ITEMS, META_ITEMS, RUNES } from '../game/content/items.js';
import { HEROES } from '../game/content/heroes.js';
import { FACTIONS } from '../game/content/factions.js';
import { ENEMIES } from '../game/content/enemies.js';
import { NODE_TYPES, EVENTS } from '../game/content/stages.js';
import { skillIconUrl, itemIconUrl, heroIconUrl, factionIconUrl, enemyIconUrl, nodeIconUrl, eventIconUrl, debuffIconUrl } from '../ui/icons.js';
import { DEBUFFS } from '../game/content/debuffs.js';
import { RARITY } from '../game/content/rarities.js';

const set = new URLSearchParams(location.search).get('set') || 'skills';
const g = document.getElementById('g');
const add = (url, name, r = '#b0c3d9') => { const d = document.createElement('div'); d.style.cssText = 'display:grid;justify-items:center;gap:3px;text-align:center'; d.innerHTML = `<div class="icon lg" style='--r:${r};background-image:url("${url}")'></div><span>${name}</span>`; g.append(d); };
if (set === 'skills') for (const s of DRAFTABLE) add(skillIconUrl(s.id), s.name, RARITY[s.rarity].color);
if (set === 'items') for (const it of [...ALL_ITEMS, ...META_ITEMS, ...RUNES]) add(itemIconUrl(it.id), it.name, RARITY[it.rarity || 'common']?.color);
if (set === 'misc') {
  for (const h of HEROES) add(heroIconUrl(h.id), h.name, '#e4ae39');
  for (const f of FACTIONS) add(factionIconUrl(f.id), f.name, f.color);
  for (const e of ENEMIES) add(enemyIconUrl(e.id), e.name);
  for (const k of Object.keys(NODE_TYPES)) add(nodeIconUrl(k), NODE_TYPES[k].name);
  for (const e of EVENTS) add(eventIconUrl(e.id), e.name);
}
if (set === 'threats') {
  for (const e of ENEMIES.filter((x) => x.special)) add(enemyIconUrl(e.id), e.name, '#ff6a4a');
  for (const d of DEBUFFS) add(debuffIconUrl(d.id), d.name, d.color);
}
window.__viewerReady = true;
