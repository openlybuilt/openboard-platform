import { useEffect, useRef, useState } from 'react';
import { CaptureUpdateAction, convertToExcalidrawElements, exportToBlob, exportToSvg, serializeAsJSON } from '@excalidraw/excalidraw';
import type { DataURL, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { FileId } from '@excalidraw/excalidraw/element/types';
import { Ellipsis, FileDown, FolderOpen, Github, HelpCircle, Image, Moon, Search, Sun, Trash2, Twitter, X } from 'lucide-react';
import { renderStyledText } from './text-format';

function download(blob: Blob, filename: string) {
 const url=URL.createObjectURL(blob);
 const link=document.createElement('a');link.href=url;link.download=filename;link.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}

type SavePicker = (options:{suggestedName:string;types:Array<{description:string;accept:Record<string,string[]>}>})=>Promise<FileSystemFileHandle>;
function chooseDestination(filename:string,description:string,mime:string,extension:string){
 const picker=(window as Window & {showSaveFilePicker?:SavePicker}).showSaveFilePicker;
 return picker?picker.call(window,{suggestedName:filename,types:[{description,accept:{[mime]:[extension]}}]}):Promise.resolve(null);
}
async function writeFile(handle:FileSystemFileHandle|null,blob:Blob,filename:string){
 if(!handle){download(blob,filename);return}
 const writable=await handle.createWritable();
 try{await writable.write(blob);await writable.close()}catch(error){await writable.abort();throw error}
}

export function BoardMenu({api,name,theme,canvasColor,background,onThemeChange,onOpen,onShow}:{api:ExcalidrawImperativeAPI|null;name:string;theme:'light'|'dark';canvasColor?:string;background:string;onThemeChange:(theme:'light'|'dark')=>void;onOpen:()=>void;onShow:()=>void}) {
 const [open,setOpen]=useState(false);
 const [panel,setPanel]=useState<'search'|'help'|'export'|'reset'|'open'|null>(null);
 const [query,setQuery]=useState('');
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [includeBackground,setIncludeBackground]=useState(true);
 const root=useRef<HTMLDivElement>(null);
 const dialog=useRef<HTMLDialogElement>(null);
 const trigger=useRef<HTMLButtonElement>(null);
 const filename=(name.trim()||'whiteboard').replace(/[\\/:*?"<>|]/g,'-');
 useEffect(()=>{
  const outside=(event:PointerEvent)=>{if(event.target instanceof Node&&!root.current?.contains(event.target))setOpen(false)};
  const key=(event:KeyboardEvent)=>{if(event.key==='Escape'&&open){event.stopPropagation();setOpen(false);trigger.current?.focus()}};
  document.addEventListener('pointerdown',outside);document.addEventListener('keydown',key);
  return ()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key)};
 },[open]);
 useEffect(()=>{if(panel&&!dialog.current?.open)dialog.current?.showModal()},[panel]);
 const show=(next:NonNullable<typeof panel>)=>{setOpen(false);setError('');setPanel(next)};
 async function save(format:'openboard'|'excalidraw'){
  if(!api)return;
  try{
   const target=`${filename}.${format}`;
   const destination=await chooseDestination(target,format==='openboard'?'OpenBoard file':'Excalidraw file','application/json',`.${format}`);
   const {elements,files}=format==='excalidraw'?prepareExport():{elements:api.getSceneElementsIncludingDeleted(),files:api.getFiles()};
   const state=api.getAppState();
   const serialized=serializeAsJSON(elements,state,files,'local');
   const contents=format==='openboard'?JSON.stringify({...JSON.parse(serialized),openboard:{background,canvasColor:canvasColor??state.viewBackgroundColor,viewport:{zoom:state.zoom.value,scrollX:state.scrollX,scrollY:state.scrollY}}}):serialized;
   await writeFile(destination,new Blob([contents],{type:'application/json'}),target);if(!destination)setNotice('Saved using your browser’s download location. Turn on “ask where to save” in browser settings to choose a folder.');setOpen(false)
  }
  catch(error){if(error instanceof DOMException&&error.name==='AbortError'){setOpen(false);return}setError('Could not save this whiteboard. Please try again.');setOpen(false)}
 }
 function prepareExport(){
   if(!api)throw new Error('Editor unavailable');
   const files={...api.getFiles()};
   const elements=api.getSceneElements().flatMap(element=>{
    if(element.customData?.kind!=='arc-code-block')return [element];
    // Code cards are HTML overlays, so provide an image for canvas exports.
    const canvas=document.createElement('canvas');
    const scale=Math.min(2,4096/Math.max(element.width,element.height));
    canvas.width=Math.max(1,Math.ceil(element.width*scale));canvas.height=Math.max(1,Math.ceil(element.height*scale));
    const context=canvas.getContext('2d');if(!context)throw new Error('Canvas unavailable');
    context.scale(scale,scale);context.fillStyle=theme==='dark'?'#2c2c2c':'#fff';context.fillRect(0,0,element.width,element.height);
    context.strokeStyle=theme==='dark'?'#505050':'#dedede';context.strokeRect(.5,.5,element.width-1,element.height-1);
    context.fillStyle=theme==='dark'?'#eee':'#171717';context.font='13px sans-serif';
    context.fillText(String(element.customData.filename||element.customData.language||'Code'),14,27,Math.max(0,element.width-28));
    context.beginPath();context.moveTo(0,42);context.lineTo(element.width,42);context.stroke();
    context.font='12px monospace';context.save();context.beginPath();context.rect(12,48,Math.max(0,element.width-24),Math.max(0,element.height-60));context.clip();
    String(element.customData.code||'').split('\n').forEach((line,index)=>context.fillText(line,14,64+index*18));context.restore();
    const id=crypto.randomUUID() as FileId;
    files[id]={id,mimeType:'image/png',dataURL:canvas.toDataURL('image/png') as DataURL,created:Date.now()};
    return convertToExcalidrawElements([{id:element.id,type:'image',fileId:id,x:element.x,y:element.y,width:element.width,height:element.height,angle:element.angle,status:'saved'}],{regenerateIds:false});
   });
   return renderStyledText(elements,files);
 }
 async function exportImage(format:'png'|'svg'){
  if(!api)return;
  try{
   if(!api.getSceneElements().length){setError('Add something to the whiteboard before exporting.');return}
   const target=`${filename}.${format}`;
   const destination=await chooseDestination(target,format==='png'?'PNG image':'SVG image',format==='png'?'image/png':'image/svg+xml',`.${format}`);
   const {elements,files}=prepareExport();
   const page=elements.find(element=>element.type==='frame'&&element.customData?.kind==='openboard-page');
   const opts={elements,appState:{...api.getAppState(),exportBackground:includeBackground,...(canvasColor?{viewBackgroundColor:canvasColor}:{})},files,exportPadding:20,exportingFrame:page?.type==='frame'?page:null};
   const blob=format==='png'?await exportToBlob({...opts,mimeType:'image/png'}):new Blob([new XMLSerializer().serializeToString(await exportToSvg(opts))],{type:'image/svg+xml'});
   await writeFile(destination,blob,target);dialog.current?.close();if(!destination)setNotice('Saved using your browser’s download location. Turn on “ask where to save” in browser settings to choose a folder.');
  }catch(error){if(error instanceof DOMException&&error.name==='AbortError')return;setError('Could not export this whiteboard. Please try again.')}
 }
 function find(){
  if(!api||!query.trim())return;
  const search=query.trim().toLowerCase();
  const matches=api.getSceneElements().filter(element=>element.type==='text'&&element.text.toLowerCase().includes(search)||element.customData?.kind==='arc-code-block'&&[element.customData.code,element.customData.filename].some(value=>typeof value==='string'&&value.toLowerCase().includes(search)));
  if(!matches.length){setError('No matching text found.');return}
  api.updateScene({appState:{selectedElementIds:Object.fromEntries(matches.map(item=>[item.id,true]))}});
  api.scrollToContent(matches,{fitToContent:true});dialog.current?.close();
 }
 return <>
  <div className="board-menu" ref={root}>
   <button ref={trigger} className="board-menu-trigger" type="button" aria-label="More options" aria-expanded={open} aria-controls="board-menu-panel" onClick={()=>{if(!open)onShow();setOpen(!open)}}><Ellipsis size={20}/></button>
   <div id="board-menu-panel" className={`board-menu-panel ${open?'is-open':'is-closed'}`} inert={!open} aria-hidden={!open}>
    <button type="button" onClick={()=>{if(api?.getSceneElements().length)show('open');else{setOpen(false);onOpen()}}}><FolderOpen size={17}/>Open</button>
    <button type="button" onClick={()=>void save('openboard')}><FileDown size={17}/>Save to file</button>
    <button type="button" onClick={()=>void save('excalidraw')}><FileDown size={17}/>Export as Excalidraw</button>
    <button type="button" onClick={()=>show('export')}><Image size={17}/>Export image</button>
    <button type="button" onClick={()=>show('search')}><Search size={17}/>Find on canvas</button>
    <button type="button" onClick={()=>show('help')}><HelpCircle size={17}/>Help</button>
    <button type="button" onClick={()=>show('reset')}><Trash2 size={17}/>Reset canvas</button>
    <div className="board-menu-divider"/><span className="board-menu-label">Openly</span>
    <a href="https://github.com/openlybuilt" target="_blank" rel="noopener noreferrer"><Github size={17}/>GitHub</a>
    <a href="https://x.com/openlybuilt" target="_blank" rel="noopener noreferrer"><Twitter size={17}/>X</a>
    <div className="board-menu-divider"/>
    <button type="button" onClick={()=>{onThemeChange(theme==='light'?'dark':'light');setOpen(false)}}>{theme==='light'?<Moon size={17}/>:<Sun size={17}/>} {theme==='light'?'Dark mode':'Light mode'}</button>
   </div>
  </div>
  {error&&!panel&&<div className="board-menu-error" role="alert">{error}<button type="button" aria-label="Dismiss" onClick={()=>setError('')}><X size={15}/></button></div>}
  {notice&&!panel&&<div className="board-menu-error" role="status">{notice}<button type="button" aria-label="Dismiss" onClick={()=>setNotice('')}><X size={15}/></button></div>}
  <dialog ref={dialog} className="board-menu-dialog" aria-labelledby="board-menu-dialog-title" onClose={()=>{setPanel(null);setError('');trigger.current?.focus()}} onClick={event=>{if(event.target===event.currentTarget)event.currentTarget.close()}}>
   <div className="board-menu-dialog-head"><h2 id="board-menu-dialog-title">{panel==='search'?'Find on canvas':panel==='help'?'Help':panel==='export'?'Export image':panel==='open'?'Open a file?':'Reset canvas?'}</h2><button type="button" aria-label="Close" onClick={()=>dialog.current?.close()}><X size={18}/></button></div>
   {panel==='search'&&<form onSubmit={event=>{event.preventDefault();find()}}><label htmlFor="board-search">Search for text</label><input id="board-search" autoFocus value={query} onChange={event=>{setQuery(event.target.value);setError('')}} placeholder="Find text on this board"/><div className="board-menu-dialog-actions"><button type="submit" className="board-menu-primary">Find</button></div></form>}
   {panel==='help'&&<div className="board-menu-help"><p>Use the tools on the left to add and edit your diagram.</p><p>Select an object to move it or open its settings. Double-click a shape to add text.</p><p>Use the bottom slider to zoom. Your board saves automatically.</p></div>}
   {panel==='export'&&<><p>Download your whiteboard as an image.</p><label className="board-menu-check"><input type="checkbox" checked={includeBackground} onChange={event=>setIncludeBackground(event.target.checked)}/> Include background</label><div className="board-menu-dialog-actions"><button type="button" onClick={()=>void exportImage('svg')}>SVG</button><button type="button" className="board-menu-primary" onClick={()=>void exportImage('png')}>PNG</button></div></>}
   {panel==='reset'&&<><p>This removes everything from the current canvas. You can undo this action.</p><div className="board-menu-dialog-actions"><button type="button" onClick={()=>dialog.current?.close()}>Cancel</button><button type="button" className="board-menu-primary" onClick={()=>{api?.updateScene({elements:[],captureUpdate:CaptureUpdateAction.IMMEDIATELY});dialog.current?.close()}}>Reset canvas</button></div></>}
   {panel==='open'&&<><p>Opening a file replaces the current canvas. Your current changes are saved in this board until you choose a file.</p><div className="board-menu-dialog-actions"><button type="button" onClick={()=>dialog.current?.close()}>Cancel</button><button type="button" className="board-menu-primary" onClick={()=>{dialog.current?.close();onOpen()}}>Choose file</button></div></>}
   {error&&<p className="board-menu-dialog-error" role="alert">{error}</p>}
  </dialog>
 </>;
}
