import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const indexPath = join(root, 'index.html');
const cssPath = join(root, 'top-comp.css');
const navPath = join(root, 'nav.js');
const browserTestPath = join(import.meta.dirname, 'v3-top-page-browser.mjs');
const diagnosisUrl = 'https://han-ai-diagnosis.netlify.app/';

assert.ok(existsSync(indexPath), 'TOP v3 implementation exists');
assert.ok(existsSync(cssPath), 'TOP v3 stylesheet exists');
assert.ok(existsSync(navPath), 'TOP v3 navigation script exists');
assert.ok(existsSync(browserTestPath), 'TOP v3 browser test exists');

const html = readFileSync(indexPath, 'utf8');
const css = readFileSync(cssPath, 'utf8');
const nav = readFileSync(navPath, 'utf8');
const browserTest = readFileSync(browserTestPath, 'utf8');
const cssWithoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
const cssRules = [...cssWithoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
const declarationsBySelector = new Map();
for (const [, selector, declarations] of cssRules) {
  const normalizedSelector = selector.replace(/\s+/g, ' ').trim();
  declarationsBySelector.set(
    normalizedSelector,
    `${declarationsBySelector.get(normalizedSelector) ?? ''};${declarations}`
  );
}

function hasDeclaration(declarations, property, value) {
  return new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*${value}\\s*(?:;|$)`, 'i').test(declarations);
}

function hasCssDeclaration(property, value) {
  return cssRules.some(([, , declarations]) => hasDeclaration(declarations, property, value));
}

function assertNoEmoji(markup) {
  // © is intentionally allowed; these ranges cover pictographic and dingbat emoji such as 🚀🌱✅✨.
  assert.doesNotMatch(markup, /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u, 'index has no emoji');
}

const sectionIds = [
  'hero', 'problems', 'value', 'growth', 'package', 'services',
  'journey', 'why-us', 'cases', 'tools', 'faq', 'final-cta'
];
const sectionMatches = new Map();
let previousSectionIndex = -1;
for (const id of sectionIds) {
  const matches = [...html.matchAll(new RegExp(`<section\\b[^>]*\\bid="${id}"[^>]*>`, 'gi'))];
  assert.equal(matches.length, 1, `TOP v3 has exactly one section: #${id}`);
  const match = matches[0];
  assert.ok(match.index > previousSectionIndex, `TOP v3 section order: #${id}`);
  previousSectionIndex = match.index;
  sectionMatches.set(id, match);
}

function sectionMarkup(id) {
  const start = sectionMatches.get(id);
  const end = html.indexOf('</section>', start.index);
  assert.ok(end >= 0, `TOP v3 section closes: #${id}`);
  return html.slice(start.index, end + '</section>'.length);
}

const requiredCopy = [
  'AIを入れることより、仕事がよくなることから。',
  'こんな詰まり方を、していませんか',
  '「業務変革屋」の仕事',
  '「知っている」から「自分たちで回せる」まで',
  'まず3か月、一つの業務を確実に変える',
  'AI経営改善パッケージ ／ 360,000円（3か月）',
  '必要なところから始められます',
  'はじめてのご相談から',
  '「教えられる人」が、現場に入ります',
  'これまでにお手伝いしたこと',
  'まず、無料のツールから',
  'よくある質問',
  'まず30分、話を聞かせてください'
];
for (const copy of requiredCopy) {
  assert.ok(html.includes(copy), `TOP v3 copy exists: ${copy}`);
}

assert.match(html, /<main\b[^>]*\bid="main"[^>]*>/i, 'main landmark exists');
assert.equal([...html.matchAll(/<h1\b[^>]*>/gi)].length, 1, 'page has exactly one primary heading');
assert.match(html, /\bid="nav-hamburger"/i, 'hamburger navigation control exists');
assert.match(html, /\bid="site-nav"/i, 'site navigation exists');
assert.match(html, /\bclass="[^"]*\bsite-nav__dropdown-trigger\b[^"]*"/i, 'dropdown trigger exists');
assert.match(html, /\bclass="[^"]*\bfade-in\b[^"]*"/i, 'scroll reveal targets exist');
assert.match(html, /\bid="sticky-cta"/i, 'sticky call to action exists');
assert.match(html, /\bid="sticky-cta-close"/i, 'sticky call to action close control exists');
assert.match(html, /©\s*2026\s*ざつね屋/, 'copyright is current');
assert.match(
  html,
  /<link\b(?=[^>]*\brel="stylesheet")(?=[^>]*\bhref="[^"]*top-comp\.css")[^>]*>/i,
  'TOP loads its dedicated v3 stylesheet with a stylesheet link'
);
assert.match(
  html,
  /<script\b(?=[^>]*\bsrc="[^"]*nav\.js")[^>]*><\/script>/i,
  'TOP loads its navigation script with a script source'
);

const anchors = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].map(([, attributes, content]) => ({
  content,
  href: attributes.match(/\bhref="([^"]+)"/i)?.[1] ?? ''
}));
const diagnosisCallsToAction = anchors.filter(({ content }) => /診断/.test(content));
assert.ok(diagnosisCallsToAction.length >= 4, 'at least four diagnosis calls to action exist');
const diagnosisRelatedLinks = anchors.filter(({ content, href }) =>
  /診断/.test(content) || /diagnos(?:is|tic)|ai-diagnosis/i.test(href)
);
for (const { href } of diagnosisRelatedLinks) {
  assert.equal(href, diagnosisUrl, 'all diagnosis-related links use the canonical diagnosis URL');
}

const faqButtons = [...sectionMarkup('faq').matchAll(/<button\b(?=[^>]*\baria-expanded=)(?=[^>]*\baria-controls=)[^>]*>/gi)];
assert.equal(faqButtons.length, 3, 'FAQ has exactly three buttons with expanded and controlled state');
const placeholders = [...sectionMarkup('cases').matchAll(/\bdata-case-status="placeholder"/gi)];
assert.equal(placeholders.length, 3, 'cases has exactly three placeholder case studies');
const allSectionMarkup = sectionIds.map(sectionMarkup).join('');
const assetImages = [...allSectionMarkup.matchAll(/<img\b(?=[^>]*\bdata-asset-role=)[^>]*>/gi)];
assert.equal(assetImages.length, 6, 'sections contain exactly six images with asset roles');
for (const [sectionId, role] of [['hero', 'hero-meeting'], ['why-us', 'representative-portrait']]) {
  assert.match(
    sectionMarkup(sectionId),
    new RegExp(`<img\\b(?=[^>]*\\bdata-asset-role="${role}")(?=[^>]*\\balt="[^"\\s][^"]*")[^>]*>`, 'i'),
    `${role} image has meaningful alternative text`
  );
}

assert.doesNotMatch(html, /<[^>]+\sstyle\s*=/i, 'index has no inline styles');
assertNoEmoji(html);
assert.doesNotMatch(html, /ロボット|AIチップ|ホログラム|回路/i, 'index avoids generic artificial-intelligence imagery');
assert.doesNotMatch(nav, /\b(?:alert|confirm|prompt)\s*\(/, 'navigation avoids blocking browser dialogs');
assert.doesNotMatch(
  browserTest,
  /viewportPage\.waitForFunction\(\s*\(\)\s*=>\s*Array\.from\(document\.images\)\.every\([\s\S]*?\)\s*,\s*\{\s*timeout\s*:/,
  'lazy-image waitForFunction does not pass options as its second argument'
);
assert.match(
  browserTest,
  /async function loadAssetRoleImages\(viewportPage\)\s*\{[\s\S]*?viewportPage\.waitForFunction\([\s\S]*?\},\s*index\s*,\s*\{\s*timeout\s*:\s*5_000\s*\}/,
  'lazy-image loader passes its finite timeout as the third waitForFunction argument'
);
assert.match(
  browserTest,
  /const stagingDir\s*=\s*join\(screenshotDir,\s*[^;]*staging[^;]*\);/,
  'browser screenshots use a run-specific staging directory below the canonical screenshot directory'
);
assert.match(
  browserTest,
  /await viewportPage\.screenshot\(\{\s*path:\s*join\(stagingDir,\s*`\$\{viewport\.width\}\.png`\),/,
  'each viewport screenshot is written to staging, never directly to the canonical directory'
);
assert.doesNotMatch(
  browserTest,
  /unlinkSync\(screenshotPath\)/,
  'canonical screenshots are not deleted before the browser checks have passed'
);
assert.match(
  browserTest,
  /await verifyStagedScreenshots\(stagingDir\);[\s\S]*?publishStagedScreenshots\(stagingDir\);/,
  'all staged screenshots are validated before they are published together'
);
assert.match(
  browserTest,
  /finally\s*\{[\s\S]*?rmSync\(stagingDir,\s*\{\s*recursive:\s*true,\s*force:\s*true\s*\}\)/,
  'the run-specific staging directory is removed even after a failure'
);
assert.match(
  browserTest,
  /waitUntil:\s*'domcontentloaded'/,
  'visual capture navigation waits for DOM content rather than swallowing a load timeout'
);
assert.doesNotMatch(
  browserTest,
  /\.goto\([\s\S]{0,300}?waitUntil:\s*'load'[\s\S]{0,300}?\.catch\(/,
  'navigation failures are not swallowed'
);
assert.match(
  browserTest,
  /document\.fonts\.ready/,
  'visual capture waits for document fonts before taking screenshots'
);

assert.match(
  cssWithoutComments,
  /@media\s*\([^)]*prefers-reduced-motion[^)]*\)\s*\{[\s\S]*?\{[^{}]+\}/i,
  'reduced motion preferences have a real nested rule'
);
const interactiveControlSelectors = [
  ['v3 button', /\.v3-button\b/i],
  ['FAQ button', /#faq\s+button\b|button\.faq[^\s,>+~]*\b|\.faq-trigger\b|\.faq__(?:button|question|trigger)\b/i],
  ['navigation hamburger', /#nav-hamburger\b/i],
  ['navigation dropdown trigger', /\.site-nav__dropdown-trigger\b/i],
  ['sticky call-to-action close control', /#sticky-cta-close\b|\.sticky-cta__close\b/i]
];
for (const [controlName, selectorPattern] of interactiveControlSelectors) {
  assert.ok(
    [...declarationsBySelector.entries()].some(([selector, declarations]) =>
      selectorPattern.test(selector) && hasDeclaration(declarations, 'min-height', '44px')
    ),
    `${controlName} has a 44-pixel minimum height`
  );
}
assert.ok(cssRules.some(([selector, declarations]) => /:focus-visible/i.test(selector) && declarations.trim()), 'keyboard focus is visible');
assert.ok(hasCssDeclaration('scroll-padding-bottom', '[^;]+'), 'sticky call to action is accounted for when scrolling');
assert.ok(hasCssDeclaration('--space-4', '4px'), 'four-pixel spacing token exists');
assert.ok(hasCssDeclaration('--space-96', '96px'), 'ninety-six-pixel spacing token exists');
for (const [selector, declarations] of declarationsBySelector) {
  const hasOrangeBackground = hasDeclaration(declarations, 'background(?:-color)?', 'var\\(--orange\\)');
  const hasWhiteText = hasDeclaration(
    declarations,
    'color',
    '(?:#fff(?:fff)?|white|var\\(--(?:surface|color-surface|white)\\))'
  );
  assert.ok(
    !hasOrangeBackground || !hasWhiteText,
    `orange backgrounds do not use white text in ${selector} (static same-selector check)`
  );
}

console.log('PASS TOP v3 contract');
