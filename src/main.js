import './ui/style.css';
import { createGame, updateGame, actions } from './game/sim.js';
import { CHAPTERS, ENDLESS } from './game/content/stages.js';
import { ENEMY, BOSS, ALLIES } from './game/content/enemies.js';
import { HERO } from './game/content/heroes.js';
import { consumeLoadout, metaFor, settleRun } from './game/progression.js';
import { loadProfile, saveProfile, resetProfile } from './platform/profile-store.js';
import { createAssetLibrary } from './render/assets.js';
import { createRenderer } from './render/renderer.js';
import { createInput } from './input.js';
import { createHud } from './ui/hud.js';
import { createOverlays } from './ui/overlays.js';
import { createMenus } from './ui/menus.js';
import { createTouch } from './ui/touch.js';
import { createAudio } from './audio/audio.js';

const ui = document.getElementById('ui');
const canvas = document.getElementById('scene');
let profile = loadProfile();
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const autoQuality = () => (profile.settings.quality !== 'auto' ? profile.settings.quality : isTouch ? 'low' : (navigator.hardwareConcurrency || 4) >= 8 ? 'high' : 'medium');

const assets = createAssetLibrary();
const audio = createAudio(profile.settings);
let renderer = null, game = null, showcase = null, lastSel = null, settled = null;
const save = () => saveProfile(profile);

const input = createInput(canvas, { unproject: (x, y) => renderer?.unproject(x, y) });
const touch = isTouch ? createTouch(document.body, input) : null;
touch?.setVisible(false);
const rotateHint = document.createElement('div'); rotateHint.className = 'rotate-hint'; rotateHint.innerHTML = '<div><div style="font-size:48px">⟳</div>请将设备横屏以获得最佳体验</div>'; document.body.append(rotateHint);

const hud = createHud(ui, { project: (x, y, z, out) => renderer.project(x, y, z, out), onShop: () => input.press('shop'), onPause: () => input.press('pause'), touchMode: isTouch });
hud.setVisible(false);

const overlays = createOverlays(ui, {
  chooseCard: (i) => { actions.chooseCard(game, i); audio.play('pick'); overlays.close(); },
  reroll: () => { if (actions.reroll(game)) { audio.play('reroll'); overlays.draft(game); } },
  banish: (i) => { if (actions.banish(game, i)) overlays.draft(game); },
  buy: (id) => { const r = actions.buy(game, id); audio.play(r.ok ? 'buy' : 'deny'); if (!r.ok) hud.toast(r.reason); game.recomputeStats(); return r; },
  sell: (slot) => { actions.sell(game, slot); audio.play('coin'); game.recomputeStats(); },
  closeShop: () => { actions.closeShop(game); overlays.close(); },
  enterNode: (id) => { overlays.close(); actions.enterNode(game, id); renderer.resetForStage(game); audio.play('click'); },
  eventOption: (i) => { overlays.close(); actions.eventOption(game, i); if (game.status === 'playing') renderer.resetForStage(game); },
  eventDone: () => { overlays.close(); actions.eventDone(game); },
  restChoice: (c) => { overlays.close(); actions.restChoice(game, c); },
  claimTreasure: () => { overlays.close(); actions.claimTreasure(game); audio.play('coin'); },
  resume: () => { if (game.status === 'paused') actions.pause(game); overlays.close(); },
  quitRun: () => { if (!game) return; game.status = 'lost'; game.result = { win: false, reason: 'quit' }; overlays.close(); },
  openSettings: () => { const d = menus.settingsPanel(() => { overlays.close(); overlays.pause(game); }); const o = overlays.pause(game); o.querySelector('.dialog').replaceChildren(d); },
  again: () => { overlays.close(); startRun(lastSel); },
  home: () => { overlays.close(); toTitle(); },
  toast: (t) => hud.toast(t),
  sfx: (k, v) => audio.play(k, v),
});

const menus = createMenus(ui, {
  profile: () => profile, save, toast: (t) => toastAnywhere(t), sfx: (k) => audio.play(k),
  startRun: (sel) => startRun(sel),
  applySettings: () => { audio.setVolumes(profile.settings); if (renderer) { renderer.numbers.enabled = profile.settings.numbers; renderer.shake = profile.settings.shake; } input.useMouseAim = profile.settings.aimAssist; },
  resetProfile: () => { profile = resetProfile(); save(); },
  skinNames: (heroId) => (assets.manifest?.assets[HERO[heroId].model]?.skins || [{ name: '默认' }]).map((s) => s.name),
});

function toastAnywhere(text) {
  const t = document.createElement('div'); t.className = 'toast'; t.style.cssText = 'position:fixed;left:50%;bottom:40px;transform:translateX(-50%);z-index:30'; t.textContent = text;
  document.body.append(t); setTimeout(() => t.remove(), 2600);
}

function modelsFor(g) {
  const set = new Set();
  const table = g.mode === 'adventure' ? [g.chapter] : CHAPTERS;
  for (const ch of table) { for (const r of ch.spawn) set.add(ENEMY[r[0]].model); for (const e of ch.elites) set.add(ENEMY[e].model); }
  for (const s of ['skel_minion', 'frost_wizard', 'shadow_stalker', 'blood_berserker', 'skel_warrior']) set.add(ENEMY[s].model);
  for (const a of Object.values(ALLIES)) if (!a.hero) set.add(a.model);
  return [...set];
}
function bossModelsFor(g) {
  const ids = g.mode === 'adventure' ? [g.chapter.boss] : ENDLESS.bosses.flatMap((b) => [b, BOSS[b].twin].filter(Boolean));
  return ids.map((id) => BOSS[id].model);
}

async function ensureRenderer() {
  if (renderer) return renderer;
  renderer = createRenderer(canvas, assets, { quality: autoQuality() });
  renderer.numbers.enabled = profile.settings.numbers;
  renderer.shake = profile.settings.shake;
  input.useMouseAim = profile.settings.aimAssist;
  return renderer;
}

async function boot() {
  const l = menus.loading('正在召集军团……');
  assets.onProgress = (a, b) => l.set(a / Math.max(1, b));
  await assets.init();
  await ensureRenderer();
  showcase = createGame({ mode: 'endless', hero: profile.lastHero || 'knight', seed: 7, difficulty: 'normal', starter: false, meta: metaFor(profile, profile.lastHero || 'knight') });
  showcase.status = 'showcase';
  await assets.preload([HERO[showcase.hero.id].model, 'props']);
  await renderer.prepare(showcase, []);
  l.remove();
  toTitle();
  requestAnimationFrame(loop);
  if (import.meta.env.DEV) window.__realmApi = { startRun, actions, get game() { return game; }, get renderer() { return renderer; }, get profile() { return profile; }, input };
}

function toTitle() {
  game = null; settled = null;
  hud.setVisible(false); touch?.setVisible(false); rotateHint.classList.remove('on');
  if (showcase) renderer?.resetForStage(showcase);
  menus.title();
  audio.music('title');
}

async function startRun(sel) {
  lastSel = sel;
  menus.hide();
  overlays.close();
  profile.lastHero = sel.hero; profile.lastDifficulty = sel.difficulty;
  const metaItems = consumeLoadout(profile);
  save();
  const heroId = sel.mode === 'daily' ? null : sel.hero;
  const g = createGame({ mode: sel.mode, hero: heroId, difficulty: sel.difficulty, chapter: sel.chapter, maxEnemies: autoQuality() === 'low' ? 220 : autoQuality() === 'medium' ? 300 : 380,
    meta: metaFor(profile, heroId || 'knight', { metaItems, factionPick: metaItems.includes('m_faction_stone') ? sel.faction || 'fire' : null }) });
  if (g.mode === 'daily') g.meta.skin = profile.heroes[g.hero.id]?.skin || 0;
  const l = menus.loading('布阵中……');
  const models = [g.hero.model, ...modelsFor(g), ...bossModelsFor(g)];
  let done = 0;
  await Promise.all(models.map((m) => assets.preload([m]).then(() => l.set(++done / models.length * 0.7))));
  l.set(0.8, '烘焙动画……');
  await renderer.prepare(g, modelsFor(g));
  l.set(1);
  l.remove();
  renderer.units.swapHero();
  renderer.resetForStage(g);
  game = g; settled = null;
  hud.reset(); hud.setVisible(true); touch?.setVisible(true);
  rotateHint.classList.toggle('on', isTouch);
  audio.music(g.biomeId);
  if (import.meta.env.DEV) window.__realm = { game, renderer, actions, profile, startRun, input };
}

// ------------------------------------------------------------------ main loop
let last = performance.now();
function loop(now) {
  const rawMs = now - last; last = now;
  const dt = Math.min(0.05, rawMs / 1000);
  if (game) stepGame(dt, rawMs);
  else if (showcase && renderer) { showcase.events = []; showcase.time += dt; renderer.frame(showcase, dt, rawMs); }
  requestAnimationFrame(loop);
}

const DRAFT_KEYS = ['skill0', 'skill1', 'skill2', 'skill3'];
input.onPress((a) => {
  if (!game) return;
  const st = game.status;
  if (a === 'pause') {
    if (st === 'shop') { actions.closeShop(game); overlays.close(); return; }
    if (st === 'playing' || st === 'paused') { actions.pause(game); if (game.status === 'paused') overlays.pause(game); else overlays.close(); }
    return;
  }
  if (a === 'shop') {
    if (st === 'playing') { actions.openShop(game); overlays.shop(game); audio.play('open'); }
    else if (st === 'shop') { actions.closeShop(game); overlays.close(); }
    return;
  }
  if (st === 'draft') {
    const i = DRAFT_KEYS.indexOf(a);
    if (i >= 0 && game.draft.options?.[i]) { actions.chooseCard(game, i); audio.play('pick'); overlays.close(); }
    if (a === 'skill2' && false) actions.reroll(game);
  }
});
window.addEventListener('keydown', (e) => { if (game?.status === 'draft' && e.code === 'KeyR' && !e.repeat) { if (actions.reroll(game)) overlays.draft(game); } });
document.addEventListener('visibilitychange', () => { if (document.hidden && game?.status === 'playing') { actions.pause(game); overlays.pause(game); } });

function stepGame(dt, rawMs) {
  const g = game;
  if (g.status === 'playing') updateGame(g, dt, input.snapshot());
  else { input.snapshot(); g.events = []; }
  for (const ev of g.events) audio.event(ev, g);
  audio.tick?.(g);
  renderer.frame(g, g.status === 'playing' ? dt : 0.0001, rawMs);
  hud.update(g, dt);
  touch?.update(g);
  touch?.setVisible(g.status === 'playing');
  // status -> overlay
  const want = { draft: 'draft', shop: 'shop', shopNode: 'shop', map: 'map', event: 'event', eventDone: 'eventDone', rest: 'rest', treasure: 'treasure', paused: 'pause' }[g.status];
  if (want && overlays.kind !== want) {
    if (want === 'shop') overlays.shop(g, { node: g.status === 'shopNode' });
    else if (want === 'pause') overlays.pause(g);
    else overlays[want](g);
    if (want === 'draft') audio.play('levelup');
  }
  if (!want && ['draft', 'map', 'event', 'eventDone', 'rest', 'treasure'].includes(overlays.kind) && g.status === 'playing') overlays.close();
  if (['chapterClear', 'won', 'lost'].includes(g.status) && !settled) {
    settled = settleRun(profile, g);
    save();
    audio.play(settled.win || settled.chapterClear ? 'victory' : 'defeat');
    audio.music(settled.win || settled.chapterClear ? 'victory' : 'defeat');
    setTimeout(() => overlays.results(g, settled), 900);
  }
}

boot().catch((err) => { console.error(err); ui.innerHTML = `<div class="loading"><div style="text-align:center;padding:30px">加载失败：${String(err?.message || err)}<br><button class="btn" onclick="location.reload()">重试</button></div></div>`; });
