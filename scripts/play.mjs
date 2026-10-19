// Dev playtest driver: node scripts/play.mjs [mode] [hero] [seconds] [outPrefix] [width] [height]
import { chromium } from '@playwright/test';
const [mode = 'endless', hero = 'knight', secs = '8', out = 'shot', w = '1400', h = '820', chapter = '1'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR ' + String(e.stack || e)));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
await page.goto('http://127.0.0.1:5190/');
await page.waitForFunction(() => window.__realmApi, null, { timeout: 60000 });
await page.screenshot({ path: `${out}-title.png` });
await page.evaluate(([mode, hero, chapter]) => window.__realmApi.startRun({ mode, hero, difficulty: 'normal', chapter: +chapter }), [mode, hero, chapter]);
await page.waitForFunction(() => window.__realmApi.game, null, { timeout: 60000 });
if (mode === 'adventure') { await page.waitForTimeout(500); await page.evaluate(() => { const g = window.__realmApi.game; const id = g.map.available[0]; document.querySelector('.mnode.avail')?.click(); }); }
const t0 = Date.now();
let shots = 0;
while (Date.now() - t0 < +secs * 1000) {
  const st = await page.evaluate(() => window.__realmApi.game.status);
  if (st === 'draft') await page.keyboard.press('Digit1');
  if (st === 'map') await page.evaluate(() => document.querySelector('.mnode.avail')?.click());
  const keys = ['KeyJ', 'KeyJ', 'KeyJ', 'KeyK', 'KeyU', 'KeyI', 'KeyL', 'Space'];
  await page.keyboard.down(['KeyW', 'KeyA', 'KeyS', 'KeyD'][Math.floor((Date.now() / 1500) % 4)]);
  for (const k of keys) { await page.keyboard.press(k); await page.waitForTimeout(60); }
  await page.keyboard.up('KeyW'); await page.keyboard.up('KeyA'); await page.keyboard.up('KeyS'); await page.keyboard.up('KeyD');
  if (Date.now() - t0 > (shots + 1) * (+secs * 1000 / 3)) { await page.screenshot({ path: `${out}-${shots}.png` }); shots++; }
}
await page.screenshot({ path: `${out}-end.png` });
const info = await page.evaluate(() => { const g = window.__realmApi.game; const r = window.__realmApi.renderer; return { status: g.status, kills: g.run.kills, level: g.run.level, enemies: g.enemies.length, hp: Math.round(g.player.hp), fps: null, stats: r.stats() }; });
console.log(JSON.stringify(info));
console.log(errors.slice(0, 25).join('\n'));
await browser.close();
