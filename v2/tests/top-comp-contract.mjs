import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const indexPath = join(root, 'index.html');
const cssPath = join(root, 'v3-top-page.css');
const legacyCssPath = join(root, 'top-comp.css');
const navPath = join(root, 'nav.js');
const browserTestPath = join(import.meta.dirname, 'v3-top-page-browser.mjs');
const diagnosisUrl = 'https://ai-shindan-zatuneya.netlify.app/';
const oldDiagnosisUrl = `https://${'han-ai-' + 'diagnosis.netlify.app/'}`;

assert.ok(existsSync(indexPath), 'TOP v3 implementation exists');
assert.ok(existsSync(cssPath), 'TOP v3 stylesheet is isolated from lower-page shared CSS');
assert.ok(existsSync(legacyCssPath), 'lower-page shared stylesheet exists');
assert.ok(existsSync(navPath), 'TOP v3 navigation script exists');
assert.ok(existsSync(browserTestPath), 'TOP v3 browser test exists');

const html = readFileSync(indexPath, 'utf8');
const css = readFileSync(cssPath, 'utf8');
const legacyCss = readFileSync(legacyCssPath, 'utf8');
const nav = readFileSync(navPath, 'utf8');
const browserTest = readFileSync(browserTestPath, 'utf8');
const cssWithoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
const cssRules = [...cssWithoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
const sharedCssWithoutComments = legacyCss.replace(/\/\*[\s\S]*?\*\//g, '');
const sharedCssRules = [...sharedCssWithoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
const allCssRules = [...sharedCssRules, ...cssRules];
const declarationsBySelector = new Map();
for (const [, selector, declarations] of allCssRules) {
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
  return allCssRules.some(([, , declarations]) => hasDeclaration(declarations, property, value));
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
  'AIを入れることより、',
  '仕事がよくなることから。',
  '数十名規模の会社で、「人が足りない」「引き継ぎが回らない」「同じ説明を何度もしている」。その一つひとつを、現場に入って一緒にほどいていきます。ツールの導入は、そのあとの話です。',
  'こんな詰まり方を、していませんか',
  '人が足りず、改善に手が回らない',
  '特定の人しか分からない仕事がある',
  '同じ説明・同じ入力を繰り返している',
  'AIを試してはみたが、続かなかった',
  '「業務変革屋」の仕事',
  '業務整理から入る',
  '教えられる実装者',
  '現場目線の伴走',
  '「知っている」から「自分たちで回せる」まで',
  '知る', 'わかる', 'できる', '教える', '内製化',
  'まず3か月、一つの業務を確実に変える',
  'AI経営改善パッケージ ／ 360,000円（3か月）',
  '必要なところから始められます',
  'はじめてのご相談から',
  '無料診断', 'ご相談（30分・無料）', '小さく試す', 'パッケージで変える', '伴走で広げる',
  '「教えられる人」が、現場に入ります',
  'これまでにお手伝いしたこと',
  'まず、無料のツールから',
  'よくある質問',
  'Q. AIのことがまったく分からなくても大丈夫ですか。',
  'Q. どのくらいの規模の会社が対象ですか。',
  'Q. 遠方でも対応してもらえますか。',
  'まず30分、話を聞かせてください',
  '広島県府中市を拠点に、近隣の地域企業を訪問して支援しています。',
  'どの段階からでも始められます。「まず話を聞いてみたい」で構いません。',
  '以下は仮データです。事実確認済みの匿名事例に差し替え予定です。',
  'まずは無料診断から',
  '診断する'
];
const htmlCopy = html.replace(/<[^>]+>/g, '');
for (const copy of requiredCopy) {
  assert.ok(htmlCopy.includes(copy), `TOP v3 copy exists: ${copy}`);
}

assert.match(html, /<main\b[^>]*\bid="main"[^>]*>/i, 'main landmark exists');
assert.equal([...html.matchAll(/<h1\b[^>]*>/gi)].length, 1, 'page has exactly one primary heading');
assert.match(html, /\bid="nav-hamburger"/i, 'hamburger navigation control exists');
assert.match(html, /\bid="site-nav"/i, 'site navigation exists');
assert.match(html, /\bclass="[^"]*\bsite-nav__dropdown-trigger\b[^"]*"/i, 'dropdown trigger exists');
assert.match(html, /\bclass="[^"]*\bfade-in\b[^"]*"/i, 'scroll reveal targets exist');
assert.doesNotMatch(sectionMarkup('hero'), /\bclass="[^"]*\bfade-in\b[^"]*"/i,
  'hero is visible immediately and does not depend on the scroll reveal animation');
assert.match(html, /\bid="sticky-cta"/i, 'sticky call to action exists');
assert.match(html, /\bid="sticky-cta-close"/i, 'sticky call to action close control exists');
assert.match(html, /©\s*2026\s*ざつね屋/, 'copyright is current');
const sharedCssLinkIndex = html.indexOf('<link rel="stylesheet" href="./top-comp.css">');
const pageCssLinkIndex = html.indexOf('<link rel="stylesheet" href="./v3-top-page.css">');
assert.ok(sharedCssLinkIndex >= 0, 'TOP loads the v3 shared stylesheet');
assert.ok(pageCssLinkIndex > sharedCssLinkIndex,
  'TOP loads top-comp.css before v3-top-page.css');
assert.doesNotMatch(html, /fonts\.(?:googleapis|gstatic)\.com/i,
  'TOP does not request externally hosted Google Fonts');
assert.match(sharedCssWithoutComments,
  /--font-sans:\s*"Noto Sans JP",\s*"Yu Gothic",\s*"Hiragino Kaku Gothic ProN",\s*sans-serif/i,
  'TOP sans-serif token keeps the intended name with Japanese system-font fallbacks');
assert.match(sharedCssWithoutComments,
  /--font-serif:\s*"Noto Serif JP",\s*"Yu Mincho",\s*"Hiragino Mincho ProN",\s*serif/i,
  'TOP serif token keeps the intended name with Japanese system-font fallbacks');
assert.match(
  html,
  /<script\b(?=[^>]*\bsrc="[^"]*nav\.js")[^>]*><\/script>/i,
  'TOP loads its navigation script with a script source'
);

const anchors = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].map(([, attributes, content]) => ({
  attributes,
  content,
  href: attributes.match(/\bhref="([^"]+)"/i)?.[1] ?? ''
}));
assert.doesNotMatch(html, /href="(?:\.\/)?(?:growth|tools)\.html"|href="#(?:growth|tools)"/i,
  'TOP has no dead growth or tools call-to-action links');
const diagnosisMetaTags = [...html.matchAll(/<meta\b(?=[^>]*\bname="zatuneya:diagnosis-url")(?=[^>]*\bcontent="([^"]+)")[^>]*>/gi)];
assert.equal(diagnosisMetaTags.length, 1, 'TOP has exactly one diagnosis URL meta marker');
assert.equal(diagnosisMetaTags[0][1], diagnosisUrl, 'diagnosis URL meta marker has the current value');
assert.equal(html.split(diagnosisUrl).length - 1, 1, 'current diagnosis URL literal occurs only in the meta marker');
assert.doesNotMatch(html, new RegExp(oldDiagnosisUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'old diagnosis URL is absent from TOP source');
const diagnosisCallsToAction = anchors.filter(({ attributes }) => /\bdata-diagnosis-link\b/i.test(attributes));
assert.equal(diagnosisCallsToAction.length, 5, 'TOP has exactly five diagnosis links hydrated from the meta marker');
for (const { attributes, href } of diagnosisCallsToAction) {
  assert.equal(href, '', 'diagnosis links omit static href values until safe hydration');
  assert.match(attributes, /\baria-disabled="true"/i, 'unhydrated diagnosis links are marked unavailable');
  assert.doesNotMatch(attributes, /https?:\/\//i, 'diagnosis links do not duplicate external URL literals');
}
assert.match(nav, /meta\[name="zatuneya:diagnosis-url"\]/, 'navigation reads the diagnosis URL meta marker');
assert.match(nav, /new URL\(/, 'navigation parses the diagnosis URL before use');
assert.match(nav, /\.protocol\s*===\s*['"]https:['"]/, 'navigation accepts only HTTPS diagnosis URLs');
assert.match(nav, /querySelectorAll\(['"]a\[data-diagnosis-link\]['"]\)/, 'navigation selects every diagnosis link for hydration');
assert.match(nav, /setAttribute\(['"]href['"]/, 'navigation hydrates diagnosis link href values');
assert.match(nav, /else\s*\{\s*link\.removeAttribute\(['"]href['"]\);\s*link\.setAttribute\(['"]aria-disabled['"],\s*['"]true['"]\);/,
  'missing or invalid diagnosis URLs leave calls to action non-link and unavailable');
assert.doesNotMatch(nav, /innerHTML\s*=/, 'navigation does not inject diagnosis URL markup');
assert.doesNotMatch(nav, new RegExp(oldDiagnosisUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'old diagnosis URL is absent from navigation source');

const faqButtons = [...sectionMarkup('faq').matchAll(/<button\b(?=[^>]*\baria-expanded=)(?=[^>]*\baria-controls=)[^>]*>/gi)];
assert.equal(faqButtons.length, 3, 'FAQ has exactly three buttons with expanded and controlled state');
const placeholders = [...sectionMarkup('cases').matchAll(/\bdata-case-status="placeholder"/gi)];
assert.equal(placeholders.length, 3, 'cases has exactly three placeholder case studies');
const allSectionMarkup = sectionIds.map(sectionMarkup).join('');
const assetImages = [...allSectionMarkup.matchAll(/<img\b(?=[^>]*\bdata-asset-role=)[^>]*>/gi)];
assert.equal(assetImages.length, 7, 'sections contain exactly seven images with asset roles');
for (const [sectionId, role] of [['hero', 'hero-meeting'], ['why-us', 'representative-portrait']]) {
  assert.match(
    sectionMarkup(sectionId),
    new RegExp(`<img\\b(?=[^>]*\\bdata-asset-role="${role}")(?=[^>]*\\balt="[^"\\s][^"]*")[^>]*>`, 'i'),
    `${role} image has meaningful alternative text`
  );
}
assert.match(sectionMarkup('hero'), /<h1[^>]*>AIを入れることより、<br><span class="hero-accent">仕事がよくなることから。<\/span><\/h1>/,
  'hero heading exposes the approved two phrase lines without word-internal breaks');
assert.doesNotMatch(sectionMarkup('cases'), /\bcases-figure\b|data-asset-role="cases-workshop"/,
  'case studies do not retain a decorative photograph');
assert.doesNotMatch(sectionMarkup('final-cta'), /\bfinal-cta__image\b|data-asset-role="final-conversation"/,
  'final call to action is a photograph-free color band');
for (const role of ['service-training', 'service-order', 'service-banso']) {
  assert.match(sectionMarkup('services'), new RegExp(`data-asset-role="${role}"`),
    `services include the approved ${role} photograph slot`);
}
assert.doesNotMatch(sectionMarkup('why-us'), /profile-portrait-2\.jpg/,
  'representative slot no longer uses the text-baked legacy illustration');
assert.doesNotMatch(sectionMarkup('why-us'), /<img\b[^>]*data-asset-role="representative-portrait"/,
  'representative placeholder does not reuse an unrelated photograph');
assert.match(sectionMarkup('why-us'), /<figure\b(?=[^>]*class="[^"]*representative-card__placeholder)(?=[^>]*data-asset-role="representative-portrait")(?=[^>]*role="img")(?=[^>]*aria-label="代表者写真の仮枠")[^>]*>/,
  'representative slot is a dedicated accessible placeholder');
assert.match(html, /<a class="nav-diagnosis site-nav__link" data-diagnosis-link aria-disabled="true">無料で診断する<\/a>/,
  'desktop header presents the approved orange diagnosis call to action');
assert.match(sharedCssWithoutComments, /\.nav-diagnosis\{[^}]*background:var\(--orange\)[^}]*color:var\(--orange-ink\)/,
  'header diagnosis call to action uses the accessible orange pill treatment');
assert.match(sharedCssWithoutComments, /\.comp-menu,#nav-hamburger\{[^}]*flex-direction:column[^}]*justify-content:center[^}]*align-items:center/,
  'hamburger lays out three bars clearly within its control');
assert.match(sharedCssWithoutComments, /\.comp-menu span\{[^}]*width:24px[^}]*height:2px[^}]*background:var\(--ink\)/,
  'hamburger bars have explicit visible dimensions and color');

const commonSelectorPatterns = [
  /^:root(?:\s|,|$)/,
  /(?:^|,)\s*\.comp-[\w-]*/,
  /(?:^|,)\s*\.site-nav__[\w-]*/,
  /(?:^|,)\s*\.sticky-cta[\w-]*/,
  /(?:^|,)\s*\.v3-button[\w-]*/,
  /(?:^|,)\s*\.comp-header(?:\s|$)/,
  /(?:^|,)\s*\.comp-footer(?:\s|$)/
];
for (const pattern of commonSelectorPatterns) {
  assert.ok(!cssRules.some(([, selector]) => pattern.test(selector.replace(/\s+/g, ' ').trim())),
    `TOP-only stylesheet excludes shared selector pattern ${pattern}`);
}
for (const selector of [':root', '.comp-header', '.site-nav__link', '.sticky-cta', '.v3-button', '.comp-footer']) {
  assert.ok(legacyCss.includes(selector), `shared stylesheet owns ${selector}`);
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

function metaContent(attribute, name) {
  const match = html.match(new RegExp(`<meta\\b(?=[^>]*\\b${attribute}="${name}")(?=[^>]*\\bcontent="([^"]*)")[^>]*>`, 'i'));
  assert.ok(match, `${attribute} ${name} exists`);
  return match[1];
}

const pageTitle = 'ざつね屋｜地域企業の小さな業務変革屋';
const pageDescription = 'ざつね屋は、地域企業の困りごとを起点に、業務整理・人の育成・小さな仕組みづくりまで伴走する業務変革屋です。';
const canonicalUrl = 'https://zatune-gif.github.io/zatuneya-hp/v2/';
assert.equal(metaContent('name', 'description'), pageDescription, 'meta description is exact');
assert.equal(metaContent('property', 'og:type'), 'website', 'OGP type is exact');
assert.equal(metaContent('property', 'og:url'), canonicalUrl, 'OGP URL is canonical');
assert.equal(metaContent('property', 'og:title'), pageTitle, 'OGP title is exact');
assert.equal(metaContent('property', 'og:description'), pageDescription, 'OGP description matches meta description');
assert.equal(metaContent('property', 'og:image'), `${canonicalUrl}assets/og-image.jpg`, 'OGP image is the existing absolute image');
assert.match(html, new RegExp(`<title>\\s*${pageTitle}\\s*<\\/title>`, 'i'), 'document title is exact');

for (const selectorOrToken of ['.skip', '.btn-orange', '.bottom-cta', '--teal-dk', '--mint', '--serif', '--shadow']) {
  assert.ok(legacyCss.includes(selectorOrToken), `lower shared CSS preserves legacy compatibility: ${selectorOrToken}`);
}
for (const lowerPage of ['works.html', 'profile.html', 'services.html']) {
  const lowerHtml = readFileSync(join(root, lowerPage), 'utf8');
  assert.match(lowerHtml, /<link\b(?=[^>]*\brel="stylesheet")(?=[^>]*\bhref="[^"]*top-comp\.css")[^>]*>/i,
    `${lowerPage} continues to load the lower shared stylesheet`);
}
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
assert.match(
  browserTest,
  /async function prepareFullPageScreenshot\(viewportPage\)\s*\{[\s\S]*?\.fade-in[\s\S]*?is-visible[\s\S]*?opacity[\s\S]*?\.decode\(\)[\s\S]*?naturalWidth[\s\S]*?returnToTopAfterLazyLoading\(viewportPage\)[\s\S]*?\}/,
  'full-page screenshot preparation reveals every fade target, decodes every image, and returns to the top'
);
assert.match(
  browserTest,
  /await prepareFullPageScreenshot\(viewportPage\);[\s\S]*?await viewportPage\.screenshot\(\{\s*path:\s*join\(stagingDir,/,
  'full-page preparation completes before the staged screenshot is captured'
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
  `${sharedCssWithoutComments}\n${cssWithoutComments}`,
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
      selectorPattern.test(selector) && hasDeclaration(declarations, 'min-height', 'var\\(--size-control\\)')
    ),
    `${controlName} has a 44-pixel minimum height`
  );
}
assert.ok(hasCssDeclaration('--size-icon', '40px'), 'icon size token exists');
assert.ok(hasCssDeclaration('--size-control', '44px'), 'control size token exists');
assert.match(sharedCssWithoutComments, /\.brand-mark\{[^}]*\bwidth:var\(--size-icon\)[^}]*\bheight:var\(--size-icon\)/,
  'brand mark uses the icon-size token');
assert.match(sharedCssWithoutComments, /\.v3-line-icon\{[^}]*\bwidth:var\(--size-icon\)[^}]*\bheight:var\(--size-icon\)/,
  'line icons use the icon-size token');
assert.match(sharedCssWithoutComments, /\.fade-in\{[^}]*\bopacity:\s*0[^}]*\btransform:translateY\(var\(--space-16\)\)/,
  'fade-in has a meaningful hidden base state');
assert.match(sharedCssWithoutComments, /\.fade-in\.is-visible\{[^}]*\banimation:v3-fade-in\s+\.4s\s+ease-out\s+both/,
  'visible fade-in elements use the reveal animation');
assert.match(sharedCssWithoutComments, /@keyframes v3-fade-in\{from\{opacity:1;transform:translateY\(var\(--space-16\)\)\}to\{opacity:1;transform:translateY\(0\)\}\}/,
  'fade reveal animates position without transient low-contrast opacity');
assert.ok(allCssRules.some(([selector, declarations]) => /:focus-visible/i.test(selector) && declarations.trim()), 'keyboard focus is visible');
assert.ok(hasCssDeclaration('scroll-padding-bottom', '[^;]+'), 'sticky call to action is accounted for when scrolling');
assert.ok(hasCssDeclaration('--space-4', '4px'), 'four-pixel spacing token exists');
assert.ok(hasCssDeclaration('--space-96', '96px'), 'ninety-six-pixel spacing token exists');
for (const [, selector, declarations] of cssRules) {
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
