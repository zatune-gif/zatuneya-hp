import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { chromium, firefox, webkit } from 'playwright';
import { startQaServer } from './qa-server.mjs';

const root = resolve(import.meta.dirname, '..');
const viewports = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 900 }
];
const browsers = [
  ['Chromium', chromium],
  ['Firefox', firefox],
  ['WebKit', webkit]
];

async function assertNoHorizontalScroll(page, label) {
  const measurements = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth
  }));
  assert.ok(
    measurements.scrollWidth <= measurements.viewportWidth + 1,
    `${label}: horizontal overflow (${measurements.scrollWidth}px > ${measurements.viewportWidth}px)`
  );
}

async function assertV3StylesApplied(page, label) {
  const ink = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--ink').trim().toLowerCase()
  );
  assert.equal(ink, '#173f46', `${label}: V3 stylesheet is applied before layout measurement`);
}

async function exerciseInteractions(page, viewport, label) {
  const hamburger = page.locator('#nav-hamburger');
  const navigation = page.locator('#site-nav');
  const dropdown = page.locator('.site-nav__dropdown-trigger').first();

  if (viewport.width <= 768) {
    assert.equal(await hamburger.isVisible(), true, `${label}: mobile menu control is visible`);
    await hamburger.click();
    assert.equal(await hamburger.getAttribute('aria-expanded'), 'true', `${label}: hamburger opens`);
    assert.equal(await navigation.evaluate(node => node.classList.contains('is-open')), true, `${label}: navigation opens`);
  } else {
    assert.equal(await hamburger.isVisible(), false, `${label}: desktop menu control is hidden`);
  }

  assert.equal(await dropdown.isVisible(), true, `${label}: dropdown control is visible`);
  await dropdown.click();
  assert.equal(await dropdown.getAttribute('aria-expanded'), 'true', `${label}: dropdown opens`);
  await page.keyboard.press('Escape');
  assert.equal(await dropdown.getAttribute('aria-expanded'), 'false', `${label}: Escape closes dropdown`);

  const faqTrigger = page.locator('#faq .faq-trigger').first();
  const answerId = await faqTrigger.getAttribute('aria-controls');
  assert.ok(answerId, `${label}: FAQ trigger controls an answer`);
  const answer = page.locator(`#${answerId}`);
  await faqTrigger.click();
  assert.equal(await faqTrigger.getAttribute('aria-expanded'), 'true', `${label}: FAQ opens`);
  assert.equal(await answer.isHidden(), false, `${label}: FAQ answer is shown`);
  await faqTrigger.click();
  assert.equal(await faqTrigger.getAttribute('aria-expanded'), 'false', `${label}: FAQ closes`);
  assert.equal(await answer.isHidden(), true, `${label}: FAQ answer is hidden`);
}

const server = await startQaServer(root);
let checks = 0;
const failures = [];
try {
  for (const [browserName, browserType] of browsers) {
    const browser = await browserType.launch({ headless: true });
    try {
      for (const viewport of viewports) {
        const label = `${browserName} ${viewport.width}px`;
        const context = await browser.newContext({ viewport });
        try {
          try {
            const page = await context.newPage();
            const response = await page.goto(`${server.origin}/index.html`, { waitUntil: 'load' });
            assert.equal(response?.status(), 200, `${label}: index returns HTTP 200`);
            await assertV3StylesApplied(page, label);
            await assertNoHorizontalScroll(page, label);
            await exerciseInteractions(page, viewport, label);
            await assertNoHorizontalScroll(page, `${label} after interactions`);
            checks += 1;
            console.log(`PASS cross-browser ${label}`);
          } catch (error) {
            failures.push(`${label}: ${error.message}`);
            console.error(`FAIL cross-browser ${label}: ${error.message}`);
          }
        } finally {
          await context.close();
        }
      }
    } finally {
      await browser.close();
    }
  }
} finally {
  await server.close();
}

if (failures.length > 0) {
  assert.fail(`cross-browser found ${failures.length} failure(s):\n${failures.join('\n')}`);
}

console.log(`PASS cross-browser ${checks} browser/viewport checks`);
