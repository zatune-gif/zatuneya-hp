import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { AxeBuilder } from '@axe-core/playwright';
import { chromium } from 'playwright';
import { startQaServer } from './qa-server.mjs';
import { managedPages } from './v3-lower-pages-fixture.mjs';

const root = resolve(import.meta.dirname, '..');
const profiles = [
  { name: 'mobile', viewport: { width: 375, height: 812 } },
  { name: 'desktop', viewport: { width: 1280, height: 900 } }
];
const wcagTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const scans = [
  { name: 'immediate', settleMilliseconds: 0 },
  { name: 'settled', settleMilliseconds: 500 }
];

const server = await startQaServer(root);
const browser = await chromium.launch({ headless: true });
const violations = [];
try {
  for (const profile of profiles) {
    const context = await browser.newContext({ viewport: profile.viewport });
    try {
      const page = await context.newPage();
      for (const filename of managedPages) {
        const response = await page.goto(`${server.origin}/${filename}`, { waitUntil: 'domcontentloaded' });
        assert.equal(response?.status(), 200, `axe ${profile.name}: ${filename} returns HTTP 200`);
        for (const scan of scans) {
          if (scan.settleMilliseconds > 0) await page.waitForTimeout(scan.settleMilliseconds);
          const results = await new AxeBuilder({ page }).withTags(wcagTags).analyze();
          console.log(`AXE ${profile.name} ${filename} ${scan.name}: ${results.violations.length} WCAG 2/2.1 A/AA violations`);
          violations.push(...results.violations.map(violation => ({
            profile: `${profile.name} ${filename} ${scan.name}`,
            violation
          })));
        }
      }
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
  await server.close();
}

if (violations.length > 0) {
  const details = violations.map(({ profile, violation }) => {
    const targets = violation.nodes.map(node => node.target.join(' ')).join(', ');
    return `${profile}: ${violation.id} (${violation.impact ?? 'unknown'}) — ${targets}`;
  }).join('\n');
  assert.fail(`axe found ${violations.length} WCAG 2/2.1 A/AA violation(s):\n${details}`);
}

console.log(`PASS axe 0 WCAG 2/2.1 A/AA violations across ${managedPages.length * profiles.length * scans.length} scans`);
