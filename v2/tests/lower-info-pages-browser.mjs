import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { startQaServer } from './qa-server.mjs';

const root = resolve(import.meta.dirname, '..');
const allPages = ['faq', 'contact', 'privacy', 'tokusho', 'thank-you', '404', 'growth', 'tools'];
const pages = process.argv.slice(2).length ? process.argv.slice(2) : allPages;
assert.ok(pages.every(page => allPages.includes(page)), 'selected pages belong to information-page inventory');
const widths = [375, 768, 1280];
const axePages = new Set(['faq', 'contact', 'tokusho', 'thank-you']);
const shots = resolve(root, 'qa-screenshots', 'lower-info-pages');
mkdirSync(shots, { recursive: true });
const server = await startQaServer(root);
const browser = await chromium.launch();
let checks = 0;

try {
  for (const name of pages) {
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: 800 }, reducedMotion: 'reduce' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const response = await page.goto(`${server.origin}/${name}.html`, { waitUntil: 'domcontentloaded' });
      assert.equal(response.status(), 200, `${name} ${width}: HTTP`); checks++;
      await page.waitForTimeout(300);
      const overflow = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: innerWidth }));
      assert.ok(overflow.scroll <= overflow.inner, `${name} ${width}: overflow ${overflow.scroll}/${overflow.inner}`); checks++;
      assert.equal(errors.length, 0, `${name} ${width}: JS errors ${errors.join(', ')}`); checks++;
      await page.screenshot({ path: resolve(shots, `${name}-${width}.png`), fullPage: true });
      if (width === 375 && axePages.has(name)) {
        const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        assert.equal(result.violations.length, 0, `${name}: axe ${JSON.stringify(result.violations.map(v => ({ id: v.id, target: v.nodes.map(n => n.target) })))}`); checks++;
      }
      await context.close();
      console.log(`${name} ${width}: PASS`);
    }
  }
  console.log(`lower info browser: ${checks} PASS; screenshots: ${pages.length * widths.length}`);
} finally {
  await browser.close();
  await server.close();
}
