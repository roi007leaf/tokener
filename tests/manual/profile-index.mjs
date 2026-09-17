import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

const defaults = JSON.parse(await readFile(path.join(homedir(), '.config', 'pf2e-visioner', 'live.json'), 'utf8'));
const url = (process.env.VISIONER_FOUNDRY_URL ?? defaults.url).replace(/\/$/, '');
const username = process.env.VISIONER_GM_USER ?? defaults.gm.username;
const password = process.env.VISIONER_GM_PASSWORD ?? defaults.gm.password;
const browser = await chromium.launch({ headless: process.env.VISIONER_HEADLESS === '1', channel: process.env.VISIONER_BROWSER_CHANNEL || undefined });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, ignoreHTTPSErrors: new URL(url).hostname === 'localhost' });
const page = await context.newPage();
page.setDefaultTimeout(90000);
try {
  await page.goto(`${url}/join`);
  const select = page.locator('select[name="userid"]');
  await page.locator('select[name="userid"], input[name="username"]').first().waitFor();
  if (await select.count()) {
    const options = await select.locator('option').evaluateAll(items => items.map(item => ({ label: item.textContent.trim(), value: item.value })));
    const account = options.find(item => item.label.toLowerCase() === username.trim().toLowerCase());
    if (!account) throw Error(`GM account not found: ${username}`);
    await select.selectOption(account.value);
  } else await page.locator('input[name="username"]').fill(username);
  await page.locator('input[name="password"]').fill(password);
  await page.locator('button[name="join"]').click();
  await page.waitForFunction(() => globalThis.game?.ready && globalThis.canvas?.ready && !canvas.loading);
  const measurements = [];
  for (let iteration = 0; iteration < 3; iteration++) {
    measurements.push(await page.evaluate(async () => {
      const api = game.modules.get('pf2e-tokener')?.api;
      if (!api?.rebuildIndex) throw Error('Tokener API unavailable');
      const longTasks = [];
      const observer = new PerformanceObserver(list => longTasks.push(...list.getEntries().map(entry => entry.duration)));
      observer.observe({ type: 'longtask' });
      const started = performance.now();
      const index = await api.rebuildIndex();
      const durationMs = performance.now() - started;
      await new Promise(resolve => setTimeout(resolve, 100));
      observer.disconnect();
      return { candidates: index.length, durationMs, longTasks, maxLongTaskMs: Math.max(0, ...longTasks) };
    }));
  }
  console.log(JSON.stringify({ world: await page.evaluate(() => game.world.id), measurements }, null, 2));
} finally {
  await context.close().catch(() => {});
  await browser.close().catch(() => {});
}
