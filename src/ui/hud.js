import { h, skillIconHtml, itemIconHtml, esc } from './dom.js';
import { SKILL } from '../game/content/skills.js';
import { ITEM } from '../game/content/items.js';
import { FACTION, FACTIONS } from '../game/content/factions.js';
import { OBJECTIVES } from '../game/content/stages.js';
import { AFFIX } from '../game/content/enemies.js';

// In-run HUD: health/shield/musou/xp, skill & item bars with cooldown sweeps, KO counter, combo, objective,
// boss bar, faction tiers, buffs, minimap, enemy name tags, banners and announcements.
const SKILL_KEYS = ['U', 'I', 'O', 'P', 'Y'];
const ITEM_KEYS = ['Z', 'X', 'C'];
const BELT_KEYS = ['6', '7', '8', '9'];

export function createHud(root, { project, onShop, onPause, touchMode = false }) {
  const el = h('div', { id: 'hud' });
  el.innerHTML = `
  <div class="vignette"></div>
  <div class="tags-layer"></div>
  <div class="hud-top">
    <div class="hero-card panel">
      <div class="hero-portrait"><span class="pg"></span><span class="lvl">1</span></div>
      <div class="bars">
        <div class="bar hp"><i class="lag"></i><i class="fill"></i><i class="shield"></i><span></span></div>
        <div class="bar musou"><i></i><span></span></div>
        <div class="bar xp"><i></i></div>
      </div>
    </div>
    <div class="hud-center-top">
      <div class="objective panel"><span class="glyph"></span><span class="txt"></span><div class="bar prog"><i></i></div></div>
      <div class="boss-bar panel hidden"><div class="name"></div><div class="bar"><i></i></div><div class="phase"></div></div>
    </div>
    <div class="hud-right">
      <div class="ko-counter panel"><div class="ko"><small>KO</small><span>0</span></div><div class="sub"></div></div>
      <canvas id="minimap" width="300" height="300"></canvas>
      <div class="gold-chip panel">💰 <span>0</span></div>
    </div>
  </div>
  <div class="hud-buttons pe"><button class="btn shopbtn">商店 <span class="kbd">B</span></button><button class="btn pausebtn">暂停 <span class="kbd">Esc</span></button></div>
  <div class="buffs"></div>
  <div class="factions"></div>
  <div class="combo hidden"><div class="n">0</div><div class="label">连击</div><div class="timer"><i></i></div></div>
  <div class="hud-bottom ${touchMode ? 'touchmode' : ''}">
    <div class="panel" style="padding:8px;display:grid;gap:6px"><div class="autobar"></div><div class="passivebar"></div></div>
    <div class="skillbar panel"></div>
    <div class="panel" style="display:grid;gap:6px;padding:6px"><div class="items"></div><div class="belt"></div></div>
  </div>
  <div class="toast-stack"></div>`;
  root.append(el);
  const q = (s) => el.querySelector(s);
  q('.shopbtn').onclick = onShop; q('.pausebtn').onclick = onPause;
  const refs = {
    hpFill: q('.bar.hp .fill'), hpLag: q('.bar.hp .lag'), hpShield: q('.bar.hp .shield'), hpText: q('.bar.hp span'), musou: q('.bar.musou'), musouFill: q('.bar.musou i'), musouText: q('.bar.musou span'),
    xp: q('.bar.xp i'), lvl: q('.hero-portrait .lvl'), pg: q('.hero-portrait .pg'), obj: q('.objective'), objGlyph: q('.objective .glyph'), objTxt: q('.objective .txt'), objProg: q('.objective .prog i'),
    boss: q('.boss-bar'), bossName: q('.boss-bar .name'), bossFill: q('.boss-bar .bar i'), bossPhase: q('.boss-bar .phase'), ko: q('.ko span'), koSub: q('.ko-counter .sub'), gold: q('.gold-chip span'),
    skillbar: q('.skillbar'), autobar: q('.autobar'), passivebar: q('.passivebar'), items: q('.items'), belt: q('.belt'), factions: q('.factions'), buffs: q('.buffs'),
    combo: q('.combo'), comboN: q('.combo .n'), comboT: q('.combo .timer i'), vignette: q('.vignette'), tags: q('.tags-layer'), toasts: q('.toast-stack'), minimap: q('#minimap'),
  };
  const mm = refs.minimap.getContext('2d');
  let lastSkillsKey = '', lastItemsKey = '', lastFactionKey = '', lastCombo = 0, hurtT = 0, musouT = 0;
  const tagPool = [];
  const prevReady = new Map();

  function rebuildSkills(game) {
    const slots = game.skills.slots;
    refs.skillbar.innerHTML = slots.map((id, i) => `<div class="slot" data-i="${i}">${id ? skillIconHtml(id, { lv: game.skills.owned.get(id)?.lv }) : ''}<div class="cd" style="--p:0%"></div><div class="cdt"></div><span class="kbd key">${SKILL_KEYS[i]}</span></div>`).join('');
    const autos = [], passives = [];
    for (const [id, s] of game.skills.owned) { const d = SKILL[id]; if (d.kind === 'auto') autos.push(skillIconHtml(id, { size: 'sm', lv: s.lv })); else if (d.kind === 'passive') passives.push(skillIconHtml(id, { size: 'sm', lv: s.lv })); }
    refs.autobar.innerHTML = autos.join('') || '<span class="muted" style="font-size:11px">自动技</span>';
    refs.passivebar.innerHTML = passives.join('') || '<span class="muted" style="font-size:11px">被动</span>';
  }
  function rebuildItems(game) {
    const inv = game.inventory;
    const actives = game.activeItemSlots();
    refs.items.innerHTML = inv.items.map((id, i) => `<div class="islot" data-i="${i}">${id ? itemIconHtml(id) : ''}${id && ITEM[id].active ? `<div class="cd" style="--p:0%"></div><span class="kbd key">${ITEM_KEYS[actives.indexOf(i)] || ''}</span>` : ''}</div>`).join('');
    refs.belt.innerHTML = inv.belt.map((b, i) => `<div class="bslot">${b ? itemIconHtml(b.id) + `<span class="count">${b.count}</span>` : ''}<span class="kbd key">${BELT_KEYS[i]}</span></div>`).join('') + `<div class="bslot" title="中立秘宝">${inv.neutral ? itemIconHtml(inv.neutral) : '<span class="muted" style="font-size:10px;display:grid;place-items:center;height:100%">秘宝</span>'}</div>`;
  }
  function rebuildFactions(game) {
    const counts = game.factionCounts || {};
    refs.factions.innerHTML = FACTIONS.filter((f) => counts[f.id]).sort((a, b) => counts[b.id] - counts[a.id]).map((f) => {
      const n = counts[f.id];
      return `<div class="fchip" style="color:${f.color}" title="${esc(f.tiers.filter((t) => n >= t.n).map((t) => `${t.n}：${t.text}`).join('\n') || '集齐 2 个技能激活加成')}"><b style="background:${f.color}">${f.glyph}</b><span style="color:#eee">${f.name} ${n}</span><span class="pips">${[2, 4, 6, 8].map((t) => `<i class="${n >= t ? 'on' : ''}"></i>`).join('')}</span></div>`;
    }).join('') + (game.synergies || []).map((s) => `<div class="fchip" style="color:#ffd76a" title="${esc(s.text)}"><b style="background:linear-gradient(90deg,${FACTION[s.a].color},${FACTION[s.b].color})">羁</b><span style="color:#ffe7a0">${s.name}</span></div>`).join('')
      + (game.triads || []).map((t) => `<div class="fchip" style="color:#ade55c" title="${esc(t.text)}"><b style="background:#ade55c">合</b><span style="color:#d8ffa8">${t.name}</span></div>`).join('');
  }

  function drawMinimap(game) {
    const W = 300, half = game.arena.half, s = W / (half * 2 + 4), cx = W / 2, cz = W / 2;
    mm.clearRect(0, 0, W, W);
    mm.fillStyle = 'rgba(255,255,255,0.05)'; mm.fillRect(cx - half * s, cz - half * s, half * 2 * s, half * 2 * s);
    mm.fillStyle = 'rgba(160,150,140,0.5)';
    for (const o of game.obstacles) { mm.beginPath(); mm.arc(cx + o.x * s, cz + o.z * s, Math.max(2, o.r * s), 0, 6.28); mm.fill(); }
    const st = game.stage;
    if (st?.points) for (const p of st.points) { mm.strokeStyle = p.captured ? '#6fdc5a' : '#ffd76a'; mm.lineWidth = 4; mm.beginPath(); mm.arc(cx + p.x * s, cz + p.z * s, p.r * s, 0, 6.28); mm.stroke(); }
    if (st?.portal) { mm.fillStyle = '#7ad8ff'; mm.beginPath(); mm.arc(cx + st.portal.x * s, cz + st.portal.z * s, 8, 0, 6.28); mm.fill(); }
    if (st?.crystal) { mm.fillStyle = '#ad8cff'; mm.fillRect(cx + st.crystal.x * s - 6, cz + st.crystal.z * s - 6, 12, 12); }
    for (const e of game.enemies) {
      if (e.dying) continue;
      mm.fillStyle = e.boss ? '#ff3030' : e.officer ? '#ffb030' : e.elite ? '#d070ff' : 'rgba(255,90,80,0.8)';
      const r = e.boss ? 9 : e.officer ? 6 : e.elite ? 4 : 2.2;
      mm.fillRect(cx + e.x * s - r / 2, cz + e.z * s - r / 2, r, r);
    }
    for (const a of game.allies) { mm.fillStyle = '#6fdc5a'; mm.fillRect(cx + a.x * s - 1.5, cz + a.z * s - 1.5, 3, 3); }
    for (const pk of game.pickups) if (pk.kind === 'rune' || pk.kind === 'neutral' || pk.kind === 'component') { mm.fillStyle = pk.kind === 'rune' ? '#7affff' : '#ffd76a'; mm.beginPath(); mm.arc(cx + pk.x * s, cz + pk.z * s, 5, 0, 6.28); mm.fill(); }
    const p = game.player;
    mm.save(); mm.translate(cx + p.x * s, cz + p.z * s); mm.rotate(-p.face + Math.PI);
    mm.fillStyle = '#fff'; mm.beginPath(); mm.moveTo(0, -9); mm.lineTo(6, 7); mm.lineTo(-6, 7); mm.closePath(); mm.fill(); mm.restore();
  }

  function updateTags(game) {
    const list = game.enemies.filter((e) => !e.dying && (e.officer || e.elite) && !e.boss).slice(0, 14);
    while (tagPool.length < list.length) { const t = h('div', { class: 'etag' }); t.innerHTML = '<div class="nm"></div><div class="hb"><i></i></div>'; refs.tags.append(t); tagPool.push(t); }
    const pos = {};
    tagPool.forEach((t, i) => {
      const e = list[i];
      if (!e) { t.style.display = 'none'; return; }
      project(e.x, e.y + e.height * 1.05 + 0.4, e.z, pos);
      if (!pos.visible) { t.style.display = 'none'; return; }
      t.style.display = ''; t.style.left = `${pos.x}px`; t.style.top = `${pos.y}px`;
      t.className = `etag ${e.officer ? 'officer' : 'elite'}`;
      const key = e.uid;
      if (t.dataset.uid != key) { t.dataset.uid = key; t.querySelector('.nm').innerHTML = `${(e.affixes || []).map((a) => `<span class="aff" style="color:${AFFIX[a].color}">${AFFIX[a].name}</span>`).join('')}${esc(e.officer ? e.officer.name : `精英·${e.def.name}`)}`; }
      t.querySelector('.hb > i').style.transform = `scaleX(${Math.max(0, e.hp / e.maxHp)})`;
    });
  }

  return {
    el,
    reset() { lastSkillsKey = ''; lastItemsKey = ''; lastFactionKey = ''; refs.toasts.innerHTML = ''; },
    update(game, dt) {
      const p = game.player, st = game.stats;
      if (!st) return;
      refs.pg.textContent = game.hero.name[0];
      refs.lvl.textContent = game.run.level;
      const hpK = Math.max(0, p.hp / st.maxHp);
      refs.hpFill.style.transform = `scaleX(${hpK})`; refs.hpLag.style.transform = `scaleX(${hpK})`;
      refs.hpShield.style.transform = `scaleX(${Math.min(1, p.shield / st.maxHp)})`;
      refs.hpText.textContent = `${Math.ceil(p.hp)} / ${Math.round(st.maxHp)}${p.shield > 1 ? `  (+${Math.round(p.shield)})` : ''}`;
      const bars = 1 + st.musouBars;
      const mk = Math.min(1, p.musou / (100 * bars));
      refs.musouFill.style.transform = `scaleX(${mk})`;
      refs.musou.classList.toggle('ready', p.musou >= 100);
      refs.musouText.textContent = p.state === 'musou' ? '无双乱舞中' : `无双 ${Math.floor(p.musou)}${bars > 1 ? ` / ${bars * 100}` : '%'}`;
      refs.xp.style.transform = `scaleX(${Math.min(1, game.run.xp / game.xpToNext())})`;
      // objective
      const s = game.stage;
      if (s?.objective) {
        const o = s.objective, O = OBJECTIVES[o.type];
        refs.objGlyph.textContent = O ? O.icon : game.mode === 'endless' ? '∞' : '日';
        let txt = O ? O.desc(o) : '';
        if (o.type === 'slay') txt = `歼灭 ${game.killsThisStage} / ${o.count}`;
        if (o.type === 'officers') txt = `击破敌将 ${s.officersKilled || 0} / ${o.count}`;
        if (o.type === 'defend') txt = `守护水晶 ${Math.max(0, Math.ceil(o.time - game.stageTime))}s · 水晶 ${Math.round(Math.max(0, s.crystal.hp / s.crystal.maxHp) * 100)}%`;
        if (o.type === 'survive') txt = `坚守 ${Math.max(0, Math.ceil(o.time - game.stageTime))}s`;
        if (game.mode === 'endless') txt = `第 ${game.wave} 波 · 下一波 ${Math.max(0, Math.ceil(45 - game.endless.t))}s`;
        if (game.mode === 'daily') txt = `每日试炼 · 剩余 ${Math.max(0, Math.ceil(600 - game.stageTime))}s`;
        refs.objTxt.textContent = txt;
        refs.objProg.style.transform = `scaleX(${Math.min(1, s.progress || 0)})`;
      }
      // boss
      const boss = game.bosses.find((b) => !b.dying) || game.bosses[0];
      refs.boss.classList.toggle('hidden', !boss);
      if (boss) {
        const tot = game.bosses.reduce((a, b) => a + Math.max(0, b.hp), 0), max = game.bosses.reduce((a, b) => a + b.maxHp, 0);
        refs.bossName.textContent = game.bosses.length > 1 ? '双子将军' : boss.def.name;
        refs.bossFill.style.transform = `scaleX(${tot / max})`;
        refs.bossPhase.textContent = `${boss.def.title} · 阶段 ${boss.phase} / ${boss.phases}${boss.pattern && boss.state === 'pattern' ? ` · ${boss.pattern.def.name}` : ''}`;
      }
      refs.ko.textContent = game.run.kills;
      refs.koSub.textContent = `${game.mode === 'endless' ? `第 ${game.wave} 波 · ` : ''}敌将 ${game.run.officers} · ${formatTime(game.time)}`;
      refs.gold.textContent = Math.floor(game.inventory.gold);
      // skills (rebuild on change)
      const skKey = game.skills.slots.join() + '|' + [...game.skills.owned.entries()].map(([k, v]) => k + v.lv).join();
      if (skKey !== lastSkillsKey) { lastSkillsKey = skKey; rebuildSkills(game); }
      refs.skillbar.querySelectorAll('.slot').forEach((slotEl, i) => {
        const id = game.skills.slots[i]; if (!id) return;
        const o = game.skills.owned.get(id); if (!o) return;
        const k = o.cd > 0 && o.max ? o.cd / o.max : 0;
        slotEl.querySelector('.cd').style.setProperty('--p', `${k * 100}%`);
        slotEl.querySelector('.cdt').textContent = o.cd > 0 ? (o.cd >= 1 ? Math.ceil(o.cd) : o.cd.toFixed(1)) : '';
        const ready = o.cd <= 0;
        if (ready && prevReady.get(id) === false) { slotEl.classList.remove('ready'); void slotEl.offsetWidth; slotEl.classList.add('ready'); }
        prevReady.set(id, ready);
      });
      const itKey = game.inventory.items.join() + '|' + game.inventory.belt.map((b) => b ? b.id + b.count : '').join() + game.inventory.neutral;
      if (itKey !== lastItemsKey) { lastItemsKey = itKey; rebuildItems(game); }
      refs.items.querySelectorAll('.islot').forEach((c, i) => { const id = game.inventory.items[i]; const cdEl = c.querySelector('.cd'); if (id && cdEl) { const it = ITEM[id]; const cd = game.inventory.cds[id] || 0; cdEl.style.setProperty('--p', `${(cd / it.active.cd) * 100}%`); } });
      const fKey = JSON.stringify(game.factionCounts) + (game.synergies || []).length + (game.triads || []).length;
      if (fKey !== lastFactionKey) { lastFactionKey = fKey; rebuildFactions(game); }
      // buffs
      refs.buffs.innerHTML = p.buffs.filter((b) => b.t < 60).slice(0, 10).map((b) => `<div class="buff" title="${esc(b.id)}">${esc((SKILL[b.id]?.glyph) || (b.id.startsWith('rune') ? '符' : '增'))}<i style="transform:scaleX(${Math.min(1, b.t / (b.dur || 1))})"></i></div>`).join('');
      // combo
      const c = game.combo.n;
      refs.combo.classList.toggle('hidden', c < 5);
      if (c >= 5) { refs.comboN.textContent = c; if (c !== lastCombo) { refs.combo.classList.remove('bump'); void refs.combo.offsetWidth; refs.combo.classList.add('bump'); } refs.comboT.style.transform = `scaleX(${Math.max(0, game.combo.t / 2.6)})`; }
      lastCombo = c;
      // vignette
      hurtT = Math.max(0, hurtT - dt); musouT = p.state === 'musou' ? 1 : 0;
      refs.vignette.className = `vignette ${hurtT > 0 ? 'hurt' : ''} ${hpK < 0.25 && !p.dead ? 'lowhp' : ''} ${musouT ? 'musou' : ''}`;
      drawMinimap(game);
      updateTags(game);
      // events -> announcements
      for (const ev of game.events) {
        switch (ev.type) {
          case 'banner': this.banner(ev.text, ev.sub, ev.style); break;
          case 'multikill': this.flashText('multikill', ev.text); break;
          case 'ko': this.flashText('ko-milestone', `${ev.n} 斩！`); break;
          case 'playerHit': if (ev.amount > st.maxHp * 0.03) hurtT = 0.25; break;
          case 'musou': if (ev.phase === 'start') this.flashText(`musou-name ${ev.true ? 'true' : ''}`, ev.name); break;
          case 'chargeName': this.flashText('charge-name', ev.name); break;
          case 'factionTier': this.toast(`<b style="color:${FACTION[ev.faction].color}">${FACTION[ev.faction].name} ${ev.n}</b> 激活：${esc(ev.text)}`); break;
          case 'evolve': this.banner('技能进化！', ev.name, 'triad'); break;
          case 'craft': this.toast(`${itemIconHtml(ev.id)}<span>合成 <b class="rar rar-${ev.rarity}">${esc(ev.name)}</b></span>`); break;
          case 'neutral': this.toast(`${itemIconHtml(ev.id)}<span>获得秘宝 <b style="color:#c070ff">${esc(ev.name)}</b>（${ev.tier} 阶）</span>`); break;
          case 'popup': this.toast(esc(ev.text)); break;
          case 'runeSpawn': this.toast(`<b style="color:${ev.color}">${esc(ev.name)}</b> 出现在战场上`); break;
          case 'officerSpawn': this.toast(`<b style="color:#ffb030">敌将出现：</b>${esc(ev.name)}`); break;
          case 'wave': this.banner(`第 ${ev.wave} 波`, '敌人更强了', 'danger'); break;
          case 'synergy': break;
          default: break;
        }
      }
    },
    banner(text, sub = '', style = '') {
      const b = h('div', { class: `banner ${style}` }); b.innerHTML = `<div class="t">${esc(text)}</div>${sub ? `<div class="s">${esc(sub)}</div>` : ''}`;
      el.querySelectorAll('.banner').forEach((x) => x.remove());
      el.append(b); setTimeout(() => b.remove(), 2400);
    },
    flashText(cls, text) { const d = h('div', { class: cls }); d.textContent = text; el.querySelectorAll(`.${cls.split(' ')[0]}`).forEach((x) => x.remove()); el.append(d); setTimeout(() => d.remove(), 2200); },
    toast(html) { const t = h('div', { class: 'toast' }); t.innerHTML = html; refs.toasts.append(t); while (refs.toasts.children.length > 4) refs.toasts.firstChild.remove(); setTimeout(() => t.remove(), 2700); },
    setVisible(v) { el.style.display = v ? '' : 'none'; },
  };
}
const formatTime = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
