import { BaseEdge, getSmoothStepPath } from '@xyflow/react';

export default function ElectricEdge(props) {
  const [path, labelX, labelY] = getSmoothStepPath({ ...props, borderRadius: 8, offset: 35 });
  return <>
    <BaseEdge id={props.id} path={path} labelX={labelX} labelY={labelY} label={props.label} labelStyle={props.labelStyle} labelBgStyle={props.labelBgStyle} labelBgPadding={props.labelBgPadding} style={props.style} markerEnd={props.markerEnd} interactionWidth={24} />
    <path className="electric-pulse" d={path} pathLength="100" fill="none" style={{ stroke: props.style?.stroke || '#7995bd' }} aria-hidden="true" />
  </>;
}
