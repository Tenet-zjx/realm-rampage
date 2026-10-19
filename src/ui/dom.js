import { SKILL } from '../game/content/skills.js';
import { FACTION } from '../game/content/factions.js';
import { ITEM } from '../game/content/items.js';
import { RARITY } from '../game/content/rarities.js';

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

const CAT_COLOR = { attack: '#ff7a5a', defense: '#6fb4ff', magic: '#c070ff', utility: '#6fdc5a' };
export function skillIconHtml(id, { size = '', lv } = {}) {
  const s = SKILL[id]; if (!s) return '';
  const f = FACTION[s.faction];
  const color = f?.color || (s.hero ? '#ffd76a' : '#9aa6c0');
  return `<div class="icon ${size} r-${s.rarity}" style="--c:${color};--r:${RARITY[s.rarity].color}" title="${esc(s.name)}">${esc(s.glyph || s.name[0])}${lv ? `<span class="lv">${lv}</span>` : ''}</div>`;
}
export function itemIconHtml(id, { size = 'sm' } = {}) {
  const it = ITEM[id]; if (!it) return '';
  const color = it.type === 'neutral' ? '#a070ff' : it.type === 'consumable' ? '#ff9a6a' : it.type === 'meta' ? '#ffd76a' : CAT_COLOR[it.cat] || '#aaa';
  const r = RARITY[it.rarity || 'common'];
  return `<div class="icon ${size} r-${it.rarity || 'common'}" style="--c:${color};--r:${r.color}" title="${esc(it.name)}">${esc(it.glyph || it.name[0])}</div>`;
}
export const rarityTag = (id) => `<span class="tag rar rar-${id}">${RARITY[id].name}</span>`;
export const factionTag = (fid) => (FACTION[fid] ? `<span class="tag" style="color:${FACTION[fid].color}">${FACTION[fid].name}</span>` : '');
export const KIND_NAME = { active: '主动技', auto: '自动技', passive: '被动', internal: '' };
