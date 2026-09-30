import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { managedPages } from './v3-lower-pages-fixture.mjs';

const root = resolve(import.meta.dirname, '..');
const path = resolve(root, 'lower-page-template.html');
let count = 0;
const check = (value, message) => { assert.ok(value, message); count++; };
check(existsSync(path), 'template exists');
const html = readFileSync(path, 'utf8').replaceAll('\r\n', '\n');
const top = readFileSync(resolve(root, 'index.html'), 'utf8').replaceAll('\r\n', '\n');
const css = readFileSync(resolve(root, 'lower-page-template.css'), 'utf8');
for (const tag of ['header', 'footer', 'aside']) {
  const re = new RegExp(`<${tag}${tag === 'aside' ? ' id="sticky-cta"' : '\\b'}[\\s\\S]*?<\\/${tag}>`);
  const expected = top.match(re)[0].replaceAll('href="#journey"', 'href="./index.html#journey"');
  check(html.match(re)?.[0] === expected, `${tag} equals approved TOP shell`);
}
check(html.includes('name="robots" content="noindex,follow"'), 'sample is noindex');
check(html.includes('下層ページのデザイン見本'), 'sample is labelled');
check(html.includes('料金を記載') && !/[0-9,]+円/.test(html), 'no invented price');
check((html.match(/name="zatuneya:diagnosis-url"/g) || []).length === 1, 'one diagnosis meta');
check((html.match(/https:\/\/ai-shindan-zatuneya.netlify.app\//g) || []).length === 1, 'one diagnosis URL');
check(!html.includes('han-ai-diagnosis'), 'no obsolete diagnosis');
check(html.indexOf('./top-comp.css') < html.indexOf('./lower-page-template.css'), 'shared CSS precedes body CSS');
check(!html.includes('v3-top-page.css'), 'no TOP body CSS');
check(!/\sstyle=|<script(?![^>]*\bsrc=)|\bonclick=|fonts.googleapis/.test(html), 'no inline code/styles/webfonts');
for (const id of ['main', 'hero', 'overview', 'features', 'pricing', 'process', 'questions', 'final-cta', 'nav-hamburger', 'site-nav', 'sticky-cta', 'sticky-cta-close']) {
  check((html.match(new RegExp(`id="${id}"`, 'g')) || []).length === 1, `unique ${id}`);
}
for (const id of ['hero', 'overview', 'features', 'pricing', 'process', 'questions', 'final-cta']) check(html.includes(`<!-- PART: ${id} -->`), `copy boundary ${id}`);
for (const match of html.matchAll(/(?:src|href)="(\.\/[^"#]+)(?:#[^"]*)?"/g)) check(existsSync(resolve(root, match[1])), `local reference ${match[1]}`);
for (const match of html.matchAll(/href="([^"]*)#([^"]+)"/g)) {
  const target = match[1] ? readFileSync(resolve(root, match[1]), 'utf8') : html;
  check(target.includes(`id="${match[2]}"`), `fragment target ${match[1]}#${match[2]}`);
}
for (const match of html.matchAll(/<img\b[^>]*>/g)) check(/width="\d+"/.test(match[0]) && /height="\d+"/.test(match[0]), 'image dimensions');
for (const selector of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{/g)) {
  const value = selector[1].trim();
  if (!value.startsWith('@')) check(value.split(',').every(s => s.trim().startsWith('.lp-')), `scoped selector ${value}`);
}
check(!managedPages.includes('lower-page-template.html'), 'not a production QA page');
for (const page of managedPages) check(!readFileSync(resolve(root, page), 'utf8').includes('lower-page-template.html'), `${page} does not publish sample link`);
check(!readFileSync(resolve(root, '..', 'sitemap.xml'), 'utf8').includes('lower-page-template'), 'not in sitemap');
console.log(`Lower template contract: ${count} PASS`);
