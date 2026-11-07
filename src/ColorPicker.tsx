import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { Pencil } from 'lucide-react';

type HSV = {h:number;s:number;v:number};
function fromHex(hex:string):HSV {
 const match=/^#([\da-f]{6})/i.exec(hex);
 const rgb=match?match[1]:'000000';
 const [r,g,b]=[0,2,4].map(i=>parseInt(rgb.slice(i,i+2),16)/255);
 const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;
 const h=!d?0:max===r?60*(((g-b)/d+6)%6):max===g?60*((b-r)/d+2):60*((r-g)/d+4);
 return {h,s:max?d/max:0,v:max};
}
function toHex({h,s,v}:HSV){
 const c=v*s,x=c*(1-Math.abs((h/60)%2-1)),m=v-c;
 const [r,g,b]=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];
 return '#'+[r,g,b].map(n=>Math.round((n+m)*255).toString(16).padStart(2,'0')).join('');
}
export function ColorPicker({label,value,onChange,allowTransparent=false}:{label:string;value:string;onChange:(color:string)=>void;allowTransparent?:boolean}){
 const trigger=useRef<HTMLButtonElement>(null),popup=useRef<HTMLDivElement>(null);
 const [open,setOpen]=useState(false),[position,setPosition]=useState({left:0,top:0});
 const [hsv,setHsv]=useState(()=>fromHex(value)),[draft,setDraft]=useState(value.slice(0,7));
 useEffect(()=>{if(!open){setHsv(fromHex(value));setDraft(/^#[\da-f]{6}/i.test(value)?value.slice(0,7):'#000000')}},[value,open]);
 useEffect(()=>{
  if(!open)return;
  const outside=(event:globalThis.PointerEvent)=>{if(event.target instanceof Node&&!popup.current?.contains(event.target)&&!trigger.current?.contains(event.target))setOpen(false)};
  const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.stopPropagation();setOpen(false);trigger.current?.focus()}};
  document.addEventListener('pointerdown',outside);document.addEventListener('keydown',key);
  return ()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key)};
 },[open]);
 function toggle(){
  if(!open&&trigger.current){const r=trigger.current.getBoundingClientRect();setPosition({left:Math.max(8,Math.min(window.innerWidth-264,r.right+8)),top:Math.max(8,Math.min(window.innerHeight-318,r.top))})}
  setOpen(!open);
 }
 function update(next:HSV){setHsv(next);const hex=toHex(next);setDraft(hex);onChange(hex)}
 function point(event:PointerEvent<HTMLDivElement>){const rect=event.currentTarget.getBoundingClientRect();update({...hsv,s:Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width)),v:1-Math.max(0,Math.min(1,(event.clientY-rect.top)/rect.height))})}
 return <div className="openboard-color-row"><span>{label}</span><button ref={trigger} type="button" className="openboard-color-trigger" aria-label={`Choose ${label.toLowerCase()} color`} aria-expanded={open} onClick={toggle}><span className="openboard-color-swatch" style={{backgroundColor:value}}/><Pencil size={12}/></button>
 {open&&createPortal(<div ref={popup} className="openboard-color-popup" style={{left:position.left,top:position.top}} role="dialog" aria-label={`${label} color picker`}>
  <div className="color-spectrum" style={{backgroundColor:`hsl(${hsv.h} 100% 50%)`}} onPointerDown={event=>{event.currentTarget.setPointerCapture(event.pointerId);point(event)}} onPointerMove={event=>{if(event.currentTarget.hasPointerCapture(event.pointerId))point(event)}}><span className="color-spectrum-cursor" style={{left:`${hsv.s*100}%`,top:`${(1-hsv.v)*100}%`}}/></div>
  <label className="color-hue-label"><span>Hue</span><input type="range" aria-label="Hue" min="0" max="360" value={hsv.h} onChange={event=>update({...hsv,h:Number(event.target.value)})}/></label>
  {allowTransparent&&<button className="color-transparent" type="button" onClick={()=>{onChange("transparent");setOpen(false)}}>No fill</button>}
  <label className="color-hex-label"><span>Hex</span><input aria-label={`${label} hex color`} value={draft} maxLength={7} spellCheck={false} onChange={event=>{const next=event.target.value;setDraft(next);if(/^#[\da-f]{6}$/i.test(next)){setHsv(fromHex(next));onChange(next)}}} onBlur={()=>{if(!/^#[\da-f]{6}$/i.test(draft))setDraft(toHex(hsv))}}/></label>
 </div>,document.body)}</div>
}
