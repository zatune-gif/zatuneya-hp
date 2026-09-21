import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { startQaServer } from './qa-server.mjs';

const root = resolve(import.meta.dirname, '..');
const fixture = JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures', 'top-comp-section-geometry.json'), 'utf8'));
const faultArg = process.argv.find(argument => argument.startsWith('--inject-fault='));
const injectedFault = faultArg?.split('=')[1] ?? null;
const faultStyles = {
  'tiny-text': '.problem-card p{font-size:8px!important}',
  'remove-gutter': '.problem-card{transform:translateX(-32px)!important}',
  'image-aspect': '.hero-visual{height:96px!important}',
  'card-columns': '@media(max-width:400px){.problem-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}}',
  'hide-section': '#tools{display:none!important}'
};
if (injectedFault) assert.ok(faultStyles[injectedFault], `known injected fault: ${injectedFault}`);

const expectedSections = ['hero', 'problems', 'package', 'services', 'journey', 'why-us', 'cases', 'tools', 'faq', 'final-cta'];
const viewports = [320, 375, 768, 1280];
const mobileSource = fixture.sources.mobile;
const desktopSource = fixture.sources.desktop;
const mobileAnchors = fixture.measuredAnchors.mobile;
const desktopAnchors = fixture.measuredAnchors.desktop;
const tolerance = fixture.tolerances;
const mobileGutterRatio = mobileAnchors.contentGutter.x / mobileSource.width;
const desktopGutterRatio = desktopAnchors.contentGutter.x / desktopSource.width;
const mobileHeroWidthRatio = mobileAnchors.heroPhoto.width / mobileSource.width;
const mobileHeroHeightAt375 = mobileAnchors.heroPhoto.height * 375 / mobileSource.width;
const desktopHeroStartRatio = desktopAnchors.heroPhoto.x / desktopSource.width;
const desktopHeroWidthRatio = desktopAnchors.heroPhoto.width / desktopSource.width;
const mobileServiceAspect = mobileAnchors.servicePhoto.width / mobileAnchors.servicePhoto.height;
const desktopServiceAspect = desktopAnchors.servicePhoto.width / desktopAnchors.servicePhoto.height;
const server = await startQaServer(root);
const browser = await chromium.launch();
const failures = [];
let checks = 0;
const check = (condition, label) => { checks += 1; if (!condition) failures.push(label); };
const near = (a, b, tolerance = 1) => Math.abs(a - b) <= tolerance;
const increasing = values => values.every((value, index) => index === 0 || value > values[index - 1]);
const uniqueNear = values => values.reduce((groups, value) => {
  if (!groups.some(group => near(group, value, 1))) groups.push(value);
  return groups;
}, []);

try {
  for (const [kind, source] of Object.entries(fixture.sources)) {
    const png = readFileSync(join(root, 'assets', 'comp-parts', source.file));
    check(png.readUInt32BE(16) === source.width && png.readUInt32BE(20) === source.height, `${kind}: approved comp source dimensions stay ${source.width}x${source.height}`);
    for (const [name, crop] of Object.entries(fixture.crops[kind])) {
      check(crop.x >= 0 && crop.y >= 0 && crop.width > 0 && crop.height > 0 && crop.x + crop.width <= source.width && crop.y + crop.height <= source.height, `${kind} ${name}: crop remains inside approved comp`);
    }
    for (const [name, anchor] of Object.entries(fixture.measuredAnchors[kind])) {
      const crop = fixture.crops[kind][anchor.crop];
      check(Boolean(crop), `${kind} ${name}: measured anchor names an approved common-section crop`);
      if ('width' in anchor) {
        check(anchor.x >= 0 && anchor.y >= 0 && anchor.width > 0 && anchor.height > 0 && anchor.x + anchor.width <= crop.width && anchor.y + anchor.height <= crop.height, `${kind} ${name}: measured visual anchor remains inside ${anchor.crop} crop`);
      } else {
        check(anchor.x >= 0 && anchor.x <= crop.width, `${kind} ${name}: measured gutter remains inside ${anchor.crop} crop`);
      }
    }
  }

  for (const width of viewports) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    await page.addInitScript(() => sessionStorage.setItem('sticky-cta-closed', '1'));
    await page.goto(`${server.origin}/index.html`);
    if (injectedFault) await page.addStyleTag({ content: faultStyles[injectedFault] });
    await page.evaluate(async () => {
      await document.fonts.ready;
      document.querySelectorAll('img').forEach(image => { image.loading = 'eager'; });
      await Promise.all([...document.images].map(image => image.decode()));
      document.querySelectorAll('.fade-in').forEach(node => node.classList.add('is-visible'));
    });
    const layout = await page.evaluate(() => {
      const rect = element => {
        const box = element.getBoundingClientRect();
        return { x: box.x, y: box.y, width: box.width, height: box.height, right: box.right, bottom: box.bottom };
      };
      const many = selector => [...document.querySelectorAll(selector)].map(rect);
      const fontSizes = selector => [...document.querySelectorAll(selector)].filter(element => element.getClientRects().length).map(element => Number.parseFloat(getComputedStyle(element).fontSize));
      const targetSizes = selector => [...document.querySelectorAll(selector)].filter(element => element.getClientRects().length).map(element => ({ selector: element.className || element.tagName, ...rect(element) }));
      return {
        overflow: document.documentElement.scrollWidth > innerWidth,
        sectionIds: [...document.querySelectorAll('main > section[id]')].map(section => section.id),
        sectionBoxes: Object.fromEntries([...document.querySelectorAll('main > section[id]')].map(section => [section.id, rect(section)])),
        heroPhoto: rect(document.querySelector('.hero-visual')),
        heroCopy: rect(document.querySelector('.hero-copy')),
        problemCards: many('.problem-card'),
        packageHeading: rect(document.querySelector('.package-heading')),
        packagePhoto: rect(document.querySelector('.package-visual')),
        packageDetail: rect(document.querySelector('.package-detail')),
        serviceCards: many('.service-card'),
        serviceFigures: many('.service-card figure'),
        journeyItems: many('.journey-steps li'),
        caseCards: many('.case-card'),
        toolCards: many('.tool-card'),
        faqItems: many('.faq-item'),
        captions: fontSizes('.brand-copy small,.service-price small,.sticky-cta__description,.footer-row small'),
        mobileBody: fontSizes('.hero-lead,.problem-card p,.package-heading>p:last-child,.package-column li,.service-card p,.journey-steps span,.why-us-points p,.case-card>p:not(.case-type),.tool-card p'),
        primaryTargets: targetSizes('.v3-button,.service-card .card-link,.tool-action,.faq-trigger,.sticky-cta__btn,.sticky-cta__close')
      };
    });

    const compGutterRatio = width <= 400 ? mobileGutterRatio : desktopGutterRatio;
    const minimumGutter = Math.max(16, (compGutterRatio - tolerance.gutterRatio) * width);
    check(!layout.overflow, `${width}: no horizontal overflow`);
    check(JSON.stringify(layout.sectionIds) === JSON.stringify(expectedSections), `${width}: all ten sections keep their approved order`);
    check(Object.values(layout.sectionBoxes).every(box => box.height > 0), `${width}: no required section is hidden`);
    check(layout.problemCards.length === 4, `${width}: four problem cards remain`);
    check(layout.serviceCards.length === 3, `${width}: three service cards remain`);
    check(layout.journeyItems.length === 5, `${width}: five journey steps remain`);
    check(layout.caseCards.length === 3 && layout.toolCards.length === 2 && layout.faqItems.length === 6, `${width}: comp-omitted canonical sections keep 3 cases, 2 tools and 6 FAQs`);
    check([...layout.problemCards, ...layout.serviceCards].every(box => box.x >= minimumGutter - 1 && box.right <= width - minimumGutter + 1), `${width}: cards keep comp-derived side gutters (minimum ${minimumGutter.toFixed(1)}px)`);
    check(layout.captions.every(size => size >= 12), `${width}: named captions stay at least 12px`);
    if (width <= 400) check(layout.mobileBody.every(size => size >= 14), `${width}: mobile body text stays at least 14px`);
    check(layout.primaryTargets.every(target => target.width >= 44 && target.height >= 44), `${width}: primary interactive targets stay at least 44x44px`);

    if (width <= 400) {
      check(layout.heroPhoto.y < layout.heroCopy.y && Math.abs(layout.heroPhoto.height - mobileHeroHeightAt375) <= tolerance.mobileHeroHeightAt375Px, `${width}: mobile Hero keeps the comp-derived photo-first height`);
      check(Math.abs(layout.heroPhoto.width / width - mobileHeroWidthRatio) <= tolerance.mobileHeroWidthRatio, `${width}: mobile Hero photograph keeps the comp-derived inset width`);
      check(uniqueNear(layout.problemCards.map(card => card.x)).length === 1 && increasing(layout.problemCards.map(card => card.y)), `${width}: four problem cards form one vertical sequence`);
      check(uniqueNear(layout.serviceCards.map(card => card.x)).length === 1 && increasing(layout.serviceCards.map(card => card.y)), `${width}: three service cards form one vertical sequence`);
      check(layout.packageHeading.y < layout.packagePhoto.y && layout.packagePhoto.bottom <= layout.packageDetail.y + 1, `${width}: package follows heading, photo, detail order`);
      check(layout.serviceFigures.every(figure => Math.abs(figure.width / figure.height - mobileServiceAspect) <= tolerance.mobileServiceAspect), `${width}: mobile service photos retain the comp-derived landscape ratio`);
    } else if (width === 768) {
      check(layout.heroPhoto.y < layout.heroCopy.y && layout.heroPhoto.height >= 240 && layout.heroPhoto.height <= 280, '768: Hero photo remains above the copy');
      check(uniqueNear(layout.problemCards.map(card => card.x)).length === 2 && uniqueNear(layout.problemCards.map(card => card.y)).length === 2, '768: problem cards use a balanced two-by-two grid');
      check(uniqueNear(layout.serviceCards.map(card => card.x)).length === 1 && increasing(layout.serviceCards.map(card => card.y)), '768: service cards stack without narrow columns');
      check(layout.serviceFigures.every(figure => Math.abs(figure.width / figure.height - desktopServiceAspect) <= tolerance.desktopServiceAspect), '768: service photos retain the comp-derived landscape ratio');
    } else {
      check(Math.abs(layout.heroPhoto.x / width - desktopHeroStartRatio) <= tolerance.desktopHeroRatio && Math.abs(layout.heroPhoto.width / width - desktopHeroWidthRatio) <= tolerance.desktopHeroRatio, '1280: Hero photograph keeps the comp-derived right-side share');
      check(uniqueNear(layout.problemCards.map(card => card.y)).length === 1, '1280: four problem cards share one row');
      check(uniqueNear(layout.serviceCards.map(card => card.y)).length === 1, '1280: three service cards share one row');
      check(uniqueNear(layout.journeyItems.map(item => item.y)).length === 1, '1280: five journey steps share one row');
      check(layout.packagePhoto.x < layout.packageHeading.x && layout.packageDetail.y >= Math.max(layout.packagePhoto.bottom, layout.packageHeading.bottom) - 1, '1280: package keeps image-left, heading-right, detail-below composition');
      check(layout.serviceFigures.every(figure => Math.abs(figure.width / figure.height - desktopServiceAspect) <= tolerance.desktopServiceAspect), '1280: service photos retain the comp-derived landscape ratio');
    }
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}

assert.equal(failures.length, 0, failures.join('\n'));
console.info(`top-comp-section-geometry: ${checks} checks PASS${injectedFault ? ` (fault: ${injectedFault})` : ''}`);
