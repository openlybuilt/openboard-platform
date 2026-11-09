import { newElementWith } from '@excalidraw/excalidraw';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';

const FILL_KIND = 'openboard-frame-fill';

function isFill(element: ExcalidrawElement) {
  return element.customData?.kind === FILL_KIND;
}

// Excalidraw draws frames as outlines, even when a file gives them a fill.
// A locked child rectangle supplies the fill while the frame keeps its normal
// selection, grouping, clipping, and movement behavior.
export function ensureFrameFills(elements: readonly ExcalidrawElement[]): ExcalidrawElement[] {
  const filled = new Set(elements.filter(isFill).map(element => element.frameId));
  const ids = new Set(elements.map(element => element.id));
  const result: ExcalidrawElement[] = [];
  for (const element of elements) {
    result.push(element);
    if (element.type !== 'frame' || element.isDeleted || element.backgroundColor === 'transparent' || filled.has(element.id)) continue;
    let id = `openboard-frame-fill-${element.id}`;
    if (ids.has(id)) id = crypto.randomUUID();
    ids.add(id);
    filled.add(element.id);
    result.push({
      ...element,
      id,
      index: null,
      type: 'rectangle',
      frameId: element.id,
      boundElements: null,
      link: null,
      locked: true,
      name: undefined,
      customData: { kind: FILL_KIND },
    } as ExcalidrawElement);
  }
  // Excalidraw assigns the null index when it accepts the scene, preserving
  // this array order without duplicating the frame's fractional index.
  return result;
}

// Frame children move with their frame. Resizing a frame does not resize its
// child, so keep the backing rectangle fitted to the current frame geometry.
export function fitFrameFills(elements: readonly ExcalidrawElement[]): ExcalidrawElement[] | null {
  const frames = new Map(elements.filter(element => element.type === 'frame' && !element.isDeleted).map(frame => [frame.id, frame]));
  let changed = false;
  const fitted = elements.map(element => {
    if (!isFill(element) || element.isDeleted) return element;
    const frame = frames.get(element.frameId ?? '');
    if (!frame) {
      changed = true;
      return newElementWith(element, { isDeleted: true });
    }
    if (element.x === frame.x && element.y === frame.y && element.width === frame.width && element.height === frame.height && element.angle === frame.angle) return element;
    changed = true;
    return newElementWith(element, { x: frame.x, y: frame.y, width: frame.width, height: frame.height, angle: frame.angle });
  });
  return changed ? fitted : null;
}
