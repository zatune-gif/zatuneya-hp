import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const html = readFileSync(resolve(root, 'index.html'), 'utf8');
const sharedCss = readFileSync(resolve(root, 'top-comp.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const pageCss = readFileSync(resolve(root, 'v3-top-page.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const nav = readFileSync(resolve(root, 'nav.js'), 'utf8');
const diagnosisUrl = 'https://ai-shindan-zatuneya.netlify.app/';

const expectedSections = [
  'hero', 'problems', 'package', 'services', 'journey',
  'why-us', 'cases', 'tools', 'faq', 'final-cta'
];
const actualSections = [...html.matchAll(/<section\b[^>]*\bid="([^"]+)"[^>]*>/gi)].map(([, id]) => id);
assert.deepEqual(actualSections, expectedSections, 'TOP visible sections follow the approved comp exactly');
assert.doesNotMatch(html, /\bid="(?:value|growth)"/, 'comp-only TOP omits sections absent from the approved comp');

function sectionMarkup(id) {
  const start = html.search(new RegExp(`<section\\b[^>]*\\bid="${id}"[^>]*>`, 'i'));
  assert.ok(start >= 0, `section #${id} exists`);
  const end = html.indexOf('</section>', start);
  assert.ok(end > start, `section #${id} closes`);
  return html.slice(start, end + 10);
}

const requiredCopy = [
  '地域企業の小さな業務変革屋 ／ ざつね屋',
  'AIを入れることより、', '仕事がよくなることから。',
  '数十名規模の会社で、「人が足りない」「引き継ぎが回らない」「同じ説明を何度もしている」。その一つひとつを、現場に入って一緒にほどいていきます。ツールの導入は、そのあとの話です。',
  '無料でAI活用準備度を診断する', 'まず30分、話を聞かせてください',
  '広島県府中市を拠点に、近隣の地域企業を訪問して支援しています。',
  'こんな詰まり方を、していませんか',
  '人が足りず、改善に手が回らない', '特定の人しか分からない仕事がある',
  '同じ説明・同じ入力を繰り返している', 'AIを試してはみたが、続かなかった',
  'どれも、ツールを増やせば解決する話ではありません。まず、仕事の中身を見せてください。',
  'まず3か月、一つの業務を確実に変える', 'AI経営改善パッケージ ／ 360,000円（3か月）',
  '3か月でやること', '受け取れるもの', 'こんな会社に向いています',
  '必要なところから始められます', 'AI実務研修', '個別業務設計', 'AI活用伴走',
  'はじめてのご相談から', '無料診断', 'ご相談（30分・無料）', '小さく試す', 'パッケージで変える', '伴走で広げる',
  'どの段階からでも始められます。「まず話を聞いてみたい」で構いません。',
  '「教えられる人」が、現場に入ります',
  '教えられる実装者', '現場でのデジタル化推進経験', '業務整理から入れる',
  '大音 晃司（おおと こうじ）。広島県府中市を拠点に、地域企業のAI活用を支援しています。',
  'これまでにお手伝いしたこと',
  '以下は仮データです。事実確認済みの匿名事例に差し替え予定です。',
  'まず、無料のツールから', 'AI活用準備度診断', 'プロンプトライブラリ',
  'よくある質問',
  'Q. AIのことがまったく分からなくても大丈夫ですか。',
  'Q. どのくらいの規模の会社が対象ですか。',
  'Q. 遠方でも対応してもらえますか。',
  '研修は何名から受けられますか？', '費用の目安を教えてください。', '伴走支援とはどのような内容ですか？',
  '「何から手をつけるか」から一緒に考えます。売り込みはしません。',
  'まずは無料診断から', '診断する', '© 2026 ざつね屋'
];
const text = html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');
for (const copy of requiredCopy) assert.ok(text.includes(copy), `approved copy exists: ${copy}`);

assert.equal((html.match(/<h1\b/gi) ?? []).length, 1, 'TOP has one h1');
assert.match(sectionMarkup('hero'), /<h1[^>]*>AIを入れることより、<br><span class="hero-accent">仕事がよくなることから。<\/span><\/h1>/, 'hero breaks at the approved comma');
for (const hook of ['nav-hamburger', 'site-nav', 'sticky-cta', 'sticky-cta-close']) {
  assert.match(html, new RegExp(`\\bid="${hook}"`), `DOM hook #${hook} remains`);
}
assert.match(html, /\bclass="[^"]*\bsite-nav__dropdown-trigger\b/, 'dropdown DOM hook remains');
assert.match(html, /\bclass="[^"]*\bfade-in\b/, 'reveal DOM hook remains');
assert.match(sharedCss, /\.fade-in\{[^}]*opacity:1[^}]*transform:none/, 'fade-in base state is explicit');
assert.match(sharedCss, /\.fade-in\.is-visible\{[^}]*animation:/, 'fade-in visible state declares animation');
assert.match(nav, /IntersectionObserver/, 'nav script activates fade-in with IntersectionObserver');

const header = html.slice(html.indexOf('<header'), html.indexOf('</header>') + 9);
for (const href of ['./services.html', '#journey', './works.html', './tools.html', './profile.html', './faq.html', './contact.html']) {
  const escaped = href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  assert.match(header, new RegExp(`href="${escaped}"`), `header includes comp navigation ${href}`);
}
assert.match(header, /<svg\b[^>]*class="brand-mark"/, 'brand mark is reconstructed as scalable SVG');

const diagnosisMeta = [...html.matchAll(/<meta\b(?=[^>]*name="zatuneya:diagnosis-url")(?=[^>]*content="([^"]+)")[^>]*>/gi)];
assert.equal(diagnosisMeta.length, 1, 'diagnosis URL has one meta source');
assert.equal(diagnosisMeta[0][1], diagnosisUrl, 'diagnosis URL source is current');
assert.equal(html.split(diagnosisUrl).length - 1, 1, 'diagnosis URL literal is not duplicated');
assert.equal((html.match(/<a\b[^>]*\bdata-diagnosis-link\b/gi) ?? []).length, 5, 'five diagnosis CTAs delegate to nav.js');

const faq = sectionMarkup('faq');
const faqButtons = [...faq.matchAll(/<button\b(?=[^>]*aria-expanded="false")(?=[^>]*aria-controls="([^"]+)")[^>]*>/gi)];
assert.equal(faqButtons.length, 6, 'FAQ has six accessible disclosure buttons');
for (const [, answerId] of faqButtons) {
  assert.match(faq, new RegExp(`<div\\b(?=[^>]*id="${answerId}")(?=[^>]*hidden)[^>]*>`), `FAQ answer ${answerId} is linked and initially hidden`);
}

assert.equal((sectionMarkup('cases').match(/data-case-status="placeholder"/g) ?? []).length, 3, 'three anonymous cases remain disclosed placeholders');
assert.doesNotMatch(sectionMarkup('cases'), /cases-figure|data-asset-role="cases-workshop"/, 'cases have no decorative photograph');
assert.doesNotMatch(sectionMarkup('final-cta'), /<img\b|final-cta__image/, 'final CTA is a solid color band');

const expectedImages = [
  ['./assets/comp-parts/hero-desktop.png', '316', '229'],
  ['./assets/comp-parts/package-dashboard.png', '149', '124'],
  ['./assets/comp-parts/service-training.png', '162', '103'],
  ['./assets/comp-parts/service-design.png', '162', '103'],
  ['./assets/comp-parts/service-support.png', '177', '103'],
  ['./assets/comp-parts/representative.png', '185', '171']
];
for (const [src, width, height] of expectedImages) {
  const escaped = src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  assert.match(html, new RegExp(`<img\\b(?=[^>]*src="${escaped}")(?=[^>]*width="${width}")(?=[^>]*height="${height}")[^>]*>`), `${src} uses intrinsic comp dimensions`);
  assert.ok(existsSync(resolve(root, src.replace('./', ''))), `${src} exists`);
}
assert.match(sectionMarkup('hero'), /<source\b(?=[^>]*media="\(max-width: 480px\)")(?=[^>]*srcset="\.\/assets\/comp-parts\/hero-mobile\.png")[^>]*>/, 'Hero uses the dedicated SP crop');
assert.match(sectionMarkup('why-us'), /data-asset-status="comp-placeholder"/, 'representative crop is marked provisional');
assert.doesNotMatch(html, /\.\/assets\/v3-(?:hero|package|service|representative)[^"']*\.(?:jpg|png)/, 'TOP does not use AI-generated V3 images');

assert.match(html, /<link rel="stylesheet" href="\.\/top-comp\.css">[\s\S]*<link rel="stylesheet" href="\.\/v3-top-page\.css">/, 'shared CSS loads before TOP CSS');
for (const selector of [':root', '.comp-header', '.site-nav__link', '.v3-button', '.sticky-cta', '.comp-footer']) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  assert.match(sharedCss, new RegExp(escaped), `${selector} lives in shared CSS`);
  assert.doesNotMatch(pageCss, new RegExp(`(?:^|})\\s*${escaped}\\s*\\{`, 'm'), `${selector} is not duplicated in TOP CSS`);
}
for (const selector of ['.problem-grid', '.package-detail', '.service-grid', '.journey-steps', '.why-us-layout', '.case-grid', '.tool-grid', '.faq-list']) {
  assert.match(pageCss, new RegExp(selector.replace('.', '\\.') + '\\{'), `${selector} has a TOP layout rule`);
}
assert.match(pageCss, /\.problem-grid\{[^}]*grid-template-columns:repeat\(4,/s, 'PC problems use four columns');
assert.match(pageCss, /\.service-grid\{[^}]*grid-template-columns:repeat\(3,/s, 'PC services use three columns');
assert.match(pageCss, /\.journey-steps\{[^}]*grid-template-columns:repeat\(5,/s, 'PC journey uses five columns');
assert.match(pageCss, /\.faq-list\{[^}]*grid-template-columns:repeat\(2,/s, 'PC FAQ uses two columns');
assert.match(pageCss, /@media\s*\(max-width:480px\)[\s\S]*\.faq-list\{[^}]*grid-template-columns:1fr/s, 'SP FAQ collapses to one column');

assert.doesNotMatch(html, /\sstyle=/i, 'TOP has no inline style');
assert.doesNotMatch(html, /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u, 'TOP has no emoji');
assert.doesNotMatch(html + nav, /\b(?:alert|confirm|prompt)\s*\(/, 'TOP has no blocking browser dialogs');
assert.doesNotMatch(html, /han-ai-diagnosis\.netlify\.app/, 'retired diagnosis URL is absent');

console.info(`top-comp-contract: ${requiredCopy.length} copy checks, 10 sections, 6 FAQ items and comp assets PASS`);
