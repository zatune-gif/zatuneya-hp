// 欠字チェック：全公開ページを実際に表示し、画面に出る文字がすべて自サイト配信のフォント
// （assets/fonts/charset.txt に収録された文字）に含まれることを確認する。
// あわせて、フォントが読み込まれていること・同一オリジンで 200 が返ること・
// Google Fonts へ接続していないことも確認する。
//
// 使い方（リポジトリのルートで）:
//   node tools/check-fonts.mjs                       # Chromium
//   node tools/check-fonts.mjs --browsers=chromium,webkit
// 欠字や読み込み失敗があれば終了コード 1。文言を足したら tools/build-fonts.py を再実行してから流す。
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit, firefox } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=')[1] || d;
const root = path.resolve(arg('root', ROOT));
const browsers = arg('browsers', 'chromium').split(',');
const engines = { chromium, webkit, firefox };

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const server = http.createServer((q, r) => {
  const p = decodeURIComponent(q.url.split('?')[0]);
  const f = path.join(root, p.endsWith('/') ? p + 'index.html' : p);
  fs.readFile(f, (e, d) => {
    if (e) { r.writeHead(404); r.end('not found'); return; }
    r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
    r.end(d);
  });
});
await new Promise((res) => server.listen(0, res));
const base = `http://localhost:${server.address().port}`;

// charset.txt を読む
const sets = {};
let cur = null;
for (const line of fs.readFileSync(path.join(root, 'assets/fonts/charset.txt'), 'utf8').split(/\r?\n/)) {
  if (!line || line.startsWith('#')) continue;
  const m = line.match(/^\[(.+)\]$/);
  if (m) { cur = m[1]; sets[cur] = new Set(); continue; }
  for (const c of line) sets[cur].add(c);
}
const covered = new Set([...(sets.NotoSansJP || []), ...(sets.Roboto || [])]);
const accepted = sets.NoFont || new Set(); // どちらの原本にも無く、端末の代替フォントで表示すると分かっている文字

// 改善候補ページ index-v2.html は Google Fonts の接続を残したまま（変更しない方針）。欠字だけ確認する
const EXTERNAL_OK = new Set(['index-v2.html']);
const pages = fs.readdirSync(root).filter((f) => f.endsWith('.html')).sort();
let failures = 0;
const fallbackSeen = new Set();

for (const name of browsers) {
  const browser = await engines[name].launch();
  console.log(`\n== ${name} ==`);
  for (const file of pages) {
    const used = new Map(); // 文字 -> 例の場所
    const fontReqs = [];
    const bad = [];
    const faceLog = new Set();
    for (const width of [375, 1280]) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await ctx.newPage();
      page.on('response', (r) => {
        if (r.frame() !== page.mainFrame()) return; // 埋め込み（Google フォーム等）のフォントは対象外
        const u = r.url();
        if (/\.woff2?(\?|$)/.test(u) || /fonts\.(googleapis|gstatic)\.com/.test(u)) fontReqs.push({ u, s: r.status() });
      });
      page.on('request', (r) => { if (r.frame() !== page.mainFrame()) return; if (!EXTERNAL_OK.has(file) && /fonts\.(googleapis|gstatic)\.com/.test(r.url())) bad.push(`外部フォント接続: ${r.url()}`); });
      await page.goto(`${base}/${file}`, { waitUntil: 'load' });
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); }
        window.scrollTo(0, 0);
        await document.fonts.ready;
      });
      const r = await page.evaluate(() => {
        const out = [];
        const skip = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE']);
        const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        while (tw.nextNode()) {
          const n = tw.currentNode;
          if (skip.has(n.parentElement.tagName)) continue;
          out.push([n.textContent, n.parentElement.tagName.toLowerCase()]);
        }
        for (const el of document.body.querySelectorAll('*')) {
          for (const a of ['placeholder']) if (el.getAttribute(a)) out.push([el.getAttribute(a), `${el.tagName.toLowerCase()}[${a}]`]);
          if (el.tagName === 'INPUT' && /^(submit|button)$/.test(el.type) && el.value) out.push([el.value, 'input[value]']);
          for (const ps of ['::before', '::after']) {
            const c = getComputedStyle(el, ps).content;
            if (c && c !== 'none' && c !== 'normal') out.push([c.replace(/^["']|["']$/g, ''), `${el.tagName.toLowerCase()}${ps}`]);
          }
        }
        out.push([document.title, 'title']);
        const faces = [...document.fonts].map((f) => `${f.family.replace(/"/g, '')} ${f.weight}:${f.status}`);
        return { out, faces };
      });
      for (const [text, where] of r.out) for (const c of text) if (!/\s/.test(c) && c.codePointAt(0) >= 0x20 && !used.has(c)) used.set(c, where);
      const faulty = r.faces.filter((f) => f.endsWith(':error'));
      if (faulty.length) bad.push(`${width}px フォント読込エラー: ${faulty.join(', ')}`);
      if (!r.faces.some((f) => f.startsWith('Noto Sans JP') && f.endsWith(':loaded'))) bad.push(`${width}px Noto Sans JP が読み込まれていない: ${r.faces.join(', ')}`);
      faceLog.add(r.faces.filter((f) => f.endsWith(':loaded')).join(' / '));
      await ctx.close();
    }
    const missing = [...used].filter(([c]) => !covered.has(c) && !accepted.has(c));
    for (const [c] of used) if (accepted.has(c)) fallbackSeen.add(c);
    const non200 = fontReqs.filter((x) => x.s !== 200 && x.u.startsWith(base));
    const origin = EXTERNAL_OK.has(file) ? [] : fontReqs.filter((x) => !x.u.startsWith(base));
    if (non200.length) bad.push(`フォントの応答が 200 ではない: ${non200.map((x) => `${x.s} ${x.u}`).join(', ')}`);
    if (origin.length) bad.push(`同一オリジン以外のフォント通信 ${origin.length} 件（例: ${origin[0].u}）`);
    const ok = !missing.length && !bad.length;
    if (!ok) failures++;
    console.log(`${ok ? 'OK ' : 'NG '} ${file.padEnd(26)} 文字 ${String(used.size).padStart(4)} / 欠字 ${missing.length} / フォント通信 ${fontReqs.length} 件 ${[...faceLog].join(' | ')}`);
    for (const [c, w] of missing) console.log(`     欠字 ${JSON.stringify(c)} U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}  (${w})`);
    for (const b of bad) console.log(`     ${b}`);
  }
  await browser.close();
}
server.close();
if (fallbackSeen.size) console.log(`\n参考：原本フォントに無く、端末の代替フォントで表示される文字（従来どおり）: ${[...fallbackSeen].join(' ')}`);
console.log(failures ? `\n失敗 ${failures} ページ` : '\n欠字 0 件・フォント読み込み異常なし');
process.exit(failures ? 1 : 0);
