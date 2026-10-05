import {test,expect} from '@playwright/test';
import {createBackend,seedHierarchy,graphPayload} from './gas-harness.mjs';
import {mockBackend,addNode,connect} from './editor-helpers.mjs';
import {draftKey,draftSnapshot} from '../src/workflow/drafts.js';
import {newNode} from '../src/workflow/model.js';

async function openEditor(page,team) {
  await page.goto('/equipos/'+team.id);
  await page.getByRole('button',{name:'+ Flujo',exact:true}).click();
}
test('sin autoguardado ni backup local; guardar avances sobreescribe el mismo flujo sin salir',async({page})=>{
  const backend=createBackend(),{team}=seedHierarchy(backend);
  await page.clock.install();
  await page.addInitScript(() => { const original = Storage.prototype.setItem; Storage.prototype.setItem = function (...args) { if (this === localStorage) throw new Error('Backup local no disponible'); return original.apply(this, args); }; });
  let saves=0;
  await mockBackend(page,backend,action=>{if(action==='saveFullFlow') saves++;});
  await openEditor(page,team);
  await page.getByLabel('Nombre del flujo',{exact:true}).fill('Avances manuales');
  await page.getByLabel('Estado del flujo').selectOption('activo');
  await page.clock.fastForward(600000);
  expect(saves).toBe(0);
  expect(backend.request('getAllFlows').data).toHaveLength(0);
  await page.getByRole('button',{name:'Guardar avance',exact:true}).click();
  await expect(page.locator('.wf-message')).toContainText('Avance guardado');
  await expect(page.getByRole('dialog')).toBeVisible();
  const first=backend.request('getAllFlows').data[0];
  const nodeId=backend.request('getFullFlow',{flowId:first.id}).data.nodes[0].id;
  expect(first.estado).toBe('activo');
  await page.getByLabel('Título del nodo',{exact:true}).fill('Siguiente avance');
  await page.getByRole('button',{name:'Guardar avance',exact:true}).click();
  await expect.poll(()=>backend.request('getFullFlow',{flowId:first.id}).data.nodes[0].titulo).toBe('Siguiente avance');
  expect(backend.request('getFullFlow',{flowId:first.id}).data.nodes[0].id).toBe(nodeId);
  expect(backend.request('getAllFlows').data).toHaveLength(1);
  await page.getByRole('button',{name:'Guardar cambios',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(saves).toBe(3);
  await page.reload();
  await expect(page.locator('.diagram-copy')).toContainText('Siguiente avance');
});

test('conserva la recuperación de borradores anteriores sin volver a autoguardar',async({page})=>{
  const backend=createBackend(),{team,process}=seedHierarchy(backend);
  const draft=draftSnapshot({nombre:'Anterior',teamId:team.id,processId:process.id,estado:'borrador'},[newNode('inicio')],[]);
  draft.nodes[0].data.titulo='Trabajo anterior';
  const key=draftKey('https://script.google.com/macros/s/LOCAL_TEST/exec',team.id);
  await page.addInitScript(({key,draft})=>localStorage.setItem(key,JSON.stringify(draft)),{key,draft});
  await mockBackend(page,backend);await openEditor(page,team);
  await expect(page.getByLabel('Título del nodo',{exact:true})).toHaveValue('Trabajo anterior');
  await page.getByRole('button',{name:'Descartar borrador recuperado',exact:true}).click();
  await expect(page.getByLabel('Título del nodo',{exact:true})).toHaveValue('Inicio');
});

test('un fallo remoto mantiene el diseño abierto y permite reintentar el guardado manual',async({page})=>{
  const backend=createBackend(),{team,process}=seedHierarchy(backend);
  const saved=backend.request('saveFullFlow',graphPayload(team,process)).data;
  let fail=true;
  await mockBackend(page,backend,action=>action==='saveFullFlow'&&fail?{success:false,error:'Sin conexión simulada'}:null);
  await page.goto('/flujos/'+saved.flow.id);
  await page.getByRole('button',{name:'Editar flujo',exact:true}).click();
  await page.getByLabel('Título del nodo',{exact:true}).fill('Cambios sin red');
  await page.getByRole('button',{name:'Guardar avance',exact:true}).click();
  await expect(page.locator('.wf-message')).toContainText('El diseño sigue abierto');
  await expect(page.getByLabel('Título del nodo',{exact:true})).toHaveValue('Cambios sin red');
  expect(backend.request('getFullFlow',{flowId:saved.flow.id}).data.nodes[0].titulo).toBe('Inicio');
  fail=false;
  await page.getByRole('button',{name:'Guardar avance',exact:true}).click();
  await expect(page.locator('.wf-message')).toContainText('Avance guardado');
  expect(backend.request('getFullFlow',{flowId:saved.flow.id}).data.nodes[0].titulo).toBe('Cambios sin red');
  expect(backend.request('getAllFlows').data).toHaveLength(1);
});

test('cursor oscuro al arrastrar y conexiones animadas respetan movimiento reducido',async({page})=>{
  await page.setViewportSize({width:1500,height:1000});
  const backend=createBackend(),{team}=seedHierarchy(backend);
  await mockBackend(page,backend);await openEditor(page,team);
  await addNode(page,'Actividad','Revisar');await connect(page,'Inicio','Revisar');
  const pane=page.locator('.react-flow__pane');
  const openCursor=await pane.evaluate(e=>getComputedStyle(e).cursor);
  expect(openCursor).toMatch(/^url\(.+\) 16 16, grab$/);
  const rect=await pane.boundingBox();await page.mouse.move(rect.x+35,rect.y+95);await page.mouse.down();
  const grabCursor=await pane.evaluate(e=>getComputedStyle(e).cursor);
  expect(grabCursor).toMatch(/^url\(.+\) 16 16, grabbing$/);
  expect(grabCursor).not.toBe(openCursor);await page.mouse.up();
  await expect(page.locator('.electric-pulse')).toHaveCount(1);
  await expect(page.locator('.electric-pulse')).toHaveCSS('animation-name','electric-current');
  await page.emulateMedia({reducedMotion:'reduce'});
  await expect(page.locator('.electric-pulse')).toHaveCSS('animation-name','none');
  await pane.click({position:{x:35,y:95}});
  await expect(page.getByRole('button',{name:'Copiar',exact:true})).toBeDisabled();
});

test('respuesta perdida: reintentar Guardar avance no duplica el flujo',async({page})=>{
  const backend=createBackend(),{team}=seedHierarchy(backend);
  let loseResponse=true;
  await mockBackend(page,backend,(action,data)=>{
    if(action==='saveFullFlow'&&loseResponse){
      loseResponse=false;
      const committed=backend.request(action,data);
      expect(committed.success).toBe(true);
      return {success:false,error:'Respuesta perdida después de guardar'};
    }
  });
  await openEditor(page,team);
  await page.getByLabel('Nombre del flujo',{exact:true}).fill('Sin duplicados');
  await page.getByRole('button',{name:'Guardar avance',exact:true}).click();
  await expect(page.locator('.wf-message')).toContainText('Respuesta perdida');
  const first=backend.request('getAllFlows').data[0];
  await page.getByRole('button',{name:'Guardar avance',exact:true}).click();
  await expect(page.locator('.wf-message')).toContainText('Avance guardado');
  expect(backend.request('getAllFlows').data.map(f=>f.id)).toEqual([first.id]);
  await page.getByLabel('Título del nodo',{exact:true}).fill('Continuación');
  await page.getByRole('button',{name:'Guardar avance',exact:true}).click();
  await expect.poll(()=>backend.request('getFullFlow',{flowId:first.id}).data.nodes[0].titulo).toBe('Continuación');
});
