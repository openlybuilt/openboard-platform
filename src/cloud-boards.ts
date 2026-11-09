import { isExpiredDeleted, type Board } from './storage';

type Change = {type:'put';board:Board}|{type:'delete';id:string};
export type CloudConfig = { userId:string; getToken:()=>Promise<string|null>; apiUrl:string };

export class CloudBoards {
 private readonly key:string;
 private flushing:Promise<void>|null=null;
 constructor(private readonly config:CloudConfig){this.key=`whiteboard.pending.${config.userId}`}
 private pending():Change[]{
  const raw=localStorage.getItem(this.key);
  if(!raw)return [];
  const result:unknown=JSON.parse(raw);
  if(!Array.isArray(result))throw new Error('Could not read pending board changes');
  return result as Change[];
 }
 private async request(path:string,options:RequestInit={}){
  const token=await this.config.getToken();
  if(!token)throw new Error('Sign in to sync boards');
  const payload=token.split('.')[1];
  const claims=JSON.parse(atob(payload.replace(/-/g,'+').replace(/_/g,'/')));
  if(claims.sub!==this.config.userId)throw new Error('Account changed while syncing');
  const response=await fetch(`${this.config.apiUrl.replace(/\/$/,'')}${path}`,{...options,headers:{...options.headers,Authorization:`Bearer ${token}`}});
  if(!response.ok)throw new Error(`Board sync failed (${response.status})`);
  return response;
 }
 async load():Promise<Board[]>{
  const response=await this.request('/boards');
  const data=await response.json() as {boards:Board[]};
  if(!Array.isArray(data.boards))throw new Error('Invalid board response');
  const byId=new Map(data.boards.map(board=>[board.id,board]));
  for(const change of this.pending()){
   if(change.type==='delete')byId.delete(change.id);
   else if(change.type==='put')byId.set(change.board.id,change.board);
  }
  const boards=[...byId.values()];
  const current=boards.filter(board=>!isExpiredDeleted(board));
  if(current.length!==boards.length)this.enqueue(boards,current);
  return current;
 }
 enqueue(previous:Board[],next:Board[]){
  const before=new Map(previous.map(board=>[board.id,board]));
  const after=new Map(next.map(board=>[board.id,board]));
  const changes:Change[]=[];
  for(const board of next)if(before.get(board.id)!==board)changes.push({type:'put',board});
  for(const board of previous)if(!after.has(board.id))changes.push({type:'delete',id:board.id});
  if(changes.length){
   let queue=this.pending();
   for(const change of changes){
    const id=change.type==='put'?change.board.id:change.id;
    queue=queue.filter((pending,index)=>index===0&&Boolean(this.flushing)||(pending.type==='put'?pending.board.id:pending.id)!==id);
    queue.push(change);
   }
   localStorage.setItem(this.key,JSON.stringify(queue));
  }
 }
 flush():Promise<void>{
  if(this.flushing)return this.flushing;
  this.flushing=(async()=>{
   while(true){
    const change=this.pending()[0];
    if(!change)break;
    if(change.type==='put')await this.request(`/boards/${encodeURIComponent(change.board.id)}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(change.board)});
    else await this.request(`/boards/${encodeURIComponent(change.id)}`,{method:'DELETE'});
    const remaining=this.pending();remaining.shift();
    if(remaining.length)localStorage.setItem(this.key,JSON.stringify(remaining));else localStorage.removeItem(this.key);
   }
  })().finally(()=>{this.flushing=null});
  return this.flushing;
 }
}
