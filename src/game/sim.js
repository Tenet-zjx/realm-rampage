// Simulation entry point: createGame(options) builds plain state; updateGame(game, dt, input) advances it.
// Presentation reads game.events (cleared every step) and game.effects (visual descriptors with life).
import { HERO } from './content/heroes.js';
import { DIFFICULTY } from './content/difficulties.js';
import { CHAPTERS, BIOMES, ENDLESS, DAILY_MODIFIERS } from './content/stages.js';
import { ITEM, RUNES, META_ITEMS } from './content/items.js';
import { SKILL, FACTION_SKILLS } from './content/skills.js';
import { createRng, hashString } from './rng.js';
import { createGrid } from './grid.js';
import { computeStats } from './stats.js';
import { createPlayer, updatePlayer } from './player.js';
import { updateSkillEntities } from './skills.js';
import { updateEnemies, updateHostile } from './enemies.js';
import { updateDirector, updateEndless, computeScaling, layoutArena, arenaFor, startStage, createStage } from './director.js';
import { runProcs, addBuff } from './procs.js';
import { damagePlayer, healPlayer, emit } from './combat.js';
import { openDraft, chooseCard, reroll, banish, addSkill, randomFactionSkill } from './draft.js';
import { buy, sell, equipNeutral, addComponent } from './shop.js';
import { generateMap, enterNode, completeNode, eventOption, restChoice, claimTreasure } from './run.js';
import { summonUnits } from './skills.js';
import { dist2 } from './util.js';

export const xpCurve = (lv) => Math.round(8 + lv * 6 + Math.pow(lv, 1.9) * 0.8);

export function createGame(options = {}) {
  const mode = options.mode || 'adventure';
  const today = options.date || new Date().toISOString().slice(0, 10);
  const seed = options.seed ?? (mode === 'daily' ? hashString(`daily-${today}`) : Math.floor(Math.random() * 2 ** 31));
  const rng = createRng(seed);
  const heroId = mode === 'daily' ? ['knight', 'barbarian', 'mage', 'rogue'][hashString(today) % 4] : options.hero || 'knight';
  const hero = HERO[heroId];
  const diff = DIFFICULTY[options.difficulty || 'normal'];
  const chapter = mode === 'adventure' ? CHAPTERS.find((c) => c.id === (options.chapter || 1)) : null;
  const game = {
    seed, rng, mode, hero, diff, chapter, time: 0, dt: 0, uid: 1, status: 'loading',
    meta: options.meta || {}, caps: { enemies: options.maxEnemies || 360 },
    player: createPlayer(hero), enemies: [], bosses: [], allies: [], projectiles: [], waves: [], rings: [], zones: [], orbits: [], beams: [], tethers: [], traps: [], walls: [],
    hostile: [], hazards: [], pickups: [], obstacles: [], decor: [], corpses: [], scheduled: [], spawnQueue: [],
    events: [], effects: [], effectsById: new Map(), effectUid: 1, grid: createGrid(3),
    skills: { owned: new Map(), slots: [null, null, null, null] }, triadTimers: {},
    inventory: { gold: 0, items: [null, null, null, null, null, null], neutral: null, belt: [null, null, null, null], cds: {} },
    draft: { options: null, rerolls: 2, banishes: 1, banished: new Set(), extraOptions: 0, lucky: 0, rarityTicket: 0, firstLegendary: false },
    run: { kills: 0, level: 1, xp: 0, maxCombo: 0, officers: 0, damageDealt: 0, damageTaken: 0, goldEarned: 0, healed: 0, musous: 0, trueMusous: 0, crafts: 0, artifacts: 0,
      evolves: 0, arcana: 0, runes: 0, maxSummons: 0, synergyMax: 0, triads: 0, awakened: 0, neutralTier5: 0, bossHits: 0, perfectBoss: 0, clutchBoss: 0, fastBoss: 0, lastHurtAt: -99 },
    combo: { n: 0, t: 0 }, multikill: { n: 0, last: -9 }, procState: {}, procs: [], procIndex: {},
    hitstop: 0, slowmo: null, stats: null, statsDirty: true, chapterStats: {}, chapterCurse: {}, runMods: { stats: {} }, pendingLevels: 0,
    stageTime: 0, killsThisStage: 0, nodeDepth: 0, wave: 1, bossesKilled: 0, codexSeen: { skills: new Set(), enemies: new Set(), items: new Set() },
    arena: { half: 30 }, biomeId: chapter?.biome || 'graveyard', result: null,
  };
  game.biome = BIOMES[game.biomeId];
  game.spawnTable = chapter?.spawn || CHAPTERS.flatMap((c) => c.spawn.map((r) => [r[0], r[1] + (c.id - 1) * 120, r[2]]));
  attachApi(game);
  applyMeta(game, options);
  computeStats(game);
  game.procIndex = Object.fromEntries(game.procs.map((p) => [p.id, p]));
  game.player.hp = game.stats.maxHp;
  game.player.revives = game.diff.revive + Math.round(game.stats.revives) + (game.runMods.revives || 0);
  game.player.musou = game.runMods.musouFull ? 100 : game.stats.musouStart || 0;
  // starting kit: one random rare+ active for the hero's palette so runs begin with a skill to press
  if (options.starter !== false) {
    const pool = FACTION_SKILLS.filter((s) => s.kind === 'active' && ['common', 'uncommon'].includes(s.rarity));
    addSkill(game, game.rng.pick(pool).id);
  }
  if (game.runMods.startSkill) { const pool = FACTION_SKILLS.filter((s) => ['rare', 'mythical', 'legendary'].includes(s.rarity) && !game.skills.owned.has(s.id)); addSkill(game, game.rng.pick(pool).id); }
  if (game.meta.factionPick) { const id = randomFactionSkill(game, game.meta.factionPick); if (id) addSkill(game, id); }
  if (game.runMods.neutralTier) { const pool = Object.values(ITEM).filter((i) => i.type === 'neutral' && i.tier === game.runMods.neutralTier); equipNeutral(game, game.rng.pick(pool).id); }
  if (mode === 'adventure') { game.map = generateMap(game, chapter.id); game.status = 'map'; }
  else {
    game.endless = { t: 0, mutations: [] };
    if (mode === 'daily') { const rng2 = createRng(hashString(`mods-${today}`)); const mods = rng2.shuffle(DAILY_MODIFIERS.slice()).slice(0, 2); game.daily = { date: today, mods }; for (const m of mods) for (const k in m.mod) game.runMods[k] = (game.runMods[k] || 0) + m.mod[k]; }
    const stage = { objective: { type: mode === 'daily' ? 'survive' : 'endless', time: 600 }, progress: 0, points: [], spawnT: 1.5, officerT: 30, runeT: 30, cleared: false, introT: 2 };
    game.stage = stage; game.arena = arenaFor(game); computeScaling(game); layoutArena(game, game.biome);
    game.status = 'playing';
    emit(game, { type: 'stageStart', name: mode === 'daily' ? '每日试炼' : '无尽模式', desc: mode === 'daily' ? `生存 10 分钟 · ${game.daily.mods.map((m) => m.name).join(' / ')}` : '敌人无穷无尽，每 5 波一位首领', glyph: mode === 'daily' ? '日' : '∞' });
  }
  game.recomputeStats();
  return game;
}

function applyMeta(game, options) {
  const m = game.meta;
  const mods = game.runMods;
  for (const id of m.metaItems || []) {
    const it = META_ITEMS.find((x) => x.id === id); if (!it) continue;
    const e = it.effect;
    if (e.stats) for (const k in e.stats) mods.stats[k] = (mods.stats[k] || 0) + e.stats[k];
    for (const k of ['revives', 'rerolls', 'banishes', 'extraSlot', 'runGold', 'draftOptions', 'rarityTicket', 'neutralTier']) if (e[k]) mods[k] = (mods[k] || 0) + e[k];
    if (e.recipeDiscount) mods.recipeDiscount = e.recipeDiscount;
    if (e.startSkill) mods.startSkill = true;
    if (e.musouFull) mods.musouFull = true;
    if (e.freeEvolve) mods.freeEvolve = true;
  }
  if (mods.extraSlot) game.skills.slots.push(null);
  if (mods.runGold) game.inventory.gold += mods.runGold;
  game.draft.rerolls += (mods.rerolls || 0);
  game.draft.banishes += (mods.banishes || 0);
  game.draft.rarityTicket = mods.rarityTicket || 0;
  game.draft.firstLegendary = !!m.flags?.firstDraftLegendary;
  if (options.forceAllCharges) game.forceAllCharges = true;
}

function attachApi(game) {
  game.addEffect = (f) => { const fx = { id: game.effectUid++, t: 0, maxLife: f.life, ...f }; game.effects.push(fx); game.effectsById.set(fx.id, fx); return fx; };
  game.removeEffectWhere = (pred) => { for (const f of game.effects) if (pred(f)) f.life = 0; };
  game.updateEffect = (pred, patch) => { for (const f of game.effects) if (pred(f)) Object.assign(f, patch); };
  game.scheduleBoss = (delay, fn) => game.scheduled.push({ t: game.time + delay, fn });
  game.recomputeStats = () => { computeStats(game); game.procIndex = Object.fromEntries(game.procs.map((p) => [p.id, p])); };
  game.xpToNext = () => xpCurve(game.run.level);
  game.addXp = (v) => {
    game.run.xp += v;
    while (game.run.xp >= game.xpToNext()) {
      game.run.xp -= game.xpToNext(); game.run.level++; game.pendingLevels++;
      game.statsDirty = true;
      emit(game, { type: 'levelup', level: game.run.level });
      game.player.hp = Math.min(game.stats.maxHp * 1.05, game.player.hp + game.stats.maxHp * 0.08);
      game.draftDue = game.time + 0.35;
    }
  };
  game.damagePlayer = (amount, src) => damagePlayer(game, amount, src);
  game.activeItemSlots = () => game.inventory.items.map((id, i) => (id && ITEM[id].active ? i : null)).filter((x) => x != null);
  game.fail = (why) => { if (game.status === 'playing') { game.player.dead = true; game.endAt = game.time + 1.5; game.failReason = why; } };
  game.onBossKilled = (e) => {
    game.bossesKilled++;
    emit(game, { type: 'bossDeath', name: e.def.name, x: e.x, z: e.z });
    emit(game, { type: 'hitstop', t: 0.2 }); game.slowmo = { t: 1.2, scale: 0.25 };
    if (game.run.bossHits === 0) game.run.perfectBoss = 1;
    if (game.player.hp / game.stats.maxHp < 0.05) game.run.clutchBoss = 1;
    if (game.chapter?.id === 1 && game.time < 300) game.run.fastBoss = 1;
    if (game.mode !== 'adventure') { const g = Math.round(1200 * game.diff.reward * (1 + game.stats.goldGain)); game.inventory.gold += g; game.run.goldEarned += g; emit(game, { type: 'banner', text: '首领击破！', sub: `+${g} 金币`, style: 'clear' }); }
  };
  game.objectivePoint = () => {
    const st = game.stage;
    if (st?.portal) return { x: st.portal.x, z: st.portal.z };
    const open = st?.points?.find((p) => !p.captured); if (open) return { x: open.x, z: open.z };
    return { x: 0, z: 0 };
  };
  game.setBiome = (id) => { game.biomeId = id; game.biome = BIOMES[id]; emit(game, { type: 'biome', id }); };
}

// ---------------------------------------------------------------- pickups & runes
function applyRune(game, id) {
  const r = RUNES.find((x) => x.id === id), p = game.player, st = game.stats;
  game.run.runes++;
  if (r.stats) addBuff(game, { id: r.id, dur: r.dur, stats: r.stats, vfx: r.id });
  if (r.summon) summonUnits(game, r.summon.unit, r.summon.count, r.dur, 1, p.x, p.z, 'blink');
  if (r.stealth) p.stealthT = r.dur;
  if (r.hot) addBuff(game, { id: r.id, dur: r.dur, hotRate: (st.maxHp * r.hot) / r.dur });
  if (r.shield) { p.shield = Math.max(p.shield, st.maxHp * r.shield); p.shieldT = r.dur; }
  if (r.gold) { game.inventory.gold += r.gold; game.run.goldEarned += r.gold; }
  if (r.xp) game.addXp(game.xpToNext() * r.xp);
  game.statsDirty = true;
  emit(game, { type: 'rune', id: r.id, name: r.name, color: r.color });
  emit(game, { type: 'banner', text: r.name, sub: r.desc, style: 'rune', color: r.color });
}

function updatePickups(game, dt) {
  const p = game.player, range = game.stats.pickupRange;
  if (game.pickups.length > 420) for (const pk of game.pickups.slice(0, game.pickups.length - 380)) if (pk.kind === 'xp' || pk.kind === 'gold') pk.vacuum = true;
  for (const pk of game.pickups) {
    pk.t += dt;
    if (pk.vy || pk.y > 0.25) { pk.y += pk.vy * dt; pk.vy -= 22 * dt; pk.x += pk.vx * dt; pk.z += pk.vz * dt; if (pk.y <= 0.25) { pk.y = 0.25; pk.vy = 0; pk.vx = 0; pk.vz = 0; } }
    if (p.dead) continue;
    const d2 = dist2(pk.x, pk.z, p.x, p.z);
    const magnet = pk.vacuum || (pk.kind !== 'rune' && d2 < range * range) || (pk.kind === 'rune' && d2 < 2.5 * 2.5);
    if (magnet && pk.t > 0.25) {
      const d = Math.sqrt(d2) || 1, sp = (pk.vacuum ? 26 : 16) + pk.t * 4;
      pk.x += ((p.x - pk.x) / d) * sp * dt; pk.z += ((p.z - pk.z) / d) * sp * dt;
    }
    if (d2 < 1.0 && pk.t > 0.2) {
      pk.taken = true;
      switch (pk.kind) {
        case 'xp': game.addXp(pk.value); break;
        case 'gold': game.inventory.gold += pk.value; game.run.goldEarned += pk.value; emit(game, { type: 'gold', amount: pk.value, x: pk.x, z: pk.z }); break;
        case 'heal': healPlayer(game, game.stats.maxHp * pk.value); break;
        case 'neutral': equipNeutral(game, pk.item); break;
        case 'component': if (addComponent(game, pk.item)) emit(game, { type: 'popup', text: `获得 ${ITEM[pk.item].name}`, color: '#ffd76a' }); break;
        case 'rune': applyRune(game, pk.item); break;
        default: break;
      }
      emit(game, { type: 'pickup', kind: pk.kind, uid: pk.uid });
    }
  }
  game.pickups = game.pickups.filter((pk) => !pk.taken);
}

// ---------------------------------------------------------------- main step
export function updateGame(game, rawDt, input = {}) {
  game.events = [];
  if (game.status !== 'playing') return game;
  let dt = Math.min(0.05, rawDt);
  if (game.hitstop > 0) { game.hitstop -= rawDt; dt *= 0.06; }
  if (game.slowmo) { game.slowmo.t -= rawDt; dt *= game.slowmo.scale; if (game.slowmo.t <= 0) game.slowmo = null; }
  game.time += dt; game.dt = dt;
  if (game.statsDirty) game.recomputeStats();
  // spatial grid
  game.grid.clear();
  for (const e of game.enemies) if (!e.dying) game.grid.insert(e);
  updatePlayer(game, dt, input);
  updateSkillEntities(game, dt);
  updateEnemies(game, dt);
  updateHostile(game, dt);
  runProcs(game, 'tick', { dt });
  updatePickups(game, dt);
  if (game.mode === 'adventure') updateDirector(game, dt); else updateEndless(game, dt);
  // combo decay
  if (game.combo.n > 0) { game.combo.t -= dt; if (game.combo.t <= 0) { if (game.combo.n >= 20) emit(game, { type: 'comboEnd', n: game.combo.n }); game.combo.n = 0; } }
  // effects lifetime
  for (const f of game.effects) { f.t += dt; f.life -= dt; }
  if (game.effects.some((f) => f.life <= 0)) { game.effects = game.effects.filter((f) => { if (f.life > 0) return true; game.effectsById.delete(f.id); return false; }); }
  // hit-stop requests
  let hs = 0; for (const ev of game.events) if (ev.type === 'hitstop') hs = Math.max(hs, ev.t);
  if (hs > 0) game.hitstop = Math.min(0.22, Math.max(game.hitstop, hs));
  // codex: seen enemies
  for (const ev of game.events) if (ev.type === 'kill' && ev.model) game.codexSeen.enemies.add(ev.model);
  // flow
  if (game.draftDue && game.time >= game.draftDue && game.pendingLevels > 0 && !game.player.dead) { game.draftDue = null; openDraft(game); return game; }
  if (game.endAt && game.time >= game.endAt) { game.status = 'lost'; game.result = { win: false, reason: game.failReason || 'death' }; emit(game, { type: 'runEnd', win: false }); return game; }
  if (game.clearAt && game.time >= game.clearAt) {
    game.clearAt = null;
    if (game.pendingLevels > 0) { game.draft.returnTo = 'playing'; game.clearPending = true; openDraft(game); return game; }
    finishStage(game);
  }
  if (game.clearPending && game.status === 'playing' && game.pendingLevels === 0) { game.clearPending = false; finishStage(game); }
  return game;
}

function finishStage(game) {
  if (game.mode === 'daily') { game.status = 'won'; game.result = { win: true }; return; }
  if (game.pendingDuel) {
    const d = game.pendingDuel; game.pendingDuel = null;
    if (d.gold) { game.inventory.gold += d.gold; game.run.goldEarned += d.gold; }
    if (d.component) addComponent(game, game.rng.pick(Object.values(ITEM).filter((i) => i.type === 'component' && i.cost <= 1400)).id);
    game.eventResult = d.gold ? `战斗胜利：+${d.gold} 金币` : '战斗胜利：获得一件配件';
    game.status = 'eventDone';
    return;
  }
  completeNode(game);
}

// ---------------------------------------------------------------- UI-facing actions
export const actions = {
  chooseCard, reroll, banish, buy, sell, enterNode, eventOption, restChoice, claimTreasure,
  eventDone(game) { game.eventResult = null; completeNode(game); },
  pause(game) { if (game.status === 'playing') { game.status = 'paused'; return true; } if (game.status === 'paused') { game.status = 'playing'; return true; } return false; },
  openShop(game) { if (game.status === 'playing') { game.status = 'shop'; return true; } return false; },
  closeShop(game) { if (game.status === 'shop') game.status = 'playing'; else if (game.status === 'shopNode') { game.consumableDiscount = 0; completeNode(game); } },
  swapSlots(game, a, b) { const s = game.skills.slots; [s[a], s[b]] = [s[b], s[a]]; },
};
export { SKILL, startStage, createStage };
