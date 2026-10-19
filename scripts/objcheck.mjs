// Objective-stage screenshots (capture / defend / escape): node scripts/objcheck.mjs <outPrefix>
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 820 } });
const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://127.0.0.1:5190/');
await page.waitForFunction(() => window.__realmApi, null, { timeout: 60000 });
for (const obj of ['capture', 'defend', 'escape']) {
  await page.evaluate(async (obj) => {
    const api = window.__realmApi;
    await api.startRun({ mode: 'adventure', hero: 'knight', difficulty: 'normal', chapter: 2 });
    const g = api.game; const node = g.map.layers[0][0]; node.objective = obj;
    api.actions.enterNode(g, node.id); api.renderer.resetForStage(g); g.player.invuln = 99;
  }, obj);
  await page.waitForTimeout(4000);
  await page.screenshot({ path: process.argv[2] + `-${obj}.png` });
}
console.log(errors.join('\n') || 'ok');
await browser.close();
