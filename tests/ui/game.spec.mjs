import { test, expect } from '@playwright/test';

function watchErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return errors;
}
async function startEndless(page, hero = 'knight') {
  await page.goto('/');
  await page.waitForFunction(() => window.__realmApi, null, { timeout: 60000 });
  await page.evaluate((hero) => window.__realmApi.startRun({ mode: 'endless', hero, difficulty: 'normal' }), hero);
  await page.waitForFunction(() => window.__realmApi.game?.status === 'playing', null, { timeout: 60000 });
}

test('title screen loads with the main menu and no errors', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await expect(page.locator('[data-act=play]')).toBeVisible({ timeout: 60000 });
  await expect(page.locator('[data-act=codex]')).toBeVisible();
  expect(errors).toEqual([]);
});

test('codex lists every enemy and the debuffs special enemies inflict', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await page.click('[data-act=codex]');
  await page.click('[data-sub=enemies]');
  await expect(page.locator('.codex-item')).toHaveCount(42);
  expect(await page.locator('.codex-item .dchips').count()).toBe(15);
  expect(errors).toEqual([]);
});

test('special enemies put their debuffs on the hero and the HUD shows them', async ({ page }) => {
  const errors = watchErrors(page);
  await startEndless(page);
  for (const [id, debuff, dist] of [['banshee', 'fear', 3.4], ['soul_wraith', 'tether', 6], ['chain_jailer', 'hooked', 9]]) {
    await page.evaluate(async ([id, dist]) => {
      const g = window.__realmApi.game;
      const { addEnemy } = await import('/src/game/enemies.js');
      g.caps.enemies = 0; g.enemies = g.enemies.filter((e) => e.boss); g.player.debuffs = {}; g.player.invuln = 0; g.player.hp = g.stats.maxHp; g.player.musou = 50;
      const e = addEnemy(g, id, g.player.x, g.player.z + dist, { noSpawnAnim: true }); e.abCd = 0; e.atkCd = 99;
    }, [id, dist]);
    await page.waitForFunction((d) => (window.__realmApi.game.player.debuffs[d]?.t || 0) > 0, debuff, { timeout: 5000 });
    await expect(page.locator(`.debuffs .debuff[data-id=${debuff}]`)).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('a time bomb shows its countdown and detonates', async ({ page }) => {
  const errors = watchErrors(page);
  await startEndless(page, 'barbarian');
  await page.evaluate(async () => {
    const g = window.__realmApi.game;
    const { applyDebuff } = await import('/src/game/debuffs.js');
    g.caps.enemies = 0; g.enemies = []; g.player.invuln = 0;
    applyDebuff(g, 'bomb', 1, { dmg: 40 });
  });
  await expect(page.locator('.bomb-count')).toBeVisible();
  await page.waitForFunction(() => !(window.__realmApi.game.player.debuffs.bomb?.t > 0), null, { timeout: 8000 });
  await expect(page.locator('.bomb-count')).toBeHidden();
  expect(errors).toEqual([]);
});
