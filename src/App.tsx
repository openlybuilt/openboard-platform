import { useCallback, useEffect, useRef, useState } from 'react';
import { Boxes, Plus, Trash2, Moon, Sun } from 'lucide-react';
import { loadBoards, newBoard, saveBoards, type Board } from './storage';
import { CanvasEditor } from './CanvasEditor';
import { BoardThumbnail } from './BoardThumbnail';
import { AuthControls } from './AuthControls';
import openlyLight from './assets/openly-light.svg';
import openlyDark from './assets/openly-dark.svg';

function routeId() { return new URLSearchParams(location.hash.split('?')[1] || '').get('board'); }
function navigate(id?: string) { location.hash = id ? `editor?board=${encodeURIComponent(id)}` : ''; }
function formatDate(value:number) { return new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',year:'numeric'}).format(value); }
export function App({authConfigured=false}:{authConfigured?:boolean}) {
  const [boards,setBoards] = useState<Board[]>(() => { try { return loadBoards(); } catch { return []; } });
  const [error,setError] = useState(() => { try { loadBoards(); return ''; } catch { return 'Could not read your saved boards. Check browser storage before creating a new board.'; } });
  const [readFailed] = useState(() => { try { loadBoards(); return false; } catch { return true; } });
  const [id,setId] = useState(routeId);
  const [boardToDelete,setBoardToDelete] = useState<Board|null>(null);
  const deleteDialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{if(boardToDelete&&!deleteDialog.current?.open)deleteDialog.current?.showModal()},[boardToDelete]);
  const [saveStatus,setSaveStatus] = useState<'saving'|'saved'|null>('saved');
  const [theme,setTheme] = useState<'light'|'dark'>(()=>{try{return localStorage.getItem('whiteboard.theme')==='dark'?'dark':'light'}catch{return 'light'}});
  useEffect(()=>{try{localStorage.setItem('whiteboard.theme',theme)}catch{/* The app still works if storage is unavailable. */}},[theme]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(()=>()=>{if(saveTimer.current) clearTimeout(saveTimer.current)},[]);
  useEffect(()=>{ const change=()=>setId(routeId()); window.addEventListener('hashchange',change); return ()=>window.removeEventListener('hashchange',change); },[]);
  const commit=useCallback((next:Board[])=>{if(readFailed)return false;if(saveTimer.current)clearTimeout(saveTimer.current);setSaveStatus('saving');try{saveBoards(next);setBoards(next);setError('');saveTimer.current=setTimeout(()=>setSaveStatus('saved'),400);return true}catch{setSaveStatus(null);setError('Could not save your changes. Check that browser storage is available.');return false}},[readFailed]);
  const board=boards.find(b=>b.id===id);
  const update=useCallback((next:Board)=>{commit(boards.map(b=>b.id===next.id?{...next,updatedAt:Date.now()}:b));},[boards,commit]);
  const create=()=>{const next=newBoard();if(commit([next,...boards]))navigate(next.id)};
  const remove=()=>{if(!boardToDelete)return;commit(boards.filter(board=>board.id!==boardToDelete.id));deleteDialog.current?.close()};
  return <div className="app" data-theme={theme}>{error&&<div className="notice" role="alert">{error}</div>}{id ? board ? <CanvasEditor key={board.id} board={board} update={update} saveStatus={saveStatus} theme={theme} onThemeChange={setTheme} onBack={()=>navigate()}/> : <main className="missing"><h1>Board not found</h1><button className="primary" onClick={()=>navigate()}>Back to boards</button></main> : <main className="home">{authConfigured&&<AuthControls/>}<div className="home-brand" aria-label="Openly"><img className="home-logo light-logo" src={openlyLight} alt=""/><img className="home-logo dark-logo" src={openlyDark} alt=""/></div><button className="home-theme-toggle" type="button" aria-label={theme==='light'?'Switch to dark mode':'Switch to light mode'} title={theme==='light'?'Switch to dark mode':'Switch to light mode'} onClick={()=>setTheme(value=>value==='light'?'dark':'light')}>{theme==='light'?<Moon size={18}/>:<Sun size={18}/>}</button><div className="home-heading"><h1 className="home-title">OpenBoard</h1><p className="home-byline">by Openly</p></div><div className="section-heading"><div className="board-actions"><span>{boards.length} {boards.length===1?'board':'boards'}</span>{boards.length > 0 && <button className="primary" onClick={create}><Plus size={17}/> New whiteboard</button>}</div></div>{boards.length ? <div className="board-grid">{[...boards].sort((a,b)=>b.updatedAt-a.updatedAt).map(b=><article className="board-card" key={b.id}><button className="board-open" onClick={()=>navigate(b.id)} aria-label={`Open ${b.name}`}><BoardThumbnail board={b} theme={theme}/><div className="card-title">{b.name}</div><small>Edited {formatDate(b.updatedAt)}</small></button><button className="delete" aria-label={`Delete ${b.name}`} onClick={()=>setBoardToDelete(b)}><Trash2 size={16}/></button></article>)}</div> : <div className="empty"><div className="empty-icon"><Boxes size={25}/></div><h3>Your first idea starts here.</h3><p>Create a whiteboard to map out an architecture, a system, or anything on your mind.</p><button className="secondary" onClick={create}><Plus size={16}/> Create a whiteboard</button></div>}</main>}<dialog ref={deleteDialog} className="delete-dialog" aria-labelledby="delete-dialog-title" aria-describedby="delete-dialog-description" onClose={()=>setBoardToDelete(null)} onClick={e=>{if(e.target===e.currentTarget)e.currentTarget.close()}}><div className="delete-dialog-icon"><Trash2 size={20}/></div><h2 id="delete-dialog-title">Delete whiteboard?</h2><p id="delete-dialog-description">“{boardToDelete?.name}” will be permanently deleted. This cannot be undone.</p><div className="delete-dialog-actions"><button type="button" className="delete-dialog-cancel" autoFocus onClick={()=>deleteDialog.current?.close()}>Cancel</button><button type="button" className="delete-dialog-confirm" onClick={remove}>Delete</button></div></dialog></div>;
}

