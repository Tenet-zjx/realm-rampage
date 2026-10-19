// Frame-time benchmark: spawns a large crowd in an endless run and samples rAF frame times in headless Chrome.
// node scripts/benchmark.mjs [enemies=360] [seconds=12] [quality=high]
import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
const [count = '360', secs = '12'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://127.0.0.1:5190/');
await page.waitForFunction(() => window.__realmApi, null, { timeout: 60000 });
await page.evaluate(() => window.__realmApi.startRun({ mode: 'endless', hero: 'mage', difficulty: 'easy' }));
await page.waitForFunction(() => window.__realmApi.game, null, { timeout: 60000 });
const result = await page.evaluate(async ([count, secs]) => {
  const api = window.__realmApi, g = api.game;
  const { addEnemy } = await import('/src/game/enemies.js');
  const { addSkill } = await import('/src/game/draft.js');
  g.caps.enemies = +count + 40; g.player.invuln = 1e9;
  for (const id of ['fire_orbit', 'frost_field', 'storm_spark', 'holy_halo', 'nature_swarm', 'blade_swords']) for (let i = 0; i < 5; i++) addSkill(g, id);
  const ids = ['skel_minion', 'skel_warrior', 'skel_archer', 'skel_mage', 'vampire_bat', 'slime', 'lava_imp'];
  for (let i = 0; i < +count; i++) { const a = Math.random() * 6.28, d = 6 + Math.random() * 22; addEnemy(g, ids[i % ids.length], Math.sin(a) * d, Math.cos(a) * d, { noSpawnAnim: true, hpMult: 50 }); }
  await new Promise((r) => setTimeout(r, 2500));
  const times = []; let last = performance.now();
  await new Promise((resolve) => { const tick = (now) => { times.push(now - last); last = now; if (times.length < +secs * 60) requestAnimationFrame(tick); else resolve(); }; requestAnimationFrame(tick); });
  times.sort((a, b) => a - b);
  const avg = times.reduce((s, x) => s + x, 0) / times.length;
  return { enemies: g.enemies.length, frames: times.length, avgMs: +avg.toFixed(2), p50: +times[Math.floor(times.length / 2)].toFixed(2), p95: +times[Math.floor(times.length * 0.95)].toFixed(2), fps: +(1000 / avg).toFixed(1), renderer: api.renderer.stats() };
}, [count, secs]);
console.log(JSON.stringify(result, null, 1));
mkdirSync('docs/verification', { recursive: true });
writeFileSync('docs/verification/benchmark.json', JSON.stringify({ date: new Date().toISOString(), env: 'headless Google Chrome (ANGLE/Metal) on the dev Mac', ...result }, null, 1) + '\n');
console.log(errors.join('\n'));
await browser.close();
