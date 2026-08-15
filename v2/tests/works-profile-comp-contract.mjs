import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const origin = 'https://zatune-gif.github.io/zatuneya-hp/v2/';
let checks = 0;
const check = (condition, message) => { checks += 1; assert.ok(condition, message); };

/* ── works.html ── */
const worksPath = join(root, 'works.html');
check(existsSync(worksPath), 'works.html exists');
const works = readFileSync(worksPath, 'utf8');

check(works.includes('href="./top-comp.css"'), 'works.html loads the shared TOP comp stylesheet');
check(works.includes('href="./works-profile-comp.css"'), 'works.html loads its own comp stylesheet');
check(!/href="\.\/style\.css"/.test(works), 'works.html no longer loads the legacy style.css');
check(!/<style[\s>]/i.test(works), 'works.html has no embedded <style> block');
check(!/style\s*=\s*"/.test(works), 'works.html adds no inline style attributes');
check(!/\b(alert|confirm|prompt)\s*\(/.test(works), 'works.html avoids blocking dialogs');
check(works.includes(`rel="canonical" href="${origin}works.html"`), 'works.html has the V2 canonical URL');
check(works.includes('© 2026 ざつね屋'), 'works.html has the 2026 copyright line');
check(works.includes('<script src="./nav.js" defer></script>'), 'works.html loads nav.js');
check(/aria-current="page"[^>]*>導入事例/.test(works) || /導入事例[^<]*<\/a>[^>]*aria-current="page"/.test(works.replace(/\n/g, '')), 'works.html marks 導入事例 nav link as current');

for (const token of [
  'WORKS', '導入事例',
  '変わったのは、', '毎日の手触り。',
  '会議メモが、次の仕事につながるまで。',
  '業務改善', '毎月の集計を、迷わない流れに。',
  '伴走サポート', '相談できる場所を、日常のそばに。',
  '要確認',
]) check(works.includes(token), `works.html contains: ${token}`);

check(works.includes('https://han-ai-diagnosis.netlify.app/'), 'works.html has the primary diagnosis CTA link');
check(works.includes('href="./contact.html"'), 'works.html has the secondary contact CTA link');
check(works.includes('./assets/band-onsite.jpg') || works.includes('./assets/band-together.jpg'), 'works.html reuses an existing band photo asset');

/* ── profile.html ── */
const profilePath = join(root, 'profile.html');
check(existsSync(profilePath), 'profile.html exists');
const profile = readFileSync(profilePath, 'utf8');

check(profile.includes('href="./top-comp.css"'), 'profile.html loads the shared TOP comp stylesheet');
check(profile.includes('href="./works-profile-comp.css"'), 'profile.html loads its own comp stylesheet');
check(!/href="\.\/style\.css"/.test(profile), 'profile.html no longer loads the legacy style.css');
check(!/<style[\s>]/i.test(profile), 'profile.html has no embedded <style> block');
check(!/style\s*=\s*"/.test(profile), 'profile.html adds no inline style attributes');
check(!/\b(alert|confirm|prompt)\s*\(/.test(profile), 'profile.html avoids blocking dialogs');
check(profile.includes(`rel="canonical" href="${origin}profile.html"`), 'profile.html has the V2 canonical URL');
check(profile.includes('© 2026 ざつね屋'), 'profile.html has the 2026 copyright line');
check(profile.includes('<script src="./nav.js" defer></script>'), 'profile.html loads nav.js');
check(/aria-current="page"[^>]*>代表プロフィール/.test(profile), 'profile.html marks 代表プロフィール nav link as current');

for (const token of [
  'PROFILE', '代表プロフィール',
  '「難しそう」を、', 'いっしょに越えていく。',
  'これまでの経歴と、この事業で活きる強み',
  'パソコン講師', 'NPO法人代表', 'コンテンツライター', 'Webディレクター',
  'カスタマーエンジニア', '企業の課長職', 'DX推進担当', '専門学校の担任', 'AIプロダクト開発',
  '「教えられる実装者」が、業務整理から伴走します',
  '支援で大切にしていること',
  '要確認',
]) check(profile.includes(token), `profile.html contains: ${token}`);

check(profile.includes('https://han-ai-diagnosis.netlify.app/'), 'profile.html has the primary diagnosis CTA link');
check(profile.includes('href="./contact.html"'), 'profile.html has the secondary contact CTA link');
check(profile.includes('./assets/profile-portrait-2.jpg'), 'profile.html keeps the existing portrait asset');

/* ── shared header/footer parity with v2/index.html ── */
const indexHtml = readFileSync(join(root, 'index.html'), 'utf8');
const headerMatch = indexHtml.match(/<header class="comp-header">[\s\S]*?<\/header>/);
check(!!headerMatch, 'v2/index.html has a comp-header block to copy from');
if (headerMatch) {
  const headerCore = headerMatch[0].replace(/\s*aria-current="page"/g, '').replace(/\s+/g, ' ');
  const worksHeaderNorm = works.replace(/\s*aria-current="page"/g, '').replace(/\s+/g, ' ');
  const profileHeaderNorm = profile.replace(/\s*aria-current="page"/g, '').replace(/\s+/g, ' ');
  check(worksHeaderNorm.includes(headerCore.trim()), 'works.html reuses the confirmed TOP header markup verbatim');
  check(profileHeaderNorm.includes(headerCore.trim()), 'profile.html reuses the confirmed TOP header markup verbatim');
}

const footerMatch = indexHtml.match(/<footer class="comp-footer">[\s\S]*?<\/footer>/);
check(!!footerMatch, 'v2/index.html has a comp-footer block to copy from');
if (footerMatch) {
  const footerNorm = footerMatch[0].replace(/\s+/g, ' ').trim();
  const worksNorm = works.replace(/\s+/g, ' ');
  const profileNorm = profile.replace(/\s+/g, ' ');
  check(worksNorm.includes(footerNorm), 'works.html reuses the confirmed TOP footer markup verbatim');
  check(profileNorm.includes(footerNorm), 'profile.html reuses the confirmed TOP footer markup verbatim');
}

console.log(`PASS ${checks} works/profile comp contract checks`);
