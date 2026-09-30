import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, firefox, webkit } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { startQaServer } from './qa-server.mjs';

const root = resolve(import.meta.dirname, '..');
const visualOnly = process.argv.includes('--visual-only');
const pageArgs = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
const pages = pageArgs.length ? pageArgs : ['service-management.html'];
const shots = resolve(root, 'qa-screenshots', 'lower-pages-current');
mkdirSync(shots, { recursive: true });
const server = await startQaServer(root);
let checks = 0;
const check = (value, label) => { assert.ok(value, label); checks++; };
async function dock(page, visible) {
  await page.waitForFunction(expected => {
    const style = getComputedStyle(document.querySelector('#sticky-cta'));
    return (style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0) === expected;
  }, visible);
  checks++;
}
try {
  for (const [name, engine] of Object.entries(visualOnly ? { chromium } : { chromium, firefox, webkit })) {
    const browser = await engine.launch();
    try {
      for (const file of pages) for (const width of [375, 768, 1280]) {
        const context = await browser.newContext({ viewport: { width, height: 800 }, reducedMotion: 'reduce' });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        const response = await page.goto(server.origin + '/' + file, { waitUntil: 'networkidle' });
        check(response.status() === 200, file + ' HTTP 200');
        await dock(page, false);
        for (const reveal of await page.locator('.fade-in').all()) {
          await reveal.scrollIntoViewIfNeeded();
          await page.waitForFunction(el => el.classList.contains('is-visible'), await reveal.elementHandle());
        }
        await page.evaluate(() => scrollTo(0, 0));
        await dock(page, false);
        check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), file + width + ' no overflow');
        check(await page.locator('img').evaluateAll(images => images.every(img => img.complete && img.naturalWidth > 0)), file + ' images loaded');
        if (name === 'chromium') {
          await page.screenshot({ path: resolve(shots, file.replace('.html', '') + '-' + width + '.png'), fullPage: true });
          if (width === 375) {
            for (const [suffix, selector] of [['mid', file === 'service-training.html' ? '#courses' : 'main > section:nth-child(2)'], ['detail', file === 'service-training.html' ? '#course-guide' : 'main > section:nth-child(3)']]) {
              const section = page.locator(selector);
              if (await section.count()) {
                await section.evaluate(el => scrollTo({top:scrollY + el.getBoundingClientRect().top - 88, behavior:'instant'}));
                await page.waitForTimeout(200);
                await page.screenshot({ path: resolve(shots, file.replace('.html', '') + '-375-' + suffix + '.png') });
              }
            }
            await page.evaluate(() => scrollTo(0, 0));
          }
        }
        if (visualOnly) {
          const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
          check(result.violations.length === 0, file + width + ' axe ' + JSON.stringify(result.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))));
          check(errors.length === 0, file + ' no JS errors');
          await context.close();
          console.log(name + ' ' + file + ' ' + width + ': visual PASS');
          continue;
        }
        await page.locator('#features').scrollIntoViewIfNeeded();
        await dock(page, true);
        check(await page.locator('[data-diagnosis-link]').evaluateAll(links => links.every(link => link.href === 'https://ai-shindan-zatuneya.netlify.app/')), file + ' diagnosis links');
        const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
        check(result.violations.length === 0, file + name + width + ' axe ' + JSON.stringify(result.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))));
        const toggle = width < 1080 ? page.locator('#nav-hamburger') : page.locator('.site-nav__dropdown-trigger');
        await toggle.focus();
        await page.keyboard.press('Enter');
        check(await toggle.getAttribute('aria-expanded') === 'true', file + ' keyboard nav opens');
        await dock(page, false);
        await page.keyboard.press('Escape');
        check(await toggle.getAttribute('aria-expanded') === 'false', file + ' nav Escape closes');
        await page.locator('#final-cta').scrollIntoViewIfNeeded();
        await dock(page, false);
        check(errors.length === 0, file + ' no JS errors');
        await context.close();
        console.log(name + ' ' + file + ' ' + width + ': PASS');
      }
    } finally { await browser.close(); }
  }
  console.log('Current lower-page browser: ' + checks + ' PASS');
} finally { await server.close(); }
