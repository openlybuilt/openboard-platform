import type { Folder } from './storage';

export function folderDescendants(folders: Folder[], id: string): Set<string> {
  const result = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const folder of folders) if (folder.parentId && result.has(folder.parentId) && !result.has(folder.id)) {
      result.add(folder.id);
      changed = true;
    }
  }
  return result;
}

export function folderPath(folders: Folder[], folder: Folder): string {
  const byId = new Map(folders.map(item => [item.id, item]));
  const names: string[] = [];
  const seen = new Set<string>();
  let current: Folder | undefined = folder;
  while (current && !seen.has(current.id)) {
    seen.add(current.id); names.unshift(current.name);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return names.join(' / ');
}

export function folderRows(folders: Folder[], collapsed: Set<string>): {folder: Folder; depth: number; hasChildren: boolean}[] {
  const sorted = [...folders].sort((a,b) => a.name.localeCompare(b.name));
  const byId = new Map(sorted.map(folder => [folder.id, folder]));
  const children = new Map<string, Folder[]>();
  for (const folder of sorted) {
    const parent = folder.parentId && byId.has(folder.parentId) && folder.parentId !== folder.id ? folder.parentId : '';
    const group = children.get(parent) ?? []; group.push(folder); children.set(parent, group);
  }
  const rows: {folder: Folder; depth: number; hasChildren: boolean}[] = [];
  const seen = new Set<string>();
  const add = (folder: Folder, depth: number) => {
    if (seen.has(folder.id)) return;
    seen.add(folder.id);
    const nested = children.get(folder.id) ?? [];
    rows.push({folder, depth, hasChildren: nested.length > 0});
    if (!collapsed.has(folder.id)) for (const child of nested) add(child, depth + 1);
  };
  for (const folder of children.get('') ?? []) add(folder, 0);
  // A malformed cycle has no root. Keep it reachable without recursion loops.
  for (const folder of sorted) if (!seen.has(folder.id) && !folder.parentId) add(folder, 0);
  return rows;
}
