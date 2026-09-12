import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { startQaServer } from './qa-server.mjs';

const root = resolve(import.meta.dirname, '..');
const mobileWidths = [320, 375, 390, 430];
const desktopWidths = [1280, 1440];
const bodySelectors = [
  '.problem-card p',
  '.package-heading > p:last-child',
  '.package-column li',
  '.service-card > p:not(.service-number)',
  '.journey-steps span',
  '.why-us-points p',
  '.case-card > p:not(.case-type)',
  '.tool-card p',
  '.faq-answer p',
  '.final-cta p'
];
const supportingSelectors = [
  '.section-closing',
  '.service-price small',
  '.case-disclosure',
  '.case-type',
  '.footer-brand p'
];
const protectedHeadingIds = [
  'problems-title',
  'package-title',
  'services-title',
  'why-us-title',
  'cases-title',
  'tools-title',
  'final-cta-title'
];

let checks = 0;
const failures = [];
const check = (condition, message) => {
  checks += 1;
  if (!condition) failures.push(message);
};

const server = await startQaServer(root);
const browser = await chromium.launch();

try {
  for (const width of [...mobileWidths, ...desktopWidths]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(`${server.origin}/index.html`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => document.fonts.ready);
    await page.locator('.faq-answer').evaluateAll((answers) => answers.forEach((answer) => {
      answer.hidden = false;
    }));

    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      `${width}px has no horizontal overflow`);

    if (mobileWidths.includes(width)) {
      for (const selector of bodySelectors) {
        const sizes = await page.locator(selector).evaluateAll((elements) => elements.map((element) =>
          Number.parseFloat(getComputedStyle(element).fontSize)));
        check(sizes.length > 0, `${width}px body selector exists: ${selector}`);
        check(sizes.every((size) => size >= 14), `${width}px ${selector} body text is at least 14px (${sizes.join(', ')})`);
      }

      for (const selector of supportingSelectors) {
        const sizes = await page.locator(selector).evaluateAll((elements) => elements.map((element) =>
          Number.parseFloat(getComputedStyle(element).fontSize)));
        check(sizes.length > 0, `${width}px supporting selector exists: ${selector}`);
        check(sizes.every((size) => size >= 12), `${width}px ${selector} supporting text is at least 12px (${sizes.join(', ')})`);
      }

      const compactLinks = await page.locator('.case-link,.section-link,.faq-more').evaluateAll((links) => links.map((link) => ({
        text: link.textContent.trim(),
        height: link.getBoundingClientRect().height
      })));
      check(compactLinks.every(({ height }) => height >= 44),
        `${width}px compact links are at least 44px high (${compactLinks.map(({ text, height }) => `${text}:${height}`).join(', ')})`);

      const packageDuration = await page.locator('.package-duration').evaluateAll((parts) => parts.map((part) => {
        const range = document.createRange();
        range.selectNodeContents(part);
        return [...range.getClientRects()].filter(({ width: rectWidth }) => rectWidth > 0).length;
      }));
      check(packageDuration.length === 1, `${width}px package duration has one semantic part`);
      check(packageDuration[0] === 1, `${width}px package duration stays on one line`);

      const headingLayouts = await page.locator(protectedHeadingIds.map((id) => `#${id}`).join(',')).evaluateAll((headings) => headings.map((heading) => {
        const parts = [...heading.querySelectorAll('.top-title-part')];
        const rangeLines = (element) => {
          const range = document.createRange();
          range.selectNodeContents(element);
          return [...range.getClientRects()].filter(({ width: rectWidth }) => rectWidth > 0).length;
        };
        return {
          id: heading.id,
          partCount: parts.length,
          partLines: parts.map(rangeLines)
        };
      }));
      for (const layout of headingLayouts) {
        check(layout.partCount >= 2, `${width}px #${layout.id} has semantic wrap parts`);
        check(layout.partLines.every((lineCount) => lineCount === 1),
          `${width}px #${layout.id} semantic parts stay intact (${layout.partLines.join(', ')})`);
      }

      if (width === 320) {
        const heroInsets = await page.locator('.hero-copy').evaluate((copy) => {
          const rect = copy.getBoundingClientRect();
          return { left: rect.left, right: innerWidth - rect.right };
        });
        check(heroInsets.left >= 16 && heroInsets.right >= 16,
          `320px Hero copy keeps at least 16px side insets (${heroInsets.left}, ${heroInsets.right})`);
      }
    } else {
      const desktopParts = await page.locator('.top-title-part').evaluateAll((parts) => parts.map((part) => {
        const range = document.createRange();
        range.selectNodeContents(part);
        return [...range.getClientRects()].filter(({ width: rectWidth }) => rectWidth > 0).length;
      }));
      check(desktopParts.length >= protectedHeadingIds.length * 2,
        `${width}px desktop contains all semantic heading parts`);
      check(desktopParts.every((lineCount) => lineCount === 1),
        `${width}px desktop semantic heading parts remain intact`);
    }

    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}

assert.equal(failures.length, 0, `${failures.length} SP typography failures:\n${failures.join('\n')}`);
console.log(`PASS TOP SP typography: ${checks} checks across ${mobileWidths.length} mobile and ${desktopWidths.length} desktop widths`);
