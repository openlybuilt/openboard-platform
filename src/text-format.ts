import { convertToExcalidrawElements, FONT_FAMILY } from '@excalidraw/excalidraw';
import type { ExcalidrawTextElement, FileId, NonDeletedExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { BinaryFiles, DataURL } from '@excalidraw/excalidraw/types';

export type TextStyle = {bold:boolean;italic:boolean;underline:boolean;color:string};
export function textStyle(element:ExcalidrawTextElement):TextStyle|null {
 const data=element.customData?.openboardText;
 if(!data||typeof data!=='object')return null;
 const value=data as Record<string,unknown>;
 if(typeof value.color!=='string')return null;
 return {bold:value.bold===true,italic:value.italic===true,underline:value.underline===true,color:value.color};
}
export function fontName(id:number){
 return Object.entries(FONT_FAMILY).find(([,value])=>value===id)?.[0]??'Helvetica';
}
export function renderStyledText(elements:readonly NonDeletedExcalidrawElement[],files:BinaryFiles){
 const images={...files};
 const rendered=elements.flatMap(element=>{
  const style=element.type==='text'?textStyle(element):null;
  if(element.type!=='text'||!style)return [element];
  const padding=8,scale=2;
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.ceil((element.width+2*padding)*scale));canvas.height=Math.max(1,Math.ceil((element.height+2*padding)*scale));
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas unavailable');
  ctx.scale(scale,scale);ctx.globalAlpha=element.opacity/100;ctx.fillStyle=style.color;ctx.strokeStyle=style.color;
  ctx.font=`${style.italic?'italic ':'normal '}${style.bold?'700':'400'} ${element.fontSize}px "${fontName(element.fontFamily)}"`;
  ctx.textBaseline='top';ctx.textAlign=element.textAlign==='center'?'center':element.textAlign==='right'?'right':'left';
  const x=padding+(ctx.textAlign==='center'?element.width/2:ctx.textAlign==='right'?element.width:0);
  element.text.split('\n').forEach((line,index)=>{
   const y=padding+index*element.fontSize*element.lineHeight;ctx.fillText(line,x,y);
   if(style.underline){const width=ctx.measureText(line).width;const left=x-(ctx.textAlign==='center'?width/2:ctx.textAlign==='right'?width:0);ctx.lineWidth=Math.max(1,element.fontSize/16);ctx.beginPath();ctx.moveTo(left,y+element.fontSize*1.06);ctx.lineTo(left+width,y+element.fontSize*1.06);ctx.stroke()}
  });
  const id=crypto.randomUUID() as FileId;
  images[id]={id,mimeType:'image/png',dataURL:canvas.toDataURL('image/png') as DataURL,created:Date.now()};
  return convertToExcalidrawElements([{id:element.id,type:'image',fileId:id,x:element.x-padding,y:element.y-padding,width:element.width+2*padding,height:element.height+2*padding,angle:element.angle,status:'saved',frameId:element.frameId}],{regenerateIds:false});
 });
 return {elements:rendered,files:images};
}
