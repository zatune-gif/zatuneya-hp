import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { stagingPages } from '../../tools/publication-package.mjs';

const root = resolve(import.meta.dirname, '..');
const read = name => readFileSync(join(root, name), 'utf8');
const html = read('index.html');
let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks++; };
const sectionIds = ['hero', 'problems', 'thinking', 'service', 'kaizen', 'jisso', 'choose', 'check', 'works', 'profile', 'price', 'faq', 'contact'];
const actualIds = [...html.matchAll(/<section\b[^>]*\bid="([^"]+)"/g)].map(match => match[1]);
assert.deepEqual(actualIds, sectionIds, 'Ver.5 LP has 13 sections in the approved order'); checks++;
for (const id of sectionIds) check(html.includes(`id="${id}"`), 'missing section #' + id);
for (const phrase of [
  '業務を見直し、', '現場で使える仕組みまで。', '業務の見直し支援（業務改善）',
  '320,000円（税別）', 'ざつね屋の作業時間 16時間', 'オプション：AI活用設計',
  'オプション：運用保守', '対応は平日日中です（24時間対応は承っておりません）',
  '上記以外のご相談（複数の部署にまたがる見直しなど）',
  '883品番・24,923件', '業務の現在地チェック', '約7分'
]) check(html.includes(phrase), 'missing approved text: ' + phrase);
check((html.match(/<tr>/g) ?? []).length === 6, 'price table has header and five rows');
check((html.match(/<details class="faq-item">/g) ?? []).length === 12, 'eleven FAQ answers plus contract terms accordion');
check((html.match(/data-diagnosis-link/g) ?? []).length >= 6, 'four diagnosis placements plus navigation/footer');
for (const selector of ['id="nav-hamburger"', 'id="site-nav"', 'site-nav__dropdown-trigger', 'id="sticky-cta"', 'class="fade-in"']) {
  check(html.includes(selector) || (selector === 'class="fade-in"' && html.includes(' fade-in"')), 'nav.js DOM contract: ' + selector);
}
const redirects = {
  'services.html': 'service', 'service-training.html': 'faq',
  'works.html': 'works', 'faq.html': 'faq',
  'service-management.html': 'kaizen', 'service-order.html': 'kaizen'
};
for (const [page, anchor] of Object.entries(redirects)) {
  const source = read(page);
  check(source.includes(`content="5;url=./index.html#${anchor}"`), page + ' five-second redirect');
  check(source.includes(`href="./index.html#${anchor}"`), page + ' manual link');
  check(source.includes(`rel="canonical" href="https://zatune-gif.github.io/zatuneya-hp/v2/index.html#${anchor}"`), page + ' canonical');
  check(source.includes(`property="og:url" content="https://zatune-gif.github.io/zatuneya-hp/v2/index.html#${anchor}"`), page + ' og:url');
}
for (const page of stagingPages) {
  const source = read(page);
  const head = source.split(/<\/head>/i)[0];
  check(/<html\s+lang="ja"/i.test(source), page + ' Japanese document language');
  check(/<meta\s+name="description"\s+content="[^"]+"/i.test(head), page + ' description');
  const expectedUrl = 'https://zatune-gif.github.io/zatuneya-hp/v2/'
    + (redirects[page] ? 'index.html#' + redirects[page] : page === 'index.html' ? '' : page);
  check(head.includes(`rel="canonical" href="${expectedUrl}"`), page + ' expected canonical URL');
  check(head.includes(`property="og:url" content="${expectedUrl}"`), page + ' expected og:url');
  for (const property of ['type', 'title', 'description', 'image']) {
    check(new RegExp(`<meta\\s+property="og:${property}"\\s+content="[^"]+"`, 'i').test(head), page + ' og:' + property);
  }
  check(head.includes('property="og:type" content="website"'), page + ' website OG type');
  const diagnosisMeta = [...head.matchAll(/<meta\s+name="zatuneya:diagnosis-url"\s+content="([^"]+)"/gi)];
  check(diagnosisMeta.length === 1 && diagnosisMeta[0][1] === 'https://ai-shindan-zatuneya.netlify.app/',
    page + ' unique current diagnosis URL');
  check(!source.includes('han-ai-diagnosis.netlify.app'), page + ' no legacy diagnosis URL');
  check((head.match(/<meta\b[^>]*name="robots"[^>]*>/gi) ?? []).length === 1
    && head.includes('content="noindex,follow"'), page + ' review noindex');
  check(!/\bstyle\s*=/i.test(source), page + ' no inline style');
  check(!/BPR|本格BPR|部門をまたぐ業務の再設計|1,500,000|150万|6社|7社/.test(source), page + ' no prohibited claims');
  if (page !== 'service-banso.html') check(!/href="[^"]*service-banso\.html/.test(source), page + ' no accompanied-service link');
}
check(!/\b(alert|confirm|prompt)\s*\(/.test(read('nav.js')), 'navigation has no native dialogs');
console.log('PASS Ver.5 LP contract: ' + checks + ' checks');
