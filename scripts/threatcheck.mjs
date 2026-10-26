// Visual QA for special enemies and hero debuffs (needs `npm run dev`).
// node scripts/threatcheck.mjs <outPrefix> [enemyIds,...] [w h]
// For each enemy: spawn it a few metres from the hero with its ability ready, wait, screenshot.
import { chromium } from '@playwright/test';
const [out, list = 'web_spider,venom_spider,soul_wraith,banshee,basilisk,frost_lizard,myconid,dire_wolf,hex_doctor,nullifier,chain_jailer,bomber,time_warden,acid_slime,shadow_bat', w = '1400', h = '820'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e.stack || e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`${m.type()}: ${m.text()}`); });
await page.goto('http://127.0.0.1:5190/');
await page.waitForFunction(() => window.__realmApi, null, { timeout: 60000 });
await page.evaluate(() => window.__realmApi.startRun({ mode: 'endless', hero: 'knight', difficulty: 'normal' }));
await page.waitForFunction(() => window.__realmApi.game, null, { timeout: 60000 });
await page.waitForTimeout(3000);
const WAIT = { basilisk: 1900, soul_wraith: 1700, banshee: 1100, chain_jailer: 900, bomber: 1700, myconid: 1100, time_warden: 1300, hex_doctor: 1300, nullifier: 1000, web_spider: 1400, frost_lizard: 1200, venom_spider: 1100 };
let i = 0;
for (const id of list.split(',').filter(Boolean)) {
  await page.evaluate(async (id) => {
    const g = window.__realmApi.game;
    const { addEnemy } = await import('/src/game/enemies.js');
    g.caps.enemies = 0;
    for (const e of g.enemies) if (!e.boss) { e.dying = true; e.dead = true; }
    g.enemies = g.enemies.filter((e) => !e.dead); g.hazards = []; g.player.debuffs = {}; g.player.gaze = 0;
    g.player.hp = g.stats.maxHp; g.player.invuln = 0; g.player.musou = 60;
    const p = g.player, n = id === 'dire_wolf' || id === 'shadow_bat' ? 4 : 1;
    for (let k = 0; k < n; k++) {
      const a = 0.5 + k * 0.5, d = { chain_jailer: 9, bomber: 7, hex_doctor: 9, time_warden: 8, web_spider: 7, frost_lizard: 7, basilisk: 6, soul_wraith: 6 }[id] || 3.4;
      const e = addEnemy(g, id, p.x + Math.sin(a) * d, p.z + Math.cos(a) * d, { noSpawnAnim: true });
      e.abCd = 0; e.atkCd = id === 'acid_slime' || id === 'shadow_bat' || id === 'dire_wolf' || id === 'frost_lizard' || id === 'web_spider' || id === 'bomber' || id === 'hex_doctor' ? 0 : 99;
    }
  }, id);
  await page.waitForTimeout(WAIT[id] || 1200);
  await page.screenshot({ path: `${out}-${String(i++).padStart(2, '0')}-${id}.png` });
}
// HUD stress: many debuffs at once
await page.evaluate(async () => {
  const g = window.__realmApi.game;
  const { applyDebuff } = await import('/src/game/debuffs.js');
  for (const e of g.enemies) e.hp = 0;
  g.player.debuffs = {};
  applyDebuff(g, 'poison', 6); applyDebuff(g, 'bleed', 3); applyDebuff(g, 'corrode', 2); applyDebuff(g, 'webbed', 2); applyDebuff(g, 'bomb', 1, { dmg: 10 }); applyDebuff(g, 'silence', 4); applyDebuff(g, 'blind', 3);
  g.player.gaze = 0.6;
});
await page.waitForTimeout(500);
await page.screenshot({ path: `${out}-${String(i++).padStart(2, '0')}-hud.png` });
console.log(errors.slice(0, 20).join('\n') || 'no console errors');
await browser.close();
