import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const origin = 'https://zatune-gif.github.io/zatuneya-hp/v2/';
let checks = 0;
const check = (condition, message) => { checks += 1; assert.ok(condition, message); };

// ---- shared CSS file must exist ----
check(existsSync(join(root, 'services-comp.css')), 'services-comp.css exists');
const compCss = readFileSync(join(root, 'services-comp.css'), 'utf8');
check(!/top-comp\.css[\s\S]*\{/.test(compCss) || true, 'services-comp.css is its own file (sanity)');

const pages = [
  'services.html',
  'service-training.html',
  'service-order.html',
  'service-management.html',
  'service-banso.html'
];

const detailPages = pages.slice(1);

for (const page of pages) {
  const path = join(root, page);
  check(existsSync(path), `${page} exists`);
  const html = readFileSync(path, 'utf8');

  check(/<html lang="ja">/i.test(html), `${page} declares Japanese`);
  check(html.includes('rel="stylesheet" href="./top-comp.css"'), `${page} loads shared top-comp.css`);
  check(html.includes('rel="stylesheet" href="./services-comp.css"'), `${page} loads services-comp.css`);
  check(!html.includes('href="./style.css"'), `${page} no longer loads legacy style.css`);
  check(!/<style>/.test(html), `${page} has no embedded <style> block`);
  check(!/\sstyle\s*=/.test(html), `${page} adds no inline styles`);
  check(!/\balert\(|\bconfirm\(|\bprompt\(/.test(html), `${page} avoids blocking dialogs`);
  check(html.includes('<script src="./nav.js" defer></script>'), `${page} includes nav.js`);
  check(html.includes(`rel="canonical" href="${origin}${page}"`), `${page} has correct V2 canonical URL`);
  check(html.includes('https://han-ai-diagnosis.netlify.app/'), `${page} links the primary diagnosis CTA`);
  check(html.includes('href="./contact.html"'), `${page} links the secondary contact CTA`);
  check(html.includes('© 2026 ざつね屋'), `${page} has the correct copyright notice`);
  check(html.includes('id="nav-hamburger"') && html.includes('id="site-nav"'), `${page} keeps nav.js DOM contract`);
  check(/サービス<\/a>/.test(html) && html.includes('aria-current="page"'), `${page} marks サービス nav item as current`);
  check(!html.includes('href="#prices"'), `${page} does not use a same-page #prices anchor (fixed to index.html#prices)`);

  for (const match of html.matchAll(/(?:href|src)="(\.\/[^"?#]+)(?:[?#][^"]*)?"/g)) {
    check(existsSync(join(root, match[1].replace(/^\.\//, ''))), `${page} local reference exists: ${match[1]}`);
  }
  for (const img of html.matchAll(/<img\b[^>]*>/g)) {
    check(/\salt="[^"]+"/.test(img[0]), `${page} image has non-empty alt text: ${img[0].slice(0, 60)}`);
  }
}

// ---- services.html specific ----
{
  const html = readFileSync(join(root, 'services.html'), 'utf8');
  check(html.includes('「使える」まで、'), 'services.html hero H1 line 1 matches comp');
  check(html.includes('一緒に整える。'), 'services.html hero H1 line 2 matches comp');
  check(html.includes('今の困りごとから、選べる4つの入口。'), 'services.html section-2 heading matches comp');
  check(html.includes('道具より先に、仕事を見ます。'), 'services.html philosophy heading matches comp');
  check(html.includes('まずは、今の困りごとを聞かせてください。'), 'services.html bottom CTA band heading matches comp');
  for (const title of ['AI研修・教育', 'オーダーメイド開発', '業務改善・経営支援', '伴走サポート']) {
    check(html.includes(title), `services.html includes support card: ${title}`);
  }
  check((html.match(/class="assist-card(?: accent)?"/g) || []).length === 4, 'services.html has exactly 4 assist cards');
  check(html.includes('href="./service-training.html"'), 'services.html links service-training.html');
  check(html.includes('href="./service-order.html"'), 'services.html links service-order.html');
  check(html.includes('href="./service-management.html"'), 'services.html links service-management.html');
  check(html.includes('href="./service-banso.html"'), 'services.html links service-banso.html');
}

// ---- service-detail pages: shared template checks ----
const detailExpectations = {
  'service-training.html': {
    h1: 'AI研修ワークショップ',
    lead: '自分でAIを使えるようになる',
    price: '60,000円'
  },
  'service-order.html': {
    h1: 'AI業務改善オーダーメイドサービス',
    lead: '使える仕組みを手元に残す',
    price: '50,000円'
  },
  'service-management.html': {
    h1: 'AI経営改善パッケージ',
    lead: '経営視点で整えてから動かす',
    price: '360,000円'
  },
  'service-banso.html': {
    h1: 'AI活用伴走サービス',
    lead: '一緒に走り続ける',
    price: '60,000円'
  }
};

for (const page of detailPages) {
  const html = readFileSync(join(root, page), 'utf8');
  const exp = detailExpectations[page];
  check(html.includes(`SERVICE DETAIL / ${exp.h1}`), `${page} hero eyebrow includes service name`);
  check(html.includes(`<h1>${exp.h1}</h1>`), `${page} hero H1 matches existing service name (no invented copy)`);
  check(html.includes(exp.lead), `${page} hero lead reuses existing catch copy`);
  check(html.includes(exp.price), `${page} keeps existing real price figure`);
  check(html.includes('こんな時に'), `${page} has こんな時に section (comp template)`);
  check(html.includes('進め方'), `${page} has 進め方 section (comp template)`);
  check(html.includes('提供内容'), `${page} has 提供内容 section (comp template)`);
  check((html.match(/class="pain-card/g) || []).length === 3, `${page} has exactly 3 pain cards (こんな時に)`);
  check((html.match(/class="process-item/g) || []).length === 3, `${page} has exactly 3 process steps (進め方)`);
  check(html.includes('AI活用診断（無料）'), `${page} hero CTA is the primary diagnosis CTA`);
}

console.log(`PASS ${checks} services-comp contract checks`);
