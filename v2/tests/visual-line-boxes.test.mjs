import assert from 'node:assert/strict';
import { test } from 'node:test';
import { countVisualLines } from './visual-line-boxes.mjs';

test('font-run rectangles on two visual lines count as two', () => {
  assert.equal(countVisualLines([
    { top: 437, height: 39, width: 288 },
    { top: 439, height: 35, width: 181 },
    { top: 476, height: 39, width: 288 },
    { top: 478, height: 35, width: 130 }
  ]), 2);
});

test('equal-top rectangles on two lines still count as two', () => {
  assert.equal(countVisualLines([
    { top: 437, height: 39, width: 288 },
    { top: 437, height: 39, width: 182 },
    { top: 476, height: 39, width: 288 },
    { top: 476, height: 39, width: 130 }
  ]), 2);
});

test('four separate visual lines remain four', () => {
  assert.equal(countVisualLines([0, 39, 78, 117].map((top) => ({ top, height: 39, width: 100 }))), 4);
});

test('touching or slightly overlapping adjacent lines stay separate', () => {
  assert.equal(countVisualLines([
    { top: 0, height: 40, width: 100 },
    { top: 39, height: 40, width: 100 },
    { top: 79, height: 40, width: 100 }
  ]), 3);
});

test('a tall font rectangle cannot bridge neighboring line anchors', () => {
  assert.equal(countVisualLines([
    { top: 0, height: 40, width: 100 },
    { top: 20, height: 100, width: 30 },
    { top: 40, height: 40, width: 100 }
  ]), 3);
});

test('fractional font-run top differences join while empty rectangles do not count', () => {
  assert.equal(countVisualLines([
    { top: 10.2, height: 31.4, width: 100 },
    { top: 10.8, height: 30.2, width: 50 },
    { top: 42.1, height: 31.4, width: 100 },
    { top: 42.4, height: 30.2, width: 0 }
  ]), 2);
});
