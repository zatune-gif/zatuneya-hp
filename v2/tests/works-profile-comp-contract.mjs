import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { chromium } from 'playwright';

const root = resolve(import.meta.dirname, '..');
const origin = 'https://zatune-gif.github.io/zatuneya-hp/v2/';
let checks = 0;
const check = (condition, message) => { checks += 1; assert.ok(condition, message); };
const sharedCss = readFileSync(join(root, 'top-comp.css'), 'utf8');

check(/\.skip\{[^}]*left:-999px/.test(sharedCss), 'lower shared CSS hides skip links before focus');
check(/\.skip:focus\{[^}]*left:16px/.test(sharedCss), 'lower shared CSS reveals skip links on focus');
check(/\.btn-orange\{[^}]*min-height:44px[^}]*background:var\(--orange\)/.test(sharedCss), 'lower shared CSS preserves styled 44px orange CTAs');

/* ── works.html ── */
const worksPath = join(root, 'works.html');
check(existsSync(worksPath), 'works.html exists');
const works = readFileSync(worksPath, 'utf8');

check(works.includes('href="./top-comp.css"'), 'works.html loads the shared TOP comp stylesheet');
check(works.includes('href="./works-profile-comp.css"'), 'works.html loads its own comp stylesheet');
check(!/href="\.\/style\.css"/.test(works), 'works.html no longer loads the legacy style.css');
check(!/<style[\s>]/i.test(works), 'works.html has no embedded <style> block');
check(!/style\s*=\s*"/.test(works), 'works.html adds no inline style attributes');
check(!/\b(alert|confirm|prompt)\s*\(/.test(works), 'works.html avoids blocking dialogs');
check(works.includes(`rel="canonical" href="${origin}works.html"`), 'works.html has the V2 canonical URL');
check(works.includes('© 2026 ざつね屋'), 'works.html has the 2026 copyright line');
check(works.includes('<script src="./nav.js" defer></script>'), 'works.html loads nav.js');
check(/aria-current="page"[^>]*>導入事例/.test(works) || /導入事例[^<]*<\/a>[^>]*aria-current="page"/.test(works.replace(/\n/g, '')), 'works.html marks 導入事例 nav link as current');

for (const token of [
  'WORKS', '導入事例',
  '変わったのは、', '毎日の手触り。',
  '会議メモが、次の仕事につながるまで。',
  '業務改善', '毎月の集計を、迷わない流れに。',
  '伴走サポート', '相談できる場所を、日常のそばに。',
  '要確認',
]) check(works.includes(token), `works.html contains: ${token}`);

check(works.includes('https://han-ai-diagnosis.netlify.app/'), 'works.html has the primary diagnosis CTA link');
check(works.includes('href="./contact.html"'), 'works.html has the secondary contact CTA link');
check(works.includes('./assets/band-onsite.jpg') || works.includes('./assets/band-together.jpg'), 'works.html reuses an existing band photo asset');

/* ── profile.html ── */
const profilePath = join(root, 'profile.html');
check(existsSync(profilePath), 'profile.html exists');
const profile = readFileSync(profilePath, 'utf8');

check(profile.includes('href="./top-comp.css"'), 'profile.html loads the shared TOP comp stylesheet');
check(profile.includes('href="./works-profile-comp.css"'), 'profile.html loads its own comp stylesheet');
check(!/href="\.\/style\.css"/.test(profile), 'profile.html no longer loads the legacy style.css');
check(!/<style[\s>]/i.test(profile), 'profile.html has no embedded <style> block');
check(!/style\s*=\s*"/.test(profile), 'profile.html adds no inline style attributes');
check(!/\b(alert|confirm|prompt)\s*\(/.test(profile), 'profile.html avoids blocking dialogs');
check(profile.includes(`rel="canonical" href="${origin}profile.html"`), 'profile.html has the V2 canonical URL');
check(profile.includes('© 2026 ざつね屋'), 'profile.html has the 2026 copyright line');
check(profile.includes('<script src="./nav.js" defer></script>'), 'profile.html loads nav.js');
check(/aria-current="page"[^>]*>代表プロフィール/.test(profile), 'profile.html marks 代表プロフィール nav link as current');

for (const token of [
  'PROFILE', '代表プロフィール',
  '「難しそう」を、', 'いっしょに越えていく。',
  'これまでの経歴と、この事業で活きる強み',
  'パソコン講師', 'NPO法人代表', 'コンテンツライター', 'Webディレクター',
  'カスタマーエンジニア', '企業の課長職', 'DX推進担当', '専門学校の担任', 'AIプロダクト開発',
  '「教えられる実装者」が、業務整理から伴走します',
  '支援で大切にしていること',
  '要確認',
]) check(profile.includes(token), `profile.html contains: ${token}`);

check(profile.includes('https://han-ai-diagnosis.netlify.app/'), 'profile.html has the primary diagnosis CTA link');
check(profile.includes('href="./contact.html"'), 'profile.html has the secondary contact CTA link');
check(profile.includes('./assets/profile-portrait-2.jpg'), 'profile.html keeps the existing portrait asset');

/* ── shared lower-page header parity ── */
// The V3 TOP header has its own contract in top-comp-contract.mjs. These
// lower pages intentionally retain their existing shared header instead of
// inheriting the TOP markup verbatim.
const extractLowerPageHeader = (html, filename) => {
  const match = html.match(/<header class="comp-header">[\s\S]*?<\/header>/);
  check(!!match, `${filename} has a comp-header block`);
  return match ? match[0].replace(/\s*aria-current="page"/g, '').replace(/\s+/g, ' ').trim() : '';
};

const worksHeader = extractLowerPageHeader(works, 'works.html');
const profileHeader = extractLowerPageHeader(profile, 'profile.html');
check(worksHeader === profileHeader, 'works.html and profile.html retain identical lower-page header markup except aria-current');

for (const [filename, header] of [
  ['works.html', worksHeader],
  ['profile.html', profileHeader],
]) {
  check(header.includes('<nav id="site-nav" class="comp-nav" aria-label="主要ナビゲーション">'), `${filename} header retains the accessible primary navigation hook`);
  check(header.includes('<button id="nav-hamburger" class="comp-menu" type="button" aria-label="メニューを開く" aria-expanded="false">'), `${filename} header retains the accessible mobile-menu hook`);
  for (const href of [
    './services.html',
    'https://han-ai-diagnosis.netlify.app/',
    './works.html',
    './profile.html',
    '#prices',
    './contact.html',
  ]) check(header.includes(`href="${href}"`), `${filename} header retains nav link: ${href}`);
}

/* ── shared lower-page footer parity ── */
// The V3 TOP footer has its own contract in top-comp-contract.mjs. These
// lower pages intentionally retain their existing shared footer instead of
// inheriting the TOP markup verbatim.
const extractLowerPageFooter = (html, filename) => {
  const match = html.match(/<footer class="comp-footer">[\s\S]*?<\/footer>/);
  check(!!match, `${filename} has a comp-footer block`);
  return match ? match[0].replace(/\s+/g, ' ').trim() : '';
};

const worksFooter = extractLowerPageFooter(works, 'works.html');
const profileFooter = extractLowerPageFooter(profile, 'profile.html');
check(worksFooter === profileFooter, 'works.html and profile.html retain identical lower-page footer markup');

for (const [filename, footer] of [
  ['works.html', worksFooter],
  ['profile.html', profileFooter],
]) {
  check(footer.includes('© 2026 ざつね屋'), `${filename} footer retains the 2026 copyright line`);
  for (const href of [
    './services.html',
    'https://han-ai-diagnosis.netlify.app/',
    './works.html',
    './profile.html',
    '#prices',
    './contact.html',
  ]) check(footer.includes(`href="${href}"`), `${filename} footer retains link: ${href}`);
}

const lowerPages = [
  '404.html',
  'contact.html',
  'faq.html',
  'privacy.html',
  'profile.html',
  'service-banso.html',
  'service-management.html',
  'service-order.html',
  'service-training.html',
  'services.html',
  'thank-you.html',
  'tokusho.html',
  'works.html'
];
const discoveredLowerPages = readdirSync(root)
  .filter((filename) => filename.endsWith('.html') && filename !== 'index.html')
  .filter((filename) => readFileSync(join(root, filename), 'utf8').includes('href="./top-comp.css"'))
  .sort();
check(
  JSON.stringify(lowerPages) === JSON.stringify(discoveredLowerPages),
  'lower-page browser coverage deterministically includes every non-index HTML page that loads top-comp.css'
);
for (const filename of lowerPages) {
  const html = readFileSync(join(root, filename), 'utf8');
  check(html.includes('href="./top-comp.css"'), `${filename} loads the shared TOP stylesheet`);
  check(html.includes('<script src="./nav.js" defer></script>'), `${filename} loads the shared navigation script`);
  check(html.includes('id="site-nav"'), `${filename} has the primary navigation hook`);
  check(html.includes('id="nav-hamburger"'), `${filename} has the mobile navigation hook`);
}
console.log(`PASS ${checks} works/profile comp contract checks`);
const viewports = [375, 768, 1280];
const mime = new Map([
  ['.css', 'text/css; charset=utf-8'], ['.html', 'text/html; charset=utf-8'], ['.ico', 'image/x-icon'],
  ['.jpg', 'image/jpeg'], ['.js', 'text/javascript; charset=utf-8'], ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'], ['.webp', 'image/webp']
]);
let server;
let browser;
let baseUrl;
try {
  server = createServer((request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      const target = resolve(root, `.${decodeURIComponent(url.pathname === '/' ? '/works.html' : url.pathname)}`);
      assert.ok(target === root || target.startsWith(`${root}${sep}`), 'browser server stays within v2');
      response.writeHead(200, { 'content-type': mime.get(extname(target)) ?? 'application/octet-stream' });
      response.end(readFileSync(target));
    } catch {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Not found');
    }
  });
  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', rejectListen);
      const address = server.address();
      assert.ok(address && typeof address !== 'string', 'lower-page browser server exposes a numeric port');
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolveListen();
    });
  });
  browser = await chromium.launch();
  for (const file of lowerPages) {
    for (const width of viewports) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      try {
        await page.goto(`${baseUrl}/${file}`, { waitUntil: 'domcontentloaded', timeout: 5_000 });
        await page.locator('body').waitFor({ state: 'visible' });
        assert.equal(await page.evaluate(() => [...document.styleSheets].some((sheet) => sheet.href.endsWith('/top-comp.css'))), true,
          `${file} loads top-comp.css before browser checks`);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true,
          `${file} has no horizontal overflow at ${width}px`);
        const skip = page.locator('.skip');
        if (await skip.count()) {
          assert.equal(await skip.first().evaluate((element) => getComputedStyle(element).left), '-999px',
            `${file} visually hides its skip link before focus at ${width}px`);
          await skip.first().focus();
          assert.equal(await skip.first().evaluate((element) => getComputedStyle(element).left), '16px',
            `${file} reveals its skip link on focus at ${width}px`);
        }
        const orangeButtons = page.locator('.btn-orange');
        if (await orangeButtons.count()) {
          assert.ok(await orangeButtons.first().evaluate((element) => element.getBoundingClientRect().height >= 44),
            `${file} orange call-to-action is at least 44px high at ${width}px`);
          assert.notEqual(await orangeButtons.first().evaluate((element) => getComputedStyle(element).backgroundColor), 'rgba(0, 0, 0, 0)',
            `${file} orange call-to-action keeps a visible background at ${width}px`);
        }
        assert.equal(await page.locator('#site-nav').count(), 1, `${file} exposes one primary navigation element`);
        assert.equal(await page.locator('#nav-hamburger').count(), 1, `${file} exposes one mobile navigation control`);
      } finally {
        await page.close();
      }
    }
  }
  console.log('PASS lower-page browser checks: 13 pages × 3 viewports');
} finally {
  if (browser) await browser.close();
  if (server?.listening) await new Promise((done) => server.close(done));
}
