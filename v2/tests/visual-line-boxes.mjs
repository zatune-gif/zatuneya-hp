export function countVisualLines(rects) {
  const lines = [];
  const visibleRects = rects
    .filter(({ top, height, width }) => Number.isFinite(top) && height > 0 && width > 0)
    .sort((a, b) => a.top - b.top);
  for (const rect of visibleRects) {
    const center = rect.top + rect.height / 2;
    const matchingLine = lines.find((line) => {
      const minHeight = Math.min(line.height, rect.height);
      const maxHeight = Math.max(line.height, rect.height);
      const overlap = Math.min(line.bottom, rect.top + rect.height) - Math.max(line.top, rect.top);
      // Compare with the first rect's fixed line box; a tall run must not bridge adjacent lines.
      return maxHeight <= minHeight * 1.5 &&
        overlap >= minHeight / 2 && Math.abs(line.center - center) <= minHeight / 4;
    });
    if (!matchingLine) {
      lines.push({ top: rect.top, bottom: rect.top + rect.height, center, height: rect.height });
    }
  }
  return lines.length;
}
