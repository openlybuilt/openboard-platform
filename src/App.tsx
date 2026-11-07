import { useCallback, useEffect, useRef, useState } from 'react';
import { Boxes, Plus, Trash2, Moon, Sun } from 'lucide-react';
import { loadBoards, newBoard, reconcileLocalBoards, type Board } from './storage';
import { CanvasEditor } from './CanvasEditor';
import { BoardThumbnail } from './BoardThumbnail';
import { AuthControls } from './AuthControls';
import type { CloudBoards } from './cloud-boards';
import openlyLight from './assets/openly-light.svg';
import openlyDark from './assets/openly-dark.svg';

function routeId() { return new URLSearchParams(location.hash.split('?')[1] || '').get('board'); }
function navigate(id?: string) { location.hash = id ? `editor?board=${encodeURIComponent(id)}` : ''; }
function formatDate(value:number) { return new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',year:'numeric'}).format(value); }
export function App({authConfigured=false,cloud,syncUnavailable=false}:{authConfigured?:boolean;cloud?:CloudBoards;syncUnavailable?:boolean}) {
  const [boards,setBoards] = useState<Board[]>(() => { if(cloud)return []; try { return loadBoards(); } catch { return []; } });
  const [error,setError] = useState(() => { if(cloud)return ''; try { loadBoards(); return ''; } catch { return 'Could not read your saved boards. Check browser storage before creating a new board.'; } });
  const [conflictNotice,setConflictNotice] = useState('');
  const [readFailed,setReadFailed] = useState(() => { if(cloud)return false; try { loadBoards(); return false; } catch { return true; } });
  const [loading,setLoading]=useState(Boolean(cloud));
  const boardsRef=useRef(boards); boardsRef.current=boards;
  const redirectedBoards=useRef(new Map<string,string>());
  const [id,setId] = useState(routeId);
  const [boardToDelete,setBoardToDelete] = useState<Board|null>(null);
  const deleteDialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{if(boardToDelete&&!deleteDialog.current?.open)deleteDialog.current?.showModal()},[boardToDelete]);
  const [saveStatus,setSaveStatus] = useState<'saving'|'saved'|null>('saved');
  const [theme,setTheme] = useState<'light'|'dark'>(()=>{try{return localStorage.getItem('whiteboard.theme')==='dark'?'dark':'light'}catch{return 'light'}});
  useEffect(()=>{try{localStorage.setItem('whiteboard.theme',theme)}catch{/* The app still works if storage is unavailable. */}},[theme]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(()=>()=>{if(saveTimer.current) clearTimeout(saveTimer.current)},[]);
  useEffect(()=>{
   if(!cloud)return;
   let active=true;
   cloud.load().then(next=>{if(!active)return;boardsRef.current=next;setBoards(next);setLoading(false);setSaveStatus('saving');return cloud.flush().then(()=>{if(active)setSaveStatus('saved')})}).catch(()=>{if(active){setLoading(false);setReadFailed(true);setSaveStatus(null);setError('Could not load or sync your account boards. Reload to try again.')}});
   return ()=>{active=false};
  },[cloud]);
  useEffect(()=>{ const change=()=>setId(routeId()); window.addEventListener('hashchange',change); return ()=>window.removeEventListener('hashchange',change); },[]);
  const commit=useCallback((next:Board[])=>{if(readFailed||loading)return false;if(saveTimer.current)clearTimeout(saveTimer.current);setSaveStatus('saving');try{let saved=next;let conflictId:string|undefined;if(cloud)cloud.enqueue(boardsRef.current,next);else{const result=reconcileLocalBoards(boardsRef.current,next);saved=result.boards;conflictId=id?result.conflicts.get(id):undefined}boardsRef.current=saved;setBoards(saved);setError('');if(conflictId){redirectedBoards.current.set(id!,conflictId);setConflictNotice('This board changed in another tab. Your changes were saved as a separate conflict copy.');navigate(conflictId)}if(cloud)saveTimer.current=setTimeout(()=>{void cloud.flush().then(()=>setSaveStatus('saved')).catch(()=>{setSaveStatus(null);setError('Could not sync. Your changes are saved in this browser and will retry on your next edit or reload.')})},700);else saveTimer.current=setTimeout(()=>setSaveStatus('saved'),400);return true}catch(error){setSaveStatus(null);setError(error instanceof Error&&error.message.includes('another tab')?error.message:'Could not save your changes. Check that browser storage is available.');return false}},[readFailed,loading,cloud,id]);
  const board=boards.find(b=>b.id===id);
  const update=useCallback((next:Board)=>{const target=redirectedBoards.current.get(next.id)??next.id;commit(boardsRef.current.map(b=>b.id===target?{...next,id:target,updatedAt:Date.now()}:b));},[commit]);
  const create=()=>{const next=newBoard();if(commit([next,...boardsRef.current]))navigate(next.id)};
  const remove=()=>{if(!boardToDelete)return;if(commit(boardsRef.current.filter(board=>board.id!==boardToDelete.id)))deleteDialog.current?.close()};
  if(loading)return <main className="missing">Loading boards…</main>;
  return <div className="app" data-theme={theme}>{syncUnavailable&&<div className="notice">Account syncing is not configured. Your boards are stored in this browser.</div>}{error&&<div className="notice" role="alert">{error}</div>}{conflictNotice&&<div className="notice" role="status">{conflictNotice}</div>}{id ? board ? <CanvasEditor key={board.id} board={board} update={update} saveStatus={saveStatus} theme={theme} onThemeChange={setTheme} onBack={()=>navigate()}/> : <main className="missing"><h1>Board not found</h1><button className="primary" onClick={()=>navigate()}>Back to boards</button></main> : <main className="home">{authConfigured&&<AuthControls/>}<div className="home-brand" aria-label="Openly"><img className="home-logo light-logo" src={openlyLight} alt=""/><img className="home-logo dark-logo" src={openlyDark} alt=""/></div><button className="home-theme-toggle" type="button" aria-label={theme==='light'?'Switch to dark mode':'Switch to light mode'} title={theme==='light'?'Switch to dark mode':'Switch to light mode'} onClick={()=>setTheme(value=>value==='light'?'dark':'light')}>{theme==='light'?<Moon size={18}/>:<Sun size={18}/>}</button><div className="home-heading"><h1 className="home-title">OpenBoard</h1><p className="home-byline">by Openly</p></div><div className="section-heading"><div className="board-actions"><span>{boards.length} {boards.length===1?'board':'boards'} · {cloud?'Account':'Local'}</span>{boards.length > 0 && <button className="primary" onClick={create}><Plus size={17}/> New whiteboard</button>}</div></div>{boards.length ? <div className="board-grid">{[...boards].sort((a,b)=>b.updatedAt-a.updatedAt).map(b=><article className="board-card" key={b.id}><button className="board-open" onClick={()=>navigate(b.id)} aria-label={`Open ${b.name}`}><BoardThumbnail board={b} theme={theme}/><div className="card-title">{b.name}</div><small>Edited {formatDate(b.updatedAt)}</small></button><button className="delete" aria-label={`Delete ${b.name}`} onClick={()=>setBoardToDelete(b)}><Trash2 size={16}/></button></article>)}</div> : <div className="empty"><div className="empty-icon"><Boxes size={25}/></div><h3>Your first idea starts here.</h3><p>Create a whiteboard to map out an architecture, a system, or anything on your mind.</p><button className="secondary" onClick={create}><Plus size={16}/> Create a whiteboard</button></div>}</main>}<dialog ref={deleteDialog} className="delete-dialog" aria-labelledby="delete-dialog-title" aria-describedby="delete-dialog-description" onClose={()=>setBoardToDelete(null)} onClick={e=>{if(e.target===e.currentTarget)e.currentTarget.close()}}><div className="delete-dialog-icon"><Trash2 size={20}/></div><h2 id="delete-dialog-title">Delete whiteboard?</h2><p id="delete-dialog-description">“{boardToDelete?.name}” will be permanently deleted. This cannot be undone.</p><div className="delete-dialog-actions"><button type="button" className="delete-dialog-cancel" autoFocus onClick={()=>deleteDialog.current?.close()}>Cancel</button><button type="button" className="delete-dialog-confirm" onClick={remove}>Delete</button></div></dialog></div>;
}

