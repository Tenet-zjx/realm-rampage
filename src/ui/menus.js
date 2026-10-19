import { h, esc, skillIconHtml, itemIconHtml, rarityTag } from './dom.js';
import { HEROES, HERO } from '../game/content/heroes.js';
import { DIFFICULTIES } from '../game/content/difficulties.js';
import { CHAPTERS, BIOMES } from '../game/content/stages.js';
import { FACTIONS } from '../game/content/factions.js';
import { DRAFTABLE, SKILL } from '../game/content/skills.js';
import { COMPONENTS, CRAFTED, ARTIFACTS, CONSUMABLES, NEUTRALS, META_ITEMS, ITEM } from '../game/content/items.js';
import { ENEMIES, BOSSES } from '../game/content/enemies.js';
import { TALENTS, TALENT_LINES, ACHIEVEMENTS, MASTERY, ACCOUNT } from '../game/content/meta.js';
import { RARITIES } from '../game/content/rarities.js';
import { talentPointsFree, canBuyTalent, buyTalent, buyMeta, toggleLoadout, unlockHero, chapterUnlocked } from '../game/progression.js';
import { describe } from '../game/skills.js';
import { statLabel } from './overlays.js';

// Title, play setup wizard, camp (talents / shop / heroes / codex / achievements / settings).
export function createMenus(root, ctx) {
  let screen = null;
  const show = (el) => { screen?.remove(); screen = el; root.append(el); return el; };
  const hide = () => { screen?.remove(); screen = null; };
  const P = () => ctx.profile();

  function profileChip() {
    const p = P();
    const c = h('div', { class: 'profile-chip panel' });
    c.innerHTML = `<span>账号 <b class="gold-text">Lv ${p.accountLevel}</b></span><span class="gold-text">💰 ${p.gold}</span>${p.title ? `<span class="tag" style="color:#ffd76a">${esc(p.title)}</span>` : ''}`;
    return c;
  }

  function title() {
    const s = h('div', { class: 'screen' });
    s.innerHTML = `<div style="display:grid;justify-items:center"><div class="logo"><div class="cn">幻域无双</div><div class="en">REALM · RAMPAGE</div></div>
      <div class="menu"><button class="btn primary" data-act="play">开始征战</button><button class="btn" data-act="camp">营地 · 养成</button><button class="btn" data-act="heroes">英雄</button><button class="btn" data-act="codex">图鉴</button><button class="btn" data-act="settings">设置</button></div></div>
      <div class="menu-footer">WASD 移动 · J/左键 普攻 · K/右键 蓄力技 · 空格 闪避 · L 无双 · U I O P / Q E R F 技能 · Z X C 装备主动 · 6-9 药品 · B 商店 · Esc 暂停<br>模型素材：KayKit（CC0）· 音效音乐：原创合成</div>`;
    s.append(profileChip());
    s.querySelector('[data-act=play]').onclick = () => playWizard();
    s.querySelector('[data-act=camp]').onclick = () => camp('talents');
    s.querySelector('[data-act=heroes]').onclick = () => camp('heroes');
    s.querySelector('[data-act=codex]').onclick = () => camp('codex');
    s.querySelector('[data-act=settings]').onclick = () => camp('settings');
    return show(s);
  }

  // ----------------------------------------------------------- play wizard
  const sel = { mode: 'adventure', hero: null, difficulty: null, chapter: 1, faction: null };
  function playWizard(step = 'mode') {
    const p = P();
    sel.hero ??= p.lastHero || 'knight'; sel.difficulty ??= p.lastDifficulty || 'normal';
    const s = h('div', { class: 'screen' });
    const w = h('div', { class: 'wizard' });
    s.append(w, profileChip());
    const nav = (prev, next, nextLabel = '下一步') => { const a = h('div', { class: 'wizard-actions' }); a.innerHTML = `<button class="btn back">返回</button><button class="btn primary next">${nextLabel}</button>`; a.querySelector('.back').onclick = prev; a.querySelector('.next').onclick = next; return a; };
    if (step === 'mode') {
      const today = new Date().toISOString().slice(0, 10);
      w.innerHTML = '<h2>选择模式</h2>';
      const row = h('div', { class: 'choice-row' });
      for (const m of [{ id: 'adventure', big: '征', name: '冒险闯关', ds: '6 个章节的分支路线：战斗、精英、商人、奇遇、篝火、宝藏，最终挑战章节首领。' }, { id: 'endless', big: '∞', name: '无尽模式', ds: `敌潮无穷，每 5 波首领、每 10 波变异。最高纪录：第 ${p.stats.bestEndlessWave} 波。` }, { id: 'daily', big: '日', name: '每日试炼', ds: `固定种子与英雄，两个随机词缀，坚持 10 分钟。${p.stats.dailyLast === today ? '（今日已完成）' : ''}` }]) {
        const c = h('div', { class: `choice ${sel.mode === m.id ? 'sel' : ''}` }); c.innerHTML = `<div class="big title-font">${m.big}</div><div class="nm">${m.name}</div><div class="ds">${esc(m.ds)}</div>`;
        c.onclick = () => { sel.mode = m.id; playWizard('mode'); }; row.append(c);
      }
      w.append(row, nav(title, () => playWizard(sel.mode === 'daily' ? 'loadout' : 'hero')));
    }
    if (step === 'hero') {
      w.innerHTML = '<h2>选择英雄</h2>';
      const stage = h('div', { class: 'hero-stage' });
      const list = h('div', { class: 'hero-list' });
      for (const hero of HEROES) {
        const hp = p.heroes[hero.id];
        const c = h('div', { class: `choice ${sel.hero === hero.id ? 'sel' : ''} ${hp.unlocked ? '' : 'locked'}`, style: { width: 'auto' } });
        c.innerHTML = `<div class="big title-font" style="color:${FACTIONS.find((f) => f.id === hero.palette)?.color}">${hero.name[0]}</div><div class="nm">${esc(hero.name)}</div><div class="ds">${esc(hero.title)}</div><div class="ds">熟练度 ${hp.mastery}${hp.unlocked ? '' : ` · 🔒 ${hero.unlock.desc}`}</div>`;
        c.onclick = () => { sel.hero = hero.id; playWizard('hero'); };
        list.append(c);
      }
      const hero = HERO[sel.hero], hp = p.heroes[sel.hero];
      const info = h('div', { class: 'hero-info panel' });
      const charges = Math.min(6, [2, 4].reduce((n, lv) => (hp.mastery >= lv ? n + 1 : n), 4));
      info.innerHTML = `<div class="nm">${esc(hero.name)}</div><div class="muted">${esc(hero.title)}</div><div style="line-height:1.6">${esc(hero.desc)}</div>
        <div class="statgrid"><div><span>生命</span><b>${hero.base.hp}</b></div><div><span>攻击</span><b>${hero.base.atk}</b></div><div><span>护甲</span><b>${hero.base.def}</b></div><div><span>移速</span><b>${hero.base.speed}</b></div><div><span>暴击</span><b>${Math.round(hero.base.crit * 100)}%</b></div><div><span>暴伤</span><b>${Math.round((hero.base.critDmg || 1.5) * 100)}%</b></div></div>
        <div class="combo-list">${hero.charges.map((c, i) => `<div class="c ${i < charges ? '' : 'lock'}"><b>C${i + 1}</b><span>${esc(c.name)}</span><span class="muted">${i === 0 ? '蓄力' : `${'普'.repeat(i)}+蓄`}</span>${i < charges ? '' : ' 🔒 熟练度'}</div>`).join('')}<div class="c"><b>无双</b><span>${esc(hero.musou.name)}</span><span class="muted">L 键</span></div></div>
        <div class="muted" style="font-size:12px">专属技能：${hero.exclusive.map((id) => esc(SKILL[id].name)).join('、')}</div>
        ${hp.unlocked ? '' : `<button class="btn primary unlock">解锁（💰 ${hero.unlock.cost}）</button>`}`;
      info.querySelector('.unlock')?.addEventListener('click', () => { const r = unlockHero(p, sel.hero); if (!r.ok) ctx.toast(r.reason); else ctx.save(); playWizard('hero'); });
      stage.append(list, info);
      w.append(stage, nav(() => playWizard('mode'), () => { if (!p.heroes[sel.hero].unlocked) return ctx.toast('该英雄尚未解锁'); playWizard('difficulty'); }));
    }
    if (step === 'difficulty') {
      w.innerHTML = '<h2>选择难度</h2>';
      const row = h('div', { class: 'choice-row' });
      for (const d of DIFFICULTIES) {
        const c = h('div', { class: `choice ${sel.difficulty === d.id ? 'sel' : ''}` });
        c.innerHTML = `<div class="nm" style="color:${d.color}">${esc(d.name)}</div><div class="ds">${esc(d.desc)}</div><div class="ds">敌方生命 ×${d.hp} · 伤害 ×${d.dmg}<br>奖励 ×${d.reward} · 复活 ${d.revive} 次</div>`;
        c.onclick = () => { sel.difficulty = d.id; playWizard('difficulty'); };
        row.append(c);
      }
      w.append(row, nav(() => playWizard('hero'), () => playWizard(sel.mode === 'adventure' ? 'chapter' : 'loadout')));
    }
    if (step === 'chapter') {
      w.innerHTML = '<h2>选择章节</h2>';
      const row = h('div', { class: 'choice-row' });
      for (const ch of CHAPTERS) {
        const unlocked = chapterUnlocked(p, ch.id);
        if (ch.hidden && !unlocked) continue;
        const clears = p.stats.chapterClears[ch.id] || [];
        const c = h('div', { class: `choice ${sel.chapter === ch.id ? 'sel' : ''} ${unlocked ? '' : 'locked'}`, style: { background: `linear-gradient(180deg, ${BIOMES[ch.biome].fog}, rgba(20,16,30,0.95))` } });
        c.innerHTML = `<div class="big title-font">${['一', '二', '三', '四', '五', '隐'][ch.id - 1]}</div><div class="nm">${esc(ch.name)}</div><div class="ds">${esc(ch.desc)}</div><div class="ds">首领：${esc(BOSSES.find((b) => b.id === ch.boss).name)}</div><div class="ds" style="color:#ade55c">${clears.length ? `已通关：${clears.map((d) => DIFFICULTIES.find((x) => x.id === d).name).join(' / ')}` : unlocked ? '' : '🔒 通关上一章解锁'}</div>`;
        if (unlocked) c.onclick = () => { sel.chapter = ch.id; playWizard('chapter'); };
        row.append(c);
      }
      w.append(row, nav(() => playWizard('difficulty'), () => playWizard('loadout')));
    }
    if (step === 'loadout') {
      w.innerHTML = '<h2>出征准备</h2><div class="sub" style="text-align:center">从库存中选择最多 3 件强力道具带入本局（消耗）</div>';
      const grid = h('div', { class: 'codex-grid' });
      for (const it of META_ITEMS) {
        const n = p.metaInv[it.id] || 0;
        const on = p.loadout.includes(it.id);
        const c = h('div', { class: 'codex-item', style: { cursor: n ? 'pointer' : 'default', borderColor: on ? 'var(--gold)' : '', opacity: n ? 1 : 0.45 } });
        c.innerHTML = `${itemIconHtml(it.id)}<div><div class="nm">${esc(it.name)} ${on ? '✔' : ''}</div><div class="muted">${esc(it.desc)}</div><div>库存 ${n}</div></div>`;
        if (n) c.onclick = () => { const r = toggleLoadout(p, it.id); if (!r.ok) ctx.toast(r.reason); ctx.save(); playWizard('loadout'); };
        grid.append(c);
      }
      if (p.loadout.includes('m_faction_stone')) {
        const fr = h('div', { class: 'choice-row' });
        fr.innerHTML = `<div class="muted" style="width:100%;text-align:center">派系召唤石：选择派系</div>${FACTIONS.map((f) => `<button class="btn small ${sel.faction === f.id ? 'primary' : ''}" data-f="${f.id}" style="color:${sel.faction === f.id ? '' : f.color}">${f.name}</button>`).join('')}`;
        fr.querySelectorAll('[data-f]').forEach((b) => (b.onclick = () => { sel.faction = b.dataset.f; playWizard('loadout'); }));
        w.append(fr);
      }
      w.append(grid, nav(() => playWizard(sel.mode === 'adventure' ? 'chapter' : sel.mode === 'daily' ? 'mode' : 'difficulty'), () => ctx.startRun({ ...sel }), '出 征 ！'));
    }
    return show(s);
  }

  // ----------------------------------------------------------- camp
  function camp(tab = 'talents') {
    const p = P();
    const s = h('div', { class: 'screen' });
    const c = h('div', { class: 'camp panel' });
    const tabs = [['talents', '能力养成'], ['shop', '金币商城'], ['heroes', '英雄'], ['codex', '图鉴'], ['achievements', '成就'], ['settings', '设置']];
    c.innerHTML = `<header><h2>营地</h2><div class="tabs">${tabs.map(([id, n]) => `<button class="tab ${tab === id ? 'on' : ''}" data-tab="${id}">${n}</button>`).join('')}</div><div style="margin-left:auto" class="gold-text">💰 ${p.gold}</div><button class="btn small back">返回</button></header><div class="body"></div>`;
    const body = c.querySelector('.body');
    c.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => camp(b.dataset.tab)));
    c.querySelector('.back').onclick = title;
    if (tab === 'talents') {
      const need = ACCOUNT.xpFor(p.accountLevel);
      body.innerHTML = `<div class="acct panel"><div class="lv">Lv ${p.accountLevel}</div><div style="flex:1"><div>账号经验 ${p.accountXp} / ${need}</div><div class="bar xp" style="margin-top:6px"><i style="transform:scaleX(${p.accountXp / need})"></i></div><div class="muted" style="font-size:12px;margin-top:6px">每级：生命 +1.2%、攻击 +0.8%、护甲 +0.4 · 每 5 级获得 1 个天赋点</div></div><div>天赋点 <b class="gold-text">${talentPointsFree(p)}</b></div></div>`;
      const board = h('div', { class: 'talent-board' });
      for (const line of TALENT_LINES) {
        const col = h('div', { class: 'tline', style: { color: line.color } });
        col.innerHTML = `<h3>${line.glyph} ${line.name}</h3>`;
        for (const t of TALENTS.filter((x) => x.line === line.id)) {
          const on = p.talents.includes(t.id), chk = canBuyTalent(p, t.id);
          const n = h('button', { class: `tnode ${on ? 'on' : ''} ${!on && !chk.ok ? 'lock' : ''}`, title: on ? '已点亮' : chk.reason || '点击点亮' });
          n.innerHTML = `<span class="nm">${esc(t.name)}</span><span style="color:#ddd">${esc(t.desc)}</span><span class="cost">${on ? '已点亮' : `💰 ${t.cost}${t.points ? ` · ${t.points} 天赋点` : ''}`}</span>`;
          n.onclick = () => { if (on) return; const r = buyTalent(p, t.id); if (!r.ok) ctx.toast(r.reason); else { ctx.save(); ctx.sfx?.('buy'); } camp('talents'); };
          col.append(n);
        }
        board.append(col);
      }
      body.append(board);
    }
    if (tab === 'shop') {
      body.innerHTML = '<div class="muted" style="margin-bottom:8px">购买的道具进入库存，出征前可选择最多 3 件带入（使用后消耗）。</div>';
      const grid = h('div', { class: 'codex-grid' });
      for (const it of META_ITEMS) {
        const n = p.metaInv[it.id] || 0;
        const c2 = h('div', { class: 'codex-item' });
        c2.innerHTML = `${itemIconHtml(it.id)}<div style="flex:1"><div class="nm">${esc(it.name)} ${rarityTag(it.rarity)}</div><div class="muted">${esc(it.desc)}</div><div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px"><span>库存 ${n}</span><button class="btn small" ${p.gold < it.cost ? 'disabled' : ''}>💰 ${it.cost}</button></div></div>`;
        c2.querySelector('button').onclick = () => { const r = buyMeta(p, it.id); if (!r.ok) ctx.toast(r.reason); else { ctx.save(); ctx.sfx?.('buy'); } camp('shop'); };
        grid.append(c2);
      }
      body.append(grid);
    }
    if (tab === 'heroes') {
      const grid = h('div', { class: 'codex-grid', style: { gridTemplateColumns: 'repeat(auto-fill,minmax(340px,1fr))' } });
      for (const hero of HEROES) {
        const hp = p.heroes[hero.id];
        const need = MASTERY.xpFor(hp.mastery);
        const skins = ctx.skinNames(hero.id);
        const c2 = h('div', { class: 'codex-item', style: { display: 'grid', gap: '6px' } });
        c2.innerHTML = `<div style="display:flex;gap:10px;align-items:center"><div class="icon lg" style="--c:${FACTIONS.find((f) => f.id === hero.palette)?.color};--r:#e4ae39">${hero.name[0]}</div><div><div class="nm">${esc(hero.name)} <span class="muted">${esc(hero.title)}</span></div><div>熟练度 <b class="gold-text">${hp.mastery}</b> · ${hp.xp}/${need}</div>${hp.unlocked ? '' : `<button class="btn small unlock">解锁 💰 ${hero.unlock.cost}</button>`}</div></div>
          <div class="muted">${Object.entries(MASTERY.unlocks).map(([lv, u]) => `<span style="color:${hp.mastery >= lv ? '#ade55c' : '#6a6458'}">Lv${lv} ${esc(u.text)}</span>`).join(' · ')}</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">${skins.map((n, i) => { const lockLv = i === 1 ? 3 : i === 2 ? 6 : 1; const ok = hp.mastery >= lockLv; return `<button class="btn small ${hp.skin === i ? 'primary' : ''}" data-skin="${i}" ${ok ? '' : 'disabled'}>皮肤·${esc(n)}${ok ? '' : ` 🔒Lv${lockLv}`}</button>`; }).join('')}</div>`;
        c2.querySelector('.unlock')?.addEventListener('click', () => { const r = unlockHero(p, hero.id); if (!r.ok) ctx.toast(r.reason); else ctx.save(); camp('heroes'); });
        c2.querySelectorAll('[data-skin]').forEach((b) => (b.onclick = () => { hp.skin = +b.dataset.skin; ctx.save(); camp('heroes'); }));
        grid.append(c2);
      }
      body.append(grid);
    }
    if (tab === 'codex') {
      const seen = { skills: new Set(p.codex.skills), items: new Set(p.codex.items), enemies: new Set(p.codex.enemies) };
      const sub = ctx.codexTab || 'skills';
      body.innerHTML = `<div class="tabs" style="margin-bottom:10px">${[['skills', `技能 ${DRAFTABLE.length}`], ['items', `物品 ${COMPONENTS.length + CRAFTED.length + ARTIFACTS.length + CONSUMABLES.length + NEUTRALS.length}`], ['enemies', `敌人 ${ENEMIES.length + BOSSES.length}`], ['rarity', '稀有度']].map(([id, n]) => `<button class="tab ${sub === id ? 'on' : ''}" data-sub="${id}">${n}</button>`).join('')}</div>`;
      body.querySelectorAll('[data-sub]').forEach((b) => (b.onclick = () => { ctx.codexTab = b.dataset.sub; camp('codex'); }));
      const grid = h('div', { class: 'codex-grid' });
      if (sub === 'skills') for (const f of [...FACTIONS.map((x) => x.id), null]) {
        const list = DRAFTABLE.filter((d) => d.faction === f);
        const head = h('div', { style: { gridColumn: '1/-1', marginTop: '8px', font: '700 20px var(--title-font)', color: f ? FACTIONS.find((x) => x.id === f).color : '#ddd' } });
        head.textContent = f ? `${FACTIONS.find((x) => x.id === f).name} · ${FACTIONS.find((x) => x.id === f).desc}` : '通用 / 进化 / 英雄专属';
        grid.append(head);
        for (const d of list) { const c2 = h('div', { class: `codex-item ${seen.skills.has(d.id) ? '' : 'unseen'}` }); c2.innerHTML = `${skillIconHtml(d.id, { size: 'sm' })}<div><div class="nm rar rar-${d.rarity}">${esc(d.name)}</div><div class="muted">${esc(describe(d, 1, null))}</div></div>`; grid.append(c2); }
      }
      if (sub === 'items') for (const it of [...COMPONENTS, ...CRAFTED, ...ARTIFACTS, ...CONSUMABLES, ...NEUTRALS]) { const c2 = h('div', { class: `codex-item ${seen.items.has(it.id) || it.type === 'component' || it.type === 'consumable' ? '' : 'unseen'}` }); c2.innerHTML = `${itemIconHtml(it.id)}<div><div class="nm rar rar-${it.rarity}">${esc(it.name)}</div><div class="muted">${esc(it.desc || Object.entries(it.stats || {}).map(([k, v]) => statLabel(k, v)).join(' '))}${it.parts ? `<br>配方：${it.parts.map((x) => ITEM[x].name).join(' + ')}${it.recipe ? ` + 卷轴 ${it.recipe}` : ''}` : ''}${it.tier ? `<br>${it.tier} 阶秘宝` : ''}</div></div>`; grid.append(c2); }
      if (sub === 'enemies') for (const e of [...ENEMIES, ...BOSSES]) { const c2 = h('div', { class: `codex-item ${seen.enemies.has(e.model) ? '' : 'unseen'}` }); c2.innerHTML = `<div class="icon sm" style="--c:${e.patterns ? '#ff4a3a' : '#8a8070'};--r:${e.patterns ? '#eb4b4b' : '#b0c3d9'}">${esc(e.name[0])}</div><div><div class="nm">${esc(e.name)}</div><div class="muted">${esc(e.desc || e.title || '')}${e.patterns ? `<br>招式：${e.patterns.map((x) => x.name).join('、')}` : ''}</div></div>`; grid.append(c2); }
      if (sub === 'rarity') for (const r of RARITIES) { const c2 = h('div', { class: 'codex-item' }); c2.innerHTML = `<div class="icon sm r-${r.id}" style="--c:${r.color};--r:${r.color}">${r.name[0]}</div><div><div class="nm" style="color:${r.color}">${r.name}</div><div class="muted">出现权重 ${r.weight} · 强度系数 ×${r.power}</div></div>`; grid.append(c2); }
      body.append(grid);
    }
    if (tab === 'achievements') {
      const grid = h('div', { class: 'codex-grid' });
      body.innerHTML = `<div class="muted" style="margin-bottom:8px">已完成 ${Object.keys(p.achievements).length} / ${ACHIEVEMENTS.length} · 称号：${p.titles.length ? p.titles.map((t) => `<button class="btn small ${p.title === t ? 'primary' : ''}" data-title="${esc(t)}">${esc(t)}</button>`).join(' ') : '暂无'}</div>`;
      body.querySelectorAll('[data-title]').forEach((b) => (b.onclick = () => { p.title = b.dataset.title; ctx.save(); camp('achievements'); }));
      for (const a of ACHIEVEMENTS) { const done = p.achievements[a.id]; const c2 = h('div', { class: 'codex-item', style: { opacity: done ? 1 : 0.6 } }); c2.innerHTML = `<div class="icon sm" style="--c:${done ? '#ffd76a' : '#555'};--r:${done ? '#e4ae39' : '#555'}">${done ? '✔' : '?'}</div><div><div class="nm">${esc(a.name)}</div><div class="muted">${esc(a.desc)}</div><div class="gold-text" style="font-size:12px">💰 ${a.reward.gold}${a.reward.title ? ` · 称号「${esc(a.reward.title)}」` : ''}</div></div>`; grid.append(c2); }
      body.append(grid);
    }
    if (tab === 'settings') body.append(settingsPanel());
    s.append(c);
    return show(s);
  }

  function settingsPanel(onDone) {
    const p = P(), st = p.settings;
    const d = h('div', { class: 'settings' });
    d.innerHTML = `<label>画质 <select class="q"><option value="auto">自动</option><option value="high">高</option><option value="medium">中</option><option value="low">低</option></select></label>
      <label>震屏强度 <input type="range" class="shake" min="0" max="1.5" step="0.1" value="${st.shake}"></label>
      <label>伤害数字 <input type="checkbox" class="nums" ${st.numbers ? 'checked' : ''}></label>
      <label>鼠标瞄准 <input type="checkbox" class="aim" ${st.aimAssist ? 'checked' : ''}></label>
      <label>音乐音量 <input type="range" class="music" min="0" max="1" step="0.05" value="${st.music}"></label>
      <label>音效音量 <input type="range" class="sfx" min="0" max="1" step="0.05" value="${st.sfx}"></label>
      <div class="muted" style="font-size:12px">画质修改在下一局生效。存档保存在本机浏览器中。</div>
      <div style="display:flex;gap:8px">${onDone ? '<button class="btn primary done">完成</button>' : ''}<button class="btn danger reset">重置存档</button></div>`;
    d.querySelector('.q').value = st.quality;
    const upd = () => { st.quality = d.querySelector('.q').value; st.shake = +d.querySelector('.shake').value; st.numbers = d.querySelector('.nums').checked; st.aimAssist = d.querySelector('.aim').checked; st.music = +d.querySelector('.music').value; st.sfx = +d.querySelector('.sfx').value; ctx.applySettings(); ctx.save(); };
    d.querySelectorAll('select,input').forEach((x) => (x.onchange = upd));
    d.querySelector('.done')?.addEventListener('click', onDone);
    d.querySelector('.reset').onclick = () => { if (confirm('确定要清空全部进度吗？此操作无法撤销。')) { ctx.resetProfile(); title(); } };
    return d;
  }

  function loading(text = '加载中') {
    const s = h('div', { class: 'loading' });
    s.innerHTML = `<div style="text-align:center"><div class="logo"><div class="cn" style="font-size:64px">幻域无双</div></div><div class="ltext">${esc(text)}</div><div class="bar"><i style="transform:scaleX(0)"></i></div><div class="tip">${esc(TIPS[Math.floor(Math.random() * TIPS.length)])}</div></div>`;
    root.append(s);
    return { set(k, t) { s.querySelector('.bar i').style.transform = `scaleX(${k})`; if (t) s.querySelector('.ltext').textContent = t; }, remove() { s.remove(); } };
  }

  return { title, playWizard, camp, hide, loading, settingsPanel, get visible() { return !!screen; } };
}

const TIPS = [
  '普攻若干段后接蓄力技（K），可打出不同的 C 技：挑空、突进、范围爆发……',
  '无双槽满时按 L 释放无双乱舞，生命低于 25% 时会变成更强的「真·无双」。',
  '同派系技能集齐 2/4/6/8 个会激活派系加成，两个派系各 2 个还能触发羁绊。',
  '技能升到满级并持有指定被动，会在升级时出现至宝级的进化卡。',
  '战斗中按 B 打开战地商店：配件凑齐即可合成，部分装备还能升级为神器。',
  '红色地面预警的大小就是真实的伤害范围，按空格闪避可获得无敌帧。',
  '精英与敌将会掉落中立秘宝，秘宝独占一格，阶数越高越强。',
  '地图上定时刷新神符：双倍伤害、急速、幻象、隐身……记得去捡！',
  '骨盾卫正面会格挡大部分伤害，用蓄力技或绕到背后攻击可以破防。',
];
