import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
export const root = resolve(import.meta.dirname, '..');
export const text = source => source.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
export const html = page => readFileSync(resolve(root, page), 'utf8');
export let checks = 0;
export function check(value, label) { assert.ok(value, label); checks++; }
const normalizeShell = source => source.replace(/\s+aria-current="page"/g, '').replace(/href="#(?!main)/g, 'href="./index.html#').replace(/>\s+</g, '><').replace(/\s+/g, ' ').trim();
export function commonPage(page) {
  const source = html(page);
  check(/<html lang="ja">/.test(source), page + ' Japanese');
  check(/<main id="main" class="lp-page">/.test(source), page + ' template namespace');
  check((source.match(/<h1\b/g) || []).length === 1, page + ' one main heading');
  check(/top-comp\.css[\s\S]*lower-page-template\.css/.test(source), page + ' shared CSS order');
  check(!/<style\b|\sstyle\s*=|\b(?:alert|confirm|prompt)\s*\(/.test(source), page + ' no inline style or dialogs');
  check(source.includes('<script src="./nav.js" defer></script>'), page + ' navigation script');
  check(source.includes('rel="canonical" href="https://zatune-gif.github.io/zatuneya-hp/v2/' + page + '"'), page + ' staging canonical');
  check((source.match(/name="zatuneya:diagnosis-url"/g) || []).length === 1, page + ' single diagnosis metadata');
  check(source.includes('data-diagnosis-link') && !source.includes('han-ai-diagnosis.netlify.app'), page + ' diagnosis delegation');
  check(source.includes('© 2026 ざつね屋'), page + ' copyright');
  for (const tag of ['header', 'footer']) {
    const pattern = new RegExp('<' + tag + '\\b[^>]*>[\\s\\S]*?<\\/' + tag + '>');
    check(normalizeShell(source.match(pattern)?.[0] || '') === normalizeShell(html('index.html').match(pattern)?.[0] || ''), page + ' exact current TOP ' + tag + ' shell except current link and TOP anchors');
  }
  for (const hook of ['id="site-nav"', 'id="nav-hamburger"', 'site-nav__dropdown-trigger', 'id="sticky-cta"', 'id="sticky-cta-close"']) check(source.includes(hook), page + ' preserves ' + hook);
  for (const match of source.matchAll(/(?:href|src)="(\.\/[^"?#]*|)(?:\?[^"#]*)?(?:#([^"]*))?"/g)) {
    const file = match[1] ? resolve(root, match[1]) : resolve(root, page);
    check(existsSync(file), page + ' local asset/link exists: ' + match[0]);
    if (match[2] && file.endsWith('.html')) check(readFileSync(file, 'utf8').includes('id="' + decodeURIComponent(match[2]) + '"'), page + ' local fragment exists: ' + match[0]);
  }
  return source;
}
