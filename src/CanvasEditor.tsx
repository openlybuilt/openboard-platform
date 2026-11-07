import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { Excalidraw, MainMenu, convertToExcalidrawElements, getSceneVersion, getCommonBounds, FONT_FAMILY, newElementWith, CaptureUpdateAction } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI, ExcalidrawProps } from '@excalidraw/excalidraw/types';
import { BoardCodeBlock } from './BoardCodeBlock';
import { WakeSlider } from './vendor/bencho/wake-slider';
import { createFlowchart, flowcharts } from './flowcharts';
import './vendor/bencho/wake-slider.css';
import type { ExcalidrawElementSkeleton } from '@excalidraw/excalidraw/data/transform';
import { ArrowLeft, Menu, MousePointer2, Hand, Square, Diamond, Circle, ArrowUpRight, Minus, Pencil, Type, Frame, Code2, Eraser, Github, Twitter, SlidersHorizontal, Trash2, Workflow, Grid2X2, Check, Plus, ArrowLeftRight } from 'lucide-react';
import type { Board, CanvasBackground } from './storage';
import '@excalidraw/excalidraw/index.css';

const choices = [
 {type:'hand',label:'Pan',Icon:Hand}, {type:'selection',label:'Select',Icon:MousePointer2},
 {type:'rectangle',label:'Rectangle',Icon:Square}, {type:'diamond',label:'Diamond',Icon:Diamond},
 {type:'ellipse',label:'Ellipse',Icon:Circle}, {type:'arrow',label:'Arrow',Icon:ArrowUpRight},
 {type:'line',label:'Line',Icon:Minus}, {type:'freedraw',label:'Draw',Icon:Pencil},
 {type:'text',label:'Text',Icon:Type}, {type:'frame',label:'Frame',Icon:Frame},
 {type:'eraser',label:'Erase',Icon:Eraser},
] as const;

export function legacyElements(board:Board) {
 const shapes:ExcalidrawElementSkeleton[] = board.nodes.map(n=>{
   const shape=String(n.data.shape??(n.className?.includes('decision')?'diamond':'card'));
   const type=shape==='diamond'?'diamond':shape==='circle'||shape==='ellipse'?'ellipse':'rectangle';
   const label=String(n.data.label??'');
   if(shape==='text' && label) return {id:n.id,type:'text',x:n.position.x,y:n.position.y,text:label,fontFamily:FONT_FAMILY.Helvetica,strokeColor:String(n.data.textColor??'#000000')};
   return {id:n.id,type,x:n.position.x,y:n.position.y,width:Number(n.style?.width??n.measured?.width??160),height:Number(n.style?.height??n.measured?.height??90),backgroundColor:String(n.data.fill??'#ffffff'),fillStyle:'solid',roughness:0,...(label?{label:{text:label,fontFamily:FONT_FAMILY.Helvetica,strokeColor:String(n.data.textColor??'#000000')}}:{})};
 });
 const ids=new Set(board.nodes.map(n=>n.id));
 for(const edge of board.edges) if(ids.has(edge.source)&&ids.has(edge.target)){const source=board.nodes.find(n=>n.id===edge.source)!;const target=board.nodes.find(n=>n.id===edge.target)!;const x=source.position.x+Number(source.style?.width??source.measured?.width??160)/2;const y=source.position.y+Number(source.style?.height??source.measured?.height??90);const tx=target.position.x+Number(target.style?.width??target.measured?.width??160)/2;const ty=target.position.y;shapes.push({type:'arrow',x,y,points:[[0,0],[tx-x,ty-y]],roughness:0,...(edge.label?{label:{text:String(edge.label),fontFamily:FONT_FAMILY.Helvetica}}:{})});}
 return convertToExcalidrawElements(shapes,{regenerateIds:false});
}

export function CanvasEditor({board,update,saveStatus,onBack,theme,onThemeChange}:{board:Board;update:(board:Board)=>void;saveStatus:'saving'|'saved'|null;onBack:()=>void;theme:'light'|'dark';onThemeChange:(theme:'light'|'dark')=>void}) {
 const [api,setApi]=useState<ExcalidrawImperativeAPI|null>(null);
 const [open,setOpen]=useState(false);
 const [flowchartsOpen,setFlowchartsOpen]=useState(false);
 const [backgroundOpen,setBackgroundOpen]=useState(false);
 const [background,setBackground]=useState<CanvasBackground>(board.background??'plain');
 const [gridView,setGridView]=useState({size:24,x:0,y:0});
 const [zoom,setZoom]=useState(100);
 const [showProperties,setShowProperties]=useState(false);
 const [selectionPosition,setSelectionPosition]=useState<{x:number;y:number}|null>(null);
 const [connectableId,setConnectableId]=useState<string|null>(null);
 const [swappableIds,setSwappableIds]=useState<string[]>([]);
 const [swapTarget,setSwapTarget]=useState<{x:number;y:number;width:number;height:number;angle:number}|null>(null);
 const [codeBlocks,setCodeBlocks]=useState<Array<{id:string;x:number;y:number;width:number;height:number;angle:number;zoom:number;data:Record<string,unknown>}>>([]);
 const [activeTool,setActiveTool]=useState('selection');
 const styleIntent=useRef(false);
 const modifiedPointer=useRef(false);
 const preferences=useRef(board.scene?.preferences ?? {});
 const [position,setPosition]=useState<{x:number;y:number}|null>(null);
 const canvasRef=useRef<HTMLDivElement>(null);
 const dockRef=useRef<HTMLDivElement>(null);
 const drag=useRef<{x:number;y:number;left:number;top:number;moved:boolean}|null>(null);
 const boardRef=useRef(board); boardRef.current=board;
 useEffect(()=>{
  const closeOutside=(event:PointerEvent)=>{if(event.target instanceof Node&&!dockRef.current?.contains(event.target)){setOpen(false);setFlowchartsOpen(false);setBackgroundOpen(false)}};
  document.addEventListener('pointerdown',closeOutside);
  return ()=>document.removeEventListener('pointerdown',closeOutside);
 },[]);
 useEffect(()=>{
  if(!api)return;
  const button=canvasRef.current?.querySelector<HTMLElement>('.main-menu-trigger');
  button?.setAttribute('aria-label','More options');button?.setAttribute('title','More options');
  const parent=button?.parentElement;
  if(!button||!parent)return;
  let closing:HTMLElement|null=null;
  let timer:ReturnType<typeof setTimeout>|undefined;
  const removeClosing=()=>{closing?.remove();closing=null;if(timer)clearTimeout(timer)};
  const observer=new MutationObserver(records=>{
   for(const record of records){
    for(const node of record.addedNodes){if(node instanceof HTMLElement&&node.matches('.dropdown-menu'))removeClosing()}
    for(const node of record.removedNodes){
     if(!(node instanceof HTMLElement)||!node.matches('.dropdown-menu')||window.matchMedia('(prefers-reduced-motion: reduce)').matches)continue;
     removeClosing();
     const rect=button.getBoundingClientRect();
     const wrapper=document.createElement('div');
     wrapper.className=`excalidraw ${theme==='dark'?'theme--dark':''} options-closing-layer`;
     wrapper.setAttribute('aria-hidden','true');wrapper.inert=true;
     const copy=node.cloneNode(true) as HTMLElement;
     copy.classList.add('options-closing');
     copy.style.top=`${rect.top}px`;copy.style.right=`${window.innerWidth-rect.left+8}px`;
     wrapper.appendChild(copy);document.body.appendChild(wrapper);closing=wrapper;
     timer=setTimeout(removeClosing,260);
    }
   }
  });
  observer.observe(parent,{childList:true});
  return ()=>{observer.disconnect();removeClosing()};
 },[api,theme]);
 // Excalidraw inverts the canvas in dark mode, including its background.
 useEffect(()=>{if(api)api.updateScene({appState:{viewBackgroundColor:background==='plain'?(theme==='dark'?'#f0f0f0':'#ffffff'):'transparent'}})},[api,theme,background]);
 // A nearly transparent fill makes the entire card draggable without painting behind its rounded corners.
 const initial=useMemo(()=>(board.scene?.elements ?? legacyElements(board)).map(element=>{
  if(element.customData?.kind==='arc-code-block')return {...element,type:'rectangle' as const,link:null,strokeColor:'transparent',backgroundColor:'#ffffff01',fillStyle:'solid' as const};
  if(element.type==='rectangle'&&element.backgroundColor==='transparent'&&element.boundElements?.some(binding=>binding.type==='arrow'))return {...element,backgroundColor:'#ffffff01',fillStyle:'solid' as const};
  return element;
 }),[board.id]);
 const version=useRef(getSceneVersion(initial));
 useEffect(()=>{
  if(boardRef.current.scene?.elements.some(element=>element.customData?.kind==='arc-code-block'&&(element.type!=='rectangle'||element.link!==null||element.backgroundColor!=='#ffffff01'||element.fillStyle!=='solid')||element.type==='rectangle'&&element.backgroundColor==='transparent'&&element.boundElements?.some(binding=>binding.type==='arrow'))){
   update({...boardRef.current,scene:{...boardRef.current.scene,elements:initial}});
  }
 },[initial,update]);
 const onChange:NonNullable<ExcalidrawProps['onChange']>=useCallback((elements,state)=>{
   setActiveTool(state.activeTool.type);
   const blocks=elements.filter(element=>!element.isDeleted&&element.customData?.kind==='arc-code-block').map(element=>({id:element.id,x:(element.x+state.scrollX)*state.zoom.value,y:(element.y+state.scrollY)*state.zoom.value,width:element.width,height:element.height,angle:element.angle,zoom:state.zoom.value,data:element.customData??{}}));
   setCodeBlocks(previous=>JSON.stringify(previous)===JSON.stringify(blocks)?previous:blocks);
   if(background!=='plain'){
     const size=24*state.zoom.value;
     const x=(state.scrollX*state.zoom.value)%size,y=(state.scrollY*state.zoom.value)%size;
     setGridView(previous=>previous.size===size&&previous.x===x&&previous.y===y?previous:{size,x,y});
   }
   const selected=elements.filter(element=>!element.isDeleted && state.selectedElementIds[element.id]);
   const single=selected.length===1?selected[0]:null;
   setConnectableId(single && ['rectangle','diamond','ellipse'].includes(single.type) && single.customData?.kind!=='arc-code-block'?single.id:null);
   const swappable=selected.length===2&&selected.every(element=>element.type==='rectangle'&&!element.locked&&element.customData?.kind!=='arc-code-block')?selected.map(element=>element.id):[];
   setSwappableIds(previous=>previous.join()===swappable.join()?previous:swappable);
   if(selected.length && !state.editingTextElement){
     const [,top,right]=getCommonBounds(selected);
     const x=Math.max(80,Math.min(state.width-4,(right+state.scrollX)*state.zoom.value));
     const y=Math.max(48,Math.min(state.height-4,(top+state.scrollY)*state.zoom.value));
     setSelectionPosition(previous=>previous?.x===x&&previous.y===y?previous:{x,y});
   }else{
     setSelectionPosition(null);
     if(!selected.length)setShowProperties(false);
   }
   if(state.openSidebar?.name==='default' && api) queueMicrotask(()=>api.toggleSidebar({name:'default',force:false}));
   const next=getSceneVersion(elements);
   let changedPreferences=false;
   if(styleIntent.current){
     styleIntent.current=false;
     const nextPreferences={currentItemStrokeColor:state.currentItemStrokeColor,currentItemBackgroundColor:state.currentItemBackgroundColor,currentItemFillStyle:state.currentItemFillStyle,currentItemStrokeWidth:state.currentItemStrokeWidth,currentItemStrokeStyle:state.currentItemStrokeStyle,currentItemRoughness:state.currentItemRoughness,currentItemOpacity:state.currentItemOpacity,currentItemFontFamily:state.currentItemFontFamily,currentItemFontSize:state.currentItemFontSize,currentItemTextAlign:state.currentItemTextAlign,currentItemRoundness:state.currentItemRoundness,currentItemStartArrowhead:state.currentItemStartArrowhead,currentItemEndArrowhead:state.currentItemEndArrowhead};
     changedPreferences=JSON.stringify(preferences.current)!==JSON.stringify(nextPreferences);
     preferences.current=nextPreferences;
   }
   if(next===version.current&&!changedPreferences)return;
   version.current=next;
   update({...boardRef.current,scene:{elements:[...elements],preferences:preferences.current}});
 },[update,api,background]);
 function chooseBackground(value:CanvasBackground){setBackground(value);update({...boardRef.current,background:value});setBackgroundOpen(false)}
 function insertCodeBlock(){
   if(!api)return;
   const state=api.getAppState();
   const x=state.width/(2*state.zoom.value)-state.scrollX-230, y=state.height/(2*state.zoom.value)-state.scrollY-150;
   const [base]=convertToExcalidrawElements([{type:'rectangle',x,y,width:460,height:300,roughness:0}],{regenerateIds:true});
   const block={...base,strokeColor:'transparent',backgroundColor:'#ffffff01',fillStyle:'solid' as const,link:null,customData:{kind:'arc-code-block',code:'',filename:'',language:'python'}};
   api.updateScene({elements:[...api.getSceneElementsIncludingDeleted(),block],captureUpdate:CaptureUpdateAction.IMMEDIATELY});
 }
 function insertFlowchart(index:number){
   if(!api)return;
   const state=api.getAppState();
   const x=state.width/(2*state.zoom.value)-state.scrollX,y=state.height/(2*state.zoom.value)-state.scrollY;
   const created=createFlowchart(flowcharts[index],x,y);
   api.updateScene({elements:[...api.getSceneElementsIncludingDeleted(),...created],captureUpdate:CaptureUpdateAction.IMMEDIATELY});
 }
 function swapSteps(ids:string[],originals?:Parameters<NonNullable<ExcalidrawProps['onPointerUp']>>[1]['originalElements']){
   if(!api||ids.length!==2)return;
   const current=api.getSceneElementsIncludingDeleted();
   const dragged=originals?.get(ids[0]);
   const restoreIds=new Set([ids[0],...(dragged?.boundElements??[]).map(binding=>binding.id)]);
   const elements=originals?current.map(element=>{
    const original=restoreIds.has(element.id)?originals.get(element.id):undefined;
    if(!original)return element;
    const {index:_index,version:_version,versionNonce:_nonce,updated:_updated,...restore}=original;
    return newElementWith(element,restore);
   }):current;
   const [a,b]=ids.map(id=>elements.find(element=>element.id===id&&!element.isDeleted));
   if(!a||!b||a.type!=='rectangle'||b.type!=='rectangle'||a.locked||b.locked)return;
   const aText=elements.find(element=>!element.isDeleted&&element.type==='text'&&element.containerId===a.id);
   const bText=elements.find(element=>!element.isDeleted&&element.type==='text'&&element.containerId===b.id);
   const style=(element:typeof a)=>({strokeColor:element.strokeColor,backgroundColor:element.backgroundColor,fillStyle:element.fillStyle,strokeWidth:element.strokeWidth,strokeStyle:element.strokeStyle,roughness:element.roughness,opacity:element.opacity,roundness:element.roundness});
   const bindings=(element:typeof a,textId:string|undefined)=>[...(element.boundElements??[]).filter(binding=>binding.type!=='text'),...(textId?[{id:textId,type:'text' as const}]:[])];
   const dx=(b.x+b.width/2)-(a.x+a.width/2),dy=(b.y+b.height/2)-(a.y+a.height/2);
   const swapped=elements.map(element=>{
    if(element.id===a.id)return newElementWith(element,{...style(b),boundElements:bindings(a,bText?.id)});
    if(element.id===b.id)return newElementWith(element,{...style(a),boundElements:bindings(b,aText?.id)});
    if(aText&&element.id===aText.id&&element.type==='text')return newElementWith(element,{containerId:b.id,x:element.x+dx,y:element.y+dy});
    if(bText&&element.id===bText.id&&element.type==='text')return newElementWith(element,{containerId:a.id,x:element.x-dx,y:element.y-dy});
    return element;
   });
   api.updateScene({elements:swapped,captureUpdate:CaptureUpdateAction.IMMEDIATELY});
 }
 useEffect(()=>{
   if(!api)return;
   let stopTracking=()=>{};
   const findTarget=(pointer:Parameters<NonNullable<ExcalidrawProps['onPointerUp']>>[1],event:PointerEvent)=>{
    if(!pointer.drag.hasOccurred||pointer.resize.isResizing||pointer.hit.hasBeenDuplicated||pointer.withCmdOrCtrl)return null;
    const selected=Object.entries(api.getAppState().selectedElementIds).filter(([,value])=>value).map(([id])=>id);
    if(selected.length!==1)return null;
    const source=pointer.originalElements.get(selected[0]);
    if(!source||source.type!=='rectangle'||source.locked||source.customData?.kind==='arc-code-block'||!source.boundElements?.some(binding=>binding.type==='arrow'))return null;
    const state=api.getAppState();
    const x=(event.clientX-state.offsetLeft)/state.zoom.value-state.scrollX;
    const y=(event.clientY-state.offsetTop)/state.zoom.value-state.scrollY;
    const target=[...pointer.originalElements.values()].reverse().find(element=>element.id!==source.id&&element.type==='rectangle'&&!element.locked&&element.customData?.kind!=='arc-code-block'&&element.boundElements?.some(binding=>binding.type==='arrow')&&x>=element.x&&x<=element.x+element.width&&y>=element.y&&y<=element.y+element.height);
    return target?{source,target,state}:null;
   };
   const unsubscribeDown=api.onPointerDown((tool,pointer,event)=>{
    stopTracking();
    if(tool.type!=='selection')return;
    const pointerId=event.pointerId;
    const move=(moveEvent:PointerEvent)=>{
     if(moveEvent.pointerId!==pointerId)return;
     const match=findTarget(pointer,moveEvent),bounds=canvasRef.current?.getBoundingClientRect();
     if(!match||!bounds){setSwapTarget(null);return}
     const {target,state}=match,scale=state.zoom.value;
     setSwapTarget({x:state.offsetLeft-bounds.left+(target.x+state.scrollX)*scale,y:state.offsetTop-bounds.top+(target.y+state.scrollY)*scale,width:target.width*scale,height:target.height*scale,angle:target.angle});
    };
    const finish=(endEvent:PointerEvent)=>{if(endEvent.pointerId===pointerId)stopTracking()};
    stopTracking=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',finish);window.removeEventListener('pointercancel',finish);setSwapTarget(null)};
    window.addEventListener('pointermove',move);
    window.addEventListener('pointerup',finish);
    window.addEventListener('pointercancel',finish);
   });
   const unsubscribeUp=api.onPointerUp((tool,pointer,event)=>{
    if(tool.type!=='selection')return;
    const match=findTarget(pointer,event);
    if(match)setTimeout(()=>swapSteps([match.source.id,match.target.id],pointer.originalElements),0);
   });
   return ()=>{stopTracking();unsubscribeDown();unsubscribeUp()};
 },[api]);
 function addConnectedStep(){
   if(!api||!connectableId)return;
   const elements=api.getSceneElementsIncludingDeleted();
   const source=elements.find(element=>element.id===connectableId&&!element.isDeleted);
   if(!source||!['rectangle','diamond','ellipse'].includes(source.type))return;
   const width=160,height=80,x=source.x+source.width+90;
   let y=source.y+source.height/2-height/2;
   const overlaps=(top:number)=>elements.some(element=>!element.isDeleted&&element.type!=='arrow'&&element.type!=='line'&&x<element.x+element.width+20&&x+width+20>element.x&&top<element.y+element.height+20&&top+height+20>element.y);
   while(overlaps(y))y+=height+60;
   const id=crypto.randomUUID();
   const [placeholder,step,arrow]=convertToExcalidrawElements([
    {id:source.id,type:source.type as 'rectangle'|'diamond'|'ellipse',x:source.x,y:source.y,width:source.width,height:source.height},
    {id,type:'rectangle',x,y,width,height,strokeColor:source.strokeColor,backgroundColor:'#ffffff01',fillStyle:'solid',roughness:0,strokeWidth:2},
    {type:'arrow',x:source.x+source.width+4,y:source.y+source.height/2,points:[[0,0],[x-source.x-source.width-8,y+height/2-source.y-source.height/2]],start:{id:source.id},end:{id},roughness:0,strokeColor:source.strokeColor,strokeWidth:2},
   ],{regenerateIds:false});
   const boundElements=[...(source.boundElements??[]),...(placeholder.boundElements??[])];
   api.updateScene({elements:[...elements.map(element=>element.id===source.id?newElementWith(element,{boundElements}):element),step,arrow],appState:{selectedElementIds:{[id]:true}},captureUpdate:CaptureUpdateAction.IMMEDIATELY});
 }
 function setCanvasZoom(percent:number){
   if(!api)return;
   const state=api.getAppState();
   const next=percent/100;
   const previous=state.zoom.value;
   api.updateScene({appState:{zoom:{...state.zoom,value:next as typeof state.zoom.value},scrollX:state.scrollX+state.width/(2*next)-state.width/(2*previous),scrollY:state.scrollY+state.height/(2*next)-state.height/(2*previous)}});
   setZoom(percent);
 }
 const selectShapeInterior:NonNullable<ExcalidrawProps['onPointerUp']>=(tool,pointer)=>{
   if(api&&tool.type==='selection'&&pointer.boxSelection.hasOccurred&&!api.getAppState().editingLinearElement){
    const left=Math.min(pointer.origin.x,pointer.lastCoords.x),right=Math.max(pointer.origin.x,pointer.lastCoords.x);
    const top=Math.min(pointer.origin.y,pointer.lastCoords.y),bottom=Math.max(pointer.origin.y,pointer.lastCoords.y);
    const overlapping=api.getSceneElements().filter(element=>{
     if(element.isDeleted||element.locked||(element.type==='text'&&element.containerId))return false;
     const [x1,y1,x2,y2]=getCommonBounds([element]);
     return x1<=right&&x2>=left&&y1<=bottom&&y2>=top;
    }).map(element=>element.id);
    setTimeout(()=>{
     const state=api.getAppState();
     const selectedElementIds={...state.selectedElementIds};
     for(const id of overlapping)selectedElementIds[id]=true;
     api.updateScene({appState:{selectedElementIds,selectedLinearElement:Object.values(selectedElementIds).filter(Boolean).length>1?null:state.selectedLinearElement}});
    },0);
    return;
   }
   if(!api||tool.type!=='selection'||pointer.hit.element||pointer.drag.hasOccurred||pointer.boxSelection.hasOccurred||pointer.withCmdOrCtrl||modifiedPointer.current)return;
   const {x,y}=pointer.origin;
   const hit=[...api.getSceneElements()].reverse().find(element=>{
    if(element.isDeleted||element.locked||!['rectangle','ellipse','diamond'].includes(element.type))return false;
    const cx=element.x+element.width/2,cy=element.y+element.height/2;
    const dx=x-cx,dy=y-cy,cos=Math.cos(element.angle),sin=Math.sin(element.angle);
    const nx=(dx*cos+dy*sin)/(element.width/2),ny=(-dx*sin+dy*cos)/(element.height/2);
    if(!Number.isFinite(nx)||!Number.isFinite(ny))return false;
    return element.type==='ellipse'?nx*nx+ny*ny<=1:element.type==='diamond'?Math.abs(nx)+Math.abs(ny)<=1:Math.abs(nx)<=1&&Math.abs(ny)<=1;
   });
   if(hit)setTimeout(()=>{if(!api.getAppState().editingTextElement)api.updateScene({appState:{selectedElementIds:{[hit.id]:true}}})},0);
 };
 function start(e:ReactPointerEvent<HTMLButtonElement>){const panel=e.currentTarget.parentElement;const bounds=canvasRef.current?.getBoundingClientRect();if(!panel||!bounds)return;const r=panel.getBoundingClientRect();drag.current={x:e.clientX,y:e.clientY,left:r.left-bounds.left,top:r.top-bounds.top,moved:false};e.currentTarget.setPointerCapture(e.pointerId)}
 function move(e:ReactPointerEvent<HTMLButtonElement>){const d=drag.current;const box=canvasRef.current;if(!d||!box)return;const dx=e.clientX-d.x,dy=e.clientY-d.y;if(Math.hypot(dx,dy)>4)d.moved=true;if(d.moved)setPosition({x:Math.max(0,Math.min(box.clientWidth-46,d.left+dx)),y:Math.max(0,Math.min(box.clientHeight-154,d.top+dy))})}
 function end(){if(drag.current&&!drag.current.moved){if(!open){setFlowchartsOpen(false);setBackgroundOpen(false)}setOpen(value=>!value)}drag.current=null}
 return <main className="editor"><div className="editor-head"><button className="back" aria-label="All whiteboards" title="All whiteboards" onClick={onBack}><ArrowLeft size={17}/></button><div className="name-wrap"><input aria-label="Board name" value={board.name} maxLength={100} onFocus={e=>{const input=e.currentTarget;requestAnimationFrame(()=>{if(document.activeElement===input)input.setSelectionRange(0,0)})}} onChange={e=>update({...board,name:e.target.value})} onBlur={()=>{if(!board.name.trim())update({...board,name:'Untitled board'})}}/></div><span className="save-status" data-status={saveStatus??undefined} role="status" aria-live="polite">{saveStatus==='saving'?'Saving...':saveStatus==='saved'?'Saved':''}</span></div><div className="canvas-wrap excalidraw-wrap" ref={canvasRef} data-background={background} style={{"--grid-size":`${gridView.size}px`,"--grid-x":`${gridView.x}px`,"--grid-y":`${gridView.y}px`} as CSSProperties} data-show-properties={showProperties} onPointerDownCapture={e=>{modifiedPointer.current=e.shiftKey||e.altKey||e.ctrlKey||e.metaKey}} onClickCapture={e=>{if((e.target as Element).closest('.selected-shape-actions'))styleIntent.current=true}} onInputCapture={e=>{if((e.target as Element).closest('.selected-shape-actions'))styleIntent.current=true}}>
  <Excalidraw theme={theme} initialData={{elements:initial,appState:{viewBackgroundColor:background==='plain'?(theme==='dark'?'#f0f0f0':'#ffffff'):'transparent',currentItemRoughness:0,currentItemFontFamily:FONT_FAMILY.Helvetica,currentItemStrokeColor:'#000000',...preferences.current},scrollToContent:true}} excalidrawAPI={setApi} onChange={onChange} onPointerUp={selectShapeInterior} onScrollChange={(_x,_y,value)=>setZoom(Math.round(value.value*100))} UIOptions={{tools:{image:false},canvasActions:{changeViewBackgroundColor:false,toggleTheme:true}}}>
    <MainMenu>
      <MainMenu.DefaultItems.LoadScene/>
      <MainMenu.DefaultItems.SaveToActiveFile/>
      <MainMenu.DefaultItems.Export/>
      <MainMenu.DefaultItems.SaveAsImage/>
      <MainMenu.DefaultItems.SearchMenu/>
      <MainMenu.DefaultItems.Help/>
      <MainMenu.DefaultItems.ClearCanvas/>
      <MainMenu.Separator/>
      <MainMenu.Group title="Openly">
        <MainMenu.ItemLink href="https://github.com/openlybuilt" target="_blank" rel="noopener noreferrer" icon={<Github size={18}/>}>GitHub</MainMenu.ItemLink>
        <MainMenu.ItemLink href="https://x.com/openlybuilt" target="_blank" rel="noopener noreferrer" icon={<Twitter size={18}/>}>X</MainMenu.ItemLink>
      </MainMenu.Group>
      <MainMenu.Separator/>
      <MainMenu.DefaultItems.ToggleTheme onSelect={onThemeChange}/>
    </MainMenu>
  </Excalidraw>
  {swapTarget&&<div className="swap-target-outline" aria-hidden="true" style={{left:swapTarget.x,top:swapTarget.y,width:swapTarget.width,height:swapTarget.height,transform:`rotate(${swapTarget.angle}rad)`}}/>}
  {codeBlocks.map(block=><div key={block.id} className="native-code-position" style={{left:block.x,top:block.y,width:block.width*block.zoom,height:block.height*block.zoom,transform:`rotate(${block.angle}rad)`}}><div className="native-code-scale" style={{width:block.width,height:block.height,transform:`scale(${block.zoom})`}}><BoardCodeBlock code={String(block.data.code??'')} filename={String(block.data.filename??'')} language={String(block.data.language??'python')} onSave={(code,filename,language)=>{
   if(!api)return;
   api.updateScene({elements:api.getSceneElementsIncludingDeleted().map(item=>item.id===block.id?newElementWith(item,{customData:{...item.customData,code,filename,language}}):item),captureUpdate:CaptureUpdateAction.IMMEDIATELY});
  }}/></div></div>)}
  {selectionPosition&&<div className="selection-actions" style={{left:selectionPosition.x,top:selectionPosition.y}}>
   {connectableId&&<button type="button" aria-label="Add connected step" title="Add connected step" onClick={addConnectedStep}><Plus size={16}/></button>}
   {swappableIds.length===2&&<button type="button" aria-label="Swap steps" title="Swap steps" onClick={()=>swapSteps(swappableIds)}><ArrowLeftRight size={16}/></button>}
   <button type="button" aria-label={showProperties?'Close shape settings':'Open shape settings'} title="Shape settings" aria-pressed={showProperties} onClick={()=>setShowProperties(value=>!value)}><SlidersHorizontal size={16}/></button>
   <button type="button" aria-label="Delete selection" title="Delete selection" onClick={()=>canvasRef.current?.querySelector('.excalidraw')?.dispatchEvent(new KeyboardEvent('keydown',{key:'Delete',code:'Delete',bubbles:true}))}><Trash2 size={16}/></button>
  </div>}
  <div className="zoom-slider"><WakeSlider value={zoom} onChange={setCanvasZoom}/></div>
  <div className="tool-dock" ref={dockRef} style={position?{left:position.x,top:position.y,transform:'none'}:undefined}>
   <button className="tool-toggle" type="button" aria-expanded={open} aria-controls="drawing-tools" aria-label={open?'Close tools':'Open tools'} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={()=>{drag.current=null}} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();if(!open){setFlowchartsOpen(false);setBackgroundOpen(false)}setOpen(v=>!v)}}}><Menu size={20}/></button>
   <button className="flowchart-toggle" type="button" aria-label="Flowcharts" title="Flowcharts" aria-expanded={flowchartsOpen} aria-controls="flowchart-options" onClick={()=>{if(!flowchartsOpen){setOpen(false);setBackgroundOpen(false)}setFlowchartsOpen(value=>!value)}}><Workflow size={19}/></button>
   <button className="background-toggle" type="button" aria-label="Canvas background" title="Canvas background" aria-expanded={backgroundOpen} aria-controls="background-options" onClick={()=>{if(!backgroundOpen){setOpen(false);setFlowchartsOpen(false)}setBackgroundOpen(value=>!value)}}><Grid2X2 size={19}/></button>
   <div className={`tool-panel ${open?'is-open':'is-closed'}`} inert={!open}>
    <div id="drawing-tools" className="tools" aria-label="Drawing tools">{choices.map(({type,label,Icon})=><button key={type} onClick={()=>{setShowProperties(false);if(api)api.updateScene({appState:{...api.getAppState(),...preferences.current}});api?.setActiveTool({type,locked:type!=='selection'&&type!=='hand'})}} aria-pressed={activeTool===type} aria-label={label} title={label}><Icon size={18}/><span className="tool-label">{label}</span></button>)}<button onClick={insertCodeBlock} aria-label="Add code block" title="Add code block"><Code2 size={18}/><span className="tool-label">Code block</span></button></div>
   </div>
   <div id="flowchart-options" className={`flowchart-options ${flowchartsOpen?'is-open':'is-closed'}`} inert={!flowchartsOpen} aria-hidden={!flowchartsOpen}>{flowcharts.map((flowchart,index)=><button key={flowchart.name} onClick={()=>insertFlowchart(index)} aria-label={`Add ${flowchart.name.toLowerCase()} flowchart`}>{flowchart.name}</button>)}</div>
   <div id="background-options" className={`flowchart-options background-options ${backgroundOpen?'is-open':'is-closed'}`} inert={!backgroundOpen} aria-hidden={!backgroundOpen} role="group" aria-label="Canvas background">{([['plain','Plain'],['dots','Dots'],['grid','Square grid']] as const).map(([value,label])=><button key={value} type="button" aria-pressed={background===value} onClick={()=>chooseBackground(value)}>{label}{background===value&&<Check size={15}/>}</button>)}</div>
  </div>
 </div></main>;
}
