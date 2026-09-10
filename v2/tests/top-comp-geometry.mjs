import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { startQaServer } from './qa-server.mjs';

// Independent bounds derived from the approved 722×2178 combined comp.
// PC panel is ~587px wide; SP panel is ~128px wide (not a 75/25 split).
// The approved copy adds value/growth and longer explanations, so those two
// sections are budgeted separately. Never replace these bounds with a screenshot.
const budgets = {
  1280: { total: [4500, 6100], header: [60, 88], hero: [570, 710], package: [440, 660], services: [520, 720], extras: [500, 950] },
  375: { total: [5800, 6500], header: [56, 72], hero: [540, 680], package: [700, 950], services: [800, 1050], extras: [950, 1150] }
};
const server = await startQaServer(resolve(import.meta.dirname, '..'));
const browser = await chromium.launch();
const failures = [];
let checks = 0;
function check(ok, label) { checks++; if (!ok) failures.push(label); }
try {
  for (const width of [1280, 375]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    await page.addInitScript(() => sessionStorage.setItem('sticky-cta-closed', '1'));
    await page.goto(server.origin);
    await page.evaluate(async () => {
      await document.fonts.ready;
      document.querySelectorAll('img').forEach(image => image.loading = 'eager');
      await Promise.all([...document.images].map(image => image.decode()));
      document.querySelectorAll('.fade-in').forEach(node => node.classList.add('is-visible'));
    });
    const geometry = await page.evaluate(() => {
      const box = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
      return { total: document.documentElement.scrollHeight, overflow: document.documentElement.scrollWidth > innerWidth, header: box('.comp-header'), hero: box('#hero'), photo: box('.v3-media--hero'), copy: box('.v3-hero__copy'), problemsSection: box('#problems'), package: box('#package'), services: box('#services'), value: box('#value'), growth: box('#growth'), journey: box('#journey'), whyUs: box('#why-us'), cases: box('#cases'), tools: box('#tools'), faq: box('#faq'), finalCta: box('#final-cta'), footer: box('.comp-footer'), representative: box('.representative-card img'), strengths: box('.why-us-copy'), cards: [...document.querySelectorAll('.service-card')].map(el => { const r=el.getBoundingClientRect(); return { x:r.x,y:r.y }; }), problems: [...document.querySelectorAll('.problem-card')].map(el => el.getBoundingClientRect().y), packagePhoto: box('.package-figure'), packageHeading: box('.package-heading'), faqColumns: getComputedStyle(document.querySelector('.faq-list')).gridTemplateColumns.split(' ').length };
    });
    const bounds = budgets[width];
    for (const key of ['total', 'header', 'hero', 'package', 'services']) {
      const actual = key === 'total' ? geometry.total : geometry[key].h;
      check(actual >= bounds[key][0] && actual <= bounds[key][1], `${width} ${key}: ${actual} outside ${bounds[key]}`);
    }
    const extras = geometry.value.h + geometry.growth.h;
    check(extras >= bounds.extras[0] && extras <= bounds.extras[1], `${width} additional copy sections: ${extras} outside ${bounds.extras}`);
    check(!geometry.overflow, `${width}: no horizontal overflow`);
    if (width === 1280) {
      check(geometry.cards.every(c => c.y === geometry.cards[0].y), 'PC: three services in one row');
      check(geometry.problems.every(y => y === geometry.problems[0]), 'PC: four worries in one row');
      check(geometry.packagePhoto.x < geometry.packageHeading.x, 'PC: package photograph is left inset');
      check(geometry.representative.x < geometry.strengths.x && geometry.representative.h <= 400, 'PC: portrait left with compact photograph frame');
      check(geometry.faqColumns === 2, 'PC: compact FAQ in two columns');
      check(geometry.photo.x < 520 && geometry.photo.w >= 720, 'PC: large hero photograph extends behind the copy edge');
    } else {
      check(geometry.photo.y < geometry.copy.y && geometry.photo.h <= 260, 'SP: compact hero photograph above copy');
      check(geometry.cards[1].y > geometry.cards[0].y, 'SP: service cards stack');
      check(geometry.problems[3] - geometry.problems[0] < 480, 'SP: compact icon/text worry rows');
    }
    console.info(JSON.stringify({width, ...geometry}));
    await page.close();
  }
} finally { await browser.close(); await server.close(); }
assert.equal(failures.length, 0, failures.join('\n'));
console.info(`top-comp-geometry: ${checks} checks PASS`);
