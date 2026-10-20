import { h, esc, skillIconHtml, itemIconHtml, rarityTag, factionTag, KIND_NAME, iconImg } from './dom.js';
import { nodeIconUrl, eventIconUrl, miscIconUrl } from './icons.js';
import { SKILL } from '../game/content/skills.js';
import { ITEM, itemTotalCost } from '../game/content/items.js';
import { RARITY, rarityTier } from '../game/content/rarities.js';
import { FACTION } from '../game/content/factions.js';
import { NODE_TYPES, OBJECTIVES } from '../game/content/stages.js';
import { SHOP_TABS, shopList, acquisitionPlan, priceOf, craftableHints } from '../game/shop.js';
import { nodeById } from '../game/run.js';
import { describe } from '../game/skills.js';

// Modal overlays during a run: level-up draft, battlefield shop, chapter map, events, rest, treasure, pause, results.
export function createOverlays(root, ctx) {
  let current = null, currentKind = '';
  const close = () => { current?.remove(); current = null; currentKind = ''; };
  const open = (kind, el) => { close(); current = el; currentKind = kind; root.append(el); return el; };

  // ------------------------------------------------------------- draft
  function draft(game) {
    const d = game.draft;
    const ov = h('div', { class: 'overlay' });
    const top = d.options.reduce((m, c) => Math.max(m, rarityTier(c.rarity)), 0);
    const topR = Object.values(RARITY).find((r) => r.tier === top);
    if (top >= 4) { const f = h('div', { class: 'reveal-flash', style: { background: `radial-gradient(circle, ${topR.color}aa, transparent 70%)` } }); ov.append(f); ctx.sfx?.('reveal', top); }
    const wrap = h('div', { class: 'draft' });
    wrap.innerHTML = `<h2>${d.source === 'event' ? '天赐之选' : `等级提升 · Lv ${game.run.level}`}</h2><div class="sub">选择一张技能卡 · 稀有度越高越强 · 同派系集齐 2/4/6/8 激活加成</div>`;
    const cards = h('div', { class: 'cards' });
    d.options.forEach((c, i) => {
      const def = SKILL[c.id];
      const r = RARITY[c.rarity];
      const f = c.faction && FACTION[c.faction];
      const owned = game.skills.owned.get(c.id);
      const card = h('div', { class: `card r-${c.rarity}`, style: { '--r': r.color } });
      const cur = owned?.lv || 0;
      const max = c.max || 5;
      const pips = c.kind === 'bonus' ? '' : Array.from({ length: max }, (_, k) => `<i class="${k < cur ? 'on' : k === cur ? 'next' : ''}"></i>`).join('');
      let syn = '';
      if (f) { const n = (game.factionCounts?.[c.faction] || 0) + (owned ? 0 : 1); const next = f.tiers.find((t) => t.n >= n); if (next && n === next.n && !owned) syn = `<div style="font-size:12px;color:${f.color}">→ ${f.name} ${n}：${esc(next.text)}</div>`; }
      card.innerHTML = `<div class="rbar">${r.name} · ${c.isEvolve ? '进化' : c.isNew ? '新技能' : `升级 Lv${c.level}`}</div>
        ${c.isEvolve ? '<span class="badge evo">进化</span>' : c.isNew ? '<span class="badge">NEW</span>' : ''}
        ${c.kind !== 'bonus' && !c.isEvolve ? '<button class="ban" title="放逐：本局不再出现">放逐</button>' : ''}
        <div class="head">${c.kind === 'bonus' ? `<div class="icon lg" style='--r:${r.color};${iconImg(miscIconUrl(c.id === 'fallback_gold' ? 'gold' : 'heal'))}'></div>` : skillIconHtml(c.id, { size: 'lg' })}</div>
        <div class="name">${esc(c.name)}</div>
        <div class="meta">${c.kind !== 'bonus' ? `${rarityTag(c.rarity)}${factionTag(c.faction)}<span class="tag" style="color:#ccc">${KIND_NAME[c.kind] || ''}</span>${c.cd ? `<span class="tag" style="color:#9ad">冷却 ${c.cd}s</span>` : ''}${def?.hero ? '<span class="tag" style="color:#ffd76a">英雄专属</span>' : ''}` : ''}</div>
        <div class="desc">${esc(c.desc)}${c.isEvolve ? `<div style="margin-top:6px;font-size:12px;color:#ade55c">替换：${esc(SKILL[c.from].name)}</div>` : ''}${!c.isEvolve && def?.evolve ? `<div style="margin-top:6px;font-size:12px;color:#8fd">满级 + ${esc(SKILL[def.evolve.with].name)} → 进化「${esc(SKILL[def.evolve.into].name)}」</div>` : ''}${syn}</div>
        <div class="lvl">${pips}</div><span class="kbd key">${i + 1}</span>`;
      card.onclick = (e) => { if (e.target.closest('.ban')) return; ctx.chooseCard(i); };
      card.querySelector('.ban')?.addEventListener('click', (e) => { e.stopPropagation(); ctx.banish(i); });
      cards.append(card);
    });
    wrap.append(cards);
    const acts = h('div', { class: 'draft-actions' });
    acts.innerHTML = `<button class="btn" ${d.rerolls <= 0 ? 'disabled' : ''}>重抽（${d.rerolls}）<span class="kbd">R</span></button><span class="muted" style="align-self:center">放逐剩余 ${d.banishes}</span>`;
    acts.querySelector('button').onclick = () => ctx.reroll();
    wrap.append(acts);
    ov.append(wrap);
    return open('draft', ov);
  }

  // ------------------------------------------------------------- shop
  const shopState = { tab: 'attack', sel: null };
  function shop(game, { node = false } = {}) {
    const ov = h('div', { class: 'overlay' });
    const p = h('div', { class: 'shop panel' });
    ov.append(p);
    const render = () => {
      const inv = game.inventory;
      const hints = new Set(craftableHints(game));
      const list = shopList(shopState.tab);
      const sel = shopState.sel || list[0];
      const it = ITEM[sel];
      p.innerHTML = `<header><h2 class="title-font">${node ? '流浪商人' : '战地商店'}</h2><div class="tabs">${SHOP_TABS.map((t) => `<button class="tab ${t.id === shopState.tab ? 'on' : ''}" data-tab="${t.id}">${t.name}</button>`).join('')}</div><div style="margin-left:auto" class="gold-text">💰 ${Math.floor(inv.gold)}</div><button class="btn small close">关闭 <span class="kbd">B</span></button></header>
      <div class="grid-items">${list.map((id) => { const x = ITEM[id]; const plan = acquisitionPlan(game, id); return `<button class="gitem ${id === sel ? 'sel' : ''} ${plan.cost > inv.gold ? 'cant' : ''} ${hints.has(id) ? 'hint' : ''}" data-id="${id}">${itemIconHtml(id)}<div><div class="nm rar-${x.rarity || 'common'}">${esc(x.name)}</div><div class="pr">💰 ${plan.cost}${x.type !== 'component' && x.type !== 'consumable' ? ` <span class="muted">/ ${itemTotalCost(id)}</span>` : ''}</div></div></button>`; }).join('')}</div>
      <div class="detail">
        ${it ? itemDetail(game, sel) : ''}
        <div><div class="muted" style="margin:6px 0">装备栏（点击出售，返还 50%）</div><div class="inv">${inv.items.map((id, i) => `<div class="cell" data-slot="${i}">${id ? itemIconHtml(id) + `<span class="sell">售 ${Math.round(itemTotalCost(id) * 0.5)}</span>` : ''}</div>`).join('')}</div></div>
        <div><div class="muted" style="margin:6px 0">药品栏</div><div class="belt" style="display:flex;gap:6px">${inv.belt.map((b) => `<div class="bslot" style="width:44px;height:44px;position:relative">${b ? itemIconHtml(b.id) + `<span class="count" style="position:absolute;right:2px;bottom:0">${b.count}</span>` : ''}</div>`).join('')}</div></div>
      </div>`;
      p.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { shopState.tab = b.dataset.tab; shopState.sel = null; render(); }));
      p.querySelectorAll('[data-id]').forEach((b) => { b.onclick = () => { shopState.sel = b.dataset.id; render(); }; b.ondblclick = () => { ctx.buy(b.dataset.id); render(); }; });
      p.querySelectorAll('[data-slot]').forEach((c) => (c.onclick = () => { if (game.inventory.items[+c.dataset.slot]) { ctx.sell(+c.dataset.slot); render(); } }));
      p.querySelector('.close').onclick = () => ctx.closeShop();
      p.querySelector('.buy')?.addEventListener('click', () => { const r = ctx.buy(sel); if (r && !r.ok) ctx.toast(r.reason); render(); });
    };
    render();
    shopState.render = render;
    return open('shop', ov);
  }
  function itemDetail(game, id) {
    const it = ITEM[id];
    const plan = acquisitionPlan(game, id);
    const have = new Set();
    const tree = (pid, depth = 0) => {
      const x = ITEM[pid];
      const owned = game.inventory.items.includes(pid);
      let out = `<div class="row ${depth === 0 ? '' : owned ? 'have' : 'need'}" style="padding-left:${depth * 16}px">${itemIconHtml(pid)}<span>${esc(x.name)}</span><span class="muted" style="margin-left:auto">${x.type === 'component' ? x.cost : `卷轴 ${priceOf(game, pid)}`}</span>${owned && depth ? ' ✓' : ''}</div>`;
      if (x.parts && !(owned && depth)) for (const part of x.parts) out += tree(part, depth + 1);
      return out;
    };
    const stats = Object.entries(it.stats || {}).map(([k, v]) => statLabel(k, v)).filter(Boolean).join('　');
    return `<div class="top">${itemIconHtml(id, { size: 'lg' })}<div><div class="nm rar-${it.rarity || 'common'}">${esc(it.name)}</div><div>${rarityTag(it.rarity || 'common')} ${it.artifact ? '<span class="tag" style="color:#e4ae39">神器</span>' : ''}</div></div></div>
      ${stats ? `<div style="font-size:13px;color:#cfe">${stats}</div>` : ''}
      <div style="font-size:14px;line-height:1.5">${esc(it.desc || (it.use ? it.desc : ''))}</div>
      ${it.active ? `<div style="font-size:12px;color:#9ad">主动冷却 ${it.active.cd}s · 按 Z/X/C 使用</div>` : ''}
      ${it.parts ? `<div class="tree">${tree(id)}</div>` : ''}
      ${it.upgrade ? `<div style="font-size:12px;color:#e4ae39">可升级为神器：${esc(ITEM[it.upgrade].name)}</div>` : ''}
      <button class="btn primary buy" ${plan.cost > game.inventory.gold ? 'disabled' : ''}>购买 · 💰 ${plan.cost}</button>`;
  }

  // ------------------------------------------------------------- chapter map
  function map(game) {
    const ov = h('div', { class: 'overlay' });
    const m = game.map;
    const p = h('div', { class: 'map panel' });
    const layers = m.layers;
    const W = 100, H = 100;
    const pos = (n) => ({ x: 7 + (n.layer / (layers.length - 1)) * 86, y: 12 + n.x * 76 });
    let lines = '';
    for (const n of layers.flat()) for (const nid of n.next) { const t = nodeById(m, nid); const a = pos(n), b = pos(t); lines += `<line x1="${a.x}%" y1="${a.y}%" x2="${b.x}%" y2="${b.y}%" stroke="${n.done ? '#ffd76a' : 'rgba(255,255,255,0.18)'}" stroke-width="${n.done ? 3 : 2}" stroke-dasharray="${n.done ? '' : '6 6'}"/>`; }
    p.innerHTML = `<h2>${esc(game.chapter.name)}</h2><div class="sub">第 ${game.chapter.id} 章 · 选择下一个节点 · 💰 ${Math.floor(game.inventory.gold)} · 生命 ${Math.ceil(game.player.hp)}/${Math.round(game.stats.maxHp)} · Lv ${game.run.level}</div>
      <div class="map-board"><svg>${lines}</svg></div>
      <div class="legend">${Object.entries(NODE_TYPES).map(([k, t]) => `<span style="display:inline-flex;gap:4px;align-items:center"><i class="icon xs" style='--r:${t.color};${iconImg(nodeIconUrl(k))}'></i>${t.name}</span>`).join('')}</div>
      <div style="display:flex;gap:10px;justify-content:center"><button class="btn small shopnow">查看装备 / 商店（只读）</button><button class="btn small danger quit">放弃本局</button></div>`;
    const board = p.querySelector('.map-board');
    for (const n of layers.flat()) {
      const t = NODE_TYPES[n.type];
      const a = pos(n);
      const avail = m.available.includes(n.id);
      const label = n.type === 'battle' ? OBJECTIVES[n.objective]?.name : t.name;
      const b = h('button', { class: `mnode ${avail ? 'avail' : ''} ${n.done ? 'done' : ''} ${m.current === n.id ? 'cur' : ''}`, style: { left: `${a.x}%`, top: `${a.y}%`, color: t.color } });
      b.innerHTML = `<small>${esc(label)}</small>`; b.style.backgroundImage = `url("${nodeIconUrl(n.type)}")`;
      if (avail) b.onclick = () => ctx.enterNode(n.id);
      board.append(b);
    }
    p.querySelector('.quit').onclick = () => ctx.quitRun();
    p.querySelector('.shopnow').onclick = () => ctx.toast('商店仅在战斗中（B 键）或商人节点开放');
    ov.append(p);
    return open('map', ov);
  }

  // ------------------------------------------------------------- event / rest / treasure / generic dialogs
  function dialog(icon, title, text, options) {
    const ov = h('div', { class: 'overlay' });
    const d = h('div', { class: 'dialog panel' });
    d.innerHTML = `<div class="icon xl" style='--r:#e4ae39;margin:0 auto;${iconImg(icon)}'></div><h2>${esc(title)}</h2><div style="line-height:1.6">${text}</div><div class="opts"></div>`;
    const opts = d.querySelector('.opts');
    options.forEach((o) => { const b = h('button', { class: `btn ${o.primary ? 'primary' : ''}`, disabled: o.disabled }); b.innerHTML = o.html || esc(o.text); b.onclick = o.onClick; opts.append(b); });
    ov.append(d);
    return ov;
  }
  function event(game) {
    const ev = game.currentEvent;
    return open('event', dialog(eventIconUrl(ev.id), ev.name, esc(ev.text), ev.options.map((o, i) => ({ text: `${o.text}${o.cost ? `（💰 ${o.cost}）` : ''}`, disabled: o.cost > game.inventory.gold, onClick: () => ctx.eventOption(i) }))));
  }
  function eventDone(game) {
    return open('eventDone', dialog(miscIconUrl('result'), '结果', esc(game.eventResult || ''), [{ text: '继续', primary: true, onClick: () => ctx.eventDone() }]));
  }
  function rest(game) {
    return open('rest', dialog(miscIconUrl('rest'), '篝火营地', '在温暖的篝火旁稍作休整。', [
      { text: `休息：回复 45% 生命（当前 ${Math.ceil(game.player.hp)}/${Math.round(game.stats.maxHp)}）`, primary: true, onClick: () => ctx.restChoice('heal') },
      { text: '磨砺：随机一个技能提升 1 级', onClick: () => ctx.restChoice('upgrade') },
    ]));
  }
  function treasure(game) {
    const t = game.treasure;
    const text = t.kind === 'gold' ? `一箱金币：💰 ${t.amount}` : `${itemIconHtml(t.item, { size: 'lg' })}<div style="margin-top:8px">${t.kind === 'neutral' ? '中立秘宝' : '合成装备'}：<b class="rar rar-${ITEM[t.item].rarity}">${esc(ITEM[t.item].name)}</b></div><div class="muted" style="font-size:13px">${esc(ITEM[t.item].desc || '')}</div>`;
    return open('treasure', dialog(miscIconUrl('treasure'), '宝藏', `<div style="display:grid;justify-items:center">${text}</div>`, [{ text: '收下', primary: true, onClick: () => ctx.claimTreasure() }]));
  }
  function pause(game) {
    const build = [...game.skills.owned.entries()].map(([id, s]) => `<div style="display:flex;gap:8px;align-items:center;text-align:left">${skillIconHtml(id, { size: 'sm', lv: s.lv })}<div><b class="rar rar-${SKILL[id].rarity}">${esc(SKILL[id].name)}</b> <span class="muted">Lv${s.lv}</span><div class="muted" style="font-size:12px">${esc(describe(SKILL[id], s.lv, game.stats))}</div></div></div>`).join('');
    const st = game.stats;
    const stats = `<div class="statgrid" style="text-align:left"><div><span>攻击</span><b>${Math.round(st.atk)}</b></div><div><span>生命</span><b>${Math.round(st.maxHp)}</b></div><div><span>护甲</span><b>${Math.round(st.armor)}</b></div><div><span>暴击</span><b>${Math.round(st.critChance * 100)}% × ${st.critMult.toFixed(2)}</b></div><div><span>攻速</span><b>${Math.round(st.attackRate * 100)}%</b></div><div><span>冷却缩减</span><b>${Math.round(st.cdrTotal * 100)}%</b></div><div><span>范围</span><b>${Math.round(st.areaMult * 100)}%</b></div><div><span>技能伤害</span><b>+${Math.round(st.skillDmg * 100)}%</b></div><div><span>吸血</span><b>${Math.round(st.lifestealTotal * 100)}%</b></div><div><span>移速</span><b>${st.speed.toFixed(1)}</b></div></div>`;
    const ov = dialog(miscIconUrl('pause'), '暂停', `<div style="display:grid;gap:12px">${stats}<div style="display:grid;gap:6px;max-height:36vh;overflow-y:auto">${build || '<span class="muted">尚未获得技能</span>'}</div></div>`, [
      { text: '继续战斗', primary: true, onClick: () => ctx.resume() }, { text: '设置', onClick: () => ctx.openSettings() }, { text: '放弃本局', onClick: () => ctx.quitRun() },
    ]);
    ov.querySelector('.dialog').style.width = 'min(720px, 96vw)';
    return open('pause', ov);
  }
  function results(game, summary) {
    const win = summary.win || summary.chapterClear;
    const ov = h('div', { class: 'overlay' });
    const p = h('div', { class: 'results panel' });
    p.innerHTML = `<div class="big ${win ? 'win' : 'lose'}">${win ? (game.mode === 'adventure' ? '章节通关' : '试炼完成') : '战败'}</div>
      <div class="muted">${game.mode === 'adventure' ? `第 ${game.chapter.id} 章 · ${esc(game.chapter.name)}` : game.mode === 'endless' ? `无尽模式 · 第 ${game.wave} 波` : `每日试炼 · ${game.daily?.date}`} · ${esc(game.diff.name)} · ${esc(game.hero.name)}</div>
      <div class="res-grid"><div><b>${summary.kills}</b>斩敌</div><div><b>${summary.maxCombo}</b>最大连击</div><div><b>Lv ${summary.level}</b>等级</div><div><b>+${summary.gold}</b>金币</div><div><b>+${summary.xp}</b>账号经验</div><div><b>${formatTime(summary.time)}</b>用时</div></div>
      ${summary.levels ? `<div class="gold-text">账号等级提升 ${summary.levels} 级！</div>` : ''}
      ${summary.mastery.gained ? `<div class="gold-text">英雄熟练度 +${summary.mastery.gained}：${summary.mastery.unlocks.map(esc).join('、')}</div>` : ''}
      ${summary.records.map((r) => `<div style="color:#ade55c">🏆 ${esc(r)}</div>`).join('')}
      ${summary.achievements.map((a) => `<div style="color:#ffd76a">成就达成：${esc(a.name)} · ${esc(a.desc)}（+${a.reward.gold} 金币）</div>`).join('')}
      <div class="wizard-actions"><button class="btn primary again">再来一局</button><button class="btn home">返回营地</button></div>`;
    p.querySelector('.again').onclick = () => ctx.again();
    p.querySelector('.home').onclick = () => ctx.home();
    ov.append(p);
    return open('results', ov);
  }

  return {
    draft, shop, map, event, eventDone, rest, treasure, pause, results, close,
    get kind() { return currentKind; },
    refreshShop() { shopState.render?.(); },
    el: () => current,
  };
}

const STAT_NAMES = { atkFlat: '攻击', atkMult: '攻击%', hpFlat: '生命', hpMult: '生命%', def: '护甲', crit: '暴击', critDmg: '暴伤', atkSpeed: '攻速', speedMult: '移速', cdr: '冷却缩减', area: '范围', skillDmg: '技能伤害', lifesteal: '吸血', skillLifesteal: '技能吸血', regenPct: '每秒回复', block: '格挡', dmgReduction: '减伤', evasion: '闪避', thorns: '反伤', musouGain: '无双充能', goldGain: '金币', luck: '幸运', pickup: '拾取', xpGain: '经验', projectiles: '投射物', summonPower: '召唤', vsElite: '对精英', dmgMult: '伤害', dmgTaken: '受到伤害', dodgeCdr: '闪避冷却', comboDmg: '连击伤害', healPower: '治疗' };
const FLAT = new Set(['atkFlat', 'hpFlat', 'def', 'luck', 'projectiles']);
export function statLabel(k, v) { const n = STAT_NAMES[k]; if (!n) return ''; return `${n} ${v > 0 ? '+' : ''}${FLAT.has(k) ? Math.round(v) : `${Math.round(v * 1000) / 10}%`}`; }
const formatTime = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
