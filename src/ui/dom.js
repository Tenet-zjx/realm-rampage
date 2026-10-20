import { SKILL } from '../game/content/skills.js';
import { FACTION } from '../game/content/factions.js';
import { ITEM } from '../game/content/items.js';
import { RARITY } from '../game/content/rarities.js';
import { skillIconUrl, itemIconUrl, heroIconUrl, factionIconUrl, enemyIconUrl } from './icons.js';

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}
export const $ = (sel, root = document) => root.querySelector(sel);
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const img = (url) => `background-image:url(&quot;${url}&quot;)`;
export function skillIconHtml(id, { size = '', lv } = {}) {
  const s = SKILL[id]; if (!s) return '';
  return `<div class="icon ${size} r-${s.rarity}" style="--r:${RARITY[s.rarity].color};${img(skillIconUrl(id))}" title="${esc(s.name)}">${lv ? `<span class="lv">${lv}</span>` : ''}</div>`;
}
export function itemIconHtml(id, { size = 'sm' } = {}) {
  const it = ITEM[id]; if (!it) return '';
  const r = RARITY[it.rarity || 'common'];
  return `<div class="icon ${size} r-${it.rarity || 'common'}" style="--r:${r.color};${img(itemIconUrl(id))}" title="${esc(it.name)}"></div>`;
}
export const heroIconHtml = (id, size = '') => `<div class="icon ${size} r-immortal" style="--r:#e4ae39;${img(heroIconUrl(id))}"></div>`;
export const factionIconHtml = (id, size = 'xs') => `<div class="icon ${size}" style="--r:${FACTION[id]?.color || '#888'};${img(factionIconUrl(id))}"></div>`;
export const enemyIconHtml = (id, size = 'sm', boss = false) => `<div class="icon ${size}" style="--r:${boss ? '#eb4b4b' : '#b0c3d9'};${img(enemyIconUrl(id))}"></div>`;
export const iconImg = img;
export const rarityTag = (id) => `<span class="tag rar rar-${id}">${RARITY[id].name}</span>`;
export const factionTag = (fid) => (FACTION[fid] ? `<span class="tag" style="color:${FACTION[fid].color}">${FACTION[fid].name}</span>` : '');
export const KIND_NAME = { active: '主动技', auto: '自动技', passive: '被动', internal: '' };
