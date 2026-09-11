import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { chromium } from 'playwright';

const root = resolve(import.meta.dirname, '..');
const screenshotDir = join(root, 'qa-screenshots', 'index');
const stagingDir = join(screenshotDir, `.staging-${process.pid}-${Date.now()}-${randomUUID()}`);
const backupDir = join(screenshotDir, `.backup-${process.pid}-${Date.now()}-${randomUUID()}`);
const forceFailureAfterFirstScreenshot = process.env.V3_TOP_PAGE_FORCE_FAILURE_AFTER_SCREENSHOT === '1';
const viewports = [
  { width: 320, height: 900 },
  { width: 375, height: 900 },
  { width: 768, height: 1024 },
  { width: 1280, height: 960 }
];
const mime = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp']
]);

let browser;
let serve;
let page;
let baseUrl;
const canonicalHashesBeforeForcedFailure = forceFailureAfterFirstScreenshot
  ? canonicalScreenshotHashes()
  : undefined;

function canonicalScreenshotPath(width) {
  return join(screenshotDir, `${width}.png`);
}

function stagedScreenshotPath(width) {
  return join(stagingDir, `${width}.png`);
}

function hashFile(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function canonicalScreenshotHashes() {
  return Object.fromEntries(viewports.map(({ width }) => {
    const screenshotPath = canonicalScreenshotPath(width);
    assert.ok(existsSync(screenshotPath), `canonical ${width}px screenshot exists`);
    return [width, hashFile(screenshotPath)];
  }));
}

function pngDimensions(path) {
  const png = readFileSync(path);
  assert.ok(
    png.length >= 24 && png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    `${path} is a PNG file`
  );
  assert.equal(png.toString('ascii', 12, 16), 'IHDR', `${path} has an IHDR chunk`);
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

async function verifyStagedScreenshots(directory) {
  for (const { width } of viewports) {
    const screenshotPath = join(directory, `${width}.png`);
    assert.ok(existsSync(screenshotPath), `staged ${width}px screenshot exists before publish`);
    const dimensions = pngDimensions(screenshotPath);
    assert.equal(dimensions.width, width, `staged ${width}px screenshot width matches its viewport`);
    assert.ok(dimensions.height > 0, `staged ${width}px screenshot has a positive height`);
  }
}

async function publishStagedScreenshots(directory) {
  const backups = [];
  const published = [];
  mkdirSync(backupDir, { recursive: true });
  try {
    for (const { width } of viewports) {
      const canonicalPath = canonicalScreenshotPath(width);
      const backupPath = join(backupDir, `${width}.png`);
      if (existsSync(canonicalPath)) {
        renameSync(canonicalPath, backupPath);
        backups.push({ canonicalPath, backupPath });
      }
    }
    for (const { width } of viewports) {
      const sourcePath = join(directory, `${width}.png`);
      const canonicalPath = canonicalScreenshotPath(width);
      renameSync(sourcePath, canonicalPath);
      published.push({ canonicalPath, sourcePath });
    }
  } catch (error) {
    for (const { canonicalPath, sourcePath } of published.reverse()) {
      if (existsSync(canonicalPath)) renameSync(canonicalPath, sourcePath);
    }
    for (const { canonicalPath, backupPath } of backups.reverse()) {
      if (existsSync(backupPath)) renameSync(backupPath, canonicalPath);
    }
    throw error;
  }
}

async function waitForDocumentFonts(targetPage) {
  await targetPage.evaluate(async (timeoutMs) => {
    if (!document.fonts?.ready) throw new Error('Document font loading API is required for visual capture');
    let timer;
    try {
      await Promise.race([
        document.fonts.ready,
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error(`Font loading timed out after ${timeoutMs}ms`)), timeoutMs);
        })
      ]);
    } finally {
      clearTimeout(timer);
    }
  }, 5_000);
}

async function loadTopPage(targetPage) {
  await targetPage.goto(`${baseUrl}/index.html`, {
    waitUntil: 'domcontentloaded',
    timeout: 5_000
  });
  await targetPage.locator('body').waitFor({ state: 'visible', timeout: 5_000 });
  await waitForDocumentFonts(targetPage);
}

async function assertHeroPhraseLines(targetPage, viewportWidth) {
  if (![320, 375, 1280].includes(viewportWidth)) return;
  const layout = await targetPage.locator('#hero-title').evaluate((heading) => {
    const first = heading.firstChild;
    const accent = heading.querySelector('.hero-accent');
    const rectFor = (node) => {
      const range = document.createRange();
      range.selectNodeContents(node);
      const rects = [...range.getClientRects()].filter((rect) => rect.width > 0);
      return {
        text: node.textContent,
        top: Math.round(rects[0]?.top ?? -1),
        rectCount: rects.length,
        whiteSpace: node.nodeType === Node.ELEMENT_NODE ? getComputedStyle(node).whiteSpace : null
      };
    };
    return [rectFor(first), rectFor(accent)];
  });
  assert.deepEqual(layout.map(({ text }) => text),
    ['AIを入れることより、', '仕事がよくなることから。'],
    `hero phrase text is exact at ${viewportWidth}px`);
  const resultPhrase = layout[1];
  if (viewportWidth <= 375) {
    assert.equal(layout[0].rectCount, 1, `hero first phrase stays intact at ${viewportWidth}px`);
    assert.equal(resultPhrase.rectCount, 2, `hero accent follows the approved two-line mobile comp at ${viewportWidth}px`);
    assert.equal(resultPhrase.whiteSpace, 'normal', `hero accent wraps naturally on mobile at ${viewportWidth}px`);
  } else {
    assert.equal(resultPhrase.rectCount, 1, `hero phrase '${resultPhrase.text}' is never internally split at ${viewportWidth}px`);
    assert.equal(resultPhrase.whiteSpace, 'nowrap', `hero phrase '${resultPhrase.text}' is nowrap at ${viewportWidth}px`);
    const lineCount = new Set(layout.map(({ top }) => top)).size;
    assert.equal(lineCount, 2, `hero uses two intentional phrase lines at ${viewportWidth}px`);
  }
}

async function trackStickyCtaListeners(targetPage) {
  await targetPage.addInitScript(() => {
    const trackedTypes = new Set(['scroll', 'resize', 'pagehide', 'pageshow']);
    const activeListeners = new Map([...trackedTypes].map((type) => [type, new Set()]));
    const addEventListener = window.addEventListener.bind(window);
    const removeEventListener = window.removeEventListener.bind(window);
    window.addEventListener = function (type, listener, options) {
      if (trackedTypes.has(type)) activeListeners.get(type).add(listener);
      return addEventListener(type, listener, options);
    };
    window.removeEventListener = function (type, listener, options) {
      if (trackedTypes.has(type)) activeListeners.get(type).delete(listener);
      return removeEventListener(type, listener, options);
    };
    window.__stickyCtaListenerCounts = () => Object.fromEntries(
      [...activeListeners].map(([type, listeners]) => [type, listeners.size])
    );
  });
}

async function assertAssetRoleImagesReady(viewportPage) {
  const assetImages = viewportPage.locator('img[data-asset-role]');
  const states = await assetImages.evaluateAll((images) => images.map((image) => {
    const style = getComputedStyle(image);
    return {
      role: image.dataset.assetRole,
      currentSrc: image.currentSrc,
      complete: image.complete,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      visible: style.display !== 'none' && style.visibility !== 'hidden',
      opacity: Number.parseFloat(style.opacity)
    };
  }));
  assert.ok(states.length > 0, 'asset-role images exist');
  for (const state of states) {
    assert.ok(state.currentSrc, `asset-role image ${state.role} has a current source before screenshot`);
    assert.equal(state.complete, true, `asset-role image ${state.role} is complete before screenshot`);
    assert.ok(state.naturalWidth > 0 && state.naturalHeight > 0, `asset-role image ${state.role} is decoded before screenshot`);
    assert.equal(state.visible, true, `asset-role image ${state.role} is visible before screenshot`);
    assert.ok(state.opacity > 0, `asset-role image ${state.role} has positive opacity before screenshot`);
  }
}

async function loadAssetRoleImages(viewportPage) {
  const assetImages = viewportPage.locator('img[data-asset-role]');
  const count = await assetImages.count();
  assert.ok(count > 0, 'asset-role images exist to load');
  for (let index = 0; index < count; index += 1) {
    const image = assetImages.nth(index);
    await image.scrollIntoViewIfNeeded({ timeout: 5_000 });
    await image.waitFor({ state: 'visible', timeout: 5_000 });
    await viewportPage.waitForFunction(
      (imageIndex) => {
        const assetImage = document.querySelectorAll('img[data-asset-role]')[imageIndex];
        return Boolean(
          assetImage?.currentSrc && assetImage.complete &&
          assetImage.naturalWidth > 0 && assetImage.naturalHeight > 0
        );
      },
      index,
      { timeout: 5_000 }
    );
    await image.evaluate(async (assetImage) => {
      await assetImage.decode();
    });
  }
}

async function returnToTopAfterLazyLoading(viewportPage) {
  await viewportPage.evaluate(() => window.scrollTo({ top: 0, behavior: 'auto' }));
  await viewportPage.waitForFunction(async () => {
    if (window.scrollY !== 0) return false;
    await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
    return window.scrollY === 0;
  }, undefined, { timeout: 5_000 });
}

async function prepareFullPageScreenshot(viewportPage) {
  const fadeTargets = viewportPage.locator('.fade-in');
  const fadeCount = await fadeTargets.count();
  assert.ok(fadeCount > 0, 'full-page screenshot has fade targets to reveal');
  for (let index = 0; index < fadeCount; index += 1) {
    const target = fadeTargets.nth(index);
    await target.scrollIntoViewIfNeeded({ timeout: 5_000 });
    await viewportPage.waitForFunction(
      (targetIndex) => document.querySelectorAll('.fade-in')[targetIndex]?.classList.contains('is-visible'),
      index,
      { timeout: 5_000 }
    );
  }
  await viewportPage.waitForFunction(() => Array.from(document.querySelectorAll('.fade-in')).every((target) => {
    const opacity = Number.parseFloat(getComputedStyle(target).opacity);
    return target.classList.contains('is-visible') && opacity >= 0.99;
  }), undefined, { timeout: 5_000 });

  await viewportPage.waitForFunction(() => Array.from(document.images).every((image) =>
    image.complete && image.naturalWidth > 0 && image.naturalHeight > 0
  ), undefined, { timeout: 5_000 });
  await viewportPage.locator('img').evaluateAll(async (images) => {
    await Promise.all(images.map((image) => image.decode()));
  });
  const imageStates = await viewportPage.locator('img').evaluateAll((images) => images.map((image) => ({
    src: image.currentSrc,
    naturalWidth: image.naturalWidth,
    naturalHeight: image.naturalHeight
  })));
  for (const image of imageStates) {
    assert.ok(image.src && image.naturalWidth > 0 && image.naturalHeight > 0,
      `full-page screenshot image decoded: ${image.src || '(missing source)'}`);
  }
  await returnToTopAfterLazyLoading(viewportPage);
  await viewportPage.waitForTimeout(100);
}

async function scrollPastHero(viewportPage, expectVisible = true) {
  await viewportPage.evaluate(() => {
    const hero = document.querySelector('#hero');
    if (!hero) throw new Error('Hero is required for sticky CTA behavior');
    window.scrollTo({ top: hero.offsetTop + hero.offsetHeight + 16, behavior: 'auto' });
  });
  await viewportPage.waitForFunction((shouldBeVisible) => {
    const hero = document.querySelector('#hero');
    const sticky = document.querySelector('#sticky-cta');
    if (!hero || !sticky) return false;
    return hero.getBoundingClientRect().bottom <= 0 &&
      (!shouldBeVisible || (
        sticky.classList.contains('is-after-hero') &&
        getComputedStyle(sticky).display !== 'none'
      ));
  }, expectVisible, { timeout: 5_000 });
}

async function assertStickyCtaHiddenAtHero(viewportPage) {
  await returnToTopAfterLazyLoading(viewportPage);
  await viewportPage.waitForFunction(() => {
    const hero = document.querySelector('#hero');
    const sticky = document.querySelector('#sticky-cta');
    if (!hero || !sticky) return false;
    return hero.getBoundingClientRect().bottom > 0 &&
      !sticky.classList.contains('is-after-hero') &&
      getComputedStyle(sticky).display === 'none';
  }, undefined, { timeout: 5_000 });
}

async function assertInitialHeroCtasAreUncovered(viewportPage, width) {
  const state = await viewportPage.evaluate(() => {
    const sticky = document.querySelector('#sticky-cta');
    const primary = document.querySelector('#hero .v3-button--primary');
    const secondary = document.querySelector('#hero .v3-button--secondary');
    if (!sticky || !primary || !secondary) {
      throw new Error('Sticky CTA and both hero CTA buttons are required');
    }
    const area = (one, two) => {
      const left = Math.max(one.left, two.left);
      const right = Math.min(one.right, two.right);
      const top = Math.max(one.top, two.top);
      const bottom = Math.min(one.bottom, two.bottom);
      return Math.max(0, right - left) * Math.max(0, bottom - top);
    };
    const stickyRect = sticky.getBoundingClientRect();
    return {
      display: getComputedStyle(sticky).display,
      primaryOverlap: area(primary.getBoundingClientRect(), stickyRect),
      secondaryOverlap: area(secondary.getBoundingClientRect(), stickyRect)
    };
  });
  assert.equal(state.display, 'none', `sticky CTA is hidden at the initial ${width}px hero position`);
  assert.equal(state.primaryOverlap, 0, `primary hero CTA has zero sticky overlap at ${width}px`);
  assert.equal(state.secondaryOverlap, 0, `secondary hero CTA has zero sticky overlap at ${width}px`);
}

try {
  serve = createServer((request, response) => {
    try {
      const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
      const pathname = requestUrl.pathname === '/' ? '/index.html' : requestUrl.pathname;
      const target = resolve(root, `.${decodeURIComponent(pathname)}`);
      assert.ok(
        target === root || target.startsWith(`${root}${sep}`),
        'server path stays inside v2 root'
      );
      const body = readFileSync(target);
      response.writeHead(200, { 'content-type': mime.get(extname(target)) ?? 'application/octet-stream' });
      response.end(body);
    } catch (error) {
      if (!response.headersSent) {
        response.writeHead(error instanceof assert.AssertionError ? 403 : 404, { 'content-type': 'text/plain; charset=utf-8' });
        response.end('Not found');
      }
    }
  });
  await new Promise((resolveListen, rejectListen) => {
    serve.once('error', rejectListen);
    serve.listen(0, '127.0.0.1', () => {
      serve.off('error', rejectListen);
      const address = serve.address();
      assert.ok(address && typeof address !== 'string', 'top-page browser server exposes a numeric port');
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolveListen();
    });
  });

  const missingResponse = await fetch(`${baseUrl}/does-not-exist.html`);
  assert.equal(missingResponse.status, 404, 'server returns 404 once for a missing file');
  assert.equal(await missingResponse.text(), 'Not found', 'missing-file response is safe');

  browser = await chromium.launch();
  mkdirSync(screenshotDir, { recursive: true });
  mkdirSync(stagingDir, { recursive: true });
  for (const viewport of viewports) {
    const viewportPage = await browser.newPage({ viewport });
    try {
      await loadTopPage(viewportPage);
      await loadAssetRoleImages(viewportPage);
      assert.equal(
        await viewportPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        true,
        `no horizontal scroll at ${viewport.width}px`
      );
      await assertAssetRoleImagesReady(viewportPage);
      await returnToTopAfterLazyLoading(viewportPage);
      await assertHeroPhraseLines(viewportPage, viewport.width);
      if (viewport.width === 320 || viewport.width === 375) {
        await assertInitialHeroCtasAreUncovered(viewportPage, viewport.width);
      }
      await prepareFullPageScreenshot(viewportPage);
      await viewportPage.screenshot({ path: join(stagingDir, `${viewport.width}.png`), fullPage: true });
      if (forceFailureAfterFirstScreenshot) {
        throw new Error('Intentional screenshot failure after staging; canonical PNGs must remain unchanged');
      }
    } finally {
      await viewportPage.close();
    }
  }

  page = await browser.newPage({ viewport: viewports[1] });
  page.setDefaultTimeout(5_000);
  await trackStickyCtaListeners(page);
  await loadTopPage(page);
  await page.locator('#nav-hamburger').waitFor({ state: 'visible' });

  const diagnosisLinks = page.locator('a[data-diagnosis-link]');
  assert.equal(await diagnosisLinks.count(), 5, 'all five diagnosis links are present after page load');
  const diagnosisLinkStates = await diagnosisLinks.evaluateAll((links) => links.map((link) => {
    const style = getComputedStyle(link);
    return {
      href: link.getAttribute('href'),
      disabled: link.getAttribute('aria-disabled'),
      usable: !link.hidden && style.display !== 'none' && style.visibility !== 'hidden' && style.pointerEvents !== 'none'
    };
  }));
  for (const state of diagnosisLinkStates) {
    assert.equal(state.href, 'https://ai-shindan-zatuneya.netlify.app/', 'diagnosis link is hydrated with the current HTTPS URL');
    assert.equal(state.disabled, null, 'hydrated diagnosis link is not marked unavailable');
    assert.equal(state.usable, true, 'hydrated diagnosis link remains visible and usable');
  }

  const offscreenFade = page.locator('#faq .fade-in').first();
  await offscreenFade.waitFor({ state: 'attached' });
  assert.equal(await offscreenFade.evaluate((element) => element.classList.contains('is-visible')), false,
    'an offscreen fade target starts hidden before it enters the viewport');
  assert.equal(await offscreenFade.evaluate((element) => getComputedStyle(element).opacity), '0',
    'an offscreen fade target has a visually hidden base state');
  await offscreenFade.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('#faq .fade-in')?.classList.contains('is-visible'));
  assert.equal(await offscreenFade.evaluate((element) => getComputedStyle(element).animationName), 'v3-fade-in',
    'scrolling a fade target into view starts its reveal animation');
  assert.equal(await offscreenFade.evaluate((element) => getComputedStyle(element).animationDuration), '0.4s',
    'the reveal animation keeps its designed duration');

  const faqButtons = page.locator('#faq button[aria-controls]');
  await faqButtons.first().waitFor({ state: 'visible' });
  await faqButtons.nth(0).focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('#faq button[aria-controls]')?.getAttribute('aria-expanded') === 'true');
  assert.equal(await faqButtons.nth(0).getAttribute('aria-expanded'), 'true');
  const faqAnswerId = await faqButtons.nth(0).getAttribute('aria-controls');
  assert.ok(faqAnswerId, 'FAQ button exposes its controlled answer ID');
  const faqAnswer = page.locator(`#${faqAnswerId}`);
  await faqAnswer.waitFor({ state: 'visible' });
  assert.equal(await faqAnswer.isHidden(), false);

  await scrollPastHero(page);
  assert.deepEqual(
    await page.evaluate(() => window.__stickyCtaListenerCounts()),
    { scroll: 1, resize: 1, pagehide: 1, pageshow: 1 },
    'sticky CTA registers one state listener per relevant window event'
  );
  await assertStickyCtaHiddenAtHero(page);
  await scrollPastHero(page);
  await page.locator('#sticky-cta-close').click();
  await page.waitForFunction(() => {
    const sticky = document.querySelector('#sticky-cta');
    if (!sticky?.classList.contains('is-closed')) return false;
    const style = getComputedStyle(sticky);
    return sticky.hidden || style.display === 'none' || style.visibility === 'hidden' ||
      (style.opacity === '0' && style.pointerEvents === 'none');
  });
  assert.equal(await page.locator('#sticky-cta').evaluate((element) => element.classList.contains('is-closed')), true);
  assert.equal(await page.locator('#sticky-cta').evaluate((element) => {
    const style = getComputedStyle(element);
    return element.hidden || style.display === 'none' || style.visibility === 'hidden' ||
      (style.opacity === '0' && style.pointerEvents === 'none');
  }), true, 'closed sticky call to action is not interactive or visible');
  assert.deepEqual(
    await page.evaluate(() => window.__stickyCtaListenerCounts()),
    { scroll: 0, resize: 0, pagehide: 0, pageshow: 0 },
    'closed sticky CTA removes its window listeners'
  );
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 5_000 });
  await waitForDocumentFonts(page);
  await page.locator('#sticky-cta').waitFor({ state: 'attached' });
  await assertStickyCtaHiddenAtHero(page);
  await scrollPastHero(page, false);
  await page.waitForFunction(() => document.querySelector('#sticky-cta')?.classList.contains('is-closed'));
  assert.equal(await page.locator('#sticky-cta').evaluate((element) => element.classList.contains('is-closed')), true);

  await page.locator('#nav-hamburger').focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => {
    const hamburger = document.querySelector('#nav-hamburger');
    const nav = document.querySelector('#site-nav');
    if (hamburger?.getAttribute('aria-expanded') !== 'true' || !nav) return false;
    const style = getComputedStyle(nav);
    return !nav.hasAttribute('hidden') && style.display !== 'none' && style.visibility !== 'hidden';
  });
  assert.equal(await page.locator('#nav-hamburger').getAttribute('aria-expanded'), 'true');
  assert.equal(await page.locator('#site-nav').evaluate((element) => {
    const style = getComputedStyle(element);
    return !element.hasAttribute('hidden') && style.display !== 'none' && style.visibility !== 'hidden';
  }), true, 'opened navigation is visible');

  const dropdownTrigger = page.locator('.site-nav__dropdown-trigger').first();
  const dropdownMenu = dropdownTrigger.locator('xpath=..').locator('.site-nav__dropdown-menu');
  await dropdownTrigger.focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => {
    const trigger = document.querySelector('.site-nav__dropdown-trigger');
    const menu = trigger?.parentElement?.querySelector('.site-nav__dropdown-menu');
    if (trigger?.getAttribute('aria-expanded') !== 'true' || !menu) return false;
    const style = getComputedStyle(menu);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  });
  assert.equal(await dropdownTrigger.getAttribute('aria-expanded'), 'true', 'dropdown trigger expands with Enter');
  assert.equal(await dropdownMenu.isHidden(), false, 'expanded dropdown menu is visible');
  await page.waitForFunction(() => {
    const trigger = document.querySelector('.site-nav__dropdown-trigger');
    const menu = trigger?.parentElement?.querySelector('.site-nav__dropdown-menu');
    if (trigger?.getAttribute('aria-expanded') !== 'true' || !menu) return false;
    return getComputedStyle(menu).display !== 'none';
  });
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => {
    const trigger = document.querySelector('.site-nav__dropdown-trigger');
    const menu = trigger?.parentElement?.querySelector('.site-nav__dropdown-menu');
    if (trigger?.getAttribute('aria-expanded') !== 'false' || !menu) return false;
    const style = getComputedStyle(menu);
    return style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0';
  });
  assert.equal(await dropdownTrigger.getAttribute('aria-expanded'), 'false', 'Escape collapses the open dropdown');
  assert.equal(await dropdownMenu.isHidden(), true, 'Escape hides the dropdown menu');
  assert.equal(await page.evaluate(() => document.activeElement?.classList.contains('site-nav__dropdown-trigger')), true,
    'Escape restores focus to the dropdown trigger');
  assert.equal(await page.locator('#nav-hamburger').getAttribute('aria-expanded'), 'true',
    'Escape keeps the mobile navigation open after closing its focused dropdown');
  assert.equal(await page.locator('#site-nav').evaluate((element) => getComputedStyle(element).display !== 'none'), true,
    'the focused dropdown trigger remains visible after Escape');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => {
    const hamburger = document.querySelector('#nav-hamburger');
    const nav = document.querySelector('#site-nav');
    if (hamburger?.getAttribute('aria-expanded') !== 'false' || !nav) return false;
    const style = getComputedStyle(nav);
    return nav.hasAttribute('hidden') || style.display === 'none' || style.visibility === 'hidden';
  });
  assert.equal(await page.locator('#nav-hamburger').getAttribute('aria-expanded'), 'false');
  assert.equal(await page.locator('#site-nav').evaluate((element) => {
    const style = getComputedStyle(element);
    return element.hasAttribute('hidden') || style.display === 'none' || style.visibility === 'hidden';
  }), true, 'closed navigation is hidden');

  const inactiveEscapeFocus = faqButtons.nth(0);
  await inactiveEscapeFocus.focus();
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => document.activeElement === document.querySelector('#faq button[aria-controls]')),
    true, 'Escape keeps focus in place when neither the navigation nor a dropdown is open');
  assert.equal(await page.locator('#nav-hamburger').getAttribute('aria-expanded'), 'false',
    'Escape leaves the closed mobile navigation closed');
  assert.equal(await page.locator('#site-nav').evaluate((element) => !element.classList.contains('is-open')),
    true, 'Escape does not reopen the closed mobile navigation');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('.fade-in').first().waitFor({ state: 'attached' });
  await page.waitForFunction(() => {
    const fadeIn = document.querySelector('.fade-in');
    return fadeIn && getComputedStyle(fadeIn).animationDuration === '0.01s';
  });
  assert.equal(
    await page.locator('.fade-in').first().evaluate((element) => getComputedStyle(element).animationDuration),
    '0.01s'
  );

  const storageDeniedContext = await browser.newContext({ viewport: viewports[1] });
  const storageDeniedPage = await storageDeniedContext.newPage();
  const storageErrors = [];
  storageDeniedPage.on('pageerror', (error) => storageErrors.push(error));
  await storageDeniedPage.addInitScript(() => {
    const denyStorage = () => {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    };
    Object.defineProperty(Storage.prototype, 'getItem', { configurable: true, value: denyStorage });
    Object.defineProperty(Storage.prototype, 'setItem', { configurable: true, value: denyStorage });
  });
  await loadTopPage(storageDeniedPage);
  const storageDeniedFaq = storageDeniedPage.locator('#faq button[aria-controls]').first();
  await storageDeniedFaq.click();
  await storageDeniedPage.waitForFunction(() => document.querySelector('#faq button[aria-controls]')?.getAttribute('aria-expanded') === 'true');
  assert.equal(await storageDeniedFaq.getAttribute('aria-expanded'), 'true', 'FAQ remains interactive when session storage is denied');
  assert.equal(storageErrors.length, 0, 'storage denial does not abort navigation initialization');
  await storageDeniedContext.close();

  const bfcacheContext = await browser.newContext({ viewport: viewports[1] });
  const bfcachePage = await bfcacheContext.newPage();
  bfcachePage.setDefaultTimeout(5_000);
  await trackStickyCtaListeners(bfcachePage);
  await loadTopPage(bfcachePage);
  await scrollPastHero(bfcachePage);
  assert.deepEqual(
    await bfcachePage.evaluate(() => window.__stickyCtaListenerCounts()),
    { scroll: 1, resize: 1, pagehide: 1, pageshow: 1 },
    'open sticky CTA has one listener per event before a BFCache pagehide'
  );
  await bfcachePage.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
  assert.deepEqual(
    await bfcachePage.evaluate(() => window.__stickyCtaListenerCounts()),
    { scroll: 0, resize: 0, pagehide: 0, pageshow: 1 },
    'persisted pagehide removes active sticky CTA listeners but keeps the restoration hook'
  );
  await bfcachePage.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  assert.deepEqual(
    await bfcachePage.evaluate(() => window.__stickyCtaListenerCounts()),
    { scroll: 1, resize: 1, pagehide: 1, pageshow: 1 },
    'pageshow restores exactly one sticky CTA listener per event'
  );
  await assertStickyCtaHiddenAtHero(bfcachePage);
  await scrollPastHero(bfcachePage);
  assert.deepEqual(
    await bfcachePage.evaluate(() => window.__stickyCtaListenerCounts()),
    { scroll: 1, resize: 1, pagehide: 1, pageshow: 1 },
    'sticky CTA updates after BFCache restoration without duplicate listeners'
  );
  await bfcacheContext.close();

  await verifyStagedScreenshots(stagingDir);
  await publishStagedScreenshots(stagingDir);

  console.log('PASS v3 TOP browser checks: 4 viewports, keyboard, storage denial, BFCache sticky CTA, reduced motion');
} finally {
  if (page) await page.close().catch(() => {});
  if (browser) await browser.close().catch(() => {});
  if (serve?.listening) await new Promise((done) => serve.close(done));
  rmSync(stagingDir, { recursive: true, force: true });
  rmSync(backupDir, { recursive: true, force: true });
  if (canonicalHashesBeforeForcedFailure) {
    assert.deepEqual(
      canonicalScreenshotHashes(),
      canonicalHashesBeforeForcedFailure,
      'forced failure leaves all canonical screenshots byte-for-byte unchanged'
    );
    console.log('PASS forced-failure artifact preservation: canonical screenshot hashes unchanged');
  }
}
