import { useEffect, useState } from 'react';
import { exportToSvg, getCommonBounds } from '@excalidraw/excalidraw';
import type { NonDeletedExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { legacyElements } from './CanvasEditor';
import { addCodeThumbnail } from './code-thumbnail';
import type { Board } from './storage';
import { renderStyledText } from './text-format';

export function BoardThumbnail({board,theme}:{board:Board;theme:'light'|'dark'}) {
 const [src,setSrc]=useState<string|null>(null);
 useEffect(()=>{
  let cancelled=false;
  let objectUrl:string|null=null;
  setSrc(null);
  const elements=(board.scene?.elements ?? legacyElements(board)).filter((element):element is NonDeletedExcalidrawElement=>!element.isDeleted);
  if(!elements.length)return;
  // Keep code-card geometry in the exported bounds, and draw its saved contents below.
  const exported=elements.map(element=>element.customData?.kind==='arc-code-block'?{...element,type:'rectangle' as const,link:null,strokeColor:'transparent',backgroundColor:'transparent'}:element);
  const [minX,minY]=getCommonBounds(exported);
  const rendered=renderStyledText(exported,board.scene?.files??{});
  exportToSvg({elements:rendered.elements,files:rendered.files,appState:{exportBackground:false,exportWithDarkMode:theme==='dark'},exportPadding:16,skipInliningFonts:true}).then((svg:SVGSVGElement)=>{
   if(cancelled)return;
   elements.filter(element=>element.customData?.kind==='arc-code-block').forEach(element=>addCodeThumbnail(svg,element,minX,minY,theme));
   objectUrl=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml'}));
   setSrc(objectUrl);
  }).catch(()=>{if(!cancelled)setSrc(null)});
  return ()=>{cancelled=true;if(objectUrl)URL.revokeObjectURL(objectUrl)};
 },[board,theme]);
 return <div className="board-art" style={board.canvasColor?{backgroundColor:board.canvasColor}:undefined} data-background={board.background??'plain'} aria-hidden="true">{src&&<img className="board-thumbnail" src={src} alt=""/>}</div>;
}
