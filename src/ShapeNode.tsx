import { Handle, NodeResizer, Position, type NodeProps } from '@xyflow/react';

type Shape = 'card' | 'rounded' | 'diamond' | 'circle' | 'ellipse' | 'hexagon' | 'parallelogram' | 'database' | 'text';
export const shapeNames: {shape:Shape; label:string; icon:string}[] = [
  {shape:'card',label:'Rectangle',icon:'□'}, {shape:'rounded',label:'Rounded',icon:'▢'},
  {shape:'diamond',label:'Diamond',icon:'◇'}, {shape:'circle',label:'Circle',icon:'○'},
  {shape:'ellipse',label:'Oval',icon:'⬭'}, {shape:'hexagon',label:'Hexagon',icon:'⬡'},
  {shape:'parallelogram',label:'Parallelogram',icon:'▱'}, {shape:'database',label:'Database',icon:'▤'},
  {shape:'text',label:'Text',icon:'T'},
];
export function ShapeNode({data, selected}:NodeProps) {
  const shape = (data.shape || 'card') as Shape;
  const fill = typeof data.fill === 'string' ? data.fill : '#ffffff';
  const text = typeof data.textColor === 'string' ? data.textColor : '#000000';
  const common = { fill, stroke: selected ? '#000000' : '#777777', strokeWidth: selected ? 2 : 1, vectorEffect:'non-scaling-stroke' as const };
  return <div className={`shape-node shape-${shape}${selected ? ' selected' : ''}${shape === 'text' && !data.label ? ' blank' : ''}`}>
    <NodeResizer isVisible={selected} minWidth={60} minHeight={40} lineClassName="shape-resize-line" handleClassName="shape-resize-handle"/>
    <Handle type="target" position={Position.Top}/>
    {shape !== 'text' && <svg className="shape-background" viewBox="0 0 160 90" preserveAspectRatio="none" aria-hidden="true">
      {shape==='diamond' ? <polygon points="80,1 159,45 80,89 1,45" {...common}/> :
       shape==='hexagon' ? <polygon points="30,1 130,1 159,45 130,89 30,89 1,45" {...common}/> :
       shape==='parallelogram' ? <polygon points="28,1 159,1 132,89 1,89" {...common}/> :
       shape==='circle'||shape==='ellipse' ? <ellipse cx="80" cy="45" rx="79" ry="44" {...common}/> :
       shape==='database' ? <><path d="M1 14 C1 -3 159 -3 159 14 L159 75 C159 94 1 94 1 75 Z" {...common}/><path d="M1 14 C1 32 159 32 159 14" fill="none" stroke={common.stroke} strokeWidth="1" vectorEffect="non-scaling-stroke"/></> :
       <rect x="1" y="1" width="158" height="88" rx={shape==='rounded'?18:3} {...common}/>}
    </svg>}
    <span className="shape-label" style={{color:text}}>{String(data.label ?? '')}</span>
    <Handle type="source" position={Position.Bottom}/>
  </div>;
}
