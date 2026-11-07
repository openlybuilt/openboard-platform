import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';

const ns='http://www.w3.org/2000/svg';
function element(name:string,attributes:Record<string,string|number>,text?:string){
 const node=document.createElementNS(ns,name);
 for(const [key,value] of Object.entries(attributes))node.setAttribute(key,String(value));
 if(text!==undefined)node.textContent=text;
 return node;
}

/** Draw the saved code card in the same position as its canvas element. */
export function addCodeThumbnail(svg:SVGSVGElement,block:ExcalidrawElement,minX:number,minY:number,theme:'light'|'dark'){
 const data=block.customData??{};
 const code=String(data.code??''),filename=String(data.filename||'Source code'),language=String(data.language||'python');
 const width=block.width,height=block.height;
 // The SVG exporter inverts all colors in dark mode, so use corresponding source colors here.
 const colors=theme==='dark'?{surface:'#dedede',raised:'#d4d4d4',border:'#a5a5a5',divider:'#bcbcbc',text:'#111111',muted:'#585858',field:'#cccccc'}:{surface:'#ffffff',raised:'#ffffff',border:'#dedede',divider:'#eaeaea',text:'#171717',muted:'#777777',field:'#f6f6f6'};
 const group=element('g',{transform:`translate(${block.x-minX+16} ${block.y-minY+16}) rotate(${block.angle*180/Math.PI} ${width/2} ${height/2})`});
 const clipId=`code-clip-${block.id.replace(/[^a-zA-Z0-9_-]/g,'')}`;
 const clip=element('clipPath',{id:clipId});clip.appendChild(element('rect',{x:0,y:0,width,height,rx:14}));
 const defs=svg.querySelector('defs');defs?.appendChild(clip);
 const body=element('g',{'clip-path':`url(#${clipId})`});
 body.appendChild(element('rect',{x:0,y:0,width,height,rx:14,fill:colors.surface,stroke:colors.border}));
 body.appendChild(element('rect',{x:0,y:0,width,height:50,fill:colors.raised}));
 body.appendChild(element('path',{d:`M0 50 H${width} M0 ${height-42} H${width}`,stroke:colors.divider,'stroke-width':1}));
 body.appendChild(element('text',{x:17,y:30,fill:colors.muted,'font-size':15,'font-family':'monospace'},'‹/›'));
 body.appendChild(element('text',{x:43,y:30,fill:colors.text,'font-size':13,'font-family':'Arial, sans-serif','font-weight':600},filename.slice(0,24)));
 const labelX=Math.min(width-125,Math.max(115,43+filename.length*7));
 body.appendChild(element('text',{x:labelX,y:30,fill:colors.muted,'font-size':12,'font-family':'monospace'},`· ${language}`));
 if(width>250){
  body.appendChild(element('rect',{x:width-112,y:10,width:98,height:30,rx:15,fill:colors.surface,stroke:colors.border}));
  body.appendChild(element('text',{x:width-100,y:30,fill:colors.text,'font-size':12,'font-family':'Arial, sans-serif'},'▢  Copy code'));
 }
 if(code){
  const clipContent=element('clipPath',{id:`${clipId}-content`});clipContent.appendChild(element('rect',{x:15,y:51,width:Math.max(0,width-30),height:Math.max(0,height-93)}));defs?.appendChild(clipContent);
  const lines=element('g',{'clip-path':`url(#${clipId}-content)`});
  code.split('\n').forEach((line,index)=>{if(index*22<height-92)lines.appendChild(element('text',{x:20,y:78+index*22,fill:colors.text,'font-size':13,'font-family':'monospace','xml:space':'preserve'},line))});
  body.appendChild(lines);
 }else if(height>150){
  const center=(50+height-42)/2;
  body.appendChild(element('rect',{x:width/2-19,y:center-51,width:38,height:38,rx:12,fill:colors.field,stroke:colors.border}));
  body.appendChild(element('text',{x:width/2,y:center-27,fill:colors.muted,'font-size':16,'font-family':'monospace','text-anchor':'middle'},'‹/›'));
  body.appendChild(element('text',{x:width/2,y:center+8,fill:colors.text,'font-size':12,'font-family':'Arial, sans-serif','text-anchor':'middle'},'Add a snippet to your board'));
  body.appendChild(element('text',{x:width/2,y:center+28,fill:colors.muted,'font-size':11,'font-family':'Arial, sans-serif','text-anchor':'middle'},'Keep your code close to your ideas.'));
 }
 body.appendChild(element('text',{x:width-18,y:height-17,fill:colors.muted,'font-size':12,'font-family':'Arial, sans-serif','text-anchor':'end'},code?'✎  Edit code':'✎  Add code'));
 group.appendChild(body);svg.appendChild(group);
}
