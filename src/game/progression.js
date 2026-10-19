// Out-of-run profile logic (pure): account XP/levels, talents, meta shop, heroes, mastery, achievements, codex, settlement.
import { ACCOUNT, TALENTS, TALENT, TALENT_LINES, MASTERY, ACHIEVEMENTS } from './content/meta.js';
import { HEROES, HERO } from './content/heroes.js';
import { META_ITEMS } from './content/items.js';
import { CHAPTERS } from './content/stages.js';
import { DIFFICULTY } from './content/difficulties.js';

export const PROFILE_VERSION = 1;

export function createProfile() {
  return {
    version: PROFILE_VERSION, gold: 800, accountXp: 0, accountLevel: 1, talents: [],
    heroes: Object.fromEntries(HEROES.map((h) => [h.id, { unlocked: !h.unlock, xp: 0, mastery: 1, skin: 0 }])),
    metaInv: {}, loadout: [], achievements: {}, titles: [], title: null,
    stats: { runs: 0, totalKills: 0, bestEndlessWave: 0, dailyDone: 0, dailyLast: '', chapterClears: {}, heroClears: {}, maxCombo: 0, bestKills: 0 },
    codex: { skills: [], enemies: [], items: [] },
    settings: { quality: 'auto', shake: 1, numbers: true, music: 0.5, sfx: 0.8, aimAssist: true },
    lastHero: 'knight', lastDifficulty: 'normal',
  };
}

/** Migrate older saves forward (fills new fields, keeps progress). */
export function migrateProfile(p) {
  const base = createProfile();
  if (!p || typeof p !== 'object') return base;
  const out = { ...base, ...p, stats: { ...base.stats, ...(p.stats || {}) }, settings: { ...base.settings, ...(p.settings || {}) }, codex: { ...base.codex, ...(p.codex || {}) } };
  out.heroes = { ...base.heroes };
  for (const id in p.heroes || {}) out.heroes[id] = { ...base.heroes[id], ...p.heroes[id] };
  out.version = PROFILE_VERSION;
  return out;
}

export const talentPointsTotal = (p) => Math.floor(p.accountLevel / ACCOUNT.talentPointEvery);
export const talentPointsSpent = (p) => p.talents.reduce((s, id) => s + (TALENT[id]?.points || 0), 0);
export const talentPointsFree = (p) => talentPointsTotal(p) - talentPointsSpent(p);

export function canBuyTalent(p, id) {
  const t = TALENT[id];
  if (!t || p.talents.includes(id)) return { ok: false, reason: '已点亮' };
  if (t.index > 0 && !p.talents.includes(`t_${t.line}_${t.index - 1}`)) return { ok: false, reason: '需要先点亮上一个节点' };
  if (p.gold < t.cost) return { ok: false, reason: '金币不足' };
  if (t.points > talentPointsFree(p)) return { ok: false, reason: `需要 ${t.points} 个天赋点（每 5 级获得 1 点）` };
  return { ok: true };
}
export function buyTalent(p, id) {
  const c = canBuyTalent(p, id); if (!c.ok) return c;
  p.gold -= TALENT[id].cost; p.talents.push(id);
  return { ok: true };
}

export function buyMeta(p, id) {
  const it = META_ITEMS.find((m) => m.id === id);
  if (!it) return { ok: false, reason: '未知道具' };
  if (p.gold < it.cost) return { ok: false, reason: '金币不足' };
  p.gold -= it.cost; p.metaInv[id] = (p.metaInv[id] || 0) + 1;
  return { ok: true };
}
export function toggleLoadout(p, id) {
  const i = p.loadout.indexOf(id);
  if (i >= 0) { p.loadout.splice(i, 1); return { ok: true }; }
  if (p.loadout.length >= 3) return { ok: false, reason: '最多携带 3 件' };
  if (!(p.metaInv[id] > 0)) return { ok: false, reason: '库存不足' };
  p.loadout.push(id); return { ok: true };
}
/** Consume the loadout when a run starts; returns the item ids taken. */
export function consumeLoadout(p) {
  const taken = [];
  for (const id of p.loadout) if (p.metaInv[id] > 0) { p.metaInv[id]--; taken.push(id); }
  p.loadout = p.loadout.filter((id) => p.metaInv[id] > 0);
  return taken;
}

export function unlockHero(p, id) {
  const h = HERO[id];
  if (!h?.unlock || p.heroes[id].unlocked) return { ok: false, reason: '已解锁' };
  if (p.gold < h.unlock.cost) return { ok: false, reason: '金币不足' };
  p.gold -= h.unlock.cost; p.heroes[id].unlocked = true;
  return { ok: true };
}

export function chapterUnlocked(p, chapterId) {
  if (chapterId === 1) return true;
  const ch = CHAPTERS.find((c) => c.id === chapterId);
  if (ch?.hidden) return (p.stats.chapterClears[5] || []).some((d) => d === 'hard' || d === 'hell');
  return (p.stats.chapterClears[chapterId - 1] || []).length > 0;
}

export function addAccountXp(p, xp) {
  let gained = 0;
  p.accountXp += xp;
  while (p.accountLevel < ACCOUNT.maxLevel && p.accountXp >= ACCOUNT.xpFor(p.accountLevel)) { p.accountXp -= ACCOUNT.xpFor(p.accountLevel); p.accountLevel++; gained++; }
  return gained;
}
export function addMasteryXp(p, heroId, xp) {
  const h = p.heroes[heroId]; let gained = 0; const unlocks = [];
  h.xp += xp;
  while (h.mastery < MASTERY.maxLevel && h.xp >= MASTERY.xpFor(h.mastery)) { h.xp -= MASTERY.xpFor(h.mastery); h.mastery++; gained++; if (MASTERY.unlocks[h.mastery]) unlocks.push(MASTERY.unlocks[h.mastery].text); }
  return { gained, unlocks };
}

/** Meta inputs passed into createGame. */
export function metaFor(p, heroId, extra = {}) {
  const flags = {};
  for (const id of p.talents) Object.assign(flags, TALENT[id]?.flags || {});
  return { accountLevel: p.accountLevel, talents: p.talents.slice(), mastery: p.heroes[heroId]?.mastery || 1, skin: p.heroes[heroId]?.skin || 0, flags, ...extra };
}

function achievementMet(cond, ctx) {
  const [k, v] = Object.entries(cond)[0];
  switch (k) {
    case 'runs': return ctx.p.stats.runs >= v;
    case 'runKills': return ctx.run.kills >= v;
    case 'totalKills': return ctx.p.stats.totalKills >= v;
    case 'maxCombo': return ctx.run.maxCombo >= v;
    case 'chapterClear': return ctx.chapterClear === v;
    case 'clearDifficulty': return !!ctx.chapterClear && ctx.difficulty === v;
    case 'clearDifficultyChapter': return ctx.chapterClear === v[1] && ctx.difficulty === v[0];
    case 'endlessWave': return ctx.wave >= v;
    case 'dailyDone': return ctx.p.stats.dailyDone >= v;
    case 'awaken': return ctx.run.awakened >= v;
    case 'triad': return ctx.run.triads >= v;
    case 'synergies': return ctx.run.synergyMax >= v;
    case 'evolves': return ctx.run.evolves >= v;
    case 'arcana': return ctx.run.arcana >= v;
    case 'artifact': return ctx.run.artifacts >= v;
    case 'crafts': return ctx.run.crafts >= v;
    case 'runGold': return ctx.run.goldEarned >= v;
    case 'neutralTier': return ctx.run.neutralTier5 >= 1;
    case 'runes': return ctx.run.runes >= v;
    case 'musous': return ctx.run.musous >= v;
    case 'trueMusou': return ctx.run.trueMusous >= v;
    case 'officers': return ctx.run.officers >= v;
    case 'perfectBoss': return ctx.run.perfectBoss >= v;
    case 'fastBoss': return ctx.run.fastBoss >= 1;
    case 'heroesUnlocked': return Object.values(ctx.p.heroes).filter((h) => h.unlocked).length >= v;
    case 'mastery': return Object.values(ctx.p.heroes).some((h) => h.mastery >= v);
    case 'accountLevel': return ctx.p.accountLevel >= v;
    case 'talents': return ctx.p.talents.length >= v;
    case 'codex': return ctx.p.codex.skills.length + ctx.p.codex.enemies.length + ctx.p.codex.items.length >= v;
    case 'heroClears': return Object.keys(ctx.p.stats.heroClears).length >= v;
    case 'summons': return ctx.run.maxSummons >= v;
    case 'clutchBoss': return ctx.run.clutchBoss >= v;
    default: return false;
  }
}

export function checkAchievements(p, ctx) {
  const unlocked = [];
  for (const a of ACHIEVEMENTS) {
    if (p.achievements[a.id]) continue;
    if (achievementMet(a.cond, { ...ctx, p })) {
      p.achievements[a.id] = Date.now();
      p.gold += a.reward.gold || 0;
      if (a.reward.title) p.titles.push(a.reward.title);
      unlocked.push(a);
    }
  }
  return unlocked;
}

/** Apply a finished run to the profile; returns a settlement summary for the results screen. */
export function settleRun(p, game) {
  const run = game.run, diff = DIFFICULTY[game.diff.id];
  const chapterClear = game.mode === 'adventure' && game.status === 'chapterClear' ? game.chapter.id : 0;
  const wave = game.mode === 'endless' ? game.wave : 0;
  const daily = game.mode === 'daily' && game.status === 'won';
  const settleMult = diff.reward * (1 + (game.stats?.settleGold || 0));
  let gold = run.goldEarned * 0.22 + run.kills * 0.15;
  if (chapterClear) gold += 450 * chapterClear;
  if (wave) gold += wave * 55;
  if (daily) gold += 600;
  gold = Math.round(gold * settleMult);
  let xp = Math.round((run.kills * 0.9 + run.level * 25 + (chapterClear ? 600 * chapterClear : 0) + wave * 40 + (daily ? 500 : 0)) * diff.reward);
  const masteryXp = Math.round((run.kills * 0.5 + (chapterClear ? 450 * chapterClear : 0) + wave * 30) * diff.reward);
  p.gold += gold;
  const levels = addAccountXp(p, xp);
  const mastery = addMasteryXp(p, game.hero.id, masteryXp);
  p.stats.runs++; p.stats.totalKills += run.kills; p.stats.maxCombo = Math.max(p.stats.maxCombo, run.maxCombo); p.stats.bestKills = Math.max(p.stats.bestKills, run.kills);
  const records = [];
  if (wave > p.stats.bestEndlessWave) { p.stats.bestEndlessWave = wave; records.push(`无尽最高波次 ${wave}`); }
  if (chapterClear) {
    const list = (p.stats.chapterClears[chapterClear] ||= []);
    if (!list.includes(diff.id)) { list.push(diff.id); records.push(`首次在「${diff.name}」通关第 ${chapterClear} 章`); }
    p.stats.heroClears[game.hero.id] = true;
  }
  if (daily && p.stats.dailyLast !== game.daily?.date) { p.stats.dailyDone++; p.stats.dailyLast = game.daily?.date; }
  // codex
  for (const k of ['skills', 'enemies', 'items']) { const set = new Set(p.codex[k]); for (const id of game.codexSeen[k]) set.add(id); p.codex[k] = [...set]; }
  const achievements = checkAchievements(p, { run, chapterClear, difficulty: diff.id, wave });
  return { gold, xp, levels, mastery, records, achievements, kills: run.kills, level: run.level, chapterClear, wave, daily, maxCombo: run.maxCombo, time: game.time, win: !!game.result?.win };
}

export { TALENTS, TALENT_LINES, ACHIEVEMENTS, META_ITEMS, ACCOUNT, MASTERY };
