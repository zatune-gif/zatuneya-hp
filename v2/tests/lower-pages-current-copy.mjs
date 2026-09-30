import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const pages = process.argv.slice(2).length ? process.argv.slice(2) : ['service-management.html', 'service-training.html', 'service-banso.html', 'services.html', 'works.html', 'profile.html'];
const normalize = text => text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
let count = 0;
const check = (value, label) => { assert.ok(value, label); count++; };
for (const page of pages) {
  const source = readFileSync(resolve(root, '..', page), 'utf8');
  const target = readFileSync(resolve(root, page), 'utf8');
  const top = readFileSync(resolve(root, 'index.html'), 'utf8');
  check(target.includes('class="lp-page"'), page + ' uses approved lower-page body');
  for (const tag of ['header', 'footer']) {
    const re = new RegExp('<' + tag + '\\b[\\s\\S]*?<\\/' + tag + '>');
    check(normalize(target.match(re)[0]) === normalize(top.match(re)[0]), page + ' current TOP ' + tag);
  }
  // Root paragraphs and labelled factual points are authoritative; styles are not.
  const main = source.match(/<main\b[^>]*>[\s\S]*?<\/main>/)[0];
  const blocks = [...main.matchAll(/<(?:p\b[^>]*|span\b[^>]*class="point-text"[^>]*)>([\s\S]*?)<\/(?:p|span)>/g)].map(match => normalize(match[1]));
  check(blocks.length >= 1, page + ' source contract has meaningful copy');
  const allowedReplacements = page === 'service-training.html' ? new Map([
    ['10名集めると1人あたりの受講料をさらに抑えられます。', '①AI活用知識編は、10名で受講した場合に1人あたり8,000円となります。']
  ]) : new Map();
  for (const copy of blocks.filter(copy => copy !== 'Other Services')) check(normalize(target).includes(allowedReplacements.get(copy) || copy), page + ' preserves: ' + copy);
  if (page === 'service-training.html') {
    check(!/20,900円|全コースセット・10名|560,000円/.test(target), 'no ambiguous legacy bundle recommendation or unsupported participant exception');
    check(target.includes('コース⑤はグループ3名まで'), 'explicit current course-five capacity remains');
  }
  if (page === 'service-management.html') {
    check(target.includes('class="lp-title-part">ポイント</span>') && target.includes('class="lp-title-part">ご相談ください</span>'), 'long headings wrap at meaningful phrases');
    check(target.includes('360,000円') && target.includes('期間3か月　計16時間分'), 'current management price/term');
    check(!/240,000|480,000|ライト|プレミアム|2〜4か月/.test(target), 'no obsolete management plans');
  }
  check(!target.includes('service-order.html'), page + ' no discontinued service link');
  if (page === 'profile.html') {
    check(!target.includes('profile-portrait-2.jpg'), 'profile does not reintroduce obsolete baked-copy illustration');
    check(target.includes('代表者写真は準備中です。'), 'profile placeholder is explicitly not a real portrait');
  }
  if (page === 'services.html') check(target.includes('class="lp-title-part">パッケージ</span>'), 'service name wraps as phrases, never an isolated final character');
}
console.log('Current lower-page copy: ' + count + ' PASS');
