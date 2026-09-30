import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { chromium, firefox, webkit } from 'playwright';
import { startQaServer } from './qa-server.mjs';

const root = resolve(import.meta.dirname, '..');
const screenshots = join(root, 'qa-screenshots', 'ver5-lp');
mkdirSync(screenshots, { recursive: true });
const server = await startQaServer(root);
const ids = ['hero', 'problems', 'thinking', 'service', 'kaizen', 'jisso', 'choose', 'check', 'works', 'profile', 'price', 'faq', 'contact'];
let checks = 0;

try {
  for (const [name, browserType] of Object.entries({ chromium, firefox, webkit })) {
    const browser = await browserType.launch({ headless: true });
    try {
      for (const width of [375, 768, 1280]) {
        const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
        await page.goto(server.origin + '/index.html', { waitUntil: 'networkidle' });
        await page.evaluate(() => document.fonts.ready);
        assert.equal(await page.locator('main > section').count(), 13, name + '/' + width + ' section count');
        checks++;
        for (const id of ids) {
          assert.equal(await page.locator('#' + id).count(), 1, name + '/' + width + ' #' + id);
          checks++;
        }
        const overflow = await page.evaluate(() => ({
          document: document.documentElement.scrollWidth,
          viewport: innerWidth
        }));
        assert.ok(overflow.document <= overflow.viewport + 1, name + '/' + width + ' horizontal overflow ' + JSON.stringify(overflow));
        checks++;
        const links = await page.locator('a[href^="#"]').evaluateAll(elements => elements.map(element => element.getAttribute('href')).filter(Boolean));
        for (const href of links) {
          assert.equal(await page.locator(href).count(), 1, name + '/' + width + ' destination ' + href);
          checks++;
        }
        assert.equal(await page.locator('a[data-diagnosis-link][href="https://ai-shindan-zatuneya.netlify.app/"]').count() >= 4, true, name + '/' + width + ' diagnosis links');
        checks++;
        if (name === 'chromium') {
          for (const id of ids) {
            await page.locator('#' + id).scrollIntoViewIfNeeded();
            await page.waitForTimeout(75);
          }
          await page.evaluate(() => scrollTo(0, 0));
          await page.waitForTimeout(300);
          await page.screenshot({ path: join(screenshots, width + '.png'), fullPage: true });
        }
        await page.close();
      }
    } finally {
      await browser.close();
    }
  }
  console.log('Ver.5 LP browser checks PASS: ' + checks);
} finally {
  await server.close();
}
