export function nodeUrl(origin, flowId, nodeId) {
  const url = new URL('/flujos/' + encodeURIComponent(flowId), origin);
  url.searchParams.set('nodo', nodeId);
  return url.href;
}
