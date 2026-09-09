import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { startQaServer } from './qa-server.mjs';

function luminance(rgb) {
  const channels = rgb.match(/[\d.]+/g).slice(0, 3).map(Number).map((value) => value / 255)
    .map((value) => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
function contrast(foreground, background) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
async function colors(locator) {
  return locator.evaluate((element) => { const style = getComputedStyle(element); return [style.color, style.backgroundColor]; });
}
function assertAa([foreground, background], label) {
  const ratio = contrast(foreground, background);
  assert.ok(ratio >= 4.5, `${label}: ${foreground} on ${background} = ${ratio.toFixed(3)}:1`);
  console.log(`CONTRAST ${label}: ${ratio.toFixed(3)}:1`);
}

const server = await startQaServer(resolve(import.meta.dirname, '..'));
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`${server.origin}/404.html`, { waitUntil: 'domcontentloaded' });
  const button = page.locator('.btn-teal').first();
  assert.deepEqual(await button.evaluate((element) => ({ hover: element.matches(':hover'), focus: element.matches(':focus'), active: element.matches(':active') })), { hover: false, focus: false, active: false });
  assertAa(await colors(button), '404 btn-teal normal');
  await button.hover(); assert.equal(await button.evaluate((element) => element.matches(':hover')), true); assertAa(await colors(button), '404 btn-teal hover');
  await page.mouse.move(1, 1); await button.focus();
  assert.deepEqual(await button.evaluate((element) => ({ hover: element.matches(':hover'), focus: element.matches(':focus') })), { hover: false, focus: true });
  assertAa(await colors(button), '404 btn-teal focus');
  const box = await button.boundingBox(); assert.ok(box); await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  assert.equal(await button.evaluate((element) => element.matches(':active')), true);
  assertAa(await colors(button), '404 btn-teal active'); await page.mouse.up();
  await page.goto(`${server.origin}/service-training.html`, { waitUntil: 'domcontentloaded' });
  assertAa(await colors(page.locator('.process-item.last .process-num')), 'service final process marker');
  await page.close();
} finally { await browser.close(); await server.close(); }
console.log('PASS computed contrast states browser contract');
