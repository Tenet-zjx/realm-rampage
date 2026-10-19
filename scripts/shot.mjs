// Screenshot helper: node scripts/shot.mjs <url> <out.png> [width height] [waitMs]
import { chromium } from '@playwright/test';
const [url, out, w = '1400', h = '900', wait = '1500'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
await page.goto(url);
await page.waitForFunction(() => window.__viewerReady || window.__shotReady, null, { timeout: 60000 }).catch(() => errors.push('ready flag timeout'));
await page.waitForTimeout(+wait);
await page.screenshot({ path: out });
if (errors.length) console.log(errors.slice(0, 20).join('\n'));
await browser.close();
