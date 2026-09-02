import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { diagnosisUrl, existingLowerPages, legacyDiagnosisUrl, managedPages } from './v3-lower-pages-fixture.mjs';

const root = resolve(import.meta.dirname, '..');

const failures = [];
let checks = 0;

function check(condition, message) {
  checks += 1;
  if (!condition) failures.push(message);
}

function occurrenceCount(source, literal) {
  return source.split(literal).length - 1;
}

function stylesheetCount(html, filename) {
  return [...html.matchAll(new RegExp(`<link\\b(?=[^>]*\\brel=["']stylesheet["'])(?=[^>]*\\bhref=["'][^"']*${filename.replace('.', '\\.')}(?:[?#][^"']*)?["'])[^>]*>`, 'gi'))].length;
}

export function normalizedMainDigest(html) {
  const main = html.match(/<main\b[^>]*>[\s\S]*?<\/main>/i)?.[0];
  if (!main) return null;
  const normalized = main
    .replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, (anchor) => {
      if (!/AI活用準備度診断|AI活用診断|無料診断|無料で診断する|診断する/.test(anchor)) return anchor;
      return anchor.replace(/<a\b([^>]*)>/i, (_tag, attributes) => {
        const canonicalAttributes = attributes
          .replace(/\s+href\s*=\s*(["'])https:\/\/han-ai-diagnosis\.netlify\.app\/\1/i, '')
          .replace(/\s+data-diagnosis-link(?:\s*=\s*(["'])[^"']*\1)?/i, '')
          .replace(/\s+aria-disabled\s*=\s*(["'])true\1/i, '')
          .trim();
        return `<a${canonicalAttributes ? ` ${canonicalAttributes}` : ''} data-diagnosis-link>`;
      });
    })
    .replace(/\r\n?/g, '\n')
    .replace(/>\s+</g, '><')
    .trim();
  return createHash('sha256').update(normalized).digest('hex');
}

function cssSelectors(css) {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const selectors = [];
  function walk(start, end) {
    let cursor = start;
    while (cursor < end) {
      while (cursor < end && /\s|;/.test(source[cursor])) cursor += 1;
      const open = source.indexOf('{', cursor);
      if (open < 0 || open >= end) break;
      const prelude = source.slice(cursor, open).trim();
      let depth = 1;
      let close = open + 1;
      let quote = null;
      for (; close < end && depth; close += 1) {
        const character = source[close];
        if (quote) {
          if (character === quote && source[close - 1] !== '\\') quote = null;
        } else if (character === '"' || character === "'") quote = character;
        else if (character === '{') depth += 1;
        else if (character === '}') depth -= 1;
      }
      const bodyEnd = close - 1;
      if (/^@(media|supports|layer|container|scope)\b/i.test(prelude)) walk(open + 1, bodyEnd);
      else if (!prelude.startsWith('@')) selectors.push(...prelude.split(',').map((selector) => selector.trim()).filter(Boolean));
      cursor = close;
    }
  }
  walk(0, source.length);
  return selectors;
}

function isSharedSelector(selector) {
  return selector === ':root'
    || /\.comp-[\w-]*/.test(selector)
    || /\.site-nav__[\w-]*/.test(selector)
    || /\.sticky-cta(?:__[\w-]+|--[\w-]+)?\b/.test(selector)
    || /\.v3-button(?:__[\w-]+|--[\w-]+)?\b/.test(selector);
}

const selectorFixture = cssSelectors(`
  :root { --x: 1; }
  @media (max-width: 40rem) { main.site-nav__link:hover, .ordinary { color: red; } }
  @supports (display: grid) { .card.comp-header > .v3-button--primary { display: grid; } }
  @keyframes pulse { from { opacity: 0; } to { opacity: 1; } }
`);
check(selectorFixture.includes(':root'), 'CSS scanner self-test detects :root');
check(selectorFixture.includes('main.site-nav__link:hover'), 'CSS scanner self-test detects nested compound selector');
check(selectorFixture.includes('.ordinary'), 'CSS scanner self-test splits multiple selectors');
check(selectorFixture.includes('.card.comp-header > .v3-button--primary'), 'CSS scanner self-test detects multiple shared prefixes');
check(!selectorFixture.some((selector) => selector === 'from' || selector === 'to'), 'CSS scanner self-test skips keyframe steps');

function metaContent(html, attribute, name) {
  return html.match(new RegExp(`<meta\\b(?=[^>]*\\b${attribute}=["']${name}["'])(?=[^>]*\\bcontent=["']([^"']*)["'])[^>]*>`, 'i'))?.[1];
}

check(managedPages.length === 16, 'managed inventory is explicitly TOP + 13 existing lower pages + 2 new pages = 16');

for (const page of managedPages) {
  const path = join(root, page);
  const exists = existsSync(path);
  check(exists, `${page} exists`);
  if (!exists) continue;

  const html = readFileSync(path, 'utf8');
  check(stylesheetCount(html, 'top-comp.css') === 1, `${page} loads shared top-comp.css exactly once`);
  check(stylesheetCount(html, 'v3-top-page.css') === (page === 'index.html' ? 1 : 0), `${page} has the required v3-top-page.css count`);
  check(/<script\b(?=[^>]*\bsrc=["'][^"']*nav\.js(?:[?#][^"']*)?["'])[^>]*><\/script>/i.test(html), `${page} loads nav.js`);
  check(/<header\b[^>]*\bclass=["'][^"']*\bcomp-header\b/i.test(html), `${page} has V3 comp-header`);
  check(!/<header\b[^>]*\bclass=["'][^"']*\bfade-in\b/i.test(html), `${page} keeps the primary header outside reveal animation`);
  check(/<footer\b[^>]*\bclass=["'][^"']*\bcomp-footer\b/i.test(html), `${page} has V3 comp-footer`);
  check(/\bid=["']nav-hamburger["']/i.test(html), `${page} has #nav-hamburger`);
  check(/\bid=["']site-nav["']/i.test(html), `${page} has #site-nav`);
  check(/\bclass=["'][^"']*\bsite-nav__dropdown-trigger\b/i.test(html), `${page} has dropdown trigger`);
  check(/\bid=["']sticky-cta["']/i.test(html), `${page} has #sticky-cta`);
  check(/\bid=["']sticky-cta-close["']/i.test(html), `${page} has #sticky-cta-close`);

  const diagnosisMeta = [...html.matchAll(/<meta\b(?=[^>]*\bname=["']zatuneya:diagnosis-url["'])(?=[^>]*\bcontent=["']([^"']+)["'])[^>]*>/gi)];
  check(diagnosisMeta.length === 1, `${page} has exactly one diagnosis meta`);
  check(diagnosisMeta[0]?.[1] === diagnosisUrl, `${page} diagnosis meta uses current URL`);
  check(occurrenceCount(html, diagnosisUrl) === 1, `${page} contains current diagnosis URL only in its meta`);
  check(!html.includes(legacyDiagnosisUrl), `${page} contains no legacy diagnosis URL`);

  const diagnosisAnchors = [...html.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/gi)]
    .map((match) => match[0])
    .filter((anchor) => /AI活用準備度診断|AI活用診断|無料診断|無料で診断する|診断する/.test(anchor));
  check(diagnosisAnchors.length > 0, `${page} has a diagnosis anchor`);
  for (const [index, anchor] of diagnosisAnchors.entries()) {
    check(/\bdata-diagnosis-link\b/i.test(anchor), `${page} diagnosis anchor ${index + 1} delegates to nav.js`);
    check(!/\bhref\s*=/i.test(anchor), `${page} diagnosis anchor ${index + 1} has no hard-coded href`);
    check(/\baria-disabled=["']true["']/i.test(anchor), `${page} diagnosis anchor ${index + 1} starts disabled until hydration`);
  }
}

const indexPath = join(root, 'index.html');
if (existsSync(indexPath)) {
  const html = readFileSync(indexPath, 'utf8');
  const topCompIndex = html.search(/<link\b(?=[^>]*href=["'][^"']*top-comp\.css)[^>]*>/i);
  const topPageIndex = html.search(/<link\b(?=[^>]*href=["'][^"']*v3-top-page\.css)[^>]*>/i);
  check(topCompIndex >= 0 && topPageIndex > topCompIndex, 'index.html loads top-comp.css before v3-top-page.css');
  check(/<a\b(?=[^>]*href=["']\.\/growth\.html["'])[^>]*>\s*成長段階の考え方をくわしく見る\s*<\/a>/i.test(html), 'TOP restores the approved growth CTA and href');
  check(/<a\b(?=[^>]*href=["']\.\/tools\.html["'])[^>]*>\s*ツールの一覧を見る\s*<\/a>/i.test(html), 'TOP restores the approved tools CTA and href');
}

const v3CssPath = join(root, 'v3-top-page.css');
if (existsSync(v3CssPath)) {
  const css = readFileSync(v3CssPath, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const forbidden = cssSelectors(css).filter(isSharedSelector);
  check(forbidden.length === 0, `v3-top-page.css has no shared selectors (found: ${forbidden.join(' | ') || 'none'})`);
}

const newPageCopy = {
  'growth.html': [
    '「知っている」から「自分たちで回せる」まで',
    'AI活用は、一度の研修で終わるものではありません。会社の状態に合わせて、5つの段階を順に上がっていきます。',
    '知る', 'わかる', 'できる', '教える', '内製化'
  ],
  'tools.html': [
    'まず、無料のツールから',
    'AI活用準備度診断',
    '10問ほどで、自社が今どの段階にいるかが分かります',
    'プロンプトライブラリ',
    'そのまま使える指示文を、業務別にまとめています'
  ]
};
for (const [page, requiredCopy] of Object.entries(newPageCopy)) {
  const path = join(root, page);
  if (!existsSync(path)) continue;
  const html = readFileSync(path, 'utf8');
  for (const copy of requiredCopy) check(html.includes(copy), `${page} contains approved copy: ${copy}`);
  const canonical = `https://zatune-gif.github.io/zatuneya-hp/v2/${page}`;
  check(new RegExp(`<link\\b(?=[^>]*rel=["']canonical["'])(?=[^>]*href=["']${canonical.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'])[^>]*>`, 'i').test(html), `${page} has exact canonical`);
  check(Boolean(metaContent(html, 'name', 'description')), `${page} has a non-empty description`);
  check(metaContent(html, 'property', 'og:type') === 'website', `${page} has website og:type`);
  check(metaContent(html, 'property', 'og:url') === canonical, `${page} og:url matches canonical`);
  for (const property of ['og:title', 'og:description', 'og:image']) {
    check(Boolean(metaContent(html, 'property', property)), `${page} has non-empty ${property}`);
  }
}

const lowerPageMainDigests = {
  // Generated from commit ff8d9e7. Only the diagnosis anchor migration from
  // legacy href to data-diagnosis-link is normalized as an allowed exception.
  '404.html': '99a31f0ff6d19af26370d93cdb7316d70c41fb1339ad8281f009318d70f1fb50',
  'contact.html': 'b99f3d198ceed3fe22f217bcde2f2380abf3c175d56490f86f6a81d5e85d7eef',
  'faq.html': '9f36b3186755e1e9f83765430b02b5a823338afb57de919a131c8c20ab003822',
  'privacy.html': '26917fb0bec68e9a04708405d48f7aa04aff3780db984ca88d7de6d9437e8c46',
  'profile.html': 'be0abae40aaa50d66b527e5985a1bdd2356c1b4e8bd54fde15eb4d4d598241a2',
  'service-banso.html': 'c1d90427ddf87afb3d97f47db2218b673c80732f2d8055dbab44ce82431dd5c6',
  'service-management.html': 'bbfe6e76f600de1102c385320bd2faecf2c65d338bb10e3a76e9dbbd027b95a5',
  'service-order.html': '5d67ed5d0e429c3616dff7ca9256e98b327151a372c3fbde042d837315eb0dc2',
  'service-training.html': '4c2e2310c6c40237f8eef56aeb3d9d69cd5a0002db561299b999efdf72d25303',
  'services.html': '19f1e6c213723982524a688c1cd27c7ff4a99de95934c314525856345e6f89ea',
  'thank-you.html': 'f7bd0ccc00eb967d11a3823e4f7955edf429f8a2a6e48a61d6e9d8584d66a3dc',
  'tokusho.html': '6c8b145bbf1616602e41992b547c047ec370b771ef22d0cbb36cac83287dc488',
  'works.html': '800fcf73b8fbe121a453bfc615da90f46dbe1485929ae2546926c9486622417d'
};
for (const [page, expectedDigest] of Object.entries(lowerPageMainDigests)) {
  const path = join(root, page);
  if (!existsSync(path)) continue;
  const html = readFileSync(path, 'utf8');
  check(normalizedMainDigest(html) === expectedDigest, `${page} preserves the ff8d9e7 main DOM except diagnosis href delegation`);
}
check(Object.keys(lowerPageMainDigests).length === 13, 'main DOM digest fixture covers 13 pages');
check(JSON.stringify(Object.keys(lowerPageMainDigests).sort()) === JSON.stringify([...existingLowerPages].sort()), 'main DOM digest keys exactly match existing lower-page inventory');
for (const page of existingLowerPages) check(existsSync(join(root, page)), `digest fixture path exists: ${page}`);

if (failures.length) {
  console.error(`FAIL ${failures.length}/${checks} V3 lower-page contract checks`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`PASS ${checks} V3 lower-page contract checks across ${managedPages.length} pages`);
}
