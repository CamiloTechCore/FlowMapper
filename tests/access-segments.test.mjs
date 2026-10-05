import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, pbkdf2Sync } from 'node:crypto';
import { createBackend, seedHierarchy, graphPayload } from './gas-harness.mjs';
import { COLLECTION_SEGMENTS, qualitySummary, withSegments } from '../src/workflow/segments.js';
import { fromGraph } from '../src/workflow/model.js';

function authenticatedBackend() {
  const backend = createBackend({ bypassAuth: false });
  const admin = backend.request('login', { correo: 'admin@example.test', password: 'test-password' });
  assert.equal(admin.success, true, admin.error);
  const request = (action, payload = {}) => backend.request(action, { ...payload, sessionToken: admin.data.sessionToken });
  request('saveReader', { password: 'test-password', correo: 'reader@example.test', nombre: 'Lector' });
  const reader = backend.request('login', { correo: 'reader@example.test', password: 'test-password' }).data;
  return { backend, request, admin: admin.data, reader };
}
test('login valida las credenciales de Sheets y solo admite un administrador y lectores autorizados', () => {
  const { backend, request } = authenticatedBackend();
  assert.equal(backend.request('login', { correo: 'admin@example.test', password: 'incorrect-password' }).success, false);
  assert.equal(backend.request('login', { correo: 'unknown@example.test', password: 'test-password' }).success, false);
  assert.equal(backend.request('getTeams').success, false);
  assert.equal(backend.request('setup').success, false);
  assert.equal(request('saveReader', { nombre: 'Otro admin', correo: 'admin@example.test', password: 'test-password' }).success, false);
  const users = request('getUsers').data;
  assert.equal(users.filter(u => u.rol === 'administrador').length, 1);
  assert.equal(backend.request('login', { correo: 'admin@example.test', password: 'test-password' }).success, true);
  assert.equal(request('getUsers').data.length, 2);
});
test('hash PBKDF2 coincide con Node; ninguna respuesta expone credenciales y bootstrap elimina contraseña inicial', () => {
  const { backend, request, admin } = authenticatedBackend();
  const [headers, ...rows] = backend.tables.get('usuarios');
  const record = Object.fromEntries(headers.map((key, i) => [key, rows.find(row => row[headers.indexOf('id')] === admin.user.id)[i]]));
  const key = createHmac('sha256', backend.properties.AUTH_SECRET).update('test-password').digest();
  const credential = JSON.parse(record.passwordEncriptada);
  assert.equal(credential.hash, pbkdf2Sync(key, credential.salt, credential.iterations, 32, 'sha256').toString('base64'));
  assert.equal(credential.iterations, 600000);
  assert.equal(record.passwordTemporal, '');
  assert.equal(backend.properties.ADMIN_PASSWORD, undefined);
  for (const value of [admin, request('getUsers').data, request('getSession').data]) {
    const serialized = JSON.stringify(value);
    assert.doesNotMatch(serialized, /passwordTemporal|passwordEncriptada|passwordHash|passwordSalt|passwordVersion|test-password|AUTH_SECRET/);
  }
  assert.equal(request('getData', { sheet: 'usuarios' }).success, false);
  assert.equal(request('configurarAdministrador').success, false);
  assert.equal(backend.request('login', { correo: ' ADMIN@EXAMPLE.TEST ', password: 'test-password' }).success, true);
});
test('lector se edita por ID, conserva contraseña vacía y cambio de clave o acceso revoca sesiones', () => {
  const { backend, request, reader } = authenticatedBackend();
  const data = { id: reader.user.id, correo: 'lector@example.test', nombre: 'Lector actualizado', password: '' };
  assert.equal(request('saveReader', data).success, true);
  assert.equal(backend.request('login', { correo: data.correo, password: 'test-password' }).success, true);
  assert.equal(request('saveReader', { ...data, correo: 'admin@example.test' }).success, false);
  assert.equal(request('saveReader', { ...data, password: 'corta' }).success, false);
  assert.equal(request('saveReader', { ...data, password: 'nueva-contraseña-segura' }).success, true);
  assert.equal(backend.request('getTeams', { sessionToken: reader.sessionToken }).success, false);
  assert.equal(backend.request('login', { correo: data.correo, password: 'test-password' }).success, false);
  const updated = backend.request('login', { correo: data.correo, password: 'nueva-contraseña-segura' }).data;
  assert.ok(updated.sessionToken);
  request('saveReader', { ...data, activo: false });
  assert.equal(backend.request('login', { correo: data.correo, password: 'nueva-contraseña-segura' }).success, false);
  request('saveReader', { ...data, activo: true });
  assert.equal(backend.request('getTeams', { sessionToken: updated.sessionToken }).success, false);
});
test('cinco fallos bloquean temporalmente el correo; cuentas duplicadas y segundo administrador no acceden', () => {
  const { backend, request } = authenticatedBackend();
  for (let i = 0; i < 5; i++) assert.equal(backend.request('login', { correo: 'unknown@example.test', password: 'wrong-password' }).success, false);
  assert.match(backend.request('login', { correo: 'unknown@example.test', password: 'wrong-password' }).error, /15 minutos/);
  const table = backend.tables.get('usuarios'), headers = table[0];
  const duplicate = table[1].slice(); duplicate[headers.indexOf('id')] = 'second-admin'; table.push(duplicate);
  assert.equal(backend.request('login', { correo: 'admin@example.test', password: 'test-password' }).success, false);
  assert.equal(request('getTeams').success, false);
});
test('actualización de usuarios antiguos conserva IDs y columnas adicionales al configurar contraseñas', () => {
  const backend = createBackend({ bypassAuth: false, configureAdmin: false, sheets: { usuarios: [
    ['id', 'correo', 'nombre', 'rol', 'activo', 'creadoEn', 'actualizadoEn', 'referenciaAnterior'],
    ['admin-original', 'admin@example.test', 'Administrador', 'administrador', true, '2026-01-01', '2026-01-01', 'legacy-admin'],
    ['reader-original', 'reader@example.test', 'Lector', 'lector', true, '2026-01-01', '2026-01-01', 'legacy-reader'],
  ] } });
  assert.equal(backend.configureAdministrator().id, 'admin-original');
  const admin = backend.request('login', { correo: 'admin@example.test', password: 'test-password' }).data;
  assert.equal(backend.request('login', { correo: 'reader@example.test', password: 'test-password' }).success, false);
  const saved = backend.request('saveReader', { id: 'reader-original', correo: 'reader@example.test', nombre: 'Lector', password: 'test-password', sessionToken: admin.sessionToken });
  assert.equal(saved.data.id, 'reader-original');
  assert.equal(backend.request('login', { correo: 'reader@example.test', password: 'test-password' }).data.user.id, 'reader-original');
  const table = backend.tables.get('usuarios');
  assert.equal(table[2][table[0].indexOf('referenciaAnterior')], 'legacy-reader');
});
test('PBKDF2 coincide con Node para Unicode, claves largas, varios bloques de salt y 600.000 iteraciones', () => {
  const backend = createBackend();
  for (const [password, salt, iterations] of [['clave', 'sal', 1], ['clave', 'sal', 2], ['contraseña-ñ-🔐', 'sal'.repeat(30), 4096], ['a'.repeat(200), 'sal-larga'.repeat(10), 10000], ['clave-segura-de-prueba', 'sal-de-prueba', 600000]]) {
    assert.equal(backend.derivePassword(password, salt, iterations), pbkdf2Sync(password, salt, iterations, 32, 'sha256').toString('base64'));
  }
});
test('dos columnas de contraseña: temporal sobreescribe el hash, se vacía y revoca sesiones anteriores', () => {
  const { backend, request, reader } = authenticatedBackend();
  const table = backend.tables.get('usuarios'), columns = table[0];
  assert.deepEqual(columns.filter(c => c.startsWith('password')), ['passwordTemporal', 'passwordEncriptada']);
  const row = table.find(r => r[columns.indexOf('id')] === reader.user.id), encrypted = columns.indexOf('passwordEncriptada'), temporary = columns.indexOf('passwordTemporal');
  const previous = row[encrypted];
  row[temporary] = 'contraseña-temporal-nueva';
  assert.equal(backend.request('getTeams', { sessionToken: reader.sessionToken }).success, false);
  assert.equal(backend.processPasswords().procesados, 1);
  assert.equal(row[temporary], ''); assert.notEqual(row[encrypted], previous);
  assert.equal(backend.processPasswords().procesados, 0);
  assert.equal(backend.request('login', { correo: reader.user.correo, password: 'test-password' }).success, false);
  assert.equal(backend.request('login', { correo: reader.user.correo, password: 'contraseña-temporal-nueva' }).success, true);
  assert.doesNotMatch(JSON.stringify(request('getUsers').data), /contraseña-temporal-nueva|passwordTemporal|passwordEncriptada/);
});
test('trigger de edición procesa solo la columna temporal; fallos no pierden la clave anterior', () => {
  const { backend, reader } = authenticatedBackend();
  const table = backend.tables.get('usuarios'), columns = table[0], index = table.findIndex(r => r[columns.indexOf('id')] === reader.user.id);
  const temporary = columns.indexOf('passwordTemporal'), encrypted = columns.indexOf('passwordEncriptada'), previous = table[index][encrypted];
  table[index][temporary] = 'clave-editada-en-sheet';
  backend.editUsers(index + 1, 3); assert.equal(table[index][encrypted], previous);
  backend.failNextWrite('usuarios'); assert.throws(() => backend.editUsers(index + 1, temporary + 1), /Fallo de escritura/);
  assert.equal(table[index][encrypted], previous); assert.equal(table[index][temporary], 'clave-editada-en-sheet');
  backend.editUsers(index + 1, temporary + 1);
  assert.equal(table[index][temporary], ''); assert.notEqual(table[index][encrypted], previous);
  table[index][temporary] = 'corta'; const current = table[index][encrypted];
  assert.throws(() => backend.processPasswords(), /12 y 256/); assert.equal(table[index][encrypted], current); assert.equal(table[index][temporary], 'corta');
});
test('instalar el trigger varias veces no duplica el procesamiento y no lo expone por HTTP', () => {
  const backend = createBackend();
  assert.equal(backend.installUsersTrigger().instalado, true);
  backend.installUsersTrigger();
  assert.equal(backend.triggers.length, 1);
  assert.equal(backend.triggers[0].getHandlerFunction(), 'alEditarUsuarios');
  assert.equal(backend.request('instalarTriggerUsuarios').success, false);
  assert.equal(backend.request('procesarContraseñasTemporales').success, false);
});
test('hash importado permite iniciar sin secreto previo y se refuerza en el primer acceso', () => {
  const password = 'clave-importada-de-prueba', salt = 'sal-importada-de-prueba';
  const credential = { scheme: 'pbkdf2-hmac-sha256-v2', iterations: 600000, salt, hash: pbkdf2Sync(password, salt, 600000, 32, 'sha256').toString('base64'), version: 'seed-version', pepper: false };
  const backend = createBackend({ bypassAuth: false, configureAdmin: false, properties: {}, sheets: { usuarios: [
    ['id','correo','nombre','rol','activo','creadoEn','actualizadoEn','passwordTemporal','passwordEncriptada'],
    ['admin-importado','importado@example.test','Administrador','administrador',true,'2026-01-01','2026-01-01','',JSON.stringify(credential)],
  ] } });
  const result = backend.request('login', { correo: 'importado@example.test', password });
  assert.equal(result.success, true, result.error); assert.ok(backend.properties.AUTH_SECRET);
  const saved = JSON.parse(backend.tables.get('usuarios')[1][8]);
  assert.equal(saved.pepper, true); assert.notEqual(saved.version, credential.version); assert.notEqual(saved.hash, credential.hash);
  assert.equal(backend.request('getSession', { sessionToken: result.data.sessionToken }).success, true);
});
test('contraseña de 1.6.0 migra al formato de dos columnas y conserva el acceso', () => {
  const secret = 'secreto-privado-de-prueba', password = 'test-password', salt = 'sal-heredada';
  const key = createHmac('sha256', secret).update(password).digest();
  const hash = pbkdf2Sync(key, salt, 10000, 32, 'sha256').toString('base64');
  const backend = createBackend({ bypassAuth: false, configureAdmin: false, properties: { AUTH_SECRET: secret }, sheets: { usuarios: [
    ['id','correo','nombre','rol','activo','creadoEn','actualizadoEn','passwordHash','passwordSalt','passwordVersion'],
    ['admin-anterior','anterior@example.test','Administrador','administrador',true,'2026-01-01','2026-01-01',hash,salt,'old-version'],
  ] } });
  assert.equal(backend.request('login', { correo: 'anterior@example.test', password }).success, true);
  const table = backend.tables.get('usuarios'), credential = JSON.parse(table[1][table[0].indexOf('passwordEncriptada')]);
  assert.equal(credential.iterations, 600000); assert.equal(credential.pepper, true); assert.equal(table[1][0], 'admin-anterior');
});
test('lector consulta el grafo y no puede usar ninguna ruta de escritura ni acceder a hojas privadas', () => {
  const { backend, request, reader } = authenticatedBackend();
  const team = request('createTeam', { nombre: 'Equipo' }).data;
  const process = request('createProcess', { nombre: 'Proceso', teamId: team.id }).data;
  const graph = request('saveFullFlow', graphPayload(team, process)).data;
  const read = (action, data = {}) => backend.request(action, { ...data, sessionToken: reader.sessionToken });
  assert.equal(read('getFullFlow', { flowId: graph.flow.id }).data.nodes.length, 4);
  for (const action of ['setup','createTeam','updateTeam','deleteTeam','createProcess','updateProcess','deleteProcess','createFlow','updateFlow','deleteFlow','createNode','updateNode','deleteNode','batchCreateNodes','createEdge','deleteEdge','batchCreateEdges','saveFullFlow','insertRow','saveFolder','deleteFolder','saveReader']) {
    const result = read(action, { id: team.id, sheet: 'equipos', payload: { nombre: 'Intruso' } });
    assert.equal(result.success, false, action); assert.match(result.error, /FORBIDDEN/, action);
  }
  for (const name of ['meta', ' META ', 'usuarios', 'USUARIOS']) assert.equal(read('getData', { sheet: name }).success, false, name);
  assert.equal(read('getUsers').success, false);
  assert.equal(read('getSchemaStatus').success, false);
  assert.equal(read('logout').success, true);
  assert.equal(read('getTeams').success, false);
});
test('desactivar lector o vencer la sesión revoca el acceso en backend', () => {
  const { backend, request, reader, admin } = authenticatedBackend();
  request('saveReader', { password: 'test-password', nombre: 'Lector', correo: 'reader@example.test', activo: false });
  assert.equal(backend.request('getTeams', { sessionToken: reader.sessionToken }).success, false);
  const key = 'session:' + admin.sessionToken;
  backend.cache.set(key, JSON.stringify({ userId: admin.user.id, expiresAt: Date.now() - 1 }));
  assert.equal(request('getTeams').success, false);
});
test('carpetas organizan equipos sin alterar etiquetas, IDs ni relaciones existentes', () => {
  const backend = createBackend(), { team, process } = seedHierarchy(backend);
  const folder = backend.request('saveFolder', { nombre: 'Cliente' }).data;
  const updated = backend.request('updateTeam', { id: team.id, carpetaId: folder.id, etiqueta: '#Cobranza' }).data;
  assert.equal(updated.carpetaId, folder.id); assert.equal(updated.id, team.id);
  assert.equal(backend.request('getTeams').data[0].etiqueta, '#Cobranza');
  assert.equal(backend.request('getProcesses').data[0].id, process.id);
  assert.equal(backend.request('deleteFolder', { id: folder.id }).success, false);
  assert.equal(backend.request('updateTeam', { id: team.id, carpetaId: 'missing' }).success, false);
  backend.request('updateTeam', { id: team.id, carpetaId: '' });
  assert.equal(backend.request('deleteFolder', { id: folder.id }).success, true);
});
test('segmentos, calidad y mejoras se guardan con el grafo y se revierten ante un fallo', () => {
  const backend = createBackend(), { team, process } = seedHierarchy(backend);
  const payload = graphPayload(team, process);
  payload.flow.segmentos = structuredClone(COLLECTION_SEGMENTS);
  payload.nodes.forEach(n => { n.metadata = { segmentId: 'registro', calidad: { estado: 'cumple' }, oportunidad: 'Precisar la tipificación' }; });
  let graph = backend.request('saveFullFlow', payload).data;
  assert.deepEqual(backend.request('getFullFlow', { flowId: graph.flow.id }).data.flow.segmentos, COLLECTION_SEGMENTS);
  const copy = structuredClone(graph);
  const edit = { flow: { ...copy.flow, segmentos: copy.flow.segmentos.map(s => ({ ...s, nombre: s.nombre + ' actualizado' })) }, nodes: copy.nodes.map(n => ({ ...n, _tempId: n.id })), edges: copy.edges.map(e => ({ ...e, _tempId: e.id })) };
  edit.nodes[0].metadata.calidad = { estado: 'no_aplica' };
  assert.equal(backend.request('saveFullFlow', edit).success, false);
  edit.nodes[0].metadata.calidad.justificacion = 'Cliente cortó la interacción';
  backend.failNextWrite('meta');
  assert.equal(backend.request('saveFullFlow', edit).success, false);
  assert.deepEqual(backend.request('getFullFlow', { flowId: graph.flow.id }).data, graph);
  graph = backend.request('saveFullFlow', edit).data;
  assert.equal(graph.nodes[0].id, edit.nodes[0].id);
  edit.flow.segmentos = [];
  assert.equal(backend.request('saveFullFlow', edit).success, false);
});
test('matriz no infla cumplimiento por excepciones y exige segmentación y criterios completos', () => {
  const segments = COLLECTION_SEGMENTS.slice(0, 2);
  const nodes = [{ metadata: { segmentId: 'presentacion', calidad: { estado: 'cumple' } } }, { metadata: { segmentId: 'mensaje', calidad: { estado: 'no_aplica', justificacion: 'Corte de interacción' } } }];
  let result = qualitySummary(nodes, segments);
  assert.equal(result.percent, 100); assert.equal(result.complete, true);
  assert.equal(result.results[1].percent, null);
  result = qualitySummary([...nodes, { metadata: {} }], segments);
  assert.equal(result.percent, 50); assert.equal(result.complete, false);
  const emptyCriteria = segments.map(s => ({ ...s, criterio: '' }));
  assert.equal(qualitySummary(nodes, emptyCriteria).complete, false);
});
test('transiciones presentan criterio y color sin alterar la conexión persistida', () => {
  const graph = fromGraph({ nodes: [{ id: 'a', tipo: 'paso', metadata: { segmentId: 'presentacion' } }, { id: 'b', tipo: 'paso', metadata: { segmentId: 'mensaje' } }], edges: [{ id: 'edge', sourceId: 'a', targetId: 'b', sourceHandle: 'bottom', targetHandle: 'top', etiqueta: 'Continuar' }] });
  const display = withSegments(graph.nodes, graph.edges, COLLECTION_SEGMENTS);
  assert.match(display.edges[0].data.transition.criterio, /Titularidad/);
  assert.equal(display.edges[0].style.stroke, '#0891B2');
  assert.equal(graph.edges[0].label, 'Continuar');
});
