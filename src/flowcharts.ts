import { convertToExcalidrawElements } from '@excalidraw/excalidraw';
import type { ExcalidrawElementSkeleton } from '@excalidraw/excalidraw/data/transform';

type Node = { x:number; y:number; width?:number; height?:number };
type Layout = { name:string; nodes:Node[]; edges:[number,number][] };

// Layouts follow the flowchart examples in the component gallery.
export const flowcharts:Layout[]=[
 {name:'Horizontal · 3 steps',nodes:[{x:0,y:0},{x:230,y:0},{x:460,y:0}],edges:[[0,1],[1,2]]},
 {name:'Horizontal · branch',nodes:[{x:0,y:100},{x:230,y:100},{x:460,y:0},{x:460,y:200}],edges:[[0,1],[1,2],[1,3]]},
 {name:'Horizontal · 4 steps',nodes:[{x:0,y:0},{x:230,y:0},{x:460,y:0},{x:690,y:0}],edges:[[0,1],[1,2],[2,3]]},
 {name:'Vertical · 2 steps',nodes:[{x:0,y:0},{x:0,y:170}],edges:[[0,1]]},
];

export function createFlowchart(layout:Layout,centerX:number,centerY:number){
 const width=Math.max(...layout.nodes.map(node=>node.x+(node.width??160)));
 const height=Math.max(...layout.nodes.map(node=>node.y+(node.height??80)));
 const originX=centerX-width/2,originY=centerY-height/2;
 const ids=layout.nodes.map(()=>crypto.randomUUID());
 const shapes:ExcalidrawElementSkeleton[]=layout.nodes.map((node,index)=>({
  id:ids[index],type:'rectangle',x:originX+node.x,y:originY+node.y,width:node.width??160,height:node.height??80,
  strokeColor:'#1e1e1e',backgroundColor:'transparent',roughness:0,strokeWidth:2,
 }));
 for(const [from,to] of layout.edges){
  const a=layout.nodes[from],b=layout.nodes[to];
  const ax=originX+a.x+(a.width??160)/2,ay=originY+a.y+(a.height??80)/2;
  const bx=originX+b.x+(b.width??160)/2,by=originY+b.y+(b.height??80)/2;
  const dx=bx-ax,dy=by-ay;
  // Start and end at the node edges, leaving a little room for the arrowhead.
  const horizontal=Math.abs(dx)>Math.abs(dy);
  const x1=ax+(horizontal?Math.sign(dx)*((a.width??160)/2+4):0);
  const y1=ay+(!horizontal?Math.sign(dy)*((a.height??80)/2+4):0);
  const x2=bx-(horizontal?Math.sign(dx)*((b.width??160)/2+4):0);
  const y2=by-(!horizontal?Math.sign(dy)*((b.height??80)/2+4):0);
  shapes.push({type:'arrow',x:x1,y:y1,points:[[0,0],[x2-x1,y2-y1]],start:{id:ids[from]},end:{id:ids[to]},roughness:0,strokeColor:'#1e1e1e',strokeWidth:2});
 }
 return convertToExcalidrawElements(shapes,{regenerateIds:false});
}
