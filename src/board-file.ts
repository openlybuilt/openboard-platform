import { getCommonBounds, loadFromBlob } from '@excalidraw/excalidraw';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { Board, BoardViewport, CanvasBackground } from './storage';

const COLOR = /^#[0-9a-f]{6}$/i;
const FILE_LIMIT_BYTES = 20_000_000;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function viewport(value: unknown): BoardViewport | undefined {
  const data = record(value);
  const zoom = typeof data.zoom === 'number' ? data.zoom : record(data.zoom).value;
  if (typeof zoom !== 'number' || !Number.isFinite(zoom) || zoom < 0.1 || zoom > 30 ||
      typeof data.scrollX !== 'number' || !Number.isFinite(data.scrollX) ||
      typeof data.scrollY !== 'number' || !Number.isFinite(data.scrollY)) return;
  return { zoom, scrollX: data.scrollX, scrollY: data.scrollY };
}

export function centeredViewport(elements: readonly ExcalidrawElement[]): BoardViewport {
  const visible = elements.filter(element => !element.isDeleted);
  if (!visible.length) return { zoom: 1, scrollX: 0, scrollY: 0 };
  const [left, top, right, bottom] = getCommonBounds(visible);
  return {
    zoom: 1,
    scrollX: window.innerWidth / 2 - (left + right) / 2,
    scrollY: Math.max(350, window.innerHeight - 80) / 2 - (top + bottom) / 2,
  };
}

export async function readBoardFile(file: File): Promise<Board> {
  if (file.size > FILE_LIMIT_BYTES) throw new Error('This file is too large to open.');
  let source: Record<string, unknown>;
  try { source = record(JSON.parse(await file.text())); }
  catch { throw new Error('This is not a valid OpenBoard or Excalidraw file.'); }
  if (source.type !== 'excalidraw' || !Array.isArray(source.elements))
    throw new Error('This is not a valid OpenBoard or Excalidraw file.');

  const restored = await loadFromBlob(file, null, null);
  const metadata = record(source.openboard);
  const appState = record(source.appState);
  const background: CanvasBackground = metadata.background === 'dots' || metadata.background === 'grid' ? metadata.background : 'plain';
  const rawColor = metadata.canvasColor ?? appState.viewBackgroundColor;
  const canvasColor = typeof rawColor === 'string' && COLOR.test(rawColor) ? rawColor : undefined;
  const savedViewport = viewport(metadata.viewport) ?? viewport(appState);
  const name = file.name.replace(/\.(openboard|excalidraw)$/i, '').trim().slice(0, 100) || 'Imported board';
  return {
    id: crypto.randomUUID(), name, updatedAt: Date.now(), nodes: [], edges: [], background, canvasColor,
    scene: { elements: restored.elements, files: restored.files, viewport: savedViewport ?? centeredViewport(restored.elements) },
  };
}
