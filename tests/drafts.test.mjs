import test from 'node:test';
import assert from 'node:assert/strict';
import { draftSnapshot, draftKey, loadDraft, writeDraft } from '../src/workflow/drafts.js';
import { newNode, makeEdge } from '../src/workflow/model.js';

test('borrador preserva texto, posiciones, referencias, conexiones y vista sin depender de la validación', () => {
  const nodes=[newNode('inicio'),newNode('texto',{x:234,y:567})];
  nodes[1].data.titulo=''; nodes[0].data.refFlowId='otro-flujo';
  const snapshot=draftSnapshot({nombre:'',teamId:'equipo',processId:''},nodes,[],{x:20,y:-100,zoom:.7});
  const store=new Map(),storage={getItem:key=>store.get(key),setItem:(key,value)=>store.set(key,value)};
  const key=draftKey('endpoint','equipo');writeDraft(storage,key,snapshot);
  const loaded=loadDraft(storage,key);assert.deepEqual(loaded.nodes,snapshot.nodes);assert.deepEqual(loaded.viewport,snapshot.viewport);
  assert.equal(loaded.nodes[0].data.refFlowId,'otro-flujo');assert.equal(loaded.form.nombre,'');
  assert.notEqual(key,draftKey('endpoint','otro-equipo'));assert.notEqual(key,draftKey('otro-endpoint','equipo'));
  assert.notEqual(key,draftKey('endpoint','equipo','guardado'));
});
test('descarta almacenamiento inválido y mantiene estilos semánticos fuera de datos de recuperación', () => {
  assert.equal(loadDraft({getItem:()=>'{bad'},'key'),null);
  assert.equal(loadDraft({getItem:()=>JSON.stringify({version:1,form:{},nodes:[{}],edges:[]})},'key'),null);
  const nodes=[newNode('inicio'),newNode('paso')];
  const edge=makeEdge({source:nodes[0].id,target:nodes[1].id,sourceHandle:'bottom',targetHandle:'top'},nodes);
  const snapshot=draftSnapshot({nombre:'Prueba'},nodes,[edge]);
  assert.equal(snapshot.edges[0].source,edge.source);assert.equal(snapshot.edges[0].style,undefined);
  assert.throws(()=>writeDraft({setItem:()=>{throw new Error('Cuota llena');}},'key',snapshot),/Cuota/);
});
