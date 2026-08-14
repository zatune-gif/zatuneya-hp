import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const pages = [
  'index.html', 'services.html', 'service-training.html', 'service-order.html',
  'service-management.html', 'service-banso.html', 'works.html', 'profile.html',
  'faq.html', 'contact.html', 'privacy.html', 'tokusho.html', 'thank-you.html', '404.html'
];
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
  check(html.includes('https://han-ai-diagnosis.netlify.app/'), `${page} has the primary diagnosis CTA`);
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
