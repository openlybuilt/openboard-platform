import { useRef, useState } from 'react';
import { Boxes, Folder, FolderOpen, Moon, Plus, RotateCcw, Sun, Trash2 } from 'lucide-react';
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

export function BoardHome({ boards, folders, onFolderChange, onMove, authConfigured, guestUnsaved, theme, onThemeChange, onCreate, onOpen, onImport, onDelete, onRestore }: Props) {
  const [view, setView] = useState<'boards' | 'deleted'>('boards');
  const fileInput = useRef<HTMLInputElement>(null);
  const [selectedFolder, setSelectedFolder] = useState('all');
  const active = boards.filter(board => !board.deletedAt);
  const deleted = boards.filter(board => board.deletedAt && !isExpiredDeleted(board));
  const folderIds = new Set(folders.map(folder => folder.id));
  const selected = folders.find(folder => folder.id === selectedFolder);
  const selection = selectedFolder === 'all' ? active : selectedFolder === 'unfiled' || !selected ? active.filter(board => !board.folderId || !folderIds.has(board.folderId)) : active.filter(board => board.folderId === selectedFolder);
  const shown = view === 'boards' ? selection : deleted;
  const createFolder = () => { const name=window.prompt('Folder name')?.trim(); if(name)onFolderChange({type:'put',folder:{id:crypto.randomUUID(),name:name.slice(0,100)}}); };
  const renameFolder = (folder:BoardFolder) => { const name=window.prompt('Rename folder',folder.name)?.trim(); if(name)onFolderChange({type:'put',folder:{...folder,name:name.slice(0,100)}}); };
  const deleteFolder = (folder:BoardFolder) => { if(window.confirm(`Delete “${folder.name}”? Its boards will move to Unfiled.`) && onFolderChange({type:'delete',id:folder.id}))setSelectedFolder('all'); };

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
      <button type="button" aria-pressed={selectedFolder === 'unfiled'} onClick={() => setSelectedFolder('unfiled')}>Unfiled <span>{active.filter(board=>!board.folderId||!folderIds.has(board.folderId)).length}</span></button>
      <div className="folder-label">Folders</div>
      {[...folders].sort((a,b)=>a.name.localeCompare(b.name)).map(folder=><div className="folder-row" key={folder.id}><button type="button" aria-pressed={selectedFolder===folder.id} onClick={()=>setSelectedFolder(folder.id)}><Folder size={16}/> <span className="folder-name">{folder.name}</span> <span>{active.filter(board=>board.folderId===folder.id).length}</span></button>{selectedFolder===folder.id&&<div className="folder-manage"><button type="button" onClick={()=>renameFolder(folder)}>Rename</button><button type="button" onClick={()=>deleteFolder(folder)}>Delete</button></div>}</div>)}
      <button type="button" onClick={createFolder}><Plus size={16}/> New folder</button>
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
      <article className="board-card" key={board.id}>
        {view === 'boards' ? <button className="board-open" type="button" onClick={() => onOpen(board.id)} aria-label={`Open ${board.name}`}><BoardThumbnail board={board} theme={theme}/><div className="card-title">{board.name}</div><small>Edited {formatDate(board.updatedAt)}</small></button> : <><BoardThumbnail board={board} theme={theme}/><div className="card-title">{board.name}</div><small className="deleted-date">Deleted {formatDate(board.deletedAt!)} · {Math.max(1, Math.ceil((board.deletedAt! + TRASH_RETENTION_MS - Date.now()) / 86_400_000))} days left</small><div className="trash-card-actions"><button type="button" onClick={() => onRestore(board)}><RotateCcw size={15}/> Restore</button><button type="button" onClick={() => onDelete(board)}><Trash2 size={15}/> Delete permanently</button></div></>}
        {view === 'boards' && !guestUnsaved && <label className="board-folder-select"><span className="sr-only">Folder for {board.name}</span><select aria-label={`Folder for ${board.name}`} value={board.folderId && folderIds.has(board.folderId)?board.folderId:''} onChange={event=>onMove(board,event.target.value)}><option value="">Unfiled</option>{folders.map(folder=><option value={folder.id} key={folder.id}>{folder.name}</option>)}</select></label>}
        {view === 'boards' && <button className="delete" type="button" aria-label={`Delete ${board.name}`} onClick={() => onDelete(board)}><Trash2 size={16}/></button>}
      </article>
    )}</div> : <div className="empty"><div className="empty-icon">{view === 'boards' ? <Boxes size={25}/> : <Trash2 size={23}/>}</div><h3>{view === 'boards' ? (active.length ? 'No boards here yet.' : 'Your first idea starts here.') : 'Nothing recently deleted.'}</h3><p>{view === 'boards' ? 'Create a board to map out an architecture, a system, or anything on your mind.' : 'Deleted boards stay here for 30 days before they are removed.'}</p>{view === 'boards' && <button className="secondary" type="button" onClick={() => onCreate(selected?.id)}><Plus size={16}/> Create a board</button>}</div>}
    </section></div>
  </main>;
}
