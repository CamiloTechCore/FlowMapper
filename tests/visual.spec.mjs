import { test, expect } from '@playwright/test';
import { createBackend, seedHierarchy, graphPayload } from './gas-harness.mjs';
import { mockBackend, addNode, connect } from './editor-helpers.mjs';

test('RF-CFD-001: figuras, texto completo, biblioteca, recorrido 2D y edición persistente', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const backend = createBackend(), { team } = seedHierarchy(backend), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await mockBackend(page, backend); await page.goto('/');
  await page.getByRole('button', { name: '+ Nuevo flujo', exact: true }).click();
  await page.getByRole('button', { name: 'Abrir constructor', exact: true }).click();
  await page.getByLabel('Nombre del flujo', { exact: true }).fill('Revisión documental');
  for (const category of ['General','Misc','Advanced','Arrows','Flowchart']) await expect(page.locator('summary', { hasText: category })).toBeVisible();
  await addNode(page, 'Decisión', '¿La documentación está completa y cumple los criterios de aprobación del equipo?');
  await page.getByLabel('Descripción del nodo', { exact: true }).fill('Verificar los documentos de soporte y confirmar cada requisito antes de continuar con la aprobación de la solicitud.');
  await addNode(page, 'Documento', 'Revisar');
  await addNode(page, 'Base de datos', 'Registrar');
  await addNode(page, 'Fin', 'Terminar');
  const decision = '¿La documentación está completa y cumple los criterios de aprobación del equipo?';
  await connect(page, 'Inicio', decision);
  await connect(page, decision, 'Revisar', 'Derecho');
  await connect(page, decision, 'Registrar', 'Inferior');
  await page.getByRole('button', { name: 'Línea discontinua', exact: true }).click();
  await connect(page, 'Revisar', 'Terminar');
  await connect(page, 'Registrar', 'Terminar', 'Inferior', 'Izquierdo');
  await page.getByRole('button', { name: 'Ordenar', exact: true }).click();
  await page.getByRole('button', { name: 'Ver todo', exact: true }).click();
  await expect(page.locator('.diagram-node')).toHaveCount(5);
  for (const node of await page.locator('.diagram-node').all()) await expect(node.locator('.react-flow__handle')).toHaveCount(4);
  await expect.poll(() => page.locator('.diagram-node').evaluateAll(nodes => nodes.every(n => {
    const box = n.getBoundingClientRect(), copy = n.querySelector('.diagram-copy').getBoundingClientRect();
    return copy.left >= box.left && copy.right <= box.right && copy.top >= box.top && copy.bottom <= box.bottom;
  }))).toBe(true);
  await expect(page.locator('.react-flow__edge-path[style*="stroke-dasharray"]')).toHaveCount(2);
  await expect.poll(() => page.locator('.wf-canvas').evaluate(el => {
    const box = el.getBoundingClientRect();
    return [...el.querySelectorAll('.react-flow__node')].every(n => { const r = n.getBoundingClientRect(); return r.left >= box.left && r.right <= box.right && r.top >= box.top && r.bottom <= box.bottom; });
  })).toBe(true);
  expect(await page.locator('.wf-palette').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.getByRole('button', { name: 'Guardar flujo', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Recién guardado', { exact: true })).toBeVisible();
  await expect(page.getByRole('table')).toBeVisible();
  const saved = backend.request('getAllFlows').data[0], graph = backend.request('getFullFlow', { flowId: saved.id }).data;
  expect(graph.edges).toHaveLength(5);
  expect(graph.nodes.every(n => n.metadata.anchors.length === 4)).toBe(true);
  await page.getByRole('button', { name: 'Abrir mapa de Revisión documental' }).click();
  await expect(page.getByLabel('Mapa navegable del flujo')).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(0);
  expect(await page.locator('.wf-read-canvas').evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 255)');
  await page.getByRole('button', { name: '▶ Recorrer', exact: true }).click();
  await page.getByRole('button', { name: '→ Continuar', exact: true }).click();
  await page.getByRole('button', { name: '✗ No', exact: true }).click();
  await expect.poll(() => page.locator('.diagram-node.is-selected').evaluate(el => {
    const node = el.getBoundingClientRect(), area = el.closest('.wf-canvas').getBoundingClientRect();
    return Math.round(node.x + node.width / 2 - area.x - area.width / 2);
  })).toBe(0);
  await page.getByRole('button', { name: '→ Continuar', exact: true }).click();
  await expect(page.getByText('✓ Fin del recorrido', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Editar flujo', exact: true }).click();
  await page.getByLabel('Nombre del flujo', { exact: true }).fill('Revisión actualizada');
  await page.getByLabel('Título del nodo', { exact: true }).fill('Inicio actualizado');
  await page.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('Revisión actualizada', { exact: true })).toBeVisible();
  expect(backend.request('getAllFlows').data).toHaveLength(1);
  expect(backend.request('getFullFlow', { flowId: saved.id }).data.nodes[0].id).toBe(graph.nodes[0].id);
  await page.getByRole('button', { name: '← Biblioteca', exact: true }).click();
  await expect(page.getByLabel('Filtrar por equipo')).toHaveValue(team.id);
  expect(errors).toEqual([]);
});

test('atajos copian selección múltiple y conexiones, pegan independientes y borran sin afectar campos', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const backend = createBackend(), { team } = seedHierarchy(backend);
  await mockBackend(page, backend); await page.goto('/equipos/' + team.id);
  await page.getByRole('button', { name: '+ Flujo', exact: true }).click();
  await addNode(page, 'Actividad', 'Revisar');
  await connect(page, 'Inicio', 'Revisar');
  const canvas = page.getByLabel('Lienzo del editor', { exact: true });
  await canvas.focus(); await page.keyboard.press('Control+a'); await page.keyboard.press('Control+c'); await page.keyboard.press('Control+v');
  await expect(page.locator('.react-flow__node')).toHaveCount(4);
  await expect(page.locator('.react-flow__edge')).toHaveCount(2);
  await page.keyboard.press('Delete');
  await expect(page.locator('.react-flow__node')).toHaveCount(2);
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  await page.keyboard.press('Meta+v');
  await expect(page.locator('.react-flow__node')).toHaveCount(4);
  const title = page.getByLabel('Título del nodo', { exact: true });
  await title.fill('Texto protegido'); await title.press('Backspace');
  await expect(title).toHaveValue('Texto protegid');
  await expect(page.locator('.react-flow__node')).toHaveCount(4);
  await canvas.focus(); await page.keyboard.press('Backspace');
  await expect(page.locator('.react-flow__node')).toHaveCount(2);
  await page.getByRole('button', { name: 'Ver todo', exact: true }).click();
  await page.locator('.react-flow__edge').click();
  await page.keyboard.press('Meta+c'); await page.keyboard.press('Meta+v');
  await expect(page.locator('.react-flow__node')).toHaveCount(4);
  await page.keyboard.press('Delete');
  await page.locator('.react-flow__edge').click(); await page.keyboard.press('Delete');
  await expect(page.locator('.react-flow__edge')).toHaveCount(0);
  await expect(page.locator('.react-flow__node')).toHaveCount(2);
});

test('límite visible: una conexión por lado y cuatro por figura', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const backend = createBackend(), { team } = seedHierarchy(backend);
  await mockBackend(page, backend); await page.goto('/equipos/' + team.id);
  await page.getByRole('button', { name: '+ Flujo', exact: true }).click();
  for (let i = 1; i <= 5; i++) await addNode(page, 'Actividad', 'Actividad ' + i);
  await connect(page, 'Inicio', 'Actividad 1');
  await connect(page, 'Inicio', 'Actividad 2');
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('Anclaje ocupado');
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  await connect(page, 'Inicio', 'Actividad 2', 'Superior');
  await connect(page, 'Actividad 3', 'Inicio', 'Inferior', 'Derecho');
  await connect(page, 'Inicio', 'Actividad 4', 'Izquierdo');
  await expect(page.locator('.react-flow__edge')).toHaveCount(4);
  await connect(page, 'Inicio', 'Actividad 5');
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('Máximo 4');
  await expect(page.locator('.react-flow__edge')).toHaveCount(4);
});

test('biblioteca filtra por equipo y proceso y conserva la jerarquía al recargar', async ({ page }) => {
  const backend = createBackend(), { team, process } = seedHierarchy(backend);
  backend.request('saveFullFlow', graphPayload(team, process));
  const other = backend.request('createProcess', { teamId: team.id, nombre: 'Proceso B' }).data;
  const second = graphPayload(team, other); second.flow.nombre = 'Flujo B'; backend.request('saveFullFlow', second);
  await mockBackend(page, backend); await page.goto('/');
  await page.getByLabel('Filtrar por proceso').selectOption(other.id);
  await expect(page.getByRole('button', { name: 'Flujo B', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Resolver ticket', exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel('Filtrar por proceso')).toHaveValue(other.id);
});

test('fallo de guardado y backend antiguo conservan el diseño en el editor', async ({ page }) => {
  const backend = createBackend(), { team } = seedHierarchy(backend);
  let old = true;
  await mockBackend(page, backend, action => action === 'getSchemaStatus' && old ? { success: true, data: { version: '1.1.0', requiereMigracion: false } } : null);
  await page.goto('/equipos/' + team.id);
  await page.getByRole('button', { name: '+ Flujo', exact: true }).click();
  await page.getByLabel('Nombre del flujo', { exact: true }).fill('Conservar borrador');
  await page.getByRole('button', { name: 'Guardar flujo', exact: true }).click();
  await expect(page.getByText(/Actualiza Code.gs a la versión 1.3.0/)).toBeVisible();
  expect(backend.request('getAllFlows').data).toHaveLength(0);
  old = false; backend.failNextWrite('nodos');
  await page.getByRole('button', { name: 'Guardar flujo', exact: true }).click();
  await expect(page.getByText('Fallo de escritura simulado', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Nombre del flujo', { exact: true })).toHaveValue('Conservar borrador');
  await page.getByRole('button', { name: 'Guardar flujo', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('constructor y biblioteca móviles no desbordan; cambia entre paneles y lienzo', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const backend = createBackend(), { team, process } = seedHierarchy(backend);
  backend.request('saveFullFlow', graphPayload(team, process));
  await mockBackend(page, backend); await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: '+ Nuevo flujo', exact: true }).click();
  await page.getByRole('button', { name: 'Abrir constructor', exact: true }).click();
  await addNode(page, 'Decisión', 'Decidir');
  await page.getByRole('button', { name: 'Lienzo', exact: true }).click();
  await page.getByRole('button', { name: 'Ver todo', exact: true }).click();
  await expect(page.locator('.wf-canvas')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.getByText('Hay cambios sin guardar.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Seguir editando' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar constructor', exact: true }).click();
  await page.getByRole('button', { name: 'Descartar y cerrar', exact: true }).click();
  await page.getByRole('button', { name: 'Abrir mapa de Resolver ticket' }).click();
  await page.getByRole('button', { name: '▶ Recorrer', exact: true }).click();
  await expect(page.getByRole('button', { name: '→ Continuar', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByLabel('Detalle del nodo', { exact: true })).toHaveCSS('opacity', '1');
});

test('arrastrar desde paleta, conectar puertos, mover nodo y desplazar el lienzo 2D', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 950 });
  const backend = createBackend(), { team } = seedHierarchy(backend);
  await mockBackend(page, backend); await page.goto('/equipos/' + team.id);
  await page.getByRole('button', { name: '+ Flujo', exact: true }).click();
  await page.getByLabel('Nombre del flujo', { exact: true }).fill('Arrastre 2D');
  const canvas = page.locator('.wf-canvas');
  await page.getByRole('button', { name: 'Añadir Actividad', exact: true }).dragTo(canvas, { targetPosition: { x: 380, y: 470 } });
  await expect(page.locator('.react-flow__node')).toHaveCount(2);
  await page.getByLabel('Título del nodo', { exact: true }).fill('Revisar');
  await page.getByRole('button', { name: 'Ordenar', exact: true }).click();
  await page.getByRole('button', { name: 'Ver todo', exact: true }).click();
  const start = page.locator('.react-flow__node').filter({ hasText: 'Inicio' });
  const end = page.locator('.react-flow__node').filter({ hasText: 'Revisar' });
  const source = start.locator('.react-flow__handle[data-handleid="bottom"]');
  const target = end.locator('.react-flow__handle[data-handleid="top"]');
  await expect(source).toBeVisible(); await expect(target).toBeVisible();
  // Espera a que termine el encuadre antes de arrastrar coordenadas de pantalla.
  await expect.poll(async () => { const a = await source.boundingBox(); await page.waitForTimeout(60); const b = await source.boundingBox(); return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) < .1; }).toBe(true);
  const a = await source.boundingBox(), b = await target.boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 15 }); await page.mouse.up();
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  const before = await end.getAttribute('style'), rect = await end.boundingBox();
  await page.mouse.move(rect.x + 60, rect.y + 60); await page.mouse.down(); await page.mouse.move(rect.x + 100, rect.y + 150, { steps: 12 }); await page.mouse.up();
  await expect(end).not.toHaveAttribute('style', before);
  const viewport = page.locator('.react-flow__viewport'), previous = await viewport.getAttribute('style'), pane = await canvas.boundingBox();
  await page.mouse.move(pane.x + 50, pane.y + 100); await page.mouse.down(); await page.mouse.move(pane.x + 110, pane.y + 130, { steps: 10 }); await page.mouse.up();
  await expect(viewport).not.toHaveAttribute('style', previous);
  await page.getByRole('button', { name: 'Guardar flujo', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const graph = backend.request('getFullFlow', { flowId: backend.request('getAllFlows').data[0].id }).data;
  expect(graph.nodes.find(n => n.titulo === 'Revisar').metadata.editorPosition.y).toBeGreaterThan(0);
  await page.reload(); await expect(page.locator('.react-flow__edge')).toHaveCount(1);
});


test('todas las formas adaptan textos largos sin recortes y conservan cuatro anclajes', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const backend = createBackend(), { team } = seedHierarchy(backend);
  await mockBackend(page, backend); await page.goto('/equipos/' + team.id);
  await page.getByRole('button', { name: '+ Flujo', exact: true }).click();
  await page.getByLabel('Título del nodo', { exact: true }).fill('Un título largo para comprobar el ajuste de cada actividad en su figura');
  await page.getByLabel('Descripción del nodo', { exact: true }).fill('Una descripción detallada con varias líneas y unaReferenciaSinEspaciosMuyLargaQueDebePartirseDentroDeLaFigura '.repeat(3));
  for (const shape of ['rectangle','diamond','oval','cylinder','document','note','subprocess','parallelogram','hexagon']) {
    await page.getByLabel('Forma', { exact: true }).selectOption(shape);
    await expect(page.locator('.diagram-node .react-flow__handle')).toHaveCount(4);
    await expect.poll(() => page.locator('.diagram-node').evaluate(n => {
      const text = n.querySelector('.diagram-copy'), h = n.offsetHeight, w = n.offsetWidth;
      if (text.scrollWidth > text.clientWidth + 1 || text.scrollHeight > text.clientHeight + 1) return false;
      if (n.dataset.shape === 'diamond') return text.offsetWidth / w + text.offsetHeight / h < 1;
      if (n.dataset.shape === 'oval') return (text.offsetWidth / w) ** 2 + (text.offsetHeight / h) ** 2 < 1;
      if (n.dataset.shape === 'cylinder') return (h - text.offsetHeight) / 2 > 40;
      return text.offsetWidth + 40 < w && text.offsetHeight + 40 < h;
    })).toBe(true);
  }
});
