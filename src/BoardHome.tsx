import { useEffect, useRef, useState } from 'react';
import { Boxes, Folder, FolderOpen, Moon, MoreHorizontal, Plus, RotateCcw, Sun, Trash2 } from 'lucide-react';
import { AuthControls } from './AuthControls';
import { BoardThumbnail } from './BoardThumbnail';
import { ExpandingSearch } from './vendor/arc/expanding-search/expanding-search';
import { isExpiredDeleted, TRASH_RETENTION_MS, type Board, type Folder as BoardFolder } from './storage';
import openlyLight from './assets/openly-light.svg';
import openlyDark from './assets/openly-dark.svg';

function formatDate(value: number) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(value);
}

type Props = {
  boards: Board[];
  folders: BoardFolder[];
  onFolderChange: (change: {type:'put';folder:BoardFolder}|{type:'delete';id:string}) => boolean;
  onDeleteFolder: (folder:BoardFolder) => boolean;
  onMove: (board:Board, folderId:string) => void;
  authConfigured: boolean;
  guestUnsaved: boolean;
  theme: 'light' | 'dark';
  onThemeChange: (theme: 'light' | 'dark') => void;
  onCreate: (folderId?: string) => void;
  onOpen: (id: string) => void;
  onImport: (file: File) => void;
  onDelete: (board: Board) => void;
  onRestore: (board: Board) => void;
};

export function BoardHome({ boards, folders, onFolderChange, onDeleteFolder, onMove, authConfigured, guestUnsaved, theme, onThemeChange, onCreate, onOpen, onImport, onDelete, onRestore }: Props) {
  const [view, setView] = useState<'boards' | 'deleted'>('boards');
  const fileInput = useRef<HTMLInputElement>(null);
  const [selectedFolder, setSelectedFolder] = useState('all');
  const draggingBoard = useRef<string | null>(null);
  const [draggingBoardId, setDraggingBoardId] = useState<string | null>(null);
  const [dropFolderId, setDropFolderId] = useState<string | null>(null);
  const clearDrag = () => { draggingBoard.current = null; setDraggingBoardId(null); setDropFolderId(null); };
  const [editingFolder, setEditingFolder] = useState<BoardFolder | null>(null);
  const [folderName, setFolderName] = useState('');
  const [folderToDelete, setFolderToDelete] = useState<BoardFolder | null>(null);
  const [folderMenu, setFolderMenu] = useState<{folder:BoardFolder; x:number; y:number} | null>(null);
  const folderMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if(!folderMenu)return;
    const dismiss = (event:MouseEvent) => { if(!folderMenuRef.current?.contains(event.target as Node))setFolderMenu(null); };
    const escape = (event:KeyboardEvent) => { if(event.key==='Escape')setFolderMenu(null); };
    window.addEventListener('mousedown',dismiss); window.addEventListener('keydown',escape);
    return () => {window.removeEventListener('mousedown',dismiss);window.removeEventListener('keydown',escape)};
  }, [folderMenu]);
  const folderDialog = useRef<HTMLDialogElement>(null);
  const deleteFolderDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (editingFolder && !folderDialog.current?.open) folderDialog.current?.showModal(); }, [editingFolder]);
  useEffect(() => { if (folderToDelete && !deleteFolderDialog.current?.open) deleteFolderDialog.current?.showModal(); }, [folderToDelete]);
  const active = boards.filter(board => !board.deletedAt);
  const deleted = boards.filter(board => board.deletedAt && !isExpiredDeleted(board));
  const folderIds = new Set(folders.map(folder => folder.id));
  const selected = folders.find(folder => folder.id === selectedFolder);
  const selection = selectedFolder === 'all' ? active : selectedFolder === 'unfiled' || !selected ? active.filter(board => !board.folderId || !folderIds.has(board.folderId)) : active.filter(board => board.folderId === selectedFolder);
  const shown = view === 'boards' ? selection : deleted;
  const createFolder = () => { setFolderName(''); setEditingFolder({id:crypto.randomUUID(),name:''}); };
  const renameFolder = (folder:BoardFolder) => { setFolderName(folder.name); setEditingFolder(folder); };
  const saveFolder = () => {
    const name=folderName.trim(); if(!editingFolder || !name)return;
    if(onFolderChange({type:'put',folder:{...editingFolder,name}})){
      setSelectedFolder(editingFolder.id); folderDialog.current?.close();
    }
  };
  const deleteFolder = () => {
    if(folderToDelete && onDeleteFolder(folderToDelete)){
      setSelectedFolder('all'); deleteFolderDialog.current?.close();
    }
  };

  return <main className="home">
    {authConfigured && <AuthControls />}
    <div className="home-brand" aria-label="Openly"><img className="home-logo light-logo" src={openlyLight} alt=""/><img className="home-logo dark-logo" src={openlyDark} alt=""/></div>
    <button className="home-theme-toggle" type="button" aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'} title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'} onClick={() => onThemeChange(theme === 'light' ? 'dark' : 'light')}>{theme === 'light' ? <Moon size={18}/> : <Sun size={18}/>}</button>
    <div className="home-heading"><h1 className="home-title">OpenBoard</h1><p className="home-byline">by Openly</p></div>
    <div className="board-home-tabs" role="group" aria-label="Board view">
      <button type="button" aria-pressed={view === 'boards'} onClick={() => setView('boards')}>Your boards <span>{active.length}</span></button>
      <button type="button" aria-pressed={view === 'deleted'} onClick={() => setView('deleted')}>Recently deleted <span>{deleted.length}</span></button>
    </div>
    <input ref={fileInput} type="file" accept=".openboard,.excalidraw,application/json" hidden onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (file) onImport(file); }}/>
    <div className="folder-layout">{view === 'boards' && !guestUnsaved && <nav className="folder-sidebar" aria-label="Board folders">
      <button type="button" aria-pressed={selectedFolder === 'all'} onClick={() => setSelectedFolder('all')}>All boards <span>{active.length}</span></button>
      <div className="folder-label"><span>Folders</span><button type="button" aria-label="New folder" title="New folder" onClick={createFolder}><Plus size={16}/></button></div>
      {[...folders].sort((a,b)=>a.name.localeCompare(b.name)).map(folder=><div className="folder-row" key={folder.id}><button type="button" aria-pressed={selectedFolder===folder.id} data-drop-target={dropFolderId===folder.id || undefined} onClick={()=>setSelectedFolder(folder.id)} onDoubleClick={()=>renameFolder(folder)} onDragOver={event=>{if(draggingBoard.current){event.preventDefault();event.dataTransfer.dropEffect='move';setDropFolderId(folder.id)}}} onDragLeave={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node | null))setDropFolderId(current=>current===folder.id?null:current)}} onDrop={event=>{if(!draggingBoard.current)return;event.preventDefault();const board=active.find(item=>item.id===draggingBoard.current);if(board && board.folderId!==folder.id)onMove(board,folder.id);clearDrag()}}><Folder size={16}/> <span className="folder-name">{folder.name}</span> <span>{active.filter(board=>board.folderId===folder.id).length}</span></button><button className="folder-actions-trigger" type="button" aria-label={`Actions for ${folder.name}`} aria-expanded={folderMenu?.folder.id===folder.id} onMouseDown={event=>event.stopPropagation()} onClick={event=>{if(folderMenu?.folder.id===folder.id){setFolderMenu(null);return}const rect=event.currentTarget.getBoundingClientRect();setFolderMenu({folder,x:Math.max(8,Math.min(rect.right-150,window.innerWidth-158)),y:Math.min(rect.bottom+4,window.innerHeight-100)})}}><MoreHorizontal size={16}/></button></div>)}
    </nav>}<section className="folder-content" aria-label={selected?.name ?? 'Boards'}>
    <div className="section-heading"><div className="board-actions">
      <span>{view === 'boards' ? `${selection.length} ${selection.length === 1 ? 'board' : 'boards'}${guestUnsaved ? ' · Not saved' : ''}` : `${deleted.length} recently deleted · Removed after 30 days`}</span>
      {view === 'boards' && <div className="board-list-controls">
        <ExpandingSearch className="board-search" label="Search boards" placeholder="Search boards" items={active.map(board => ({ id: board.id, title: board.name, meta: `Edited ${formatDate(board.updatedAt)}` }))} onSelect={item => onOpen(item.id)} maxResults={active.length} emptyHint="Try a different board name."/>
        <button className="primary" type="button" onClick={() => onCreate(selected?.id)}><Plus size={17}/> New board</button>
        <button className="secondary board-open-file" type="button" aria-label="Open file" title="Open file" onClick={() => fileInput.current?.click()}><FolderOpen size={18}/></button>
      </div>}
    </div></div>
    {shown.length ? <div className="board-grid">{[...shown].sort((a, b) => (view === 'deleted' ? (b.deletedAt ?? 0) - (a.deletedAt ?? 0) : b.updatedAt - a.updatedAt)).map(board =>
      <article className="board-card" key={board.id} data-dragging={draggingBoardId===board.id || undefined}>
        {view === 'boards' ? <button className="board-open" type="button" draggable={!guestUnsaved} onDragStart={event=>{draggingBoard.current=board.id;setDraggingBoardId(board.id);event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',board.id)}} onDragEnd={clearDrag} onClick={() => onOpen(board.id)} aria-label={`Open ${board.name}`}><BoardThumbnail board={board} theme={theme}/><div className="card-title"><span className="board-card-name" title={board.name}>{board.name}</span>{board.folderId && folders.find(folder=>folder.id===board.folderId) && <span className="board-folder-name" title={folders.find(folder=>folder.id===board.folderId)?.name}>{folders.find(folder=>folder.id===board.folderId)?.name}</span>}</div><small>Edited {formatDate(board.updatedAt)}</small></button> : <><BoardThumbnail board={board} theme={theme}/><div className="card-title">{board.name}</div><small className="deleted-date">Deleted {formatDate(board.deletedAt!)} · {Math.max(1, Math.ceil((board.deletedAt! + TRASH_RETENTION_MS - Date.now()) / 86_400_000))} days left</small><div className="trash-card-actions"><button type="button" onClick={() => onRestore(board)}><RotateCcw size={15}/> Restore</button><button type="button" onClick={() => onDelete(board)}><Trash2 size={15}/> Delete permanently</button></div></>}
        {view === 'boards' && !guestUnsaved && <details className="board-move"><summary aria-label={`Move ${board.name} to a folder`} title="Move to folder">Move</summary><div className="board-move-menu"><strong>Folders</strong>{board.folderId && folderIds.has(board.folderId) && <button type="button" onClick={event=>{onMove(board,'');event.currentTarget.closest('details')?.removeAttribute('open')}}>Remove from folder</button>}{folders.map(folder=><button type="button" key={folder.id} disabled={board.folderId===folder.id} onClick={event=>{onMove(board,folder.id);event.currentTarget.closest('details')?.removeAttribute('open')}}>{folder.name}</button>)}{folders.length===0 && <span>Create a folder first</span>}</div></details>}
        {view === 'boards' && <button className="delete" type="button" aria-label={`Delete ${board.name}`} onClick={() => onDelete(board)}><Trash2 size={16}/></button>}
      </article>
    )}</div> : <div className="empty"><div className="empty-icon">{view === 'boards' ? <Boxes size={25}/> : <Trash2 size={23}/>}</div><h3>{view === 'boards' ? (active.length ? 'No boards here yet.' : 'Your first idea starts here.') : 'Nothing recently deleted.'}</h3><p>{view === 'boards' ? 'Create a board to map out an architecture, a system, or anything on your mind.' : 'Deleted boards stay here for 30 days before they are removed.'}</p>{view === 'boards' && <button className="secondary" type="button" onClick={() => onCreate(selected?.id)}><Plus size={16}/> Create a board</button>}</div>}
    </section></div>
    {folderMenu && <div ref={folderMenuRef} className="folder-actions-menu" role="group" aria-label="Folder actions" style={{left:folderMenu.x,top:folderMenu.y}}><button type="button" onClick={()=>{renameFolder(folderMenu.folder);setFolderMenu(null)}}>Rename</button><button type="button" className="folder-delete-action" onClick={()=>{setFolderToDelete(folderMenu.folder);setFolderMenu(null)}}>Delete</button></div>}
    <dialog ref={folderDialog} className="delete-dialog folder-dialog" aria-labelledby="folder-dialog-title" onClose={()=>setEditingFolder(null)} onClick={event=>{if(event.target===event.currentTarget)event.currentTarget.close()}}>
      <form onSubmit={event=>{event.preventDefault();saveFolder()}}>
        <h2 id="folder-dialog-title">{editingFolder?.name ? 'Rename folder' : 'New folder'}</h2>
        <label htmlFor="folder-name">Folder name</label><input id="folder-name" autoFocus maxLength={100} value={folderName} onChange={event=>setFolderName(event.target.value)} placeholder="Give your folder a name" required/>
        <div className="delete-dialog-actions"><button type="button" className="delete-dialog-cancel" onClick={()=>folderDialog.current?.close()}>Cancel</button><button type="submit" className="folder-save" disabled={!folderName.trim()}>{editingFolder?.name ? 'Save' : 'Create folder'}</button></div>
      </form>
    </dialog>
    <dialog ref={deleteFolderDialog} className="delete-dialog folder-delete-dialog" aria-labelledby="delete-folder-title" onClose={()=>setFolderToDelete(null)} onClick={event=>{if(event.target===event.currentTarget)event.currentTarget.close()}}>
      <h2 id="delete-folder-title">Delete folder?</h2><p>“{folderToDelete?.name}” will be deleted. {folderToDelete && active.filter(board=>board.folderId===folderToDelete.id).length > 0 ? <>{active.filter(board=>board.folderId===folderToDelete.id).length} {active.filter(board=>board.folderId===folderToDelete.id).length === 1 ? 'board will' : 'boards will'} move to Recently deleted. You can restore them within 30 days.</> : 'This folder has no active boards.'}</p>
      <div className="delete-dialog-actions"><button type="button" className="delete-dialog-cancel" autoFocus onClick={()=>deleteFolderDialog.current?.close()}>Cancel</button><button type="button" className="delete-dialog-confirm" onClick={deleteFolder}>Delete folder</button></div>
    </dialog>
  </main>;
}
