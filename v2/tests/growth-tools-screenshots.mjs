import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { startQaServer } from './qa-server.mjs';

const root = resolve(import.meta.dirname, '..');
const output = join(root, 'qa-screenshots');
const pages = ['growth', 'tools'];
const widths = [375, 768, 1280];
const staging = join(output, `.growth-tools-staging-${randomUUID()}`);
const backup = join(output, `.growth-tools-backup-${randomUUID()}`);
const forceFailure = process.env.V3_GROWTH_TOOLS_FORCE_SCREENSHOT_FAILURE === '1';
const canonicalPath = (page, width) => join(output, `${page}-${width}.png`);
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const before = Object.fromEntries(pages.flatMap(page => widths.map(width => {
  const path = canonicalPath(page, width);
  return [`${page}-${width}`, existsSync(path) ? hash(path) : null];
})));

mkdirSync(staging, { recursive: true });
const server = await startQaServer(root);
const browser = await chromium.launch({ headless: true });
try {
  for (const pageName of pages) {
    for (const width of widths) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      try {
        await page.goto(`${server.origin}/${pageName}.html`, { waitUntil: 'networkidle' });
        await page.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
        await page.locator('.fade-in').evaluateAll(elements => elements.forEach(element => element.classList.add('is-visible')));
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `${pageName}/${width} has no horizontal overflow`);
        const path = join(staging, `${pageName}-${width}.png`);
        await page.screenshot({ path, fullPage: true });
        assert.equal(readFileSync(path).readUInt32BE(16), width, `${pageName}/${width} PNG width`);
        if (forceFailure) throw new Error('Intentional screenshot staging failure');
      } finally { await page.close(); }
    }
  }
  mkdirSync(backup, { recursive: true });
  const moved = [];
  try {
    for (const pageName of pages) for (const width of widths) {
      const canonical = canonicalPath(pageName, width);
      const prior = join(backup, `${pageName}-${width}.png`);
      if (existsSync(canonical)) renameSync(canonical, prior);
      try {
        renameSync(join(staging, `${pageName}-${width}.png`), canonical);
      } catch (error) {
        if (existsSync(prior)) renameSync(prior, canonical);
        throw error;
      }
      moved.push([canonical, prior]);
    }
  } catch (error) {
    for (const [canonical, prior] of moved.reverse()) {
      if (existsSync(canonical)) rmSync(canonical);
      if (existsSync(prior)) renameSync(prior, canonical);
    }
    throw error;
  }
} catch (error) {
  if (forceFailure) {
    const after = Object.fromEntries(pages.flatMap(page => widths.map(width => {
      const path = canonicalPath(page, width);
      return [`${page}-${width}`, existsSync(path) ? hash(path) : null];
    })));
    assert.deepEqual(after, before, 'forced staging failure preserves canonical screenshot hashes');
    console.log('PASS forced screenshot failure preserves all canonical hashes');
  } else throw error;
} finally {
  await browser.close();
  await server.close();
  rmSync(staging, { recursive: true, force: true });
  rmSync(backup, { recursive: true, force: true });
}

if (!forceFailure) console.log('PASS growth/tools screenshots: 2 pages x 3 widths published atomically');
