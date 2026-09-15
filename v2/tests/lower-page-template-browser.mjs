import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, firefox, webkit } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { startQaServer } from './qa-server.mjs';

const root = resolve(import.meta.dirname, '..');
const screenshots = resolve(root, 'qa-screenshots', 'lower-page-template');
mkdirSync(screenshots, { recursive: true });
const server = await startQaServer(root);
let checks = 0;
const check = (value, label) => { assert.ok(value, label); checks++; };
async function dockState(page, expected) {
  await page.waitForFunction(wanted => {
    const el = document.querySelector('#sticky-cta');
    const css = getComputedStyle(el);
    return (css.display !== 'none' && css.visibility !== 'hidden' && Number(css.opacity) > 0) === wanted;
  }, expected);
  checks++;
}
try {
  for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
    const browser = await engine.launch();
    try {
      for (const width of name === 'chromium' ? [320, 375, 768, 1280] : [375, 1280]) {
        const context = await browser.newContext({ viewport: { width, height: 800 }, reducedMotion: 'reduce' });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(server.origin + '/lower-page-template.html', { waitUntil: 'networkidle' });
        await dockState(page, false);
        check(await page.locator('[data-diagnosis-link]').evaluateAll(links => links.every(link => link.href === 'https://ai-shindan-zatuneya.netlify.app/' && !link.hasAttribute('aria-disabled'))), name + width + ' diagnosis hydrated');
        check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), name + width + ' no overflow');
        check(await page.locator('img').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0)), name + width + ' image loaded');
        // Exercise real IntersectionObserver reveals before a full-page capture.
        for (const reveal of await page.locator('.fade-in').all()) {
          await reveal.scrollIntoViewIfNeeded();
          await page.waitForFunction(el => el.classList.contains('is-visible'), await reveal.elementHandle());
        }
        check(await page.locator('.fade-in').evaluateAll(nodes => nodes.every(el => Number(getComputedStyle(el).opacity) === 1)), name + width + ' all sections revealed');
        await page.evaluate(() => window.scrollTo(0, 0));
        await dockState(page, false);
        if (name === 'chromium') await page.screenshot({ path: resolve(screenshots, 'template-' + width + '.png'), fullPage: true });
        await page.locator('#features').scrollIntoViewIfNeeded();
        await dockState(page, true);
        if (name === 'chromium' && [375, 1280].includes(width)) await page.screenshot({ path: resolve(screenshots, 'template-' + width + '-dock.png') });
        const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
        check(axe.violations.length === 0, name + width + ' axe: ' + JSON.stringify(axe.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))));
        const trigger = width < 1080 ? page.locator('#nav-hamburger') : page.locator('.site-nav__dropdown-trigger');
        await trigger.focus();
        await page.keyboard.press('Enter');
        check(await trigger.getAttribute('aria-expanded') === 'true', name + width + ' keyboard nav opens');
        await dockState(page, false);
        await page.keyboard.press('Escape');
        check(await trigger.getAttribute('aria-expanded') === 'false', name + width + ' Escape closes nav');
        const question = page.locator('.lp-faq-trigger').first();
        await question.focus();
        await page.keyboard.press('Enter');
        check(await question.getAttribute('aria-expanded') === 'true' && await page.locator('#lp-answer-1').isVisible(), name + width + ' FAQ Enter opens');
        check(await question.evaluate(el => getComputedStyle(el).outlineStyle !== 'none'), name + width + ' focus visible');
        await page.keyboard.press('Space');
        check(await question.getAttribute('aria-expanded') === 'false' && !await page.locator('#lp-answer-1').isVisible(), name + width + ' FAQ Space closes');
        await page.locator('#final-cta').scrollIntoViewIfNeeded();
        await dockState(page, false);
        check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), name + width + ' footer no overflow');
        check(errors.length === 0, name + width + ' no JS errors: ' + errors.join(', '));
        await context.close();
        console.log(name + ' ' + width + ': layout, diagnosis, nav, FAQ, sticky, axe PASS');
      }
    } finally { await browser.close(); }
  }
  console.log('Lower template browser: ' + checks + ' PASS; screenshots: ' + screenshots);
} finally { await server.close(); }
