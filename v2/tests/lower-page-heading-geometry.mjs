import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { startQaServer } from './qa-server.mjs';
const server = await startQaServer(resolve(import.meta.dirname, '..'));
const browser = await chromium.launch();
try {
  for (const width of [320, 375, 768, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 800 }, reducedMotion: 'reduce' });
    await page.goto(server.origin + '/services.html');
    const geometry = await page.locator('.lps-overview-card').evaluateAll(cards => cards.map(card => {
      const heading = card.querySelector('h2');
      const range = document.createRange(); range.selectNodeContents(heading);
      const rect = card.getBoundingClientRect();
      const style = getComputedStyle(card);
      return { text: heading.textContent, left: rect.left + parseFloat(style.paddingLeft), right: rect.right - parseFloat(style.paddingRight), lines: [...range.getClientRects()].map(r => ({ left:r.left, right:r.right, width:r.width })) };
    }));
    console.log(JSON.stringify({width,geometry}));
    for (const card of geometry) assert.ok(card.lines.every(r => r.left >= card.left - 1 && r.right <= card.right + 1), width + ' heading inside padded card: ' + card.text);
    await page.close();
  }
  console.log('Heading geometry: 12 PASS');
} finally { await browser.close(); await server.close(); }
