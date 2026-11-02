/**
 * Painting highlights without touching the page's DOM (the CSS Custom Highlight API): ranges are
 * registered under four names and coloured by `::highlight(ann-*)` rules in index.css. Nothing is
 * inserted into the text, so React, KaTeX and the answer dropdowns never see a foreign node.
 *
 * Browsers without the API (iOS before 17.2) get the same highlights drawn as rectangles over the
 * text by AnnotationLayer instead, so nobody loses the tool.
 */
export type AnnotationColor = 'yellow' | 'pink' | 'blue' | 'underline';
export const ANNOTATION_COLORS: readonly AnnotationColor[] = ['yellow', 'pink', 'blue', 'underline'];

interface HighlightRegistry {
  set(name: string, value: unknown): void;
  delete(name: string): void;
}

type HighlightCtor = new (...ranges: Range[]) => unknown;

/** The registry and the Highlight constructor, read together, or null when either is missing. */
const api = (): { reg: HighlightRegistry; Ctor: HighlightCtor } | null => {
  try {
    const g = globalThis as { CSS?: { highlights?: HighlightRegistry }; Highlight?: unknown };
    const reg = g.CSS?.highlights;
    const Ctor = g.Highlight;
    return reg && typeof Ctor === 'function' ? { reg, Ctor: Ctor as HighlightCtor } : null;
  } catch {
    return null;
  }
};

export const supportsHighlightApi = (): boolean => api() !== null;

export interface PaintEntry {
  range: Range;
  color: AnnotationColor;
}

// Several layers can be on screen at once (a quiz inside a lesson page): each owns its ranges.
const layers = new Map<string, PaintEntry[]>();

function repaint() {
  const found = api();
  if (!found) return;
  // Painting is decoration: it must never be able to break the page it paints on.
  try {
    for (const color of ANNOTATION_COLORS) {
      const ranges: Range[] = [];
      for (const entries of layers.values()) for (const e of entries) if (e.color === color) ranges.push(e.range);
      if (ranges.length) found.reg.set(`ann-${color}`, new found.Ctor(...ranges));
      else found.reg.delete(`ann-${color}`);
    }
  } catch {
    // An engine that half-supports the API: the highlights stay unpainted, the page keeps working.
  }
}

export function paintLayer(layerId: string, entries: PaintEntry[]) {
  if (entries.length) layers.set(layerId, entries);
  else layers.delete(layerId);
  repaint();
}

export function clearLayer(layerId: string) {
  if (layers.delete(layerId)) repaint();
}
