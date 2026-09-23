import { useLayoutEffect, useRef, useState } from 'react';
import { Handle, Position, useUpdateNodeInternals } from '@xyflow/react';
import { ANCHORS } from '../workflow/model';
import '../styles/diagram.css';

export function ShapeGlyph({ shape, width = 64, height = 42 }) {
  const w = width, h = height;
  return <svg className="diagram-shape" viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
    {shape === 'diamond' ? <polygon points={`${w/2},2 ${w-2},${h/2} ${w/2},${h-2} 2,${h/2}`} />
      : shape === 'oval' ? <ellipse cx={w/2} cy={h/2} rx={w/2-2} ry={h/2-2} />
      : shape === 'cylinder' ? <><path d={`M2 20 C2 -4 ${w-2} -4 ${w-2} 20 V${h-20} C${w-2} ${h+4} 2 ${h+4} 2 ${h-20} Z`} /><path d={`M2 20 C2 44 ${w-2} 44 ${w-2} 20`} /></>
      : shape === 'parallelogram' ? <polygon points={`30,2 ${w-2},2 ${w-30},${h-2} 2,${h-2}`} />
      : shape === 'hexagon' ? <polygon points={`30,2 ${w-30},2 ${w-2},${h/2} ${w-30},${h-2} 30,${h-2} 2,${h/2}`} />
      : shape === 'document' ? <path d={`M2 2 H${w-2} V${h-20} C${w*.65} ${h-40} ${w*.4} ${h+12} 2 ${h-12} Z`} />
      : shape === 'note' ? <><path d={`M2 2 H${w-22} L${w-2} 22 V${h-2} H2 Z`} /><path d={`M${w-22} 2 V22 H${w-2}`} /></>
      : <><rect x="2" y="2" width={w-4} height={h-4} rx="2" />{shape === 'subprocess' && <path d={`M15 2 V${h-2} M${w-15} 2 V${h-2}`} />}</>}
  </svg>;
}

export default function DiagramNode({ id, data, selected, isConnectable }) {
  const shape = data.metadata?.shape || 'rectangle';
  const width = shape === 'diamond' ? 360 : 280;
  const copyWidth = shape === 'diamond' ? 154 : shape === 'oval' ? 186 : 214;
  const text = useRef(null);
  const [textHeight, setTextHeight] = useState(50);
  const factor = shape === 'diamond' ? 2.15 : shape === 'oval' ? 1.6 : 1;
  const height = Math.max(shape === 'diamond' ? 200 : 130, Math.ceil(textHeight * factor + (shape === 'diamond' ? 30 : 64)));
  const updateInternals = useUpdateNodeInternals();
  useLayoutEffect(() => {
    const observer = new ResizeObserver(() => setTextHeight(text.current?.scrollHeight || 50));
    observer.observe(text.current);
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => { updateInternals(id); }, [id, width, height, shape, updateInternals]);
  return <div className={`diagram-node ${selected ? 'is-selected' : ''}`} style={{ width, height }} data-shape={shape}>
    <ShapeGlyph shape={shape} width={width} height={height} />
    <div className="diagram-copy" ref={text} style={{ width: copyWidth }}><strong>{data.titulo}</strong>{data.descripcion && <p>{data.descripcion}</p>}</div>
    {ANCHORS.map(anchor => <Handle key={anchor.id} id={anchor.id} type="source" position={Position[anchor.id[0].toUpperCase() + anchor.id.slice(1)]} isConnectable={isConnectable} title={`${anchor.label}: una conexión`} aria-label={`Anclaje ${anchor.label}`} style={shape === 'parallelogram' && ['left','right'].includes(anchor.id) ? { [anchor.id]: 16 } : undefined} />)}
  </div>;
}
