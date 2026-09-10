import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

const root = resolve(import.meta.dirname, '..');
const parts = join(root, 'assets', 'comp-parts');
const screenshots = join(root, 'qa-screenshots', 'index');
const thresholdArg = process.argv.indexOf('--threshold');
const maxError = thresholdArg >= 0 ? Number(process.argv[thresholdArg + 1]) : 0.22;
assert.ok(Number.isFinite(maxError) && maxError > 0, '--threshold must be a positive number');

const targets = [
  { viewport: 1280, reference: 'comp-desktop-reference.png', output: 'comp-diff-1280.png' },
  { viewport: 375, reference: 'comp-mobile-reference.png', output: 'comp-diff-375.png' }
];

function dataUrl(path) {
  return `data:image/png;base64,${readFileSync(path).toString('base64')}`;
}

const browser = await chromium.launch();
const page = await browser.newPage();
const results = [];
try {
  for (const target of targets) {
    const referencePath = join(parts, target.reference);
    const implementationPath = join(screenshots, `${target.viewport}.png`);
    const comparison = await page.evaluate(async ({ referenceUrl, implementationUrl }) => {
      const load = src => new Promise((resolveImage, reject) => {
        const image = new Image();
        image.onload = () => resolveImage(image);
        image.onerror = reject;
        image.src = src;
      });
      const [reference, implementation] = await Promise.all([load(referenceUrl), load(implementationUrl)]);
      const sample = (image, width = 24, height = 96) => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        context.drawImage(image, 0, 0, width, height);
        return context.getImageData(0, 0, width, height).data;
      };
      const refGrid = sample(reference);
      const implGrid = sample(implementation);
      let colorError = 0;
      let edgeError = 0;
      const luminance = (pixels, index) => .2126 * pixels[index] + .7152 * pixels[index + 1] + .0722 * pixels[index + 2];
      for (let index = 0; index < refGrid.length; index += 4) {
        colorError += (Math.abs(refGrid[index] - implGrid[index]) + Math.abs(refGrid[index + 1] - implGrid[index + 1]) + Math.abs(refGrid[index + 2] - implGrid[index + 2])) / (3 * 255);
        if (index >= 24 * 4) {
          const refEdge = Math.abs(luminance(refGrid, index) - luminance(refGrid, index - 24 * 4));
          const implEdge = Math.abs(luminance(implGrid, index) - luminance(implGrid, index - 24 * 4));
          edgeError += Math.abs(refEdge - implEdge) / 255;
        }
      }
      const pixelCount = refGrid.length / 4;
      const colorMae = colorError / pixelCount;
      const edgeMae = edgeError / (pixelCount - 24);
      const score = colorMae * .7 + edgeMae * .3;
      const referenceRatio = reference.height / reference.width;
      const implementationRatio = implementation.height / implementation.width;
      const aspectError = Math.abs(implementationRatio - referenceRatio) / referenceRatio;

      const canvas = document.createElement('canvas');
      canvas.width = reference.width * 3;
      canvas.height = reference.height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(reference, 0, 0, reference.width, reference.height);
      context.drawImage(implementation, reference.width, 0, reference.width, reference.height);
      const refPixels = context.getImageData(0, 0, reference.width, reference.height);
      const implPixels = context.getImageData(reference.width, 0, reference.width, reference.height);
      const diff = context.createImageData(reference.width, reference.height);
      for (let index = 0; index < diff.data.length; index += 4) {
        const delta = (Math.abs(refPixels.data[index] - implPixels.data[index]) + Math.abs(refPixels.data[index + 1] - implPixels.data[index + 1]) + Math.abs(refPixels.data[index + 2] - implPixels.data[index + 2])) / 3;
        diff.data[index] = Math.min(255, delta * 3);
        diff.data[index + 1] = Math.max(0, 96 - delta);
        diff.data[index + 2] = 32;
        diff.data[index + 3] = 255;
      }
      context.putImageData(diff, reference.width * 2, 0);
      return { colorMae, edgeMae, score, aspectError, image: canvas.toDataURL('image/png') };
    }, { referenceUrl: dataUrl(referencePath), implementationUrl: dataUrl(implementationPath) });

    writeFileSync(join(screenshots, target.output), Buffer.from(comparison.image.split(',')[1], 'base64'));
    assert.ok(comparison.score <= maxError, `${target.viewport}px normalized visual error ${comparison.score.toFixed(4)} exceeds ${maxError}`);
    assert.ok(comparison.aspectError <= .08, `${target.viewport}px page aspect error ${(comparison.aspectError * 100).toFixed(2)}% exceeds 8%`);
    results.push({ viewport: target.viewport, colorMae: comparison.colorMae, edgeMae: comparison.edgeMae, score: comparison.score, aspectError: comparison.aspectError });
  }
} finally {
  await browser.close();
}

for (const result of results) console.info(JSON.stringify(result));
console.info(`top-comp-visual-diff: ${results.length} viewports PASS at threshold ${maxError}`);
