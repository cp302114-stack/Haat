// Dev helper: proves the stock tag on an open page changes when another buyer checks out.
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';

const PORT = 3223;
const base = `http://localhost:${PORT}`;
const server = spawn(process.execPath, ['server/index.js'], { env: { ...process.env, PORT: String(PORT), DATABASE_URL: '', KAFKA_BROKERS: '', OPENSEARCH_URL: '' }, stdio: 'pipe' });
await new Promise((r) => setTimeout(r, 3500));

const browser = await chromium.launch({ channel: 'msedge' });
let code = 0;
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const meta = await (await fetch(`${base}/api/meta`)).json();
  await page.goto(`${base}/#/product/${meta.race.productId}`);
  await page.waitForSelector('.stock.lg');
  const read = () => page.$eval('.stock.lg', (el) => el.textContent);

  const before = await read();
  await fetch(`${base}/api/demo/race?buyers=2&units=1`, { method: 'POST' });
  await page.waitForFunction(() => document.querySelector('.stock.lg')?.textContent === 'Sold out', null, { timeout: 5000 });
  const after = await read();
  const disabled = await page.$eval('#add', (b) => b.disabled);
  console.log(`tag before race: "${before}" -> after: "${after}", add button disabled: ${disabled}`);
  if (after !== 'Sold out' || !disabled) code = 1;

  // switch city from the header and check the page re-reads stock for the new city
  await page.click('#city-btn');
  await page.click('.city-opt[data-city="Delhi"]');
  await page.waitForFunction(() => document.querySelector('.stock.lg')?.dataset.city === 'Delhi');
  console.log('city switch ->', await page.$eval('.stock.lg', (el) => `${el.dataset.city}: ${el.textContent}`));
} catch (e) {
  console.log('FAIL', e.message);
  code = 1;
} finally {
  await browser.close();
  server.kill();
}
process.exit(code);
