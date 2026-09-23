// ╔══════════════════════════════════════════════════════════════╗
// ║  FlowMapper — Google Apps Script Backend                     ║
// ║  Spreadsheet ID fijo — No requiere abrir desde Sheets        ║
// ║  Despliega como WebApp y copia la URL en el .env del cliente ║
// ╚══════════════════════════════════════════════════════════════╝

const SPREADSHEET_ID = '12-RXAOuu_sVS479CdrhjBeKO9Tdej-93lhe6gPEnku0';
const API_VERSION = '1.2.0';

const SHEETS = {
  TEAMS:     'equipos',
  PROCESSES: 'procesos',
  FLOWS:     'flujos',
  NODES:     'nodos',
  EDGES:     'conexiones',
  META:      'meta',
};

const HEADERS = {
  equipos:    ['id','nombre','descripcion','color','icono','creadoEn','actualizadoEn'],
  procesos:   ['id','teamId','nombre','descripcion','orden','creadoEn','actualizadoEn'],
  flujos:     ['id','processId','teamId','nombre','descripcion','version','estado','creadoEn','actualizadoEn'],
  nodos:      ['id','flowId','tipo','titulo','descripcion','posX','posY','posZ','refFlowId','metadata','creadoEn','actualizadoEn'],
  conexiones: ['id','flowId','sourceId','targetId','condicion','etiqueta','creadoEn','tipo','sourceHandle','targetHandle'],
  meta:       ['clave','valor','actualizadoEn'],
};

// ══════════════════════════════════════════════════════════════════
//  CREAR / VERIFICAR BASE DE DATOS
// ══════════════════════════════════════════════════════════════════
function crearBaseDeDatos() {
  return _withWriteLock(_setupSpreadsheet);
}

// Conserva el nombre de la función que utilizaba el script anterior.
function setupSpreadsheet() { return crearBaseDeDatos(); }

function _withWriteLock(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { return fn(); }
  finally {
    try { SpreadsheetApp.flush(); }
    finally { lock.releaseLock(); }
  }
}

function _canonicalSheet(name) {
  const key = String(name || '').trim().toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(HEADERS, key)) throw new Error('Hoja no permitida: ' + name);
  return key;
}

// Conserva los nombres existentes (Equipos, Nodos...) y evita crear tablas paralelas.
function _resolveSheet(ss, name) {
  const key = _canonicalSheet(name);
  const matches = ss.getSheets().filter(sheet => sheet.getName().trim().toLowerCase() === key);
  if (matches.length > 1) throw new Error('Hojas ambiguas para ' + key + ': ' + matches.map(s => s.getName()).join(', '));
  return matches[0] || null;
}

function _columnNames(sheet) {
  if (!sheet.getLastRow()) return [];
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
  if (headers.some(h => !h) || new Set(headers).size !== headers.length) {
    throw new Error('Cabeceras vacías o duplicadas en ' + sheet.getName() + '. No se modificó su estructura.');
  }
  return headers;
}

function _migrationPlan(ss) {
  return Object.entries(HEADERS).map(([name, required]) => {
    const sheet = _resolveSheet(ss, name);
    const headers = sheet ? _columnNames(sheet) : [];
    if (sheet && sheet.getLastRow() > 1) {
      const key = name === 'meta' ? 'clave' : 'id';
      if (!headers.includes(key)) throw new Error('Falta la columna ' + key + ' en ' + sheet.getName() + '. Revisa los datos antes de migrar.');
      const values = sheet.getDataRange().getValues().slice(1);
      const used = new Set();
      values.forEach((row, index) => {
        if (row.every(value => value === '' || value == null)) return;
        const id = String(row[headers.indexOf(key)] ?? '').trim();
        if (!id || used.has(id)) throw new Error('Identificador vacío o duplicado en ' + sheet.getName() + ', fila ' + (index + 2));
        used.add(id);
      });
    }
    return { name, sheet, headers, missing: required.filter(h => !headers.includes(h)) };
  });
}

// Diagnóstico sin escrituras. Se puede ejecutar manualmente antes de la migración.
function validarBaseDeDatos() {
  const sheets = _migrationPlan(_ss()).map(plan => ({
    tabla: plan.name, hoja: plan.sheet ? plan.sheet.getName() : null,
    filas: plan.sheet ? Math.max(0, plan.sheet.getLastRow() - 1) : 0,
    columnasFaltantes: plan.missing,
  }));
  const result = { ok: true, version: API_VERSION, requiereMigracion: sheets.some(s => s.columnasFaltantes.length), sheets };
  Logger.log(JSON.stringify(result));
  return result;
}

function _setupSpreadsheet() {
  const ss = _ss(), log = [], backups = [];
  // Valida TODAS las tablas antes de crear copias o modificar una cabecera.
  const plans = _migrationPlan(ss);
  // Copia todas las tablas que cambiarán antes de iniciar la migración.
  plans.filter(p => p.sheet && p.headers.length && p.missing.length).forEach(plan => {
    const backupName = '_backup_' + plan.name + '_' + Date.now() + '_' + _uid().slice(0, 8);
    plan.sheet.copyTo(ss).setName(backupName);
    backups.push(backupName);
    log.push('RESPALDO: ' + backupName);
  });
  SpreadsheetApp.flush();
  plans.forEach(plan => {
    const sheet = plan.sheet || ss.insertSheet(plan.name);
    if (!plan.sheet) log.push('CREADA: ' + plan.name);
    if (plan.missing.length) {
      const width = plan.headers.length + plan.missing.length;
      if (width > sheet.getMaxColumns()) sheet.insertColumnsAfter(sheet.getMaxColumns(), width - sheet.getMaxColumns());
      // Solo añade columnas al final. No mueve ni reescribe las celdas antiguas.
      sheet.getRange(1, plan.headers.length + 1, 1, plan.missing.length).setValues([plan.missing])
        .setBackground('#1a0a2e').setFontColor('#c084fc').setFontWeight('bold').setFontSize(10);
      if (!plan.headers.length) {
        sheet.setFrozenRows(1);
        sheet.setRowHeight(1, 32);
        const protection = sheet.getRange(1, 1, 1, width).protect();
        protection.setDescription('Cabeceras — No modificar');
        protection.setWarningOnly(true);
      }
      log.push('ADAPTADA: ' + sheet.getName() + ' — ' + plan.missing.join(', '));
    } else log.push('OK: ' + sheet.getName());
  });
  _upsertMeta('version', API_VERSION);
  if (!_rows('meta').some(row => row.clave === 'inicializadoEn')) _upsertMeta('inicializadoEn', _now());
  _upsertMeta('spreadsheetId', SPREADSHEET_ID);
  if (backups.length) _upsertMeta('ultimoRespaldo', JSON.stringify(backups));
  Logger.log(log.join('\n'));
  return { ok: true, version: API_VERSION, log, backups };
}

function _upsertMeta(clave, valor) {
  const ri = _findRow('meta', clave);
  const row = [clave, valor, _now()];
  if (ri < 0) _appendMapped('meta', row);
  else _updateMapped('meta', ri, row);
}

// ══════════════════════════════════════════════════════════════════
//  PUNTO DE ENTRADA HTTP
// ══════════════════════════════════════════════════════════════════
function doGet(e)  { return _route(e, false); }
function doPost(e) { return _route(e, true); }

function _route(e = {}, allowWrites = false) {
  const out = ContentService.createTextOutput().setMimeType(ContentService.MimeType.JSON);
  try {
    let p = {};
    if (e.postData && e.postData.contents) {
      p = JSON.parse(e.postData.contents);
    } else if (e.parameter) {
      p = e.parameter;
      ['metadata','conditions'].forEach(k => {
        if (p[k] && typeof p[k] === 'string') {
          try { p[k] = JSON.parse(p[k]); } catch(_) {}
        }
      });
    }
    if (!p || typeof p !== 'object' || Array.isArray(p)) throw new Error('Solicitud JSON inválida');
    if (!p.action && !allowWrites) p.action = 'ping';
    if (!p.action) throw new Error('"action" requerido');
    const isRead = /^(get|ping)/.test(p.action);
    if (!isRead && !allowWrites) throw new Error('Las escrituras requieren POST');

    const map = {
      ping:              () => ({ pong: true, version: API_VERSION, ts: _now() }),
      setup:             () => _setupSpreadsheet(),
      getSchemaStatus:   () => validarBaseDeDatos(),
      getData:           () => _rows(_canonicalSheet(p.sheet)),
      insertRow:         () => _legacyInsert(p.sheet, p.payload),
      getStats:          () => _getStats(),
      // Equipos
      getTeams:          () => _rows('equipos'),
      createTeam:        () => _createTeam(p),
      updateTeam:        () => _updateTeam(p),
      deleteTeam:        () => _delete('equipos', p.id),
      // Procesos
      getProcesses:      () => _rows('procesos').filter(r => !p.teamId || r.teamId === p.teamId),
      getAllProcesses:    () => _rows('procesos'),
      createProcess:     () => _createProcess(p),
      updateProcess:     () => _updateProcess(p),
      deleteProcess:     () => _delete('procesos', p.id),
      // Flujos
      getFlows:          () => _rows('flujos').filter(r => !p.processId || r.processId === p.processId),
      getAllFlows:        () => _rows('flujos'),
      createFlow:        () => _createFlow(p),
      updateFlow:        () => _updateFlow(p),
      deleteFlow:        () => _delete('flujos', p.id),
      // Nodos
      getNodes:          () => _rows('nodos').filter(r => !p.flowId || r.flowId === p.flowId).map(_parseMeta),
      createNode:        () => _createNode(p),
      updateNode:        () => _updateNode(p),
      deleteNode:        () => _delete('nodos', p.id),
      batchCreateNodes:  () => (p.nodes||[]).map(n => _createNode({...n, flowId: p.flowId})),
      // Conexiones
      getEdges:          () => _rows('conexiones').filter(r => !p.flowId || r.flowId === p.flowId),
      createEdge:        () => _createEdge(p),
      deleteEdge:        () => _delete('conexiones', p.id),
      batchCreateEdges:  () => (p.edges||[]).map(e => _createEdge({...e, flowId: p.flowId})),
      // Grafo completo
      getFullFlow:       () => _getFullFlow(p.flowId),
      saveFullFlow:      () => _saveFullFlow(p),
    };

    const fn = Object.prototype.hasOwnProperty.call(map, p.action) && map[p.action];
    if (!fn) throw new Error('Acción desconocida: ' + p.action);
    const data = isRead ? fn() : _withWriteLock(fn);
    out.setContent(JSON.stringify({ success: true, data, ...(p.action === 'insertRow' ? { message: 'Registro creado con éxito' } : {}) }));
  } catch(err) {
    out.setContent(JSON.stringify({ success: false, error: err.message }));
  }
  return out;
}

// ══════════════════════════════════════════════════════════════════
//  UTILIDADES
// ══════════════════════════════════════════════════════════════════
const _ss    = () => SpreadsheetApp.openById(SPREADSHEET_ID);
const _sheet = n  => { const s = _resolveSheet(_ss(), n); if(!s) throw new Error('Hoja "'+n+'" no existe. Ejecuta crearBaseDeDatos()'); return s; };
const _uid   = () => Utilities.getUuid();
const _now   = () => new Date().toISOString();
const _rObj  = (headers, row) => { const o={}; headers.forEach((h,i)=>{ o[h]=row[i]??null; }); return o; };

function _rows(name) {
  const s = _sheet(name); const d = s.getDataRange().getValues();
  if (d.length<=1) return [];
  const h = _columnNames(s), key = h.indexOf(_canonicalSheet(name) === 'meta' ? 'clave' : 'id');
  if (key < 0) throw new Error('Falta identificador en ' + s.getName());
  return d.slice(1).filter(r=>r[key]!==''&&r[key]!=null).map(r=>_rObj(h,r));
}

function _findRow(name, id) {
  const s = _sheet(name), v = s.getDataRange().getValues();
  const column = _columnNames(s).indexOf(_canonicalSheet(name) === 'meta' ? 'clave' : 'id');
  if (column < 0) throw new Error('Falta identificador en ' + s.getName());
  for (let i=1;i<v.length;i++) if(String(v[i][column])===String(id)) return i+1;
  return -1;
}

function _writeColumns(name) {
  const sheet = _sheet(name), columns = _columnNames(sheet);
  const missing = HEADERS[_canonicalSheet(name)].filter(h => !columns.includes(h));
  if (missing.length) throw new Error('Ejecuta crearBaseDeDatos() antes de guardar: faltan ' + missing.join(', ') + ' en ' + sheet.getName());
  return { sheet, columns };
}

// Escrituras por nombre de campo: compatibles con columnas antiguas, reordenadas o extra.
function _appendMapped(name, row) {
  const { sheet, columns } = _writeColumns(name);
  const record = _rObj(HEADERS[_canonicalSheet(name)], row);
  sheet.appendRow(columns.map(column => Object.prototype.hasOwnProperty.call(record, column) ? record[column] : ''));
}

function _updateMapped(name, rowNumber, row) {
  const { sheet, columns } = _writeColumns(name);
  HEADERS[_canonicalSheet(name)].forEach((column, index) => {
    sheet.getRange(rowNumber, columns.indexOf(column) + 1, 1, 1).setValues([[row[index] ?? '']]);
  });
  // Las columnas adicionales (incluidas sus fórmulas) no se tocan.
}

function _newId(name, data) {
  const id = data.id == null || data.id === '' ? _uid() : String(data.id).trim();
  if (!id) throw new Error('ID inválido');
  if (_rows(name).some(row => String(row.id) === id)) throw new Error('ID duplicado en ' + name + ': ' + id);
  return id;
}

function _legacyInsert(sheetName, payload) {
  const name = _canonicalSheet(sheetName);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('payload requerido');
  const creators = { equipos: _createTeam, procesos: _createProcess, flujos: _createFlow, nodos: _createNode, conexiones: _createEdge };
  if (!creators[name]) throw new Error('No se permite insertRow en ' + name);
  return creators[name](payload);
}

function _delete(name, id) {
  const r = _findRow(name, id);
  if (r<0) throw new Error('No encontrado: '+id+' en '+name);
  if (name === 'equipos' && (_rows('procesos').some(p => p.teamId === id) || _rows('flujos').some(f => f.teamId === id))) {
    throw new Error('Elimina primero los procesos y flujos del equipo');
  }
  if (name === 'procesos' && _rows('flujos').some(f => f.processId === id)) {
    throw new Error('Elimina primero los flujos del proceso');
  }
  if (name === 'flujos') {
    if (_rows('nodos').some(n => n.refFlowId === id && n.flowId !== id)) throw new Error('Otro flujo utiliza este flujo como referencia');
    _deleteWhere('conexiones', e => e.flowId === id);
    _deleteWhere('nodos', n => n.flowId === id);
  }
  if (name === 'nodos') _deleteWhere('conexiones', e => e.sourceId === id || e.targetId === id);
  _sheet(name).deleteRow(r);
  return { deleted: id };
}

function _deleteWhere(name, predicate) {
  const sheet = _sheet(name), headers = _columnNames(sheet);
  const values = sheet.getDataRange().getValues();
  for (let i = values.length - 1; i > 0; i--) {
    if (predicate(_rObj(headers, values[i]))) sheet.deleteRow(i + 1);
  }
}

function _requireRecord(name, id) {
  const record = _rows(name).find(r => r.id === id);
  if (!record) throw new Error('Referencia no encontrada en ' + name + ': ' + id);
  return record;
}

function _parseMeta(n) {
  if (n.metadata && typeof n.metadata==='string') {
    try { n.metadata=JSON.parse(n.metadata); } catch(_) { n.metadata={}; }
  }
  return n;
}

// ══════════════════════════════════════════════════════════════════
//  CRUD EQUIPOS
// ══════════════════════════════════════════════════════════════════
function _createTeam(d) {
  const id=_newId('equipos', d), ts=_now();
  const row=[id, d.nombre||'Nuevo Equipo', d.descripcion||'', d.color||'#c084fc', d.icono||'👥', d.creadoEn||ts, d.actualizadoEn||ts];
  _appendMapped('equipos', row);
  return _rObj(HEADERS.equipos, row);
}
function _updateTeam(d) {
  const ri=_findRow('equipos',d.id); if(ri<0) throw new Error('Equipo no encontrado');
  const old=_rows('equipos').find(r=>r.id===d.id), ts=_now();
  const row=[d.id, d.nombre??old.nombre, d.descripcion??old.descripcion, d.color??old.color, d.icono??old.icono, old.creadoEn, ts];
  _updateMapped('equipos', ri, row);
  return _rObj(HEADERS.equipos, row);
}

// ══════════════════════════════════════════════════════════════════
//  CRUD PROCESOS
// ══════════════════════════════════════════════════════════════════
function _createProcess(d) {
  _requireRecord('equipos', d.teamId);
  const id=_newId('procesos', d), ts=_now();
  const row=[id, d.teamId, d.nombre||'Nuevo Proceso', d.descripcion||'', d.orden??0, d.creadoEn||ts, d.actualizadoEn||ts];
  _appendMapped('procesos', row);
  return _rObj(HEADERS.procesos, row);
}
function _updateProcess(d) {
  const ri=_findRow('procesos',d.id); if(ri<0) throw new Error('Proceso no encontrado');
  const old=_rows('procesos').find(r=>r.id===d.id), ts=_now();
  const row=[d.id, old.teamId, d.nombre??old.nombre, d.descripcion??old.descripcion, d.orden??old.orden, old.creadoEn, ts];
  _updateMapped('procesos', ri, row);
  return _rObj(HEADERS.procesos, row);
}

// ══════════════════════════════════════════════════════════════════
//  CRUD FLUJOS
// ══════════════════════════════════════════════════════════════════
function _createFlow(d) {
  const process = _requireRecord('procesos', d.processId);
  _requireRecord('equipos', d.teamId);
  if (process.teamId !== d.teamId) throw new Error('El proceso no pertenece al equipo');
  const id=_newId('flujos', d), ts=_now();
  const row=[id, d.processId, d.teamId, d.nombre||'Nuevo Flujo', d.descripcion||'', d.version||'1.0', d.estado||'borrador', d.creadoEn||ts, d.actualizadoEn||ts];
  _appendMapped('flujos', row);
  return _rObj(HEADERS.flujos, row);
}
function _updateFlow(d) {
  const ri=_findRow('flujos',d.id); if(ri<0) throw new Error('Flujo no encontrado');
  const old=_rows('flujos').find(r=>r.id===d.id), ts=new Date(Math.max(Date.now(), Date.parse(old.actualizadoEn) + 1 || 0)).toISOString();
  const row=[d.id, old.processId, old.teamId, d.nombre??old.nombre, d.descripcion??old.descripcion, d.version??old.version, d.estado??old.estado, old.creadoEn, ts];
  _updateMapped('flujos', ri, row);
  return _rObj(HEADERS.flujos, row);
}

// ══════════════════════════════════════════════════════════════════
//  CRUD NODOS
// ══════════════════════════════════════════════════════════════════
function _createNode(d) {
  _requireRecord('flujos', d.flowId);
  const id=_newId('nodos', d), ts=_now();
  const meta = typeof d.metadata==='object' ? JSON.stringify(d.metadata) : (d.metadata||'{}');
  const row=[id, d.flowId, d.tipo||'paso', d.titulo||'Nuevo Paso', d.descripcion||'',
             parseFloat(d.posX)||0, parseFloat(d.posY)||0, parseFloat(d.posZ)||0,
             d.refFlowId||'', meta, d.creadoEn||ts, d.actualizadoEn||ts];
  _appendMapped('nodos', row);
  return _parseMeta(_rObj(HEADERS.nodos, row));
}
function _updateNode(d) {
  const ri=_findRow('nodos',d.id); if(ri<0) throw new Error('Nodo no encontrado');
  const old=_rows('nodos').find(r=>r.id===d.id), ts=_now();
  const meta = d.metadata ? (typeof d.metadata==='object'?JSON.stringify(d.metadata):d.metadata) : (old.metadata||'{}');
  const row=[d.id, old.flowId, d.tipo??old.tipo, d.titulo??old.titulo, d.descripcion??old.descripcion,
             Number(d.posX ?? old.posX) || 0, Number(d.posY ?? old.posY) || 0,
             Number(d.posZ ?? old.posZ) || 0, d.refFlowId??old.refFlowId??'', meta, old.creadoEn, ts];
  _updateMapped('nodos', ri, row);
  return _parseMeta(_rObj(HEADERS.nodos, row));
}

// ══════════════════════════════════════════════════════════════════
//  CRUD CONEXIONES
// ══════════════════════════════════════════════════════════════════
function _createEdge(d) {
  _requireRecord('flujos', d.flowId);
  const source = _requireRecord('nodos', d.sourceId), target = _requireRecord('nodos', d.targetId);
  if (source.flowId !== d.flowId || target.flowId !== d.flowId) throw new Error('Los nodos deben pertenecer al mismo flujo');
  const id=_newId('conexiones', d), ts=_now();
  const normalized = _validateConnection(d, source, target);
  const row=[id, d.flowId, d.sourceId, d.targetId, normalized.condicion, d.etiqueta||'', d.creadoEn||ts, normalized.tipo, normalized.sourceHandle, normalized.targetHandle];
  _appendMapped('conexiones', row);
  return _rObj(HEADERS.conexiones, row);
}

function _nodePorts(node) {
  const meta = _parseMeta({ metadata: node.metadata }).metadata || {};
  if (meta.ports) return meta.ports;
  if (node.tipo === 'modelo-ia') return { inputs: [], outputs: [{ id: 'model-out', kind: 'modelo' }] };
  return {
    inputs: node.tipo === 'inicio' ? [] : [{ id: 'in', kind: 'secuencia' }].concat(node.tipo === 'ia' ? [{ id: 'model-in', kind: 'modelo' }] : []),
    outputs: node.tipo === 'fin' ? [] : node.tipo === 'decision' ? [{ id: 'positivo', kind: 'secuencia' }, { id: 'negativo', kind: 'secuencia' }] : [{ id: 'out', kind: 'secuencia' }],
  };
}

function _validateConnection(edge, source, target) {
  const tipo = edge.tipo || 'secuencia';
  if (!['secuencia', 'modelo'].includes(tipo)) throw new Error('Tipo de conexión inválido');
  const sourceHandle = edge.sourceHandle || (tipo === 'modelo' ? 'model-out' : source.tipo === 'decision' ? edge.condicion : 'out');
  const targetHandle = edge.targetHandle || (tipo === 'modelo' ? 'model-in' : 'in');
  const output = _nodePorts(source).outputs.find(p => p.id === sourceHandle);
  const input = _nodePorts(target).inputs.find(p => p.id === targetHandle);
  if (!output || !input || output.kind !== tipo || input.kind !== tipo) throw new Error('Puertos incompatibles o inexistentes');
  if (tipo === 'modelo' && (source.tipo !== 'modelo-ia' || target.tipo !== 'ia')) throw new Error('Una dependencia conecta un modelo con un nodo de IA');
  if (tipo === 'secuencia' && (source.tipo === 'modelo-ia' || target.tipo === 'modelo-ia' || source.tipo === 'fin' || target.tipo === 'inicio')) throw new Error('Conexión secuencial inválida');
  const condicion = source.tipo === 'decision' ? sourceHandle : 'siempre';
  if (!['siempre', 'positivo', 'negativo'].includes(condicion) || (edge.condicion && edge.condicion !== condicion)) throw new Error('Condición inválida para el puerto de salida');
  return { tipo, sourceHandle, targetHandle, condicion };
}

// Captura únicamente las filas del flujo editado, conservando columnas extra y fórmulas.
function _snapshotFlowRows(name, flowId) {
  const sheet = _sheet(name), headers = _columnNames(sheet), range = sheet.getDataRange();
  const values = range.getValues(), formulas = range.getFormulas ? range.getFormulas() : [];
  const key = headers.indexOf(name === 'flujos' ? 'id' : 'flowId');
  return values.slice(1).map((row, i) => ({ row, formulas: formulas[i + 1] || [] })).filter(item => item.row[key] === flowId)
    .map(item => headers.map((_, i) => item.formulas[i] || (item.row[i] ?? '')));
}

// Guarda bajo el bloqueo de _route. Una edición conserva el ID del flujo y de sus nodos.
function _saveFullFlow(data) {
  const { flow, nodes, edges } = data;
  if (!flow || !String(flow.nombre || '').trim()) throw new Error('Nombre de flujo requerido');
  if (!Array.isArray(nodes) || !nodes.length || !Array.isArray(edges)) throw new Error('Grafo inválido');
  const keys = nodes.map(n => String(n._tempId));
  if (nodes.some(n => n._tempId == null) || new Set(keys).size !== keys.length) throw new Error('IDs temporales inválidos o duplicados');
  if (!nodes.some(n => n.tipo === 'inicio')) throw new Error('El flujo necesita al menos un activador');
  for (const node of nodes) {
    if (!['inicio','paso','decision','fin','flujo-externo','configuracion','base-datos','transformacion','integracion','ia','modelo-ia','formato','notificacion'].includes(node.tipo) || !String(node.titulo || '').trim()) throw new Error('Nodo inválido');
    if (node.tipo === 'flujo-externo') _requireRecord('flujos', node.refFlowId);
    const ports = _nodePorts(node);
    ['inputs', 'outputs'].forEach(side => {
      if (!Array.isArray(ports[side]) || ports[side].some(p => !p || !String(p.id || '').trim() || !['secuencia', 'modelo'].includes(p.kind)) || new Set(ports[side].map(p => p.id)).size !== ports[side].length) throw new Error('Puertos inválidos o duplicados');
    });
  }
  const seen = new Set();
  for (const edge of edges) {
    if (!keys.includes(String(edge.sourceId)) || !keys.includes(String(edge.targetId))) throw new Error('Conexión con referencia inválida');
    const normalized = _validateConnection(edge, nodes[keys.indexOf(String(edge.sourceId))], nodes[keys.indexOf(String(edge.targetId))]);
    Object.assign(edge, normalized);
    const key = JSON.stringify([String(edge.sourceId), String(edge.targetId), edge.sourceHandle, edge.targetHandle]);
    if (seen.has(key)) throw new Error('Conexión duplicada');
    seen.add(key);
  }
  nodes.filter(n => n.tipo === 'decision').forEach(n => ['positivo', 'negativo'].forEach(branch => {
    if (!edges.some(e => String(e.sourceId) === String(n._tempId) && e.sourceHandle === branch)) throw new Error('La decisión necesita salidas Sí y No: ' + n.titulo);
  }));
  ['flujos', 'nodos', 'conexiones'].forEach(_writeColumns);
  const old = flow.id ? _getFullFlow(flow.id) : null;
  if (old && (flow.teamId !== old.flow.teamId || flow.processId !== old.flow.processId)) throw new Error('No se puede cambiar el equipo o proceso de un flujo existente');
  if (old && flow.actualizadoEn !== old.flow.actualizadoEn) throw new Error('El flujo cambió en otra sesión. Vuelve a abrirlo antes de guardar.');
  const backup = old ? Object.fromEntries(['flujos', 'nodos', 'conexiones'].map(name => [name, _snapshotFlowRows(name, flow.id)])) : null;
  const savedFlow = old ? old.flow : _createFlow(flow);
  try {
    const savedNodes = nodes.map(node => {
      const previous = old && old.nodes.find(n => String(n.id) === String(node._tempId));
      return previous ? _updateNode({ ...node, id: previous.id }) : _createNode({ ...node, id: undefined, flowId: savedFlow.id });
    });
    const ids = new Map(keys.map((key, index) => [key, savedNodes[index].id]));
    const savedEdges = edges.map(edge => {
      const previous = old && old.edges.find(e => String(e.id) === String(edge._tempId));
      const sourceId = ids.get(String(edge.sourceId)), targetId = ids.get(String(edge.targetId));
      if (!previous) return _createEdge({ ...edge, id: undefined, flowId: savedFlow.id, sourceId, targetId });
      const row = [previous.id, savedFlow.id, sourceId, targetId, edge.condicion, edge.etiqueta || '', previous.creadoEn, edge.tipo, edge.sourceHandle, edge.targetHandle];
      _updateMapped('conexiones', _findRow('conexiones', previous.id), row);
      return _rObj(HEADERS.conexiones, row);
    });
    if (old) {
      const keepEdges = new Set(savedEdges.map(e => e.id)), keepNodes = new Set(savedNodes.map(n => n.id));
      _deleteWhere('conexiones', e => e.flowId === flow.id && !keepEdges.has(e.id));
      _deleteWhere('nodos', n => n.flowId === flow.id && !keepNodes.has(n.id));
    }
    const resultFlow = old ? _updateFlow(flow) : savedFlow;
    return { flow: resultFlow, nodes: savedNodes, edges: savedEdges };
  } catch (err) {
    try {
      if (!old) _delete('flujos', savedFlow.id);
      else ['conexiones', 'nodos', 'flujos'].forEach(name => {
        _deleteWhere(name, record => (name === 'flujos' ? record.id : record.flowId) === flow.id);
        const sheet = _sheet(name);
        backup[name].forEach(row => sheet.appendRow(row));
      });
    }
    catch (cleanupError) { throw new Error(err.message + '. No se pudo revertir el flujo ' + savedFlow.id + ': ' + cleanupError.message); }
    throw err;
  }
}

// ══════════════════════════════════════════════════════════════════
//  GRAFO COMPLETO
// ══════════════════════════════════════════════════════════════════
function _getFullFlow(flowId) {
  if (!flowId) throw new Error('flowId requerido');
  const flows = _rows('flujos');
  const flow  = flows.find(f=>f.id===flowId);
  if (!flow) throw new Error('Flujo no encontrado: '+flowId);
  return {
    flow,
    nodes: _rows('nodos').filter(n=>n.flowId===flowId).map(_parseMeta),
    edges: _rows('conexiones').filter(e=>e.flowId===flowId),
  };
}

// ══════════════════════════════════════════════════════════════════
//  STATS
// ══════════════════════════════════════════════════════════════════
function _getStats() {
  return {
    teams:     _rows('equipos').length,
    processes: _rows('procesos').length,
    flows:     _rows('flujos').length,
    nodes:     _rows('nodos').length,
    edges:     _rows('conexiones').length,
  };
}

// ══════════════════════════════════════════════════════════════════
//  MENÚ SHEETS (opcional)
// ══════════════════════════════════════════════════════════════════
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('⚡ FlowMapper')
      .addItem('🔎 Validar esquema sin modificar datos', 'validarBaseDeDatos')
      .addItem('📦 Crear / verificar base de datos', 'crearBaseDeDatos')
      .addSeparator()
      .addItem('🔗 Ver URL del WebApp', '_mostrarUrl')
      .addItem('📊 Estadísticas', '_mostrarStats')
      .addToUi();
  } catch(_) {}
}
function _mostrarUrl() {
  const url = ScriptApp.getService().getUrl();
  SpreadsheetApp.getUi().alert('URL del WebApp:\n\n'+(url||'No desplegado aún')+'\n\nPega en .env como:\nVITE_GAS_URL='+url);
}
function _mostrarStats() {
  const s = _getStats();
  SpreadsheetApp.getUi().alert('📊 Stats\nEquipos: '+s.teams+'\nProcesos: '+s.processes+'\nFlujos: '+s.flows+'\nNodos: '+s.nodes+'\nConexiones: '+s.edges);
}
