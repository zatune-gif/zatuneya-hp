import assert from 'node:assert/strict';
import { chromium, firefox, webkit } from 'playwright';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { startQaServer } from './qa-server.mjs';
import { diagnosisUrl, existingLowerPages, managedPages } from './v3-lower-pages-fixture.mjs';

const root = resolve(import.meta.dirname, '..');
const widths = [375, 768, 1280];
const browserTypes = { chromium, firefox, webkit };
const taskBOnly = process.argv.slice(2).includes('--task-b-only');
const pagesUnderTest = taskBOnly ? ['index.html', ...existingLowerPages] : managedPages;
assert.equal(new Set(pagesUnderTest).size, pagesUnderTest.length, 'browser page inventory has no duplicates');
for (const filename of pagesUnderTest) assert.ok(existsSync(resolve(root, filename)), `required browser page exists: ${filename}`);
const failures = [];
let checks = 0;
async function check(label, operation) { checks += 1; try { await operation(); } catch (error) { failures.push(`${label}: ${error.message}`); } }

async function inspectCell(browser, browserName, width, filename, origin) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  const scope = `${browserName}/${width}/${filename}`;
  try {
    const response = await page.goto(`${origin}/${filename}`, { waitUntil: 'domcontentloaded' });
    await check(`${scope} HTTP 200`, () => assert.equal(response?.status(), 200));
    if (response?.status() !== 200) return;
    await check(`${scope} loads top-comp.css once`, async () => assert.equal(await page.locator('link[rel="stylesheet"][href*="top-comp.css"]').count(), 1));
    await check(`${scope} no horizontal overflow`, async () => {
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.ok(overflow <= 1, `horizontal overflow is ${overflow}px`);
    });
    await check(`${scope} no console errors`, () => assert.deepEqual(consoleErrors, []));
    await check(`${scope} no page errors`, () => assert.deepEqual(pageErrors, []));
  } finally {
    await page.evaluate(() => sessionStorage.clear()).catch(() => {});
    await context.close();
  }
}

async function verifyInteraction(browser, browserName, width, origin) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(5_000);
  const scope = `${browserName}/${width}/services.html interaction`;
  try {
    await page.goto(`${origin}/services.html`, { waitUntil: 'domcontentloaded' });
    if (width <= 768) {
      await check(`${scope} mobile nav`, async () => {
        assert.equal(await page.locator('html').evaluate((element) => element.classList.contains('js-nav')), true);
        assert.equal(await page.locator('#site-nav').evaluate((element) => getComputedStyle(element).display), 'none');
        await page.locator('#nav-hamburger').click();
        await page.waitForFunction(() => document.querySelector('#nav-hamburger')?.getAttribute('aria-expanded') === 'true');
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => document.querySelector('#nav-hamburger')?.getAttribute('aria-expanded') === 'false');
      });
    } else {
      await check(`${scope} desktop dropdown`, async () => {
        const trigger = page.locator('.site-nav__dropdown-trigger').first();
        await trigger.focus();
        await page.keyboard.press('Enter');
        await page.waitForFunction(() => document.querySelector('.site-nav__dropdown-trigger')?.getAttribute('aria-expanded') === 'true');
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => document.querySelector('.site-nav__dropdown-trigger')?.getAttribute('aria-expanded') === 'false');
      });
    }
    await check(`${scope} diagnosis hydration`, async () => {
      const states = await page.locator('a[data-diagnosis-link]').evaluateAll((links) => links.map((link) => ({ href: link.getAttribute('href'), disabled: link.getAttribute('aria-disabled') })));
      assert.ok(states.length > 0 && states.every(({ href, disabled }) => href === diagnosisUrl && disabled === null));
    });
    await check(`${scope} sticky visible then closed`, async () => {
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForFunction(() => {
        const sticky = document.querySelector('#sticky-cta');
        if (!sticky) return false;
        const style = getComputedStyle(sticky);
        return sticky.classList.contains('is-after-hero') && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0;
      });
      await page.locator('#sticky-cta-close').click();
      await page.waitForFunction(() => {
        const sticky = document.querySelector('#sticky-cta');
        if (!sticky?.classList.contains('is-closed')) return false;
        const style = getComputedStyle(sticky);
        return sticky.hidden || style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0;
      });
    });
  } finally { await context.close(); }
}

async function verifyWithoutJavaScript(browser, browserName, width, origin) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, javaScriptEnabled: false });
  const page = await context.newPage();
  const scope = `${browserName}/${width}/services.html no-JS`;
  try {
    const response = await page.goto(`${origin}/services.html`, { waitUntil: 'domcontentloaded' });
    await check(`${scope} HTTP 200`, () => assert.equal(response?.status(), 200));
    await check(`${scope} header visible`, async () => assert.equal(await page.locator('.comp-header').evaluate((element) => getComputedStyle(element).visibility !== 'hidden' && Number(getComputedStyle(element).opacity) > 0), true));
    await check(`${scope} navigation visible`, async () => assert.equal(await page.locator('#site-nav').evaluate((element) => { const style = getComputedStyle(element); const rect = element.getBoundingClientRect(); return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0 && rect.width > 0 && rect.height > 0; }), true));
    await check(`${scope} navigation links visible and focusable`, async () => {
      const links = page.locator('#site-nav a[href]');
      assert.ok(await links.count() >= 5);
      for (let index = 0; index < await links.count(); index += 1) assert.equal(await links.nth(index).evaluate((element) => { const rect = element.getBoundingClientRect(); return rect.width > 0 && rect.height > 0 && getComputedStyle(element).display !== 'none'; }), true);
      await links.first().focus();
      assert.equal(await links.first().evaluate((element) => document.activeElement === element), true);
    });
    await check(`${scope} diagnosis links remain visibly disabled`, async () => {
      const states = await page.locator('a[data-diagnosis-link]').evaluateAll((links) => links.map((link) => ({ href: link.getAttribute('href'), disabled: link.getAttribute('aria-disabled'), opacity: Number(getComputedStyle(link).opacity) })));
      assert.ok(states.length > 0 && states.every(({ href, disabled, opacity }) => href === null && disabled === 'true' && opacity < 1));
    });
  } finally { await context.close(); }
}

const server = await startQaServer(root);
try {
  for (const [browserName, browserType] of Object.entries(browserTypes)) {
    console.log(`PROGRESS ${browserName}: matrix start`);
    let browser;
    try {
      browser = await browserType.launch({ headless: true });
      for (const width of widths) {
        console.log(`PROGRESS ${browserName}/${width}: ${pagesUnderTest.length} pages`);
        for (const filename of pagesUnderTest) await inspectCell(browser, browserName, width, filename, server.origin);
      }
      await verifyInteraction(browser, browserName, 375, server.origin);
      await verifyInteraction(browser, browserName, 1280, server.origin);
      await verifyWithoutJavaScript(browser, browserName, 375, server.origin);
      await verifyWithoutJavaScript(browser, browserName, 1280, server.origin);
    } catch (error) { failures.push(`${browserName} session: ${error.message}`); }
    finally { await browser?.close().catch(() => {}); }
  }
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.setDefaultTimeout(5_000);
    for (const [label, href, destination] of [['growth', './growth.html', '/growth.html'], ['tools', './tools.html', '/tools.html']].filter(([, , destination]) => existsSync(resolve(root, destination.slice(1))))) {
      await page.goto(`${server.origin}/index.html`, { waitUntil: 'domcontentloaded' });
      await check(`TOP ${label} CTA navigation`, async () => {
        await Promise.all([page.waitForURL((url) => url.pathname.endsWith(destination)), page.locator(`a[href="${href}"]`).click()]);
      });
    }
  } catch (error) { failures.push(`Chromium CTA session: ${error.message}`); }
  finally { await browser?.close().catch(() => {}); }
} finally { await server.close(); }

if (failures.length) {
  console.error(`FAIL ${failures.length}/${checks} V3 lower-page browser checks`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else console.log(`PASS ${checks} browser checks: ${pagesUnderTest.length} required pages x 3 engines x 3 widths plus representative interactions and no-JS visibility`);
