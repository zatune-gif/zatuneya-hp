import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startQaServer } from './qa-server.mjs';
import { publicationDirectory, verifyPublication } from '../../tools/publication-package.mjs';
import path from 'node:path';

const source = path.resolve(import.meta.dirname, '..', '..');
const manifest = await verifyPublication(source, publicationDirectory);
const server = await startQaServer(publicationDirectory);
const browser = await chromium.launch();
const pages = ['index.html', 'index-v2.html', 'contact.html', 'service-order.html', 'v2/index.html', 'v2/services.html', 'v2/contact.html'];
const widths = [375, 768, 1280];
let cells = 0;
try {
  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    for (const filename of pages) {
      const page = await context.newPage();
      const failures = [];
      page.on('response', response => {
        if (response.url().startsWith(server.origin) && response.status() >= 400) failures.push(`${response.status()} ${response.url()}`);
      });
      page.on('requestfailed', request => {
        if (request.url().startsWith(server.origin)) failures.push(`request failed ${request.url()}: ${request.failure()?.errorText}`);
      });
      const response = await page.goto(`${server.origin}/${filename}`, { waitUntil: 'load' });
      assert.equal(response?.status(), 200, `${width}/${filename} HTTP status`);
      await page.waitForTimeout(150);
      assert.deepEqual(failures, [], `${width}/${filename} local resources`);
      cells++;
      await page.close();
    }
    await context.close();
  }
} finally {
  await browser.close();
  await server.close();
}
console.info(`publication browser: ${cells} page/width cells, ${manifest.files} files, no local HTTP failures`);
