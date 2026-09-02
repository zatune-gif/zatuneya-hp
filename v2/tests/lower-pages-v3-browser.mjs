import assert from 'node:assert/strict';
import { chromium, firefox, webkit } from 'playwright';
import { resolve } from 'node:path';
import { startQaServer } from './qa-server.mjs';
import { diagnosisUrl, managedPages } from './v3-lower-pages-fixture.mjs';

const root = resolve(import.meta.dirname, '..');
const widths = [375, 768, 1280];
const browserTypes = { chromium, firefox, webkit };
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
      const hrefs = await page.locator('a[data-diagnosis-link]').evaluateAll((links) => links.map((link) => link.getAttribute('href')));
      assert.ok(hrefs.length > 0 && hrefs.every((href) => href === diagnosisUrl));
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

const server = await startQaServer(root);
try {
  for (const [browserName, browserType] of Object.entries(browserTypes)) {
    console.log(`PROGRESS ${browserName}: matrix start`);
    let browser;
    try {
      browser = await browserType.launch({ headless: true });
      for (const width of widths) {
        console.log(`PROGRESS ${browserName}/${width}: ${managedPages.length} pages`);
        for (const filename of managedPages) await inspectCell(browser, browserName, width, filename, server.origin);
      }
      await verifyInteraction(browser, browserName, 375, server.origin);
      await verifyInteraction(browser, browserName, 1280, server.origin);
    } catch (error) { failures.push(`${browserName} session: ${error.message}`); }
    finally { await browser?.close().catch(() => {}); }
  }
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.setDefaultTimeout(5_000);
    for (const [label, href, destination] of [['growth', './growth.html', '/growth.html'], ['tools', './tools.html', '/tools.html']]) {
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
} else console.log(`PASS ${checks} browser checks: ${managedPages.length} pages x 3 engines x 3 widths plus representative interactions`);
