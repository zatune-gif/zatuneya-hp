import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { startQaServer } from './qa-server.mjs';

const root = resolve(import.meta.dirname, '..');
const repoRoot = resolve(root, '..');
const names = (await readdir(root)).filter(name => name.endsWith('.html')).sort();
assert.equal(names.length, 16, 'all 16 V3 staging HTML pages are covered');
let checks = 1;
const lighthouseSource = await readFile(resolve(import.meta.dirname, 'qa-lighthouse.mjs'), 'utf8');
assert.match(lighthouseSource, /--staging-noindex/, 'Lighthouse has an explicit normal staging mode'); checks++;
assert.match(lighthouseSource, /--promotion-readiness/, 'Lighthouse has a separately named localhost-only readiness mode'); checks++;
assert.match(lighthouseSource, /is-crawlable/, 'staging SEO exception inspects the precise crawlability audit'); checks++;
assert.match(lighthouseSource, /score < 1/, 'other weighted SEO audits must reject partial score loss'); checks++;
const packageJson = JSON.parse(await readFile(resolve(root, '..', 'package.json'), 'utf8'));
assert.match(packageJson.scripts['qa:all'], /qa:staging-noindex/, 'standard full QA includes the 16-page staging noindex gate'); checks++;
for (const name of names) {
  const html = await readFile(resolve(root, name), 'utf8');
  const baseline = execFileSync('git', ['-c', `safe.directory=${repoRoot.replaceAll('\\', '/')}`, 'show', `HEAD:v2/${name}`], { cwd: repoRoot, encoding: 'utf8' });
  const stripRobots = value => value.replace(/<meta\s+name="robots"\s+content="(?:noindex|noindex,follow)">/gi, '').replace(/\r\n/g, '\n');
  assert.equal(stripRobots(html), stripRobots(baseline), `${name}: only robots meta differs from stacked base`); checks++;
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1];
  assert.ok(head, `${name}: head exists`); checks++;
  const robots = [...head.matchAll(/<meta\s+[^>]*name=["']robots["'][^>]*>/gi)];
  assert.equal(robots.length, 1, `${name}: exactly one robots meta`); checks++;
  assert.match(robots[0][0], /\bcontent=["']noindex,follow["']/i, `${name}: exact staging robots directive`); checks++;
  assert.doesNotMatch(head, /<meta\s+[^>]*name=["'](?:googlebot|bingbot)["']/i, `${name}: no competing bot directive`); checks++;
}

const server = await startQaServer(root);
const browser = await chromium.launch();
try {
  for (const name of names) {
    const page = await browser.newPage();
    const response = await page.goto(`${server.origin}/${name}`);
    assert.equal(response.status(), 200, `${name}: normal QA response succeeds`); checks++;
    const robots = await page.locator('head meta[name="robots"]').evaluateAll(nodes => nodes.map(node => node.content));
    assert.deepEqual(robots, ['noindex,follow'], `${name}: normal served page retains noindex`); checks++;
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}
const readinessServer = await startQaServer(root, { stripNoindexForReadiness: true });
try {
  assert.match(readinessServer.origin, /^http:\/\/127\.0\.0\.1:/, 'readiness server is localhost only'); checks++;
  for (const name of names) {
    const response = await fetch(`${readinessServer.origin}/${name}`);
    assert.equal(response.status, 200, `${name}: readiness response succeeds`); checks++;
    const html = await response.text();
    assert.doesNotMatch(html, /<meta\s+[^>]*name=["']robots["'][^>]*>/i, `${name}: readiness response alone strips noindex`); checks++;
    const source = await readFile(resolve(root, name), 'utf8');
    assert.match(source, /<meta\s+[^>]*name=["']robots["'][^>]*content=["']noindex,follow["'][^>]*>/i, `${name}: source remains noindex after readiness request`); checks++;
  }
} finally {
  await readinessServer.close();
}
console.info(`staging-noindex-contract: ${checks} checks PASS across ${names.length} pages`);
