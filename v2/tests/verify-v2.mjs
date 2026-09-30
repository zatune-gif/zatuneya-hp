import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { diagnosisUrl, legacyDiagnosisUrl, managedPages as pages } from './v3-lower-pages-fixture.mjs';

const root = resolve(import.meta.dirname, '..');
const origin = 'https://zatune-gif.github.io/zatuneya-hp/v2/';
let checks = 0;
const check = (condition, message) => { checks += 1; assert.ok(condition, message); };

check(existsSync(join(root, 'style.css')), 'v2 shared stylesheet is present');
check(existsSync(join(root, 'nav.js')), 'v2 shared navigation script is present');
for (const page of pages) {
  const path = join(root, page);
  check(existsSync(path), `${page} exists`);
  const html = readFileSync(path, 'utf8');
  check(/<html lang="ja">/i.test(html), `${page} declares Japanese`);
  check(html.includes(`rel="canonical" href="${origin}${page === 'index.html' ? '' : page}"`), `${page} has a V2 canonical URL`);
  check(/<meta\b(?=[^>]*\bproperty="og:type")(?=[^>]*\bcontent="[^"]+")[^>]*>/i.test(html), `${page} has og:type`);
  check(html.includes(`property="og:url" content="${origin}${page === 'index.html' ? '' : page}"`), `${page} has an OGP URL matching canonical`);
  for (const property of ['og:title', 'og:description', 'og:image']) {
    check(new RegExp(`<meta\\b(?=[^>]*\\bproperty="${property}")(?=[^>]*\\bcontent="[^"]+")[^>]*>`, 'i').test(html), `${page} has ${property}`);
  }
  const diagnosisMeta = [...html.matchAll(/<meta\b(?=[^>]*\bname="zatuneya:diagnosis-url")(?=[^>]*\bcontent="([^"]+)")[^>]*>/gi)];
  check(diagnosisMeta.length === 1, `${page} has one diagnosis meta`);
  check(diagnosisMeta[0]?.[1] === diagnosisUrl, `${page} diagnosis meta uses current URL`);
  check(!html.includes(legacyDiagnosisUrl), `${page} contains no legacy diagnosis URL`);
  check((html.match(/\bdata-diagnosis-link\b/g) ?? []).length > 0, `${page} delegates diagnosis links`);
  check(!/style\s*=/.test(html), `${page} adds no inline styles`);
  for (const match of html.matchAll(/(?:href|src)="(\.\/[^"?#]+)(?:[?#][^"]*)?"/g)) {
    check(existsSync(join(root, match[1].replace(/^\.\//, ''))), `${page} local reference exists: ${match[1]}`);
  }
}
const faq = readFileSync(join(root, 'faq.html'), 'utf8');
check(/<button[^>]*aria-expanded=/i.test(faq), 'FAQ uses buttons with ARIA state');
check(/aria-controls=/i.test(faq), 'FAQ buttons control answer regions');
const script = readFileSync(join(root, 'nav.js'), 'utf8');
check(!/alert\(|confirm\(|prompt\(/.test(script), 'V2 script avoids blocking dialogs');
const css = readFileSync(join(root, 'style.css'), 'utf8');
check(/@media \(max-width:400px\)/.test(css), 'V2 has a narrow-screen overflow guard');
check(/\.site-nav__hamburger\s*\{[^}]*min-width:44px/.test(css), 'V2 keeps the mobile menu control touch-safe');
console.log(`PASS ${checks} V2 static checks`);
