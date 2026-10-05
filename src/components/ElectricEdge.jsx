import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath } from '@xyflow/react';

export default function ElectricEdge(props) {
  const [path, labelX, labelY] = getSmoothStepPath({ ...props, borderRadius: 8, offset: 35 });
  const transition = props.data?.transition;
  return <>
    <BaseEdge id={props.id} path={path} labelX={labelX} labelY={labelY} label={transition ? undefined : props.label} labelStyle={props.labelStyle} labelBgStyle={props.labelBgStyle} labelBgPadding={props.labelBgPadding} style={props.style} markerEnd={props.markerEnd} interactionWidth={24} />
    {transition && <EdgeLabelRenderer><div className="segment-transition-label nodrag nopan" title={transition.criterio} tabIndex={0} aria-label={`Transición: ${transition.desde} a ${transition.hasta}. ${transition.criterio}`} style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, borderColor: props.style?.stroke }}>{props.label && <strong>{props.label} · </strong>}<strong>{transition.desde} → {transition.hasta}</strong><span>{transition.criterio || 'Sin condición definida'}</span></div></EdgeLabelRenderer>}
    <path className="electric-pulse" d={path} pathLength="100" fill="none" style={{ stroke: props.style?.stroke || '#7995bd' }} aria-hidden="true" />
  </>;
}
