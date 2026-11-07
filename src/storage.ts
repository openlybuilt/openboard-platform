import type { Edge, Node } from '@xyflow/react';
import type { AppState } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
export type CanvasBackground = 'plain' | 'dots' | 'grid';
export type Board = { id: string; name: string; updatedAt: number; nodes: Node[]; edges: Edge[]; background?: CanvasBackground; scene?: { elements: readonly ExcalidrawElement[]; preferences?: Partial<AppState> } };
const KEY = 'whiteboard.boards.v1';
export function loadBoards(): Board[] {
  const raw = localStorage.getItem(KEY);
  if (!raw) return [];
  const boards: unknown = JSON.parse(raw);
  if (!Array.isArray(boards)) throw new Error('Saved boards could not be read.');
  return boards;
}
export function saveBoards(boards: Board[]) { localStorage.setItem(KEY, JSON.stringify(boards)); }
export function newBoard(): Board { return {id: crypto.randomUUID(), name: 'Untitled board', updatedAt: Date.now(), nodes: [], edges: []}; }
