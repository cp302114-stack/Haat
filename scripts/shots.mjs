// Dev helper: starts the server, walks the store in a real browser and saves screenshots to ./shots.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { chromium } from 'playwright-core';

const PORT = 3222;
const base = `http://localhost:${PORT}`;
fs.mkdirSync('shots', { recursive: true });

const server = spawn(process.execPath, ['server/index.js'], { env: { ...process.env, PORT: String(PORT) }, stdio: 'pipe' });
let log = '';
server.stdout.on('data', (d) => (log += d));
server.stderr.on('data', (d) => (log += d));
await new Promise((r) => setTimeout(r, 3500));

const browser = await chromium.launch({ channel: 'msedge' });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  const shot = (name, full = false) => page.screenshot({ path: `shots/${name}.png`, fullPage: full });

  await page.goto(base);
  await page.waitForSelector('#featured .card');
  await page.waitForTimeout(700);
  await shot('01-home');
  await shot('01b-home-full', true);

  await page.fill('#q', 'bluetoth');
  await page.waitForSelector('.suggest-row');
  await page.waitForTimeout(300);
  await shot('02-suggest');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  await page.goto(`${base}/#/search?q=bluetoth%20earphnes`);
  await page.waitForSelector('.card');
  await page.waitForTimeout(600);
  await shot('03-search-typo');

  await page.goto(`${base}/#/search?category=Fashion`);
  await page.waitForSelector('.card');
  await page.waitForTimeout(600);
  await shot('04-category');

  await page.click('.card .name a');
  await page.waitForSelector('.pdp');
  await page.waitForTimeout(500);
  await shot('05-product');

  await page.click('#add');
  await page.waitForTimeout(400);
  await page.click('#cart-btn');
  await page.waitForTimeout(500);
  await shot('06-cart');
  await page.click('.drawer-foot a');
  await page.waitForSelector('#form');
  await page.waitForTimeout(400);
  await shot('07-checkout');

  await page.click('#place');
  await page.waitForTimeout(300);
  await shot('08-checkout-errors');
  await page.fill('#name', 'Meera Iyer');
  await page.fill('#email', 'meera@example.com');
  await page.fill('#phone', '9876501234');
  await page.fill('#address', '22 Residency Road, Bengaluru 560025');
  await page.click('#place');
  await page.waitForSelector('.receipt');
  await page.waitForTimeout(2500);
  await shot('09-order');

  await page.goto(`${base}/#/ledger`);
  await page.waitForSelector('.svc-card');
  await page.waitForTimeout(500);
  await page.click('#run');
  await page.waitForSelector('.race-line');
  await page.waitForTimeout(1500);
  await shot('10-ledger', true);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base);
  await page.waitForSelector('#featured .card');
  await page.waitForTimeout(600);
  await shot('11-mobile-home');
  await page.goto(`${base}/#/search?category=Electronics`);
  await page.waitForSelector('.card');
  await page.waitForTimeout(500);
  await shot('12-mobile-search');
} catch (e) {
  errors.push('script: ' + e.message);
} finally {
  await browser.close();
  server.kill();
}
console.log(log.split('\n').slice(0, 6).join('\n'));
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no browser errors');
