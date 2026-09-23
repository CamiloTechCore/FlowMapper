import test from 'node:test';
import assert from 'node:assert/strict';
import { newNode, makeEdge, connectionError, validateGraph, fromGraph, toGraph, isAnnotation, descriptionLinks, normalizeStatus } from '../src/workflow/model.js';
import { createBackend, seedHierarchy } from './gas-harness.mjs';

test('decisión asigna Sí y No por orden, admite entradas y rechaza tercera salida desde cualquier lado', () => {
  const nodes = ['inicio','decision','paso','paso','paso'].map(type => newNode(type));
  const edge = (a,b,sourceHandle,targetHandle,edges) => makeEdge({ source: nodes[a].id, target: nodes[b].id, sourceHandle,targetHandle },nodes,{},edges);
  const input = edge(0,1,'bottom','top',[]);
  const yes = edge(1,2,'left','right',[input]);
  const no = edge(1,3,'right','left',[input,yes]);
  assert.equal(yes.data.condicion, 'positivo'); assert.equal(yes.label, 'Sí');
  assert.equal(no.data.condicion, 'negativo'); assert.equal(no.label, 'No');
  assert.deepEqual(validateGraph(nodes,[input,yes,no]).errors,[]);
  assert.match(connectionError({source:nodes[1].id,target:nodes[4].id,sourceHandle:'bottom',targetHandle:'top'},nodes,[input,yes,no]),/dos salidas/);
  const replacement = edge(1,4,'bottom','top',[input,no]);
  assert.equal(replacement.label,'Sí');
});
test('comentarios, posición, estados y referencias persisten con Code.gs 1.3.0 sin cambiar el esquema', () => {
  const backend=createBackend(), {team,process}=seedHierarchy(backend);
  const base={nombre:'Destino',teamId:team.id,processId:process.id};
  const dest=backend.request('saveFullFlow',toGraph(base,[newNode('inicio')],[])).data.flow;
  let nodes=[newNode('inicio'),newNode('texto',{x:460,y:180})];
  nodes[0].data.refFlowId=dest.id; nodes[1].data.titulo='Comentario del flujo';
  assert.equal(isAnnotation(nodes[1]),true);
  assert.match(connectionError({source:nodes[0].id,target:nodes[1].id,sourceHandle:'bottom',targetHandle:'top'},nodes),/textos flotantes/);
  let flow={...base,nombre:'Origen'};
  for(const estado of ['borrador','activo','validacion','desactivado']) {
    const response=backend.request('saveFullFlow',toGraph({...flow,estado},nodes,[]));
    assert.equal(response.success,true,response.error); flow=response.data.flow;
    const reopened=fromGraph(response.data); nodes=reopened.nodes;
    assert.equal(flow.estado,estado); assert.equal(nodes[0].data.refFlowId,dest.id);
    assert.equal(nodes[1].data.titulo,'Comentario del flujo'); assert.deepEqual(nodes[1].position,{x:460,y:180});
    assert.equal(response.data.nodes[1].flowId,flow.id); assert.equal(response.data.nodes[1].tipo,'nota');
  }
  assert.equal(backend.request('ping').data.version,'1.3.0');
  const removed=backend.request('saveFullFlow',toGraph(flow,[nodes[0]],[]));
  assert.equal(removed.data.nodes.length,1);
  assert.equal(backend.request('getFullFlow',{flowId:dest.id}).data.nodes.length,1);
});
test('URLs de descripciones solo abren http/https y estados antiguos tienen equivalencia', () => {
  assert.deepEqual(descriptionLinks('Consultar https://example.com/guia. También https://example.com/guia y javascript:alert(1)'), ['https://example.com/guia']);
  assert.deepEqual(descriptionLinks('javascript:alert(1) data:text/html,test'), []);
  assert.equal(normalizeStatus('archivado'),'desactivado');
  assert.equal(normalizeStatus('validación'),'validacion');
});
