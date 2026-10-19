// Visual QA: start an endless run, grant skills, cast them, screenshot. node scripts/vfxcheck.mjs <out> <skillIds,...> [hero] [bossId]
import { chromium } from '@playwright/test';
const [out, list, hero = 'mage', boss = '', w = '1400', h = '820'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e.stack || e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`${m.type()}: ${m.text()}`); });
await page.goto('http://127.0.0.1:5190/');
await page.waitForFunction(() => window.__realmApi, null, { timeout: 60000 });
await page.evaluate((hero) => window.__realmApi.startRun({ mode: 'endless', hero, difficulty: 'easy' }), hero);
await page.waitForFunction(() => window.__realmApi.game, null, { timeout: 60000 });
await page.waitForTimeout(3500);
const ids = list.split(',').filter(Boolean);
let i = 0;
for (const id of ids) {
  await page.evaluate(async ([id, boss]) => {
    const api = window.__realmApi, g = api.game;
    const { addSkill } = await import('/src/game/draft.js');
    const { castSkill } = await import('/src/game/skills.js');
    const { SKILL } = await import('/src/game/content/skills.js');
    g.player.invuln = 99;
    if (!g.skills.owned.has(id)) { if (SKILL[id].kind === 'active') g.skills.slots[0] = null; addSkill(g, id); }
    for (let k = 0; k < 4; k++) addSkill(g, id);
    g.recomputeStats();
    if (boss && !g.bosses.length) { const { spawnBoss } = await import('/src/game/director.js'); spawnBoss(g, boss); }
    if (SKILL[id].kind === 'active') { g.skills.owned.get(id).cd = 0; castSkill(g, id); }
  }, [id, boss]);
  await page.waitForTimeout(SKILL_WAIT(id));
  await page.screenshot({ path: `${out}-${i++}-${id}.png` });
}
function SKILL_WAIT(id) { return /meteor|sunstrike|hammer|rite|zero|fury|wrath|cataclysm/.test(id) ? 900 : /field|cloud|blackhole|chrono|orbit|swords|swarm|ward|trail|mist|thorns|halo/.test(id) ? 1300 : 350; }
console.log(errors.slice(0, 20).join('\n'));
await browser.close();
