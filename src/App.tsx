import { useCallback, useEffect, useRef, useState } from 'react';
import { Boxes, Plus, Trash2, Moon, Sun } from 'lucide-react';
import { boardSnapshots, loadBoards, newBoard, reconcileLocalBoards, type Board } from './storage';
import { CanvasEditor } from './CanvasEditor';
import { BoardThumbnail } from './BoardThumbnail';
import { AuthControls } from './AuthControls';
import { ExpandingSearch } from './vendor/arc/expanding-search/expanding-search';
import type { CloudBoards } from './cloud-boards';
import openlyLight from './assets/openly-light.svg';
import openlyDark from './assets/openly-dark.svg';

const HANDOFF_KEY='whiteboard.sign-in-handoff';
function readHandoff():Board|undefined { try { const raw=sessionStorage.getItem(HANDOFF_KEY); if(!raw)return; const board=JSON.parse(raw) as Board; return board && typeof board.id==='string' && Array.isArray(board.nodes) && Array.isArray(board.edges)?board:undefined; } catch { return; } }
function clearHandoff(id:string) { try { if(readHandoff()?.id===id)sessionStorage.removeItem(HANDOFF_KEY); } catch { /* Keep the saved board even if storage is unavailable. */ } }
function routeId() { return new URLSearchParams(location.hash.split('?')[1] || '').get('board'); }
function navigate(id?: string) { location.hash = id ? `editor?board=${encodeURIComponent(id)}` : ''; }
function formatDate(value:number) { return new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',year:'numeric'}).format(value); }
export function App({authConfigured=false,guestUnsaved=false,cloud,syncUnavailable=false,onGuestSignIn}:{authConfigured?:boolean;guestUnsaved?:boolean;cloud?:CloudBoards;syncUnavailable?:boolean;onGuestSignIn?:()=>void}) {
  const offlineHandoff=useRef(Boolean(syncUnavailable&&readHandoff()?.id===routeId())).current;
  const transient=guestUnsaved||offlineHandoff;
  const [boards,setBoards] = useState<Board[]>(() => { if(cloud)return []; if(guestUnsaved){const draft=readHandoff();return draft&&draft.id===routeId()?[draft]:[];} if(syncUnavailable){const draft=readHandoff();if(draft&&draft.id===routeId())return [draft];} try { return loadBoards(); } catch { return []; } });
  const [error,setError] = useState(() => { if(cloud||guestUnsaved)return ''; try { loadBoards(); return ''; } catch { return 'Could not read your saved boards. Check browser storage before creating a new board.'; } });
  const [conflictNotice,setConflictNotice] = useState('');
  const [readFailed,setReadFailed] = useState(() => { if(cloud||guestUnsaved)return false; try { loadBoards(); return false; } catch { return true; } });
  const [loading,setLoading]=useState(Boolean(cloud));
  const boardsRef=useRef(boards); boardsRef.current=boards;
  const snapshotsRef=useRef(boardSnapshots(boards));
  const redirectedBoards=useRef(new Map<string,string>());
  const [id,setId] = useState(routeId);
  const [boardToDelete,setBoardToDelete] = useState<Board|null>(null);
  const deleteDialog=useRef<HTMLDialogElement>(null);
  const leaveDialog=useRef<HTMLDialogElement>(null);
  const allowGuestExit=useRef(false);
  useEffect(()=>{if(boardToDelete&&!deleteDialog.current?.open)deleteDialog.current?.showModal()},[boardToDelete]);
  const [saveStatus,setSaveStatus] = useState<'saving'|'saved'|'not-saved'|'sync-unavailable'|null>(offlineHandoff?'sync-unavailable':guestUnsaved?'not-saved':'saved');
  const [theme,setTheme] = useState<'light'|'dark'>(()=>{try{return localStorage.getItem('whiteboard.theme')==='dark'?'dark':'light'}catch{return 'light'}});
  useEffect(()=>{try{localStorage.setItem('whiteboard.theme',theme)}catch{/* The app still works if storage is unavailable. */}},[theme]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(()=>()=>{if(saveTimer.current) clearTimeout(saveTimer.current)},[]);
  useEffect(()=>{
   if(!cloud)return;
   let active=true;
   cloud.load().then(async next=>{if(!active)return;
    let draft=readHandoff();
    if(draft&&draft.id===routeId()){
      const existing=next.find(board=>board.id===draft!.id);
      if(existing&&JSON.stringify(existing)!==JSON.stringify(draft)){
        draft={...draft,id:crypto.randomUUID()};
        sessionStorage.setItem(HANDOFF_KEY,JSON.stringify(draft));
        navigate(draft.id);setId(draft.id);
      }
      if(!next.some(board=>board.id===draft!.id)){const withDraft=[draft,...next];cloud.enqueue(next,withDraft);next=withDraft;}
    } else draft=undefined;
    boardsRef.current=next;setBoards(next);setSaveStatus('saving');
    await cloud.flush();
    if(active){if(draft)clearHandoff(draft.id);setLoading(false);setSaveStatus('saved');}
   }).catch(()=>{if(active){const draft=readHandoff();if(draft&&draft.id===routeId()){boardsRef.current=[draft];setBoards([draft])}setLoading(false);setReadFailed(true);setSaveStatus(null);setError(draft?'Could not load or sync your account boards. Your sign-in draft is kept in this tab; reload to try again.':'Could not load or sync your account boards. Reload to try again.')}});
   return ()=>{active=false};
  },[cloud]);
  useEffect(()=>{ const change=()=>{const next=routeId();if(transient&&id&&boardsRef.current.some(board=>board.id===id)&&next!==id&&!allowGuestExit.current){history.replaceState(null,'',`#editor?board=${encodeURIComponent(id)}`);if(!leaveDialog.current?.open)leaveDialog.current?.showModal();return}allowGuestExit.current=false;redirectedBoards.current.clear();setId(next)}; window.addEventListener('hashchange',change); return ()=>window.removeEventListener('hashchange',change); },[transient,id]);
  useEffect(()=>{if(!transient||!id||!boardsRef.current.some(board=>board.id===id))return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue=''};window.addEventListener('beforeunload',warn);return ()=>window.removeEventListener('beforeunload',warn)},[transient,id]);
  const commit=useCallback((next:Board[])=>{if(readFailed||loading)return false;if(saveTimer.current)clearTimeout(saveTimer.current);if(transient){if(offlineHandoff||readHandoff()?.id===id){try{const draft=next.find(board=>board.id===id);if(draft)sessionStorage.setItem(HANDOFF_KEY,JSON.stringify(draft));}catch{setError('Could not preserve the board in this tab. Keep this page open and try signing in again.')}}boardsRef.current=next;setBoards(next);setSaveStatus(offlineHandoff?'sync-unavailable':'not-saved');return true}setSaveStatus('saving');try{let saved=next;let conflictId:string|undefined;if(cloud)cloud.enqueue(boardsRef.current,next);else{const result=reconcileLocalBoards(boardsRef.current,next,snapshotsRef.current);saved=result.boards;conflictId=id?result.conflicts.get(id):undefined;snapshotsRef.current=boardSnapshots(saved)}boardsRef.current=saved;setBoards(saved);setError('');if(conflictId){redirectedBoards.current.set(id!,conflictId);setConflictNotice('This board changed in another tab. Your changes were saved as a separate conflict copy.');navigate(conflictId)}if(cloud)saveTimer.current=setTimeout(()=>{void cloud.flush().then(()=>setSaveStatus('saved')).catch(()=>{setSaveStatus(null);setError('Could not sync. Your changes are saved in this browser and will retry on your next edit or reload.')})},700);else saveTimer.current=setTimeout(()=>setSaveStatus('saved'),400);return true}catch(error){setSaveStatus(null);setError(error instanceof Error&&error.message.includes('another tab')?error.message:'Could not save your changes. Check that browser storage is available.');return false}},[readFailed,loading,cloud,id,transient,offlineHandoff]);
  const board=boards.find(b=>b.id===id);
  const update=useCallback((next:Board)=>{const target=redirectedBoards.current.get(next.id)??next.id;commit(boardsRef.current.map(b=>b.id===target?{...next,id:target,updatedAt:Date.now()}:b));},[commit]);
  const create=()=>{const next=newBoard();if(commit([next,...boardsRef.current]))navigate(next.id)};
  const remove=()=>{if(!boardToDelete)return;if(commit(boardsRef.current.filter(board=>board.id!==boardToDelete.id)))deleteDialog.current?.close()};
  const back=()=>{if(transient)leaveDialog.current?.showModal();else navigate()};
  const discardAndLeave=()=>{if(id)clearHandoff(id);leaveDialog.current?.close();allowGuestExit.current=true;boardsRef.current=[];setBoards([]);navigate()};
  const signInToSave=onGuestSignIn&&guestUnsaved&&board?()=>{try{sessionStorage.setItem(HANDOFF_KEY,JSON.stringify(board));onGuestSignIn()}catch{setError('Could not prepare this board for sign-in. Keep this tab open and try again.')}}:undefined;
  if(loading)return <main className="missing">Loading boards…</main>;
  return <div className="app" data-theme={theme}>{syncUnavailable&&<div className="notice">{offlineHandoff?'Account syncing is not configured. This board is not saved to your account.':'Account syncing is not configured. Your boards are stored in this browser.'}</div>}{error&&<div className="notice" role="alert">{error}</div>}{conflictNotice&&<div className="notice" role="status">{conflictNotice}</div>}{id ? board ? <CanvasEditor key={board.id} board={board} update={update} saveStatus={saveStatus} theme={theme} onThemeChange={setTheme} onBack={back} onGuestSignIn={signInToSave}/> : <main className="missing"><h1>Board not found</h1><button className="primary" onClick={()=>navigate()}>Back to boards</button></main> : <main className="home">{authConfigured&&<AuthControls/>}<div className="home-brand" aria-label="Openly"><img className="home-logo light-logo" src={openlyLight} alt=""/><img className="home-logo dark-logo" src={openlyDark} alt=""/></div><button className="home-theme-toggle" type="button" aria-label={theme==='light'?'Switch to dark mode':'Switch to light mode'} title={theme==='light'?'Switch to dark mode':'Switch to light mode'} onClick={()=>setTheme(value=>value==='light'?'dark':'light')}>{theme==='light'?<Moon size={18}/>:<Sun size={18}/>}</button><div className="home-heading"><h1 className="home-title">OpenBoard</h1><p className="home-byline">by Openly</p></div><div className="section-heading"><div className="board-actions"><span>{boards.length} {boards.length===1?'board':'boards'}{guestUnsaved?' · Not saved':''}</span><div className="board-list-controls"><ExpandingSearch className="board-search" label="Search boards" placeholder="Search boards" items={boards.map(board=>({id:board.id,title:board.name,meta:`Edited ${formatDate(board.updatedAt)}`}))} onSelect={item=>navigate(item.id)} maxResults={boards.length} emptyHint="Try a different board name."/>{boards.length > 0 && <button className="primary" onClick={create}><Plus size={17}/> New whiteboard</button>}</div></div></div>{boards.length ? <div className="board-grid">{[...boards].sort((a,b)=>b.updatedAt-a.updatedAt).map(b=><article className="board-card" key={b.id}><button className="board-open" onClick={()=>navigate(b.id)} aria-label={`Open ${b.name}`}><BoardThumbnail board={b} theme={theme}/><div className="card-title">{b.name}</div><small>Edited {formatDate(b.updatedAt)}</small></button><button className="delete" aria-label={`Delete ${b.name}`} onClick={()=>setBoardToDelete(b)}><Trash2 size={16}/></button></article>)}</div> : <div className="empty"><div className="empty-icon"><Boxes size={25}/></div><h3>Your first idea starts here.</h3><p>Create a whiteboard to map out an architecture, a system, or anything on your mind.</p><button className="secondary" onClick={create}><Plus size={16}/> Create a whiteboard</button></div>}</main>}<dialog ref={deleteDialog} className="delete-dialog" aria-labelledby="delete-dialog-title" aria-describedby="delete-dialog-description" onClose={()=>setBoardToDelete(null)} onClick={e=>{if(e.target===e.currentTarget)e.currentTarget.close()}}><div className="delete-dialog-icon"><Trash2 size={20}/></div><h2 id="delete-dialog-title">Delete whiteboard?</h2><p id="delete-dialog-description">“{boardToDelete?.name}” will be permanently deleted. This cannot be undone.</p><div className="delete-dialog-actions"><button type="button" className="delete-dialog-cancel" autoFocus onClick={()=>deleteDialog.current?.close()}>Cancel</button><button type="button" className="delete-dialog-confirm" onClick={remove}>Delete</button></div></dialog><dialog ref={leaveDialog} className="delete-dialog" aria-labelledby="leave-dialog-title" aria-describedby="leave-dialog-description" onClick={e=>{if(e.target===e.currentTarget)e.currentTarget.close()}}><h2 id="leave-dialog-title">Leave this whiteboard?</h2><p id="leave-dialog-description">Your progress will not be saved. Sign in to save your work to your account.</p><div className="delete-dialog-actions"><button type="button" className="delete-dialog-cancel" autoFocus onClick={()=>leaveDialog.current?.close()}>Keep editing</button><button type="button" className="delete-dialog-confirm" onClick={discardAndLeave}>Leave</button></div></dialog></div>;
}

