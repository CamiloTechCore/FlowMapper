import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Handle, Position, useUpdateNodeInternals } from '@xyflow/react';
import { Link, useLocation } from 'react-router-dom';
import { ANCHORS, isAnnotation, descriptionLinks } from '../workflow/model';
import '../styles/diagram.css';

export function ShapeGlyph({ shape, width = 280, height = 180 }) {
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
  const location = useLocation();
  const [tooltip, setTooltip] = useState(null);
  const hideTimer = useRef(null);
  useEffect(() => () => clearTimeout(hideTimer.current), []);
  function showDescription(event) {
    clearTimeout(hideTimer.current);
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltip({ left: Math.max(12, Math.min(innerWidth - 332, rect.x + rect.width / 2 - 160)), top: Math.max(12, Math.min(innerHeight - 272, rect.bottom + 10)) });
  }
  function hideDescription() { hideTimer.current = setTimeout(() => setTooltip(null), 140); }
  const annotation = isAnnotation({ data });
  const shape = annotation ? 'text' : data.metadata?.shape || 'rectangle';
  const urls = descriptionLinks(data.descripcion);
  const flowId = location.pathname.match(/^\/flujos\/([^/]+)/)?.[1];
  const trail = [...(location.state?.flowTrail || []), ...(flowId ? [{ flowId, nodeId: id }] : [])].slice(-50);
  const width = shape === 'diamond' ? 360 : 280;
  const copyWidth = shape === 'diamond' ? 154 : shape === 'oval' ? 186 : 214;
  const text = useRef(null);
  const [textHeight, setTextHeight] = useState(50);
  const factor = shape === 'diamond' ? 2.15 : shape === 'oval' ? 1.6 : 1;
  const height = Math.max(shape === 'diamond' ? 200 : 130, Math.ceil(textHeight * factor + (shape === 'diamond' ? 30 : shape === 'cylinder' ? 96 : 64)));
  const updateInternals = useUpdateNodeInternals();
  useLayoutEffect(() => {
    const observer = new ResizeObserver(() => setTextHeight(text.current?.scrollHeight || 50));
    observer.observe(text.current);
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => { updateInternals(id); }, [id, width, height, shape, updateInternals]);
  return <div className={`diagram-node ${selected ? 'is-selected' : ''}`} style={{ width, height }} data-shape={shape} tabIndex={0} aria-describedby={!annotation && data.descripcion ? `description-${id}` : undefined} onMouseEnter={showDescription} onMouseLeave={hideDescription} onFocus={showDescription} onBlur={hideDescription} onPointerDownCapture={() => setTooltip(null)}>
    {!annotation && <ShapeGlyph shape={shape} width={width} height={height} />}
    <div className="diagram-copy" ref={text} style={{ width: copyWidth }}><strong>{data.titulo}</strong></div>
    {!annotation && data.descripcion && tooltip && createPortal(<div id={`description-${id}`} className="diagram-tooltip" role="tooltip" style={tooltip} onMouseEnter={() => clearTimeout(hideTimer.current)} onMouseLeave={hideDescription}>{data.descripcion}</div>, document.body)}
    {!annotation && <div className="diagram-links nodrag nopan">{urls.map((url, i) => <a key={url} href={url} target="_blank" rel="noopener noreferrer" aria-label={`Abrir enlace ${i + 1} de ${data.titulo}`} title={url} onClick={e => e.stopPropagation()}>↗</a>)}{data.refFlowId && <Link to={'/flujos/' + encodeURIComponent(data.refFlowId)} state={{ flowTrail: trail }} target={isConnectable ? '_blank' : undefined} rel={isConnectable ? 'noopener noreferrer' : undefined} title="Abrir flujo referenciado" aria-label={`Continuar al flujo vinculado desde ${data.titulo}`} onClick={e => e.stopPropagation()}>⇢</Link>}</div>}
    {!annotation && ANCHORS.map(anchor => <Handle key={anchor.id} id={anchor.id} type="source" position={Position[anchor.id[0].toUpperCase() + anchor.id.slice(1)]} isConnectable={isConnectable} title={`${anchor.label}: una conexión`} aria-label={`Anclaje ${anchor.label}`} style={shape === 'document' && anchor.id === 'bottom' ? { bottom: 14 } : shape === 'parallelogram' && ['left','right'].includes(anchor.id) ? { [anchor.id]: 16 } : undefined} />)}
  </div>;
}
