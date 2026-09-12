import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { startQaServer } from './qa-server.mjs';

const root = resolve(import.meta.dirname, '..');
const desktopWidths = [1280, 1440, 1600, 1920, 2560];
const responsiveWidths = [375, 768, ...desktopWidths];
const consultPages = readdirSync(root)
  .filter((filename) => filename.endsWith('.html'))
  .filter((filename) => readFileSync(join(root, filename), 'utf8').includes('無料で相談する'))
  .sort();
const representativeConsultPage = 'services.html';

let checks = 0;
const failures = [];
const check = (condition, message) => {
  checks += 1;
  if (!condition) failures.push(message);
};

const server = await startQaServer(root);
const baseUrl = server.origin;
const browser = await chromium.launch();

try {
  check(consultPages.length === 15, '15 lower pages declare the shared consultation label');
  check(consultPages.every((filename) => {
    const html = readFileSync(join(root, filename), 'utf8');
    return html.includes('nav-diagnosis') && html.includes('nav-contact');
  }), 'all 15 lower pages declare both shared navigation CTA classes');

  for (const width of responsiveWidths) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(`${baseUrl}/index.html`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => document.fonts.ready);
    const phrases = await page.locator('#hero-title').evaluate((heading) => {
      const nodes = [heading.querySelector('.hero-intro') || heading.firstChild, heading.querySelector('.hero-accent')];
      const rangesFor = (node) => {
        const range = document.createRange();
        range.selectNodeContents(node);
        const rects = [...range.getClientRects()].filter(({ width: rectWidth }) => rectWidth > 0);
        return {
          text: node.textContent,
          lineCount: new Set(rects.map(({ top }) => Math.round(top))).size,
          rects: rects.map(({ left, right, top, width: rectWidth }) => ({ left, right, top, width: rectWidth })),
          viewportWidth: innerWidth
        };
      };
      return {
        phrases: nodes.map(rangesFor),
        accentParts: [...heading.querySelectorAll('.hero-accent-part')].map(rangesFor)
      };
    });
    check(phrases.phrases[0].text === 'AIを入れることより、', `${width}px Hero first phrase keeps canonical text`);
    check(phrases.phrases[0].lineCount === 1, `${width}px Hero first phrase stays on one meaningful line`);
    check(phrases.phrases[0].rects.every((rect) => rect.left >= 0 && rect.right <= phrases.phrases[0].viewportWidth), `${width}px Hero first phrase remains inside the viewport`);
    const expectedAccentLines = width === 375 ? 2 : 1;
    check(phrases.phrases[1].lineCount === expectedAccentLines, `${width}px Hero second phrase uses ${expectedAccentLines} readable line(s)`);
    check(phrases.phrases[1].rects.every((rect) => rect.left >= 0 && rect.right <= phrases.phrases[1].viewportWidth), `${width}px Hero second phrase remains inside the viewport`);
    check(phrases.accentParts.map(({ text }) => text).join('') === '仕事がよくなることから。', `${width}px Hero accent preserves canonical text in semantic parts`);
    check(phrases.accentParts.length === 2 && phrases.accentParts.every(({ rects }) => rects.length === 1), `${width}px Hero accent semantic parts each stay on one line`);

    if (width >= 1280) {
      const readability = await page.locator('.hero-grid').evaluate((grid) => {
        const visual = grid.querySelector('.hero-visual');
        const copy = grid.querySelector('.hero-copy');
        const visualRect = visual.getBoundingClientRect();
        const overlay = getComputedStyle(visual, '::after');
        const textRight = Math.max(...[copy.querySelector('h1'), copy.querySelector('.hero-lead')].flatMap((node) => {
          const range = document.createRange();
          range.selectNodeContents(node);
          return [...range.getClientRects()].map(({ right }) => right);
        }));
        return {
          backgroundImage: overlay.backgroundImage,
          opaqueRight: visualRect.left + parseFloat(overlay.width) * .70,
          textRight
        };
      });
      check(readability.backgroundImage.includes('70%'), `${width}px Hero overlay exposes a documented opaque white plateau`);
      check(readability.textRight <= readability.opaqueRight, `${width}px Hero heading and lead end inside the opaque white overlay (${readability.textRight.toFixed(1)} <= ${readability.opaqueRight.toFixed(1)})`);
    }
    await page.close();
  }

  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(`${baseUrl}/index.html`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => document.fonts.ready);
    const protectedPhrases = await page.locator('.top-nowrap-part').evaluateAll((nodes) => nodes.map((node) => {
      const range = document.createRange();
      range.selectNodeContents(node);
      return {
        text: node.textContent,
        rectCount: [...range.getClientRects()].filter(({ width }) => width > 0).length
      };
    }));
    check(protectedPhrases.map(({ text }) => text).includes('パッケージの内容を'), 'package CTA preserves its first semantic line');
    check(protectedPhrases.map(({ text }) => text).includes('くわしく見る'), 'package CTA preserves its second semantic line');
    check(protectedPhrases.map(({ text }) => text).includes('候補リスト'), 'package deliverable keeps 候補リスト together');
    check(protectedPhrases.map(({ text }) => text).includes('作り込みたい'), 'service description keeps 作り込みたい together');
    check(protectedPhrases.every(({ rectCount }) => rectCount === 1), 'all protected TOP phrases stay on one line at 1280px');
    await page.close();
  }

  for (const filename of [representativeConsultPage]) {
    for (const width of responsiveWidths) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.goto(`${baseUrl}/${filename}`, { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => document.fonts.ready);
      if (width <= 768) {
        await page.locator('#nav-hamburger').click();
        await page.locator('#site-nav').waitFor({ state: 'visible' });
      }
      for (const { selector, label } of [
        { selector: '.nav-diagnosis', label: 'diagnosis' },
        { selector: '.nav-contact', label: 'consultation' }
      ]) {
        const geometry = await page.locator(selector).evaluate((anchor) => {
          const range = document.createRange();
          range.selectNodeContents(anchor);
          const textRects = [...range.getClientRects()].filter(({ width: rectWidth }) => rectWidth > 0);
          const anchorRect = anchor.getBoundingClientRect();
          return {
            anchor: { left: anchorRect.left, right: anchorRect.right },
            textRects: textRects.map(({ left, right }) => ({ left, right })),
            whiteSpace: getComputedStyle(anchor).whiteSpace,
            pageOverflow: document.documentElement.scrollWidth > innerWidth + 1
          };
        });
        const textCenter = (geometry.textRects[0]?.left + geometry.textRects[0]?.right) / 2;
        const anchorCenter = (geometry.anchor.left + geometry.anchor.right) / 2;
        check(geometry.textRects.length === 1, `${filename} ${width}px ${label} label stays on one line`);
        check(geometry.textRects.every((rect) => rect.left >= geometry.anchor.left + 8 && rect.right <= geometry.anchor.right - 8), `${filename} ${width}px ${label} label keeps at least 8px inline space`);
        check(Math.abs(textCenter - anchorCenter) <= 1, `${filename} ${width}px ${label} label is horizontally centered`);
        check(geometry.whiteSpace === 'nowrap', `${filename} ${width}px ${label} label does not wrap`);
        check(!geometry.pageOverflow, `${filename} ${width}px shared header has no horizontal overflow`);
      }
      await page.close();
    }
  }
} finally {
  await browser.close();
  await server.close();
}

assert.equal(failures.length, 0, `${failures.length} header text geometry failures:\n${failures.slice(0, 24).join('\n')}`);
console.log(`PASS header text geometry: ${checks} checks across Hero and the shared header used by ${consultPages.length} lower pages`);
