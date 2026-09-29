import { test, expect } from '@playwright/test';
import { createBackend, seedHierarchy, graphPayload } from './gas-harness.mjs';
import { mockBackend } from './editor-helpers.mjs';
import { newNode, toGraph } from '../src/workflow/model.js';

test('editar etiqueta de equipo la heredan procesos y flujos, filtra y persiste al recargar', async ({ page }) => {
  const backend = createBackend(), { team, process } = seedHierarchy(backend);
  const flow = backend.request('saveFullFlow', graphPayload(team, process)).data.flow;
  const other = backend.request('createTeam', { nombre: 'Otro equipo', etiqueta: '#Otro' }).data;
  const otherProcess = backend.request('createProcess', { teamId: other.id, nombre: 'Otro proceso' }).data;
  const payload = graphPayload(other, otherProcess); payload.flow.nombre = 'Otro flujo';
  backend.request('saveFullFlow', payload);
  await mockBackend(page, backend); await page.goto('/equipos');
  await page.getByRole('button', { name: 'Editar equipo Soporte', exact: true }).click();
  await page.getByLabel('Etiqueta del equipo').fill('#Atención_QA');
  await page.getByRole('button', { name: 'Guardar equipo', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.team-tag').filter({ hasText: '#Atención_QA' })).toHaveCount(1);
  await page.goto('/equipos/' + team.id);
  await expect(page.locator('.team-tag').filter({ hasText: '#Atención_QA' })).toHaveCount(3);
  await page.goto('/');
  await page.getByLabel('Buscar en biblioteca').fill('#atención_qa ticket');
  await expect(page.getByRole('button', { name: flow.nombre, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Otro flujo', exact: true })).toHaveCount(0);
  await page.goto('/equipos');
  await page.getByRole('button', { name: 'Editar equipo Soporte', exact: true }).click();
  await page.getByLabel('Etiqueta del equipo').fill('#Nuevo');
  await page.getByRole('button', { name: 'Guardar equipo', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto('/');
  await page.getByLabel('Buscar en biblioteca').fill('#Atención_QA');
  await expect(page.getByText('No hay flujos', { exact: true })).toBeVisible();
  await page.getByLabel('Buscar en biblioteca').fill('#nuevo');
  await expect(page.getByRole('button', { name: flow.nombre, exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('enlaces de todos los tipos de nodo abren y centran; copiar, historial y guardados conservan el destino', async ({ page, context }) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const backend = createBackend(), { team, process } = seedHierarchy(backend);
  const nodes = ['inicio', 'paso', 'decision', 'fin', 'texto'].map((type, i) => newNode(type, { x: i * 500, y: i * 300 }));
  const graph = backend.request('saveFullFlow', toGraph({ nombre: 'Enlaces', teamId: team.id, processId: process.id }, nodes, [])).data;
  await mockBackend(page, backend);
  for (const node of graph.nodes) {
    await page.goto('/flujos/' + graph.flow.id + '?nodo=' + node.id);
    await expect(page.getByLabel('Detalle del nodo').getByRole('heading', { name: node.titulo, exact: true })).toBeVisible();
    await expect(page.locator('.diagram-node.is-selected')).toContainText(node.titulo);
    await expect.poll(() => page.locator('.diagram-node.is-selected').evaluate(el => {
      const node = el.getBoundingClientRect(), canvas = el.closest('.wf-canvas').getBoundingClientRect();
      return Math.abs(node.x + node.width / 2 - canvas.x - canvas.width / 2);
    })).toBeLessThan(2);
  }
  const first = graph.nodes[0], second = graph.nodes[1];
  await page.goto('/flujos/' + graph.flow.id + '?nodo=' + first.id);
  await page.getByRole('button', { name: 'Copiar URL del nodo', exact: true }).click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(new URL(copied).searchParams.get('nodo')).toBe(first.id);
  await page.getByRole('button', { name: 'Ver todo', exact: true }).click();
  await page.locator('.diagram-node').filter({ hasText: second.titulo }).click();
  await expect(page).toHaveURL(new RegExp('nodo=' + second.id));
  await page.goBack();
  await expect(page.getByLabel('Detalle del nodo').getByRole('heading')).toHaveText(first.titulo);
  await page.getByRole('button', { name: 'Editar flujo', exact: true }).click();
  await page.getByLabel('Título del nodo', { exact: true }).fill('Inicio actualizado');
  await page.getByRole('button', { name: 'Guardar avance', exact: true }).click();
  await expect(page.locator('.wf-message')).toContainText('Avance guardado');
  await expect(page.getByRole('dialog').getByLabel('URL del nodo', { exact: true })).toHaveValue(copied);
  await page.getByRole('button', { name: 'Cerrar constructor', exact: true }).click();
  await page.goto(copied);
  await expect(page.getByLabel('Detalle del nodo').getByRole('heading')).toHaveText('Inicio actualizado');
  await page.goto('/flujos/' + graph.flow.id + '?nodo=no-existe');
  await expect(page.getByRole('alert')).toContainText('El nodo del enlace ya no existe');
});

test('guarda repetidamente un flujo de 151 conexiones desde el editor', async ({ page }) => {
  test.setTimeout(60000);
  const backend = createBackend(), { team, process } = seedHierarchy(backend);
  const nodes = Array.from({ length: 152 }, (_, i) => ({ _tempId: String(i), tipo: 'paso', titulo: 'Actividad ' + i, metadata: { editorPosition: { x: (i % 10) * 400, y: Math.floor(i / 10) * 260 } } }));
  const edges = Array.from({ length: 151 }, (_, i) => ({ sourceId: String(i), targetId: String(i + 1), sourceHandle: 'bottom', targetHandle: 'top' }));
  const first = backend.request('saveFullFlow', { flow: { nombre: 'Grande', teamId: team.id, processId: process.id }, nodes, edges }).data;
  await mockBackend(page, backend); await page.goto('/flujos/' + first.flow.id);
  await page.getByRole('button', { name: 'Editar flujo', exact: true }).click();
  for (const title of ['Avance uno', 'Avance dos']) {
    await page.getByLabel('Título del nodo', { exact: true }).fill(title);
    await page.getByRole('button', { name: 'Guardar avance', exact: true }).click();
    await expect(page.locator('.wf-message')).toContainText('Avance guardado');
    const saved = backend.request('getFullFlow', { flowId: first.flow.id }).data;
    expect(saved.nodes[0].titulo).toBe(title);
    expect(saved.nodes.map(n => n.id)).toEqual(first.nodes.map(n => n.id));
    expect(saved.edges.map(e => e.id)).toEqual(first.edges.map(e => e.id));
  }
  await page.getByRole('button', { name: 'Cerrar constructor', exact: true }).click();
  await page.reload();
  await expect(page.getByText('152 nodos · 151 conexiones', { exact: true })).toBeVisible();
  expect(backend.request('getAllFlows').data).toHaveLength(1);
});
