import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

// Deliberate CI diagnostic log: layout and font metadata only, no page content or secrets.
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 320, height: 900 } });
  await page.goto(pathToFileURL(resolve(import.meta.dirname, '..', 'index.html')).href);
  await page.evaluate(() => document.fonts.ready);

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
      lineCount: new Set(rects.map((rect) => Math.round(rect.top))).size,
      lineTops: [...new Set(rects.map((rect) => Math.round(rect.top)))],
      rects: rects.map(({ top, left, width, height }) => ({
        top: Math.round(top),
        left: Math.round(left),
        width: Math.round(width),
        height: Math.round(height)
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
  console.info(JSON.stringify({
    diagnostic: 'hero-font-320px',
    browserVersion: browser.version(),
    layout,
    platformFonts: fonts.map(({ familyName, postScriptName, isCustomFont, glyphCount }) => ({
      familyName, postScriptName, isCustomFont, glyphCount
    }))
  }));
} finally {
  await browser.close();
}
