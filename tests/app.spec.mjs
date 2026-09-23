import { test, expect } from '@playwright/test';
import { createBackend, seedHierarchy, graphPayload } from './gas-harness.mjs';
import { addNode, connect } from './editor-helpers.mjs';

async function mockBackend(page, backend) {
  // Intercepta cada llamada GAS antes de salir del navegador; nunca escribe en la URL real.
  await page.route('https://script.google.com/**', async route => {
    const request = route.request();
    const payload = request.method() === 'POST' ? request.postDataJSON() : Object.fromEntries(new URL(request.url()).searchParams);
    const { action, ...data } = payload;
    await route.fulfill({ json: backend.request(action, data, request.method()) });
  });
}

test('crear equipo, proceso y flujo; recorrerlo y recuperarlo tras recargar', async ({ page }) => {
  const backend = createBackend(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await mockBackend(page, backend);
  await page.goto('/equipos');
  await page.getByRole('button', { name: '+ Nuevo Equipo', exact: true }).click();
  await page.getByPlaceholder('Ej: Equipo de Soporte').fill('Equipo QA');
  await page.getByRole('button', { name: '✓ Crear Equipo', exact: true }).click();
  await page.getByText('Equipo QA', { exact: true }).last().click();
  await page.getByRole('button', { name: '+ Proceso', exact: true }).click();
  await page.getByPlaceholder('Ej: Gestión de Tickets').fill('Proceso QA');
  await page.getByRole('button', { name: '✓ Crear Proceso', exact: true }).click();
  await page.getByRole('button', { name: '+ Flujo', exact: true }).click();
  await page.getByPlaceholder('Ej: Atención de Ticket Técnico').fill('Flujo QA');
  const process = backend.request('getAllProcesses').data[0];
  await page.getByLabel('Proceso', { exact: true }).selectOption(process.id);
  await page.getByLabel('Título del nodo', { exact: true }).fill('Inicio');
  await addNode(page, 'Actividad', 'Validar solicitud');
  await addNode(page, 'Fin');
  await connect(page, 'Inicio', 'Validar solicitud');
  await connect(page, 'Validar solicitud', 'Fin');
  await page.getByRole('button', { name: 'Guardar flujo', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: '▶ Recorrer', exact: true }).click();
  await expect(page.getByText('Inicio', { exact: true }).last()).toBeVisible();
  await page.getByRole('button', { name: '→ Continuar', exact: true }).click();
  await expect(page.getByText('Validar solicitud', { exact: true }).last()).toBeVisible();
  await page.getByRole('button', { name: '→ Continuar', exact: true }).click();
  await expect(page.getByText('✓ Fin del recorrido', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('3 nodos · 2 conexiones', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Mapa navegable del flujo')).toBeVisible();
  expect(errors).toEqual([]);
  const graph = backend.request('getFullFlow', { flowId: backend.request('getAllFlows').data[0].id }).data;
  expect(graph.edges.every(e => graph.nodes.some(n => n.id === e.sourceId) && graph.nodes.some(n => n.id === e.targetId))).toBe(true);
});

test('las ramas de decisión recorren destinos distintos y la galería filtra', async ({ page }) => {
  const backend = createBackend(), { team, process } = seedHierarchy(backend);
  const graph = backend.request('saveFullFlow', graphPayload(team, process)).data;
  await mockBackend(page, backend); await page.goto('/');
  await expect(page.getByText('Resolver ticket', { exact: true })).toBeVisible();
  await page.getByPlaceholder('🔍 Buscar flujo...').fill('inexistente');
  await expect(page.getByText('No hay flujos', { exact: true })).toBeVisible();
  await page.goto('/flujos/' + graph.flow.id);
  await page.getByRole('button', { name: '▶ Recorrer', exact: true }).click();
  await page.getByRole('button', { name: '→ Continuar', exact: true }).click();
  await page.getByRole('button', { name: '✗ No', exact: true }).click();
  await expect(page.getByText('Escalar', { exact: true }).last()).toBeVisible();
});

test('un backend HTML muestra error comprensible y no conexión exitosa', async ({ page }) => {
  await page.route('https://script.google.com/**', route => route.fulfill({ contentType: 'text/html', body: '<html>Login</html>' }));
  await page.goto('/configuracion');
  await page.getByRole('button', { name: '🔌 Probar Conexión', exact: true }).click();
  await expect(page.getByText(/✗ GAS no devolvió JSON/)).toBeVisible();
  await expect(page.getByText('● GAS Conectado', { exact: true })).toHaveCount(0);
});

test('la navegación y los formularios caben en móvil', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockBackend(page, createBackend()); await page.goto('/equipos');
  await page.getByRole('button', { name: '+ Nuevo Equipo', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
});
