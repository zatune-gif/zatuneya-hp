import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { startQaServer } from './qa-server.mjs';
import { countVisualLines } from './visual-line-boxes.mjs';

// Deliberate CI diagnostic log: layout and font metadata only, no page content or secrets.
const root = resolve(import.meta.dirname, '..');
const server = await startQaServer(root);
let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 320, height: 900 } });
  await page.goto(`${server.origin}/index.html`, {
    waitUntil: 'domcontentloaded', timeout: 5_000
  });
  await page.locator('body').waitFor({ state: 'visible', timeout: 5_000 });
  await page.evaluate(async () => {
    await Promise.race([
      document.fonts.ready,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Font loading timed out')), 5_000))
    ]);
  });
  const assetImages = page.locator('img[data-asset-role]');
  for (let index = 0; index < await assetImages.count(); index += 1) {
    const image = assetImages.nth(index);
    await image.scrollIntoViewIfNeeded({ timeout: 5_000 });
    await image.waitFor({ state: 'visible', timeout: 5_000 });
    await image.evaluate(async (element) => { await element.decode(); });
  }
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'auto' }));
  await page.waitForFunction(async () => {
    if (window.scrollY !== 0) return false;
    await new Promise((nextFrame) => requestAnimationFrame(() => requestAnimationFrame(nextFrame)));
    return window.scrollY === 0;
  }, undefined, { timeout: 5_000 });

  const layout = await page.locator('#hero-title').evaluate((heading) => {
    const accent = heading.querySelector('.hero-accent');
    const style = getComputedStyle(accent);
    const range = document.createRange();
    range.selectNodeContents(accent);
    const rects = [...range.getClientRects()].filter((rect) => rect.width > 0);
    return {
      viewportWidth: window.innerWidth,
      headingWidth: heading.getBoundingClientRect().width,
      accentWidth: accent.getBoundingClientRect().width,
      lineTops: [...new Set(rects.map((rect) => Math.round(rect.top)))],
      rects: rects.map(({ top, left, width, height }) => ({
        top, left, width, height
      })),
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      letterSpacing: style.letterSpacing,
      whiteSpace: style.whiteSpace,
      fontLoadingStatus: document.fonts.status
    };
  });

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable');
  await cdp.send('CSS.enable');
  const document = await cdp.send('DOM.getDocument');
  const { nodeId } = await cdp.send('DOM.querySelector', {
    nodeId: document.root.nodeId,
    selector: '.hero-accent'
  });
  const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
  layout.lineCount = countVisualLines(layout.rects);
  console.info(JSON.stringify({
    diagnostic: 'hero-font-320px',
    browserVersion: browser.version(),
    layout,
    platformFonts: fonts.map(({ familyName, postScriptName, isCustomFont, glyphCount }) => ({
      familyName, postScriptName, isCustomFont, glyphCount
    }))
  }));
} finally {
  if (browser) await browser.close();
  await server.close();
}
