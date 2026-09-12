import assert from 'node:assert/strict';
import { mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { startQaServer } from './qa-server.mjs';

const root = resolve(import.meta.dirname, '..');
const screenshotDir = join(root, 'qa-screenshots', 'sticky-cta');
const pages = [
  '404.html', 'contact.html', 'faq.html', 'growth.html', 'index.html', 'privacy.html',
  'profile.html', 'service-banso.html', 'service-management.html', 'service-order.html',
  'service-training.html', 'services.html', 'thank-you.html', 'tokusho.html',
  'tools.html', 'works.html'
];
const widths = [320, 375, 390, 430, 768, 1280, 1440];

function visible(element) {
  if (!element) return false;
  const style = getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0;
}

for (const pageName of pages) {
  const html = readFileSync(join(root, pageName), 'utf8');
  assert.match(html, /<div class="sticky-cta__copy">/, `${pageName} groups sticky copy`);
  assert.match(html, /class="sticky-cta__description">AI活用の準備度を確認できます。<\/p>/, `${pageName} has concise sticky description`);
  assert.match(html, /class="sticky-cta__btn"[^>]*>無料で診断する<\/a>/, `${pageName} has an explicit free-diagnosis label`);
  assert.match(html, /id="sticky-cta-close"[\s\S]*?<svg[^>]*aria-hidden="true"[^>]*>[\s\S]*?<\/svg>[\s\S]*?<\/button>/,
    `${pageName} uses a discreet SVG close icon`);
}

const sharedCss = readFileSync(join(root, 'top-comp.css'), 'utf8');
assert.match(sharedCss, /env\(safe-area-inset-bottom\)/, 'sticky CTA accounts for the device safe area');
assert.doesNotMatch(sharedCss, /body:has\(#sticky-cta[^}]+padding-bottom/, 'sticky CTA no longer creates a footer-like body spacer');

const server = await startQaServer(root);
const browser = await chromium.launch();
mkdirSync(screenshotDir, { recursive: true });

try {
  for (const width of widths) {
    const page = await browser.newPage({ viewport: { width, height: width <= 430 ? 844 : 960 }, reducedMotion: 'reduce' });
    await page.goto(`${server.origin}/index.html`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => sessionStorage.removeItem('sticky-cta-closed'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('#package').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => {
      const element = document.querySelector('#sticky-cta');
      if (!element) return false;
      const style = getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0;
    });

    const geometry = await page.locator('#sticky-cta').evaluate((dock) => {
      const rect = dock.getBoundingClientRect();
      const button = dock.querySelector('.sticky-cta__btn').getBoundingClientRect();
      const close = dock.querySelector('.sticky-cta__close').getBoundingClientRect();
      const icon = dock.querySelector('.sticky-cta__close svg').getBoundingClientRect();
      const description = dock.querySelector('.sticky-cta__description');
      const descriptionStyle = getComputedStyle(description);
      const headingStyle = getComputedStyle(dock.querySelector('.sticky-cta__text'));
      const descriptionRange = document.createRange();
      descriptionRange.selectNodeContents(description);
      return {
        left: rect.left,
        rightGap: innerWidth - rect.right,
        bottomGap: innerHeight - rect.bottom,
        width: rect.width,
        height: rect.height,
        buttonHeight: button.height,
        closeWidth: close.width,
        closeHeight: close.height,
        iconWidth: icon.width,
        iconHeight: icon.height,
        headingSize: Number.parseFloat(headingStyle.fontSize),
        descriptionSize: Number.parseFloat(descriptionStyle.fontSize),
        descriptionLines: new Set([...descriptionRange.getClientRects()].filter((line) => line.width > 0).map((line) => Math.round(line.top))).size,
        background: getComputedStyle(dock).backgroundColor,
        headingColor: headingStyle.color,
        buttonBackground: getComputedStyle(dock.querySelector('.sticky-cta__btn')).backgroundColor,
        overflow: document.documentElement.scrollWidth - innerWidth
      };
    });
    assert.ok(geometry.overflow <= 0, `${width}px has no horizontal overflow`);
    assert.ok(geometry.closeWidth >= 44 && geometry.closeHeight >= 44, `${width}px close target is at least 44px`);
    assert.ok(geometry.iconWidth >= 16 && geometry.iconWidth <= 20 && geometry.iconHeight >= 16 && geometry.iconHeight <= 20,
      `${width}px close icon is 16-20px`);
    assert.ok(geometry.headingSize >= 14 && geometry.descriptionSize >= 12, `${width}px sticky copy remains readable`);
    assert.equal(geometry.background, 'rgb(255, 255, 255)', `${width}px dock uses a light surface`);
    assert.equal(geometry.headingColor, 'rgb(49, 116, 124)', `${width}px heading uses accessible teal`);
    assert.equal(geometry.buttonBackground, 'rgb(248, 152, 29)', `${width}px has one orange primary CTA`);
    if (width <= 768) {
      assert.ok(geometry.left >= 16 && geometry.rightGap >= 16, `${width}px dock keeps 16px viewport margins`);
      assert.ok(geometry.bottomGap >= 16, `${width}px dock keeps normal bottom spacing before any larger safe-area inset`);
      assert.ok(geometry.buttonHeight >= 48, `${width}px primary CTA is at least 48px tall`);
      assert.ok(geometry.height <= 160, `${width}px dock does not consume excessive vertical space`);
      if (width === 320) assert.equal(geometry.descriptionLines, 1, '320px description stays on one meaningful line');
    } else {
      assert.ok(geometry.width <= 720, `${width}px dock remains compact`);
      assert.ok(geometry.left > 0 && geometry.rightGap > 0, `${width}px dock floats away from viewport edges`);
    }
    await page.screenshot({ path: join(screenshotDir, `${width}-mid-scroll.png`) });
    await page.close();
  }

  const behaviorPage = await browser.newPage({ viewport: { width: 375, height: 844 }, reducedMotion: 'reduce' });
  await behaviorPage.goto(`${server.origin}/index.html`, { waitUntil: 'domcontentloaded' });
  await behaviorPage.evaluate(() => sessionStorage.removeItem('sticky-cta-closed'));
  await behaviorPage.reload({ waitUntil: 'domcontentloaded' });

  assert.equal(await behaviorPage.locator('#sticky-cta').evaluate(visible), false, 'hero diagnosis area suppresses the sticky CTA');

  await behaviorPage.locator('#package').scrollIntoViewIfNeeded();
  await behaviorPage.waitForFunction(() => {
    const element = document.querySelector('#sticky-cta');
    if (!element) return false;
    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0;
  });
  await behaviorPage.locator('#nav-hamburger').click();
  await behaviorPage.waitForFunction(() => document.querySelector('#site-nav')?.classList.contains('is-open'));
  await behaviorPage.waitForFunction(() => getComputedStyle(document.querySelector('#sticky-cta')).visibility === 'hidden');
  assert.equal(await behaviorPage.locator('#sticky-cta').evaluate(visible), false, 'open navigation suppresses the sticky CTA');
  await behaviorPage.locator('#nav-hamburger').click();

  await behaviorPage.locator('#final-cta').scrollIntoViewIfNeeded();
  await behaviorPage.waitForFunction(() => getComputedStyle(document.querySelector('#sticky-cta')).visibility === 'hidden');
  assert.equal(await behaviorPage.locator('#sticky-cta').evaluate(visible), false, 'final CTA suppresses the sticky CTA');

  await behaviorPage.locator('.comp-footer').scrollIntoViewIfNeeded();
  await behaviorPage.waitForFunction(() => getComputedStyle(document.querySelector('#sticky-cta')).visibility === 'hidden');
  assert.equal(await behaviorPage.locator('#sticky-cta').evaluate(visible), false, 'footer suppresses the sticky CTA');
  await behaviorPage.screenshot({ path: join(screenshotDir, '375-footer-hidden.png') });

  await behaviorPage.locator('#package').scrollIntoViewIfNeeded();
  await behaviorPage.waitForFunction(() => {
    const style = getComputedStyle(document.querySelector('#sticky-cta'));
    return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0;
  });
  const focusTarget = behaviorPage.locator('#services a').first();
  await focusTarget.evaluate((element) => element.scrollIntoView({ block: 'end', behavior: 'auto' }));
  assert.equal(await behaviorPage.locator('#final-cta').evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.bottom > 0 && rect.top < innerHeight;
  }), false, 'focus test keeps final CTA outside the viewport');
  assert.equal(await behaviorPage.locator('.comp-footer').evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.bottom > 0 && rect.top < innerHeight;
  }), false, 'focus test keeps footer outside the viewport');
  await focusTarget.focus();
  await behaviorPage.waitForFunction(() => getComputedStyle(document.querySelector('#sticky-cta')).visibility === 'hidden');
  assert.equal(await behaviorPage.locator('#sticky-cta').evaluate(visible), false, 'sticky CTA never covers an outside focused control');
  await behaviorPage.evaluate(() => window.dispatchEvent(new Event('resize')));
  assert.equal(await behaviorPage.locator('#sticky-cta').evaluate(visible), false, 'focus-overlap suppression stays stable after geometry updates');

  await behaviorPage.evaluate(() => document.activeElement?.blur());
  await behaviorPage.locator('#package').scrollIntoViewIfNeeded();
  await behaviorPage.waitForFunction(() => {
    const style = getComputedStyle(document.querySelector('#sticky-cta'));
    return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0;
  });
  await behaviorPage.locator('#sticky-cta-close').click();
  assert.equal(await behaviorPage.evaluate(() => sessionStorage.getItem('sticky-cta-closed')), '1', 'dismissal persists for the session');
  await behaviorPage.reload({ waitUntil: 'domcontentloaded' });
  await behaviorPage.locator('#package').scrollIntoViewIfNeeded();
  assert.equal(await behaviorPage.locator('#sticky-cta').evaluate(visible), false, 'dismissed CTA stays closed after reload');
  await behaviorPage.close();

  const desktopPage = await browser.newPage({ viewport: { width: 1280, height: 960 }, reducedMotion: 'reduce' });
  await desktopPage.goto(`${server.origin}/index.html`, { waitUntil: 'domcontentloaded' });
  await desktopPage.locator('#package').scrollIntoViewIfNeeded();
  await desktopPage.waitForFunction(() => getComputedStyle(document.querySelector('#sticky-cta')).visibility !== 'hidden');
  await desktopPage.locator('.site-nav__dropdown-trigger').click();
  await desktopPage.waitForFunction(() => document.querySelector('.site-nav__item--dropdown')?.classList.contains('is-open'));
  await desktopPage.waitForFunction(() => getComputedStyle(document.querySelector('#sticky-cta')).visibility === 'hidden');
  assert.equal(await desktopPage.locator('#sticky-cta').evaluate(visible), false, 'open desktop dropdown suppresses the sticky CTA');
  await desktopPage.close();

  const pageShowPage = await browser.newPage({ viewport: { width: 375, height: 844 }, reducedMotion: 'reduce' });
  await pageShowPage.goto(`${server.origin}/index.html`, { waitUntil: 'domcontentloaded' });
  await pageShowPage.locator('#package').scrollIntoViewIfNeeded();
  await pageShowPage.waitForFunction(() => getComputedStyle(document.querySelector('#sticky-cta')).visibility !== 'hidden');
  await pageShowPage.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
  await pageShowPage.evaluate(() => sessionStorage.setItem('sticky-cta-closed', '1'));
  await pageShowPage.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  await pageShowPage.waitForFunction(() => document.querySelector('#sticky-cta')?.classList.contains('is-closed'));
  assert.equal(await pageShowPage.locator('#sticky-cta').evaluate(visible), false, 'pageshow re-reads dismissal written elsewhere in the session');
  await pageShowPage.close();

  console.log(`PASS sticky CTA quality: ${pages.length} pages, ${widths.length} widths, overlap and dismissal states`);
} finally {
  await browser.close();
  await server.close();
}
