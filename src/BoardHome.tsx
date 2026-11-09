import { useRef, useState } from 'react';
import { Boxes, FolderOpen, Moon, Plus, RotateCcw, Sun, Trash2 } from 'lucide-react';
import { AuthControls } from './AuthControls';
import { BoardThumbnail } from './BoardThumbnail';
import { ExpandingSearch } from './vendor/arc/expanding-search/expanding-search';
import { isExpiredDeleted, TRASH_RETENTION_MS, type Board } from './storage';
import openlyLight from './assets/openly-light.svg';
import openlyDark from './assets/openly-dark.svg';

function formatDate(value: number) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(value);
}

type Props = {
  boards: Board[];
  authConfigured: boolean;
  guestUnsaved: boolean;
  theme: 'light' | 'dark';
  onThemeChange: (theme: 'light' | 'dark') => void;
  onCreate: () => void;
  onOpen: (id: string) => void;
  onImport: (file: File) => void;
  onDelete: (board: Board) => void;
  onRestore: (board: Board) => void;
};

export function BoardHome({ boards, authConfigured, guestUnsaved, theme, onThemeChange, onCreate, onOpen, onImport, onDelete, onRestore }: Props) {
  const [view, setView] = useState<'boards' | 'deleted'>('boards');
  const fileInput = useRef<HTMLInputElement>(null);
  const active = boards.filter(board => !board.deletedAt);
  const deleted = boards.filter(board => board.deletedAt && !isExpiredDeleted(board));
  const shown = view === 'boards' ? active : deleted;

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
    <div className="section-heading"><div className="board-actions">
      <span>{view === 'boards' ? `${active.length} ${active.length === 1 ? 'board' : 'boards'}${guestUnsaved ? ' · Not saved' : ''}` : `${deleted.length} recently deleted · Removed after 30 days`}</span>
      {view === 'boards' && <div className="board-list-controls">
        <ExpandingSearch className="board-search" label="Search boards" placeholder="Search boards" items={active.map(board => ({ id: board.id, title: board.name, meta: `Edited ${formatDate(board.updatedAt)}` }))} onSelect={item => onOpen(item.id)} maxResults={active.length} emptyHint="Try a different board name."/>
        <button className="primary" type="button" onClick={onCreate}><Plus size={17}/> New board</button>
        <button className="secondary board-open-file" type="button" aria-label="Open file" title="Open file" onClick={() => fileInput.current?.click()}><FolderOpen size={18}/></button>
      </div>}
    </div></div>
    {shown.length ? <div className="board-grid">{[...shown].sort((a, b) => (view === 'deleted' ? (b.deletedAt ?? 0) - (a.deletedAt ?? 0) : b.updatedAt - a.updatedAt)).map(board =>
      <article className="board-card" key={board.id}>
        {view === 'boards' ? <button className="board-open" type="button" onClick={() => onOpen(board.id)} aria-label={`Open ${board.name}`}><BoardThumbnail board={board} theme={theme}/><div className="card-title">{board.name}</div><small>Edited {formatDate(board.updatedAt)}</small></button> : <><BoardThumbnail board={board} theme={theme}/><div className="card-title">{board.name}</div><small className="deleted-date">Deleted {formatDate(board.deletedAt!)} · {Math.max(1, Math.ceil((board.deletedAt! + TRASH_RETENTION_MS - Date.now()) / 86_400_000))} days left</small><div className="trash-card-actions"><button type="button" onClick={() => onRestore(board)}><RotateCcw size={15}/> Restore</button><button type="button" onClick={() => onDelete(board)}><Trash2 size={15}/> Delete permanently</button></div></>}
        {view === 'boards' && <button className="delete" type="button" aria-label={`Delete ${board.name}`} onClick={() => onDelete(board)}><Trash2 size={16}/></button>}
      </article>
    )}</div> : <div className="empty"><div className="empty-icon">{view === 'boards' ? <Boxes size={25}/> : <Trash2 size={23}/>}</div><h3>{view === 'boards' ? 'Your first idea starts here.' : 'Nothing recently deleted.'}</h3><p>{view === 'boards' ? 'Create a board to map out an architecture, a system, or anything on your mind.' : 'Deleted boards stay here for 30 days before they are removed.'}</p>{view === 'boards' && <button className="secondary" type="button" onClick={onCreate}><Plus size={16}/> Create a board</button>}</div>}
  </main>;
}
