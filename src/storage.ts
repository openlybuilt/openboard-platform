import type { Edge, Node } from '@xyflow/react';
import type { AppState, BinaryFiles } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
export type CanvasBackground = 'plain' | 'dots' | 'grid';
export type Board = { id: string; name: string; updatedAt: number; nodes: Node[]; edges: Edge[]; background?: CanvasBackground; canvasColor?: string; scene?: { elements: readonly ExcalidrawElement[]; preferences?: Partial<AppState>; files?: BinaryFiles } };
const KEY = 'whiteboard.boards.v1';
export function loadBoards(): Board[] {
  const raw = localStorage.getItem(KEY);
  if (!raw) return [];
  const boards: unknown = JSON.parse(raw);
  if (!Array.isArray(boards)) throw new Error('Saved boards could not be read.');
  return boards;
}
export function saveBoards(boards: Board[]) { localStorage.setItem(KEY, JSON.stringify(boards)); }
// Reconcile individual boards against the snapshot this tab last loaded. Never
// replace an entire, potentially newer collection with a stale tab's snapshot.
export function boardSnapshots(boards: Board[]) {
  return new Map(boards.map(board => [board.id, JSON.stringify(board)]));
}
export function reconcileLocalBoards(previous: Board[], next: Board[], snapshots: Map<string, string>) {
  const latest = loadBoards();
  const before = new Map(previous.map(board => [board.id, board]));
  const after = new Map(next.map(board => [board.id, board]));
  const merged = new Map(latest.map(board => [board.id, board]));
  const conflicts = new Map<string, string>();
  const matchesSaved = (id: string, current: Board | undefined) => snapshots.get(id) === (current ? JSON.stringify(current) : undefined);
  for (const board of next) {
    const original = before.get(board.id);
    if (original === board) continue;
    const current = merged.get(board.id);
    if (original && !matchesSaved(board.id, current)) {
      const copy = {...board, id: crypto.randomUUID(), name: `${board.name.slice(0, 83)} (conflict copy)`, updatedAt: Date.now()};
      merged.set(copy.id, copy);
      conflicts.set(board.id, copy.id);
    } else if (!original && current) {
      throw new Error('A board with this ID already exists.');
    } else {
      merged.set(board.id, board);
    }
  }
  for (const board of previous) {
    if (after.has(board.id)) continue;
    if (!matchesSaved(board.id, merged.get(board.id))) throw new Error('This board changed in another tab and was not deleted.');
    merged.delete(board.id);
  }
  const boards = [...merged.values()];
  saveBoards(boards);
  return {boards, conflicts};
}
export function newBoard(): Board { return {id: crypto.randomUUID(), name: 'Untitled board', updatedAt: Date.now(), nodes: [], edges: []}; }
