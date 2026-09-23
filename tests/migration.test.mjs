import test from 'node:test';
import assert from 'node:assert/strict';
import { createBackend, graphPayload } from './gas-harness.mjs';

function legacySheets() {
  return {
    Equipos: [
      ['id', 'nombre', 'descripcion', 'color', 'icono', 'creadoEn', 'actualizadoEn'],
      ['eq_original', 'Equipo existente', 'Conservar', '#c084fc', '👥', '2025-01-01', '2025-01-02'],
    ],
    Procesos: [
      ['id', 'teamId', 'nombre', 'descripcion', 'orden', 'creadoEn', 'actualizadoEn'],
      ['proc_original', 'eq_original', 'Proceso existente', '', 0, '2025-01-01', '2025-01-02'],
    ],
    Flujos: [
      ['id', 'processId', 'teamId', 'nombre', 'descripcion', 'version', 'estado', 'creadoEn', 'actualizadoEn'],
      ['flow_original', 'proc_original', 'eq_original', 'Flujo existente', '', '2.0', 'activo', '2025-01-01', '2025-01-02'],
    ],
    Nodos: [
      ['id', 'flowId', 'tipo', 'titulo', 'descripcion', 'posX', 'posY', 'posZ', 'metadata', 'creadoEn', 'notaExtra'],
      ['node_original', 'flow_original', 'inicio', 'Inicio existente', 'No mover', 0, -2, 3, '{"conditions":["positivo"],"custom":42}', '2025-01-01', '=1+2'],
    ],
    Conexiones: [['id', 'flowId', 'sourceId', 'targetId', 'condicion', 'etiqueta', 'creadoEn']],
  };
}

test('diagnosticar un esquema antiguo no modifica ni crea hojas', () => {
  const sheets = legacySheets(), backend = createBackend({ sheets, initialize: false });
  const result = backend.request('getSchemaStatus');
  assert.equal(result.success, true); assert.equal(result.data.requiereMigracion, true);
  const nodes = result.data.sheets.find(s => s.tabla === 'nodos');
  assert.equal(nodes.hoja, 'Nodos'); assert.deepEqual(nodes.columnasFaltantes, ['refFlowId', 'actualizadoEn']);
  assert.deepEqual(Object.fromEntries(backend.tables), sheets);
  assert.equal(backend.events.length, 0);
});

test('migrar conserva nombres, IDs, metadata, fechas y columnas extra; respalda antes de escribir', () => {
  const sheets = legacySheets(), backend = createBackend({ sheets, initialize: false });
  const result = backend.request('setup'); assert.equal(result.success, true, result.error);
  assert.equal(result.data.backups.length, 2);
  assert.deepEqual(backend.tables.get(result.data.backups[0]), sheets.Nodos);
  assert.deepEqual(backend.tables.get('Nodos')[0], [...sheets.Nodos[0], 'refFlowId', 'actualizadoEn']);
  assert.deepEqual(backend.tables.get('Nodos')[1], sheets.Nodos[1]);
  assert.equal(backend.tables.has('nodos'), false); assert.equal(backend.tables.has('equipos'), false);
  const graph = backend.request('getFullFlow', { flowId: 'flow_original' }).data;
  assert.equal(graph.nodes[0].id, 'node_original'); assert.equal(graph.nodes[0].metadata.custom, 42);
  assert.equal(graph.nodes[0].creadoEn, '2025-01-01'); assert.equal(graph.nodes[0].posX, 0);
  const copy = backend.events.findIndex(e => e.type === 'backup');
  const write = backend.events.findIndex(e => e.type === 'write');
  assert.ok(copy >= 0 && copy < write);
  assert.equal(backend.request('getSchemaStatus').data.requiereMigracion, false);
});

test('migración repetida no duplica columnas, registros ni respaldos y conserva inicializadoEn', () => {
  const backend = createBackend({ sheets: legacySheets() });
  const nodes = structuredClone(backend.tables.get('Nodos'));
  const backups = [...backend.tables.keys()].filter(n => n.startsWith('_backup_'));
  const initialized = backend.request('getData', { sheet: 'meta' }).data.find(r => r.clave === 'inicializadoEn');
  const result = backend.runSetup(); assert.equal(result.ok, true); assert.equal(result.backups.length, 0);
  assert.deepEqual(backend.tables.get('Nodos'), nodes);
  assert.deepEqual([...backend.tables.keys()].filter(n => n.startsWith('_backup_')), backups);
  assert.deepEqual(backend.request('getData', { sheet: 'meta' }).data.find(r => r.clave === 'inicializadoEn'), initialized);
});

test('CRUD usa nombres de columnas después de migrar y conserva la fórmula extra', () => {
  const backend = createBackend({ sheets: legacySheets() });
  const updated = backend.request('updateNode', { id: 'node_original', titulo: 'Actualizado', refFlowId: 'flow_original', metadata: { custom: 99 }, posY: 0 });
  assert.equal(updated.success, true, updated.error);
  const graph = backend.request('getFullFlow', { flowId: 'flow_original' }).data;
  assert.equal(graph.nodes[0].metadata.custom, 99); assert.equal(graph.nodes[0].refFlowId, 'flow_original');
  assert.equal(graph.nodes[0].posY, 0); assert.equal(graph.nodes[0].notaExtra, '=1+2');
  assert.equal(graph.nodes[0].creadoEn, '2025-01-01');
  const saved = backend.request('saveFullFlow', graphPayload({ id: 'eq_original' }, { id: 'proc_original' }));
  assert.equal(saved.success, true, saved.error);
  assert.equal(backend.request('getFullFlow', { flowId: saved.data.flow.id }).data.edges.length, 4);
  assert.equal(backend.request('deleteFlow', { id: saved.data.flow.id }).success, true);
  assert.equal(backend.request('getNodes').data.length, 1);
});

test('cabeceras reordenadas y clave fuera de primera columna funcionan en lecturas y escrituras', () => {
  const sheets = legacySheets();
  for (const rows of Object.values(sheets)) rows.forEach(row => row.reverse());
  const backend = createBackend({ sheets });
  assert.equal(backend.request('updateTeam', { id: 'eq_original', nombre: 'Renombrado' }).success, true);
  assert.equal(backend.request('getTeams').data[0].nombre, 'Renombrado');
  assert.equal(backend.request('updateProcess', { id: 'proc_original', orden: 7 }).data.orden, 7);
  assert.equal(backend.request('updateFlow', { id: 'flow_original', version: '3.0' }).data.version, '3.0');
  assert.equal(backend.request('deleteNode', { id: 'node_original' }).success, true);
  assert.equal(backend.request('getNodes').data.length, 0);
});

test('API antigua acepta IDs y fechas existentes y devuelve el registro creado', () => {
  const backend = createBackend({ sheets: legacySheets() });
  const team = backend.request('insertRow', { sheet: 'Equipos', payload: { id: 'eq_legacy', nombre: 'Antiguo', creadoEn: '2024-01-01' } });
  assert.equal(team.success, true, team.error); assert.equal(team.data.id, 'eq_legacy'); assert.equal(team.data.creadoEn, '2024-01-01');
  assert.equal(team.message, 'Registro creado con éxito');
  const process = backend.request('insertRow', { sheet: 'Procesos', payload: { id: 'p_legacy', teamId: 'eq_legacy', nombre: 'Proceso' } });
  assert.equal(process.success, true, process.error);
  assert.ok(backend.request('getData', { sheet: 'EQUIPOS' }).data.some(t => t.id === 'eq_legacy'));
  assert.equal(backend.request('insertRow', { sheet: 'Equipos', payload: { id: 'eq_legacy' } }).success, false);
  assert.equal(backend.request('getData', { sheet: 'HojaPrivada' }).success, false);
  assert.equal(backend.request('insertRow', { sheet: 'meta', payload: { clave: 'version' } }).success, false);
});

test('esquema sin migrar rechaza guardado antes de crear un flujo parcial', () => {
  const backend = createBackend({ sheets: legacySheets(), initialize: false });
  const before = structuredClone(backend.tables.get('Flujos'));
  const result = backend.request('saveFullFlow', graphPayload({ id: 'eq_original' }, { id: 'proc_original' }));
  assert.equal(result.success, false); assert.match(result.error, /crearBaseDeDatos/);
  assert.deepEqual(backend.tables.get('Flujos'), before);
});

test('una cabecera duplicada detiene toda la migración antes de cualquier escritura', () => {
  const sheets = legacySheets(); sheets.Conexiones[0].push('id');
  const backend = createBackend({ sheets, initialize: false });
  const result = backend.request('setup'); assert.equal(result.success, false); assert.match(result.error, /duplicadas/);
  assert.deepEqual(Object.fromEntries(backend.tables), sheets);
  assert.equal(backend.events.filter(e => e.type === 'write' || e.type === 'backup').length, 0);
});

test('IDs duplicados o ausentes en registros existentes detienen la migración', () => {
  for (const id of ['eq_original', '']) {
    const sheets = legacySheets(); sheets.Equipos.push([id, 'Registro adicional']);
    const backend = createBackend({ sheets, initialize: false });
    const result = backend.request('setup'); assert.equal(result.success, false); assert.match(result.error, /Identificador/);
    assert.deepEqual(Object.fromEntries(backend.tables), sheets);
  }
});

test('respaldo fallido conserva las hojas originales y libera el bloqueo', () => {
  const sheets = legacySheets(), backend = createBackend({ sheets, initialize: false });
  backend.failNextCopy(); assert.equal(backend.request('setup').success, false);
  assert.deepEqual(Object.fromEntries(backend.tables), sheets);
  assert.equal(backend.request('setup').success, true);
});

test('fallo al añadir columnas conserva los datos y permite reintentar con el respaldo disponible', () => {
  const sheets = legacySheets(), backend = createBackend({ sheets, initialize: false });
  backend.failNextWrite('Nodos'); const result = backend.request('setup');
  assert.equal(result.success, false); assert.deepEqual(backend.tables.get('Nodos'), sheets.Nodos);
  const copy = [...backend.tables.keys()].find(n => n.startsWith('_backup_nodos_'));
  assert.deepEqual(backend.tables.get(copy), sheets.Nodos);
  assert.equal(backend.request('setup').success, true);
});

test('nombres ambiguos de pestañas no se combinan ni se descartan', () => {
  const sheets = legacySheets(); sheets[' equipos '] = structuredClone(sheets.Equipos);
  const backend = createBackend({ sheets, initialize: false });
  assert.match(backend.request('setup').error, /ambiguas/);
  assert.deepEqual(Object.fromEntries(backend.tables), sheets);
});

test('abrir exec sin action responde ping y la migración por GET está prohibida', () => {
  const backend = createBackend();
  const result = backend.request(undefined, {}, 'GET');
  assert.equal(result.data.pong, true); assert.equal(result.data.version, '1.3.1');
  assert.equal(backend.request('setup', {}, 'GET').success, false);
  assert.equal(backend.request('insertRow', { sheet: 'Equipos', payload: { nombre: 'No insertar' } }, 'GET').success, false);
});
