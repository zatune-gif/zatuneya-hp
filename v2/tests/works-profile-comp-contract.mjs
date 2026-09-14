import { check, checks, commonPage, html, text } from './lower-current-contract-helpers.mjs';
for (const page of ['works.html', 'profile.html']) {
  const source = commonPage(page);
  check(source.includes('href="./' + page + '" aria-current="page"'), page + ' current navigation');
  check(source.includes('./lower-service-pages.css'), page + ' scoped body adaptations');
}
const works = text(html('works.html'));
for (const token of ['支援実績', '準備中', '匿名']) check(works.includes(token), 'works actual publication status: ' + token);
check(!/毎月の集計を、迷わない流れに。|毎日の手触り。/.test(works), 'no invented legacy case copy');
const profile = text(html('profile.html'));
for (const token of ['「難しそう」を、', 'いっしょに越えていく。', 'パソコン講師', 'NPO法人代表', 'Webディレクター', 'カスタマーエンジニア', '企業の課長職', 'DX推進担当', '専門学校の担任', 'AIプロダクト開発', '9つの現場', '「教えられる実装者」が、業務整理から伴走します', '支援で大切にしていること', '代表者写真は準備中です。']) check(profile.includes(token), 'profile current factual copy: ' + token);
check(!html('profile.html').includes('profile-portrait-2.jpg'), 'no obsolete baked text portrait');
check(html('profile.html').includes('representative-portrait-placeholder.svg'), 'neutral temporary portrait frame');
console.log('PASS ' + checks + ' current works/profile contract checks; all-page browser coverage resides in lower-pages-v3-browser.mjs');
