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
        if (width <= 768) {
          await page.locator('#nav-hamburger').click();
          assert.equal(await page.locator('#nav-hamburger').getAttribute('aria-expanded'), 'true', name + '/' + width + ' hamburger opens');
          checks++;
        }
        const servicesMenu = page.locator('.site-nav__dropdown-trigger').first();
        await servicesMenu.click();
        assert.equal(await servicesMenu.getAttribute('aria-expanded'), 'true', name + '/' + width + ' service menu opens');
        checks++;
        await servicesMenu.click();
        assert.equal(await servicesMenu.getAttribute('aria-expanded'), 'false', name + '/' + width + ' service menu closes');
        checks++;
        if (width <= 768) {
          await page.locator('#nav-hamburger').click();
          assert.equal(await page.locator('#nav-hamburger').getAttribute('aria-expanded'), 'false', name + '/' + width + ' hamburger closes');
          checks++;
        }
        const faq = page.locator('#faq details').first();
        await faq.locator('summary').click();
        assert.equal(await faq.evaluate(element => element.open), true, name + '/' + width + ' FAQ opens');
        checks++;
        await faq.locator('summary').click();
        assert.equal(await faq.evaluate(element => element.open), false, name + '/' + width + ' FAQ closes');
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
      if (name === 'chromium') {
        for (const [pageName, anchor] of Object.entries({
          'services.html': 'service',
          'service-training.html': 'faq',
          'works.html': 'works',
          'faq.html': 'faq',
          'service-management.html': 'kaizen',
          'service-order.html': 'kaizen'
        })) {
          const redirectPage = await browser.newPage();
          await redirectPage.goto(server.origin + '/' + pageName, { waitUntil: 'domcontentloaded' });
          await redirectPage.waitForURL(server.origin + '/index.html#' + anchor, { timeout: 8000 });
          assert.equal(new URL(redirectPage.url()).hash, '#' + anchor, pageName + ' reaches intended anchor');
          checks++;
          await redirectPage.close();
        }
        for (const pageName of ['profile.html', 'contact.html', 'tokusho.html']) {
          for (const width of [375, 1280]) {
            const keptPage = await browser.newPage({ viewport: { width, height: 900 } });
            await keptPage.goto(server.origin + '/' + pageName, { waitUntil: 'networkidle' });
            assert.equal(await keptPage.locator('#site-nav').count(), 1, pageName + ' shared navigation');
            checks++;
            if (width === 375) {
              await keptPage.locator('#nav-hamburger').click();
              assert.equal(await keptPage.locator('#nav-hamburger').getAttribute('aria-expanded'), 'true', pageName + ' mobile menu');
              checks++;
            }
            const dropdown = keptPage.locator('.site-nav__dropdown-trigger').first();
            await dropdown.click();
            assert.equal(await dropdown.getAttribute('aria-expanded'), 'true', pageName + ' dropdown');
            checks++;
            await keptPage.close();
          }
        }
      }
    } finally {
      await browser.close();
    }
  }
  console.log('Ver.5 LP browser checks PASS: ' + checks);
} finally {
  await server.close();
}
