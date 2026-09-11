import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { startQaServer } from './qa-server.mjs';

// Bounds are independent measurements from the approved 722x2178 combined
// comp, normalized to readable production viewports. They deliberately reject
// the former extra value/growth sections and its overlong mobile page.
const budgets = {
  1280: { total: [4300, 5100], header: [76, 88], hero: [570, 670], problems: [390, 520], package: [500, 680], services: [600, 760] },
  375: { total: [7200, 8200], header: [76, 88], hero: [680, 820], problems: [720, 860], package: [1040, 1260], services: [1480, 1760] }
};

const server = await startQaServer(resolve(import.meta.dirname, '..'));
const browser = await chromium.launch();
const failures = [];
let checks = 0;
function check(ok, label) { checks += 1; if (!ok) failures.push(label); }
try {
  for (const width of [1280, 375]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    await page.addInitScript(() => sessionStorage.setItem('sticky-cta-closed', '1'));
    await page.goto(server.origin);
    await page.evaluate(async () => {
      await document.fonts.ready;
      document.querySelectorAll('img').forEach(image => { image.loading = 'eager'; });
      await Promise.all([...document.images].map(image => image.decode()));
      document.querySelectorAll('.fade-in').forEach(node => node.classList.add('is-visible'));
    });
    const geometry = await page.evaluate(() => {
      const box = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { x:r.x, y:r.y, w:r.width, h:r.height }; };
      return {
        total: document.documentElement.scrollHeight,
        overflow: document.documentElement.scrollWidth > innerWidth,
        header: box('.comp-header'), hero: box('#hero'), copy: box('.hero-copy'), photo: box('.hero-visual'),
        problems: box('#problems'), package: box('#package'), services: box('#services'), journey: box('#journey'),
        whyUs: box('#why-us'), cases: box('#cases'), tools: box('#tools'), faq: box('#faq'), finalCta: box('#final-cta'), footer: box('.comp-footer'),
        representative: box('.representative-card img'), strengths: box('.why-us-copy'), packagePhoto: box('.package-visual'), packageHeading: box('.package-heading'),
        serviceCards: [...document.querySelectorAll('.service-card')].map(el => { const r = el.getBoundingClientRect(); return { x:r.x, y:r.y, w:r.width }; }),
        problemCards: [...document.querySelectorAll('.problem-card')].map(el => { const r = el.getBoundingClientRect(); return { x:r.x, y:r.y }; }),
        journeyItems: [...document.querySelectorAll('.journey-steps li')].map(el => { const r = el.getBoundingClientRect(); return { x:r.x, y:r.y }; }),
        faqColumns: getComputedStyle(document.querySelector('.faq-list')).gridTemplateColumns.split(' ').length,
        topSectionIds: [...document.querySelectorAll('main > section[id]')].map(node => node.id),
        packageChildren: [...document.querySelectorAll('.package-panel > *')].map(el => { const r=el.getBoundingClientRect(); return { className: el.className, x:r.x,y:r.y,w:r.width,h:r.height }; }),
        packageColumns: [...document.querySelectorAll('.package-column')].map(el => { const r=el.getBoundingClientRect(); const s=getComputedStyle(el); return { h:r.height, scrollHeight:el.scrollHeight, display:s.display, gridRows:s.gridTemplateRows, fontSize:s.fontSize, lineHeight:s.lineHeight, children:[...el.children].map(child=>{const c=child.getBoundingClientRect();return {tag:child.tagName,className:child.className,h:c.height,scrollHeight:child.scrollHeight}}) }; }),
        packageSteps: [...document.querySelectorAll('.package-steps li')].map(el=>{const r=el.getBoundingClientRect();const s=getComputedStyle(el);return {h:r.height,gridRows:s.gridTemplateRows,align:s.alignItems,child:[...el.children].map(c=>({tag:c.tagName,h:c.getBoundingClientRect().height,display:getComputedStyle(c).display}))}}),
        widest: [...document.querySelectorAll('body *')].map(el => { const r=el.getBoundingClientRect(); return { tag:el.tagName, className:el.className?.baseVal ?? el.className, left:r.left,right:r.right,w:r.width }; }).filter(item => item.left < -0.5 || item.right > innerWidth + .5).sort((a,b)=>b.w-a.w).slice(0,8)
      };
    });
    const bounds = budgets[width];
    for (const key of ['total', 'header', 'hero', 'problems', 'package', 'services']) {
      const actual = key === 'total' ? geometry.total : geometry[key].h;
      check(actual >= bounds[key][0] && actual <= bounds[key][1], `${width} ${key}: ${actual} outside ${bounds[key]}`);
    }
    check(!geometry.overflow, `${width}: no horizontal overflow`);
    check(JSON.stringify(geometry.topSectionIds) === JSON.stringify(['hero','problems','package','services','journey','why-us','cases','tools','faq','final-cta']), `${width}: approved ten-section order`);
    if (width === 1280) {
      check(geometry.serviceCards.every(card => card.y === geometry.serviceCards[0].y), 'PC: three services in one row');
      check(geometry.problemCards.every(card => card.y === geometry.problemCards[0].y), 'PC: four problems in one row');
      check(geometry.journeyItems.every(item => item.y === geometry.journeyItems[0].y), 'PC: five journey steps in one row');
      check(geometry.packagePhoto.x < geometry.packageHeading.x, 'PC: package image is left of heading');
      check(geometry.representative.x < geometry.strengths.x, 'PC: representative image is left of strengths');
      check(geometry.faqColumns === 2, 'PC: FAQ uses two columns');
      check(geometry.photo.x >= 400 && geometry.photo.x <= 460 && geometry.photo.w >= 820, 'PC: hero photograph begins near one-third and owns the right side');
    } else {
      check(geometry.photo.y < geometry.copy.y && geometry.photo.h >= 220 && geometry.photo.h <= 270, 'SP: hero image is above copy');
      check(geometry.serviceCards[1].y > geometry.serviceCards[0].y, 'SP: services stack');
      check(geometry.problemCards[1].y > geometry.problemCards[0].y, 'SP: problems stack compactly');
      check(geometry.faqColumns === 1, 'SP: FAQ uses one column');
    }
    console.info(JSON.stringify({ width, ...geometry }));
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}
assert.equal(failures.length, 0, failures.join('\n'));
console.info(`top-comp-geometry: ${checks} checks PASS`);
