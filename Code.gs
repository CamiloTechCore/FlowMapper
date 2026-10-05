// ╔══════════════════════════════════════════════════════════════╗
// ║  FlowMapper — Google Apps Script Backend                     ║
// ║  Spreadsheet ID fijo — No requiere abrir desde Sheets        ║
// ║  Despliega como WebApp y copia la URL en el .env del cliente ║
// ╚══════════════════════════════════════════════════════════════╝

const SPREADSHEET_ID = '12-RXAOuu_sVS479CdrhjBeKO9Tdej-93lhe6gPEnku0';
const API_VERSION = '1.7.0';
const PASSWORD_ITERATIONS = 600000;
const SHA256_INITIAL = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
const SHA256_K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];

const SHEETS = {
  TEAMS:     'equipos',
  PROCESSES: 'procesos',
  FLOWS:     'flujos',
  NODES:     'nodos',
  EDGES:     'conexiones',
  META:      'meta',
  USERS:     'usuarios',
  FOLDERS:   'carpetas',
};

const HEADERS = {
  equipos:    ['id','nombre','descripcion','color','icono','creadoEn','actualizadoEn'],
  procesos:   ['id','teamId','nombre','descripcion','orden','creadoEn','actualizadoEn'],
  flujos:     ['id','processId','teamId','nombre','descripcion','version','estado','creadoEn','actualizadoEn'],
  nodos:      ['id','flowId','tipo','titulo','descripcion','posX','posY','posZ','refFlowId','metadata','creadoEn','actualizadoEn'],
  conexiones: ['id','flowId','sourceId','targetId','condicion','etiqueta','creadoEn','tipo','sourceHandle','targetHandle'],
  meta:       ['clave','valor','actualizadoEn'],
  usuarios:   ['id','correo','nombre','rol','activo','creadoEn','actualizadoEn','passwordTemporal','passwordEncriptada'],
  carpetas:   ['id','nombre','descripcion','creadoEn','actualizadoEn'],
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
    try { if (!_requestStore?.staging) SpreadsheetApp.flush(); }
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
  // Solo dura esta petición: nunca reutilizar datos de otra ejecución/usuario.
  _requestStore = { tables: {}, sheets: null, spreadsheet: null };
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

    // Todas las rutas, incluidas las antiguas, comparten la misma autorización.
    if (p.action !== 'ping' && p.action !== 'login') _authorizeRequest(p, isRead);

    const map = {
      ping:              () => ({ pong: true, version: API_VERSION, ts: _now() }),
      login:             () => _login(p.correo, p.password),
      logout:            () => { CacheService.getScriptCache().remove('session:' + p.sessionToken); return { ok: true }; },
      getSession:        () => _publicUser(_authorize(p.sessionToken)),
      getUsers:          () => _rows('usuarios').map(_publicUser),
      saveReader:        () => _saveReader(p),
      getFolders:        () => _rows('carpetas'),
      saveFolder:        () => _saveFolder(p),
      deleteFolder:      () => _deleteFolder(p.id),
      setup:             () => _setupSpreadsheet(),
      getSchemaStatus:   () => validarBaseDeDatos(),
      getData:           () => { const name = _canonicalSheet(p.sheet); if (name === 'usuarios') throw new Error('Hoja privada'); return _rows(name); },
      insertRow:         () => _legacyInsert(p.sheet, p.payload),
      getStats:          () => _getStats(),
      // Equipos
      getTeams:          () => _teamsWithTags(),
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
    const data = isRead ? fn() : _withWriteLock(() => {
      // Las tablas leídas antes de esperar el bloqueo pueden haberse actualizado.
      _requestStore.tables = {};
      if (p.action !== 'login') _authorizeRequest(p, false);
      return p.action === 'setup' ? fn() : _mutateTables(fn);
    });
    out.setContent(JSON.stringify({ success: true, data, ...(p.action === 'insertRow' ? { message: 'Registro creado con éxito' } : {}) }));
  } catch(err) {
    out.setContent(JSON.stringify({ success: false, error: err.message }));
  }
  _requestStore = null;
  return out;
}

// ══════════════════════════════════════════════════════════════════
//  UTILIDADES
// ══════════════════════════════════════════════════════════════════
let _requestStore = null;
function _authorizeRequest(p, isRead) {
  const user = _authorize(p.sessionToken);
  if (((!isRead && p.action !== 'logout') || ['getUsers', 'getSchemaStatus'].includes(p.action)) && user.rol !== 'administrador') throw new Error('FORBIDDEN: solo el administrador puede modificar datos');
  if (p.action === 'getData' && _canonicalSheet(p.sheet) === 'meta' && user.rol !== 'administrador') throw new Error('FORBIDDEN: hoja privada');
}
// Solo se ejecuta manualmente desde el editor de Apps Script, nunca por HTTP.
// Configura ADMIN_EMAIL, ADMIN_PASSWORD y opcionalmente ADMIN_NAME en propiedades.
function configurarAdministrador() {
  return _withWriteLock(() => {
    _setupSpreadsheet();
    const props = PropertiesService.getScriptProperties();
    const correo = _email(props.getProperty('ADMIN_EMAIL'));
    const password = props.getProperty('ADMIN_PASSWORD');
    _validatePassword(password);
    const users = _rows('usuarios'), admins = users.filter(u => u.rol === 'administrador');
    if (admins.length > 1) throw new Error('Debe existir un único administrador en usuarios');
    const old = admins[0] || users.find(u => _normalizeEmail(u.correo) === correo);
    if (users.some(u => u.id !== old?.id && _normalizeEmail(u.correo) === correo)) throw new Error('Correo duplicado');
    if (!props.getProperty('AUTH_SECRET')) props.setProperty('AUTH_SECRET', _uid() + _uid());
    const record = { id: old?.id || _uid(), correo, nombre: props.getProperty('ADMIN_NAME') || old?.nombre || 'Administrador', rol: 'administrador', activo: true,
      creadoEn: old?.creadoEn || _now(), actualizadoEn: _now(), ..._credentials(password) };
    const row = HEADERS.usuarios.map(key => record[key]);
    if (old) _updateMapped('usuarios', _findRow('usuarios', old.id), row); else _appendMapped('usuarios', row);
    props.deleteProperty('ADMIN_PASSWORD');
    return _publicUser(record);
  });
}
function _normalizeEmail(value) { return String(value || '').trim().toLowerCase(); }
function _email(value) {
  const correo = _normalizeEmail(value);
  if (correo.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) throw new Error('Correo inválido');
  return correo;
}
function _validatePassword(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 256) throw new Error('La contraseña debe tener entre 12 y 256 caracteres');
}
function _publicUser(user) {
  const { id, correo, nombre, rol, activo, creadoEn, actualizadoEn } = user;
  return { id, correo, nombre, rol, activo, creadoEn, actualizadoEn };
}
// PBKDF2-HMAC-SHA256 con salt individual y clave previa protegida por un secreto del script.
// No se almacenan contraseñas legibles ni se devuelven hashes en la API.
function _sha256Block(state, block, words) {
  const constants = SHA256_K;
  words.set(block);
  for (let i = 16; i < 64; i++) {
    const x = words[i-15], y = words[i-2];
    const s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
    const s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
    words[i] = (words[i-16] + s0 + words[i-7] + s1) | 0;
  }
  let [a,b,c,d,e,f,g,h] = state;
  for (let i = 0; i < 64; i++) {
    const s1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
    const t1 = (h + s1 + ((e & f) ^ (~e & g)) + constants[i] + words[i]) | 0;
    const s0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
    const t2 = (s0 + ((a & b) ^ (a & c) ^ (b & c))) | 0;
    h=g; g=f; f=e; e=(d+t1)|0; d=c; c=b; b=a; a=(t1+t2)|0;
  }
  state[0]=(state[0]+a)|0; state[1]=(state[1]+b)|0; state[2]=(state[2]+c)|0; state[3]=(state[3]+d)|0;
  state[4]=(state[4]+e)|0; state[5]=(state[5]+f)|0; state[6]=(state[6]+g)|0; state[7]=(state[7]+h)|0;
}
// Calcula los bloques repetidos de PBKDF2 en JS, evitando 600.000 llamadas a servicios GAS.
// El resultado se contrasta con node:crypto en las pruebas; salida de 256 bits.
function _pbkdf2Hash(key, salt, iterations) {
  const first = Utilities.computeHmacSha256Signature(Utilities.newBlob(salt).getBytes().concat([0,0,0,1]), key);
  if (key.length > 64) key = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, key);
  const words = new Int32Array(64), block = new Int32Array(16);
  const innerPrefix = new Int32Array(SHA256_INITIAL), outerPrefix = new Int32Array(SHA256_INITIAL);
  for (let i = 0; i < 64; i++) block[i >>> 2] |= (((key[i] || 0) & 255) ^ 0x36) << (24 - (i % 4) * 8);
  _sha256Block(innerPrefix, block, words); block.fill(0);
  for (let i = 0; i < 64; i++) block[i >>> 2] |= (((key[i] || 0) & 255) ^ 0x5c) << (24 - (i % 4) * 8);
  _sha256Block(outerPrefix, block, words); block.fill(0); block[8] = 0x80000000; block[15] = 768;
  const inner = new Int32Array(8), outer = new Int32Array(8), result = new Int32Array(8);
  for (let i = 0; i < 32; i++) outer[i >>> 2] |= (first[i] & 255) << (24 - (i % 4) * 8);
  result.set(outer);
  for (let iteration = 1; iteration < iterations; iteration++) {
    block.set(outer); inner.set(innerPrefix); _sha256Block(inner, block, words);
    block.set(inner); outer.set(outerPrefix); _sha256Block(outer, block, words);
    for (let i = 0; i < 8; i++) result[i] ^= outer[i];
  }
  const bytes = [];
  for (let i = 0; i < 32; i++) bytes.push((result[i >>> 2] >>> (24 - (i % 4) * 8)) << 24 >> 24);
  return Utilities.base64Encode(bytes);
}
function _passwordHash(password, salt, iterations = PASSWORD_ITERATIONS, pepper = true) {
  const secret = PropertiesService.getScriptProperties().getProperty('AUTH_SECRET');
  if (pepper && !secret) throw new Error('Ejecuta procesarContraseñasTemporales() para configurar el acceso');
  const key = pepper ? Utilities.computeHmacSha256Signature(password, secret, Utilities.Charset.UTF_8) : Utilities.newBlob(password).getBytes();
  return _pbkdf2Hash(key, salt, iterations);
}
function _credentials(password) {
  _validatePassword(password);
  const properties = PropertiesService.getScriptProperties();
  if (!properties.getProperty('AUTH_SECRET')) properties.setProperty('AUTH_SECRET', _uid() + _uid());
  const salt = _uid() + _uid();
  return { passwordTemporal: '', passwordEncriptada: JSON.stringify({ scheme: 'pbkdf2-hmac-sha256-v2', iterations: PASSWORD_ITERATIONS, salt, hash: _passwordHash(password, salt), version: _uid(), pepper: true }) };
}
function _credential(user) {
  if (!user) return null;
  if (user.passwordEncriptada) {
    try {
      const data = JSON.parse(user.passwordEncriptada);
      const supported = (data.scheme === 'pbkdf2-hmac-sha256-v1' && data.iterations === 10000) || (data.scheme === 'pbkdf2-hmac-sha256-v2' && data.iterations === PASSWORD_ITERATIONS && typeof data.pepper === 'boolean');
      if (supported && typeof data.salt === 'string' && data.salt.length <= 150 && typeof data.hash === 'string' && data.hash.length === 44 && typeof data.version === 'string') return data;
    } catch (_) { /* Una credencial dañada no concede acceso. */ }
    return null;
  }
  // Permite convertir registros de 1.6.0 sin cambiar la contraseña ni los IDs.
  return user.passwordHash && user.passwordSalt && user.passwordVersion ? { scheme: 'pbkdf2-hmac-sha256-v1', iterations: 10000, salt: user.passwordSalt, hash: user.passwordHash, version: user.passwordVersion } : null;
}
function _syncTemporaryPassword(user) {
  const temporary = user.passwordTemporal;
  let credentials;
  if (temporary !== '' && temporary != null) credentials = _credentials(temporary);
  else if (!user.passwordEncriptada && _credential(user)) credentials = { passwordTemporal: '', passwordEncriptada: JSON.stringify(_credential(user)) };
  else return user;
  const updated = { ...user, ...credentials, actualizadoEn: _now() };
  _updateMapped('usuarios', _findRow('usuarios', user.id), HEADERS.usuarios.map(key => updated[key]));
  return updated;
}
function _userTransaction(fn) {
  const previous = _requestStore;
  _requestStore = { tables: {} };
  try { return _mutateTables(fn); } finally { _requestStore = previous; }
}
// Para cambios por API, importaciones o filas creadas directamente en Sheets.
function procesarContraseñasTemporales() {
  return _withWriteLock(() => _userTransaction(() => {
    let procesados = 0;
    _rows('usuarios').forEach(user => {
      if ((user.passwordTemporal !== '' && user.passwordTemporal != null) || (!user.passwordEncriptada && _credential(user))) { _syncTemporaryPassword(user); procesados++; }
    });
    return { procesados };
  }));
}
// Trigger instalable: procesa únicamente las filas de la columna temporal editada.
function alEditarUsuarios(e) {
  if (!e?.range || e.range.getSheet().getParent().getId() !== SPREADSHEET_ID || e.range.getSheet().getName().trim().toLowerCase() !== 'usuarios') return;
  const sheet = e.range.getSheet(), columns = _columnNames(sheet), column = columns.indexOf('passwordTemporal') + 1;
  if (!column || column < e.range.getColumn() || column >= e.range.getColumn() + e.range.getNumColumns() || e.range.getLastRow() < 2) return;
  return _withWriteLock(() => _userTransaction(() => {
    const values = sheet.getRange(Math.max(2, e.range.getRow()), 1, e.range.getLastRow() - Math.max(2, e.range.getRow()) + 1, columns.length).getValues();
    values.forEach(row => {
      const user = _rObj(columns, row);
      if (user.id) _syncTemporaryPassword(user);
    });
  }));
}
function instalarTriggerUsuarios() {
  const installed = ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'alEditarUsuarios' && t.getTriggerSourceId() === SPREADSHEET_ID);
  if (!installed) ScriptApp.newTrigger('alEditarUsuarios').forSpreadsheet(SPREADSHEET_ID).onEdit().create();
  return { instalado: true };
}
function _equalHash(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  let difference = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) difference |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return difference === 0;
}
function _validUser(user) {
  if (!user || ![true, 'true'].includes(user.activo) || !['administrador','lector'].includes(user.rol)) return false;
  return user.rol !== 'administrador' || _rows('usuarios').filter(u => u.rol === 'administrador').length === 1;
}
function _login(correo, password) {
  correo = _normalizeEmail(correo);
  if (!correo || correo.length > 254 || typeof password !== 'string' || password.length > 256) throw new Error('Credenciales incorrectas o cuenta sin acceso');
  const cache = CacheService.getScriptCache();
  const attemptKey = 'login:' + Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, correo));
  const attempts = Number(cache.get(attemptKey) || 0);
  if (attempts >= 5) throw new Error('Demasiados intentos. Espera 15 minutos antes de volver a intentar');
  cache.put(attemptKey, String(attempts + 1), 900);
  const matches = _rows('usuarios').filter(u => _normalizeEmail(u.correo) === correo);
  let user = matches.length === 1 ? matches[0] : null;
  if (_validUser(user)) user = _syncTemporaryPassword(user);
  let credential = _credential(user);
  // Se calcula también para cuentas desconocidas, sin exponer si el correo existe.
  const candidate = _passwordHash(password, credential?.salt || 'flowmapper-unknown-account', credential?.iterations || PASSWORD_ITERATIONS, credential ? credential.pepper !== false : Boolean(PropertiesService.getScriptProperties().getProperty('AUTH_SECRET')));
  if (!_validUser(user) || !credential || !_equalHash(candidate, credential.hash)) throw new Error('Credenciales incorrectas o cuenta sin acceso');
  // Los hashes de importación se refuerzan con el secreto privado tras verificar la clave.
  if (credential.pepper === false || credential.scheme !== 'pbkdf2-hmac-sha256-v2') {
    user = { ...user, ..._credentials(password), actualizadoEn: _now() };
    _updateMapped('usuarios', _findRow('usuarios', user.id), HEADERS.usuarios.map(key => user[key]));
    credential = _credential(user);
  }
  cache.remove(attemptKey);
  const sessionToken = _uid() + _uid(), expiresAt = Date.now() + 3600000;
  cache.put('session:' + sessionToken, JSON.stringify({ userId: user.id, passwordVersion: credential.version, expiresAt }), 3600);
  return { sessionToken, expiresAt, user: _publicUser(user) };
}
function _authorize(token) {
  if (typeof token !== 'string' || token.length > 150) throw new Error('UNAUTHORIZED: inicia sesión');
  const raw = CacheService.getScriptCache().get('session:' + token);
  if (!raw) throw new Error('UNAUTHORIZED: sesión vencida');
  const session = JSON.parse(raw);
  if (session.expiresAt <= Date.now()) throw new Error('UNAUTHORIZED: sesión vencida');
  const user = _rows('usuarios').find(u => u.id === session.userId);
  if (!_validUser(user) || user.passwordTemporal || !_credential(user) || _credential(user).version !== session.passwordVersion) throw new Error('UNAUTHORIZED: acceso revocado');
  return user;
}
function _saveReader(d) {
  const correo = _email(d.correo), users = _rows('usuarios');
  const old = d.id ? users.find(u => u.id === d.id) : users.find(u => _normalizeEmail(u.correo) === correo);
  if (d.id && !old) throw new Error('Lector no encontrado');
  if (old && old.rol !== 'lector') throw new Error('No se puede modificar el administrador');
  if (users.some(u => u.id !== old?.id && _normalizeEmail(u.correo) === correo)) throw new Error('Correo duplicado');
  const nombre = String(d.nombre || '').trim();
  if (!nombre) throw new Error('Nombre requerido');
  const credentials = d.password ? _credentials(d.password) : old && _credential(old) ? { passwordTemporal: '', passwordEncriptada: JSON.stringify(_credential(old)) } : _credentials(d.password);
  if (old && !d.password && old.passwordTemporal) throw new Error('Procesa la contraseña temporal antes de editar este lector');
  if (old && (String(old.activo) === 'true') !== (d.activo !== false)) {
    const credential = JSON.parse(credentials.passwordEncriptada);
    credential.version = _uid(); credentials.passwordEncriptada = JSON.stringify(credential);
  }
  const ts = _now(), record = { id: old?.id || _uid(), correo, nombre, rol: 'lector', activo: d.activo !== false, creadoEn: old?.creadoEn || ts, actualizadoEn: ts, ...credentials };
  const row = HEADERS.usuarios.map(key => record[key]);
  if (old) _updateMapped('usuarios', _findRow('usuarios', old.id), row); else _appendMapped('usuarios', row);
  return _publicUser(record);
}
function _saveFolder(d) {
  const nombre = String(d.nombre || '').trim();
  if (!nombre) throw new Error('Nombre de carpeta requerido');
  const old = d.id ? _requireRecord('carpetas', d.id) : null, ts = _now();
  const row = [old?.id || _uid(), nombre, String(d.descripcion || ''), old?.creadoEn || ts, ts];
  if (old) _updateMapped('carpetas', _findRow('carpetas', old.id), row); else _appendMapped('carpetas', row);
  return _rObj(HEADERS.carpetas, row);
}
function _deleteFolder(id) {
  if (_teamsWithTags().some(t => t.carpetaId === id)) throw new Error('La carpeta contiene equipos. Reasígnalos antes de eliminarla');
  return _delete('carpetas', id);
}
function _teamFolder(id) { return _rows('meta').find(r => r.clave === 'teamFolder:' + id)?.valor || ''; }
function _saveTeamFolder(id, folder) {
  if (folder) _requireRecord('carpetas', folder);
  _upsertMeta('teamFolder:' + id, folder || '');
  return folder || '';
}
function _segments(id) {
  const value = _rows('meta').find(r => r.clave === 'flowSegments:' + id)?.valor;
  return value ? JSON.parse(value) : [];
}
function _saveSegments(id, segments) {
  if (!Array.isArray(segments) || segments.length > 50) throw new Error('Segmentos inválidos');
  const ids = new Set();
  segments.forEach(s => {
    if (!s || typeof s.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(s.id) || ids.has(s.id) || typeof s.nombre !== 'string' || !s.nombre.trim() || typeof s.color !== 'string' || !/^#[a-fA-F0-9]{6}$/.test(s.color) || typeof s.criterio !== 'string' || typeof s.salida !== 'string') throw new Error('Configura ID, nombre, color, criterio y transición de cada segmento');
    ids.add(s.id);
  });
  const previous = _rows('meta').find(r => r.clave === 'flowSegments:' + id);
  const serialized = JSON.stringify(segments);
  if ((!previous && !segments.length) || previous?.valor === serialized) return;
  _upsertMeta('flowSegments:' + id, serialized);
}
const _ss = () => _requestStore
  ? (_requestStore.spreadsheet || (_requestStore.spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID)))
  : SpreadsheetApp.openById(SPREADSHEET_ID);
function _sheet(name) {
  const key = _canonicalSheet(name);
  const sheets = _requestStore ? (_requestStore.sheets || (_requestStore.sheets = _ss().getSheets())) : _ss().getSheets();
  const matches = sheets.filter(s => s.getName().trim().toLowerCase() === key);
  if (matches.length > 1) throw new Error('Hojas ambiguas para ' + key);
  if (!matches.length) throw new Error('Hoja "' + name + '" no existe. Ejecuta crearBaseDeDatos()');
  return matches[0];
}

function _table(name) {
  const key = _canonicalSheet(name);
  if (_requestStore && _requestStore.tables[key]) return _requestStore.tables[key];
  const sheet = _sheet(key), original = sheet.getDataRange().getValues();
  const columns = original[0].map(h => String(h).trim());
  if (columns.some(h => !h) || new Set(columns).size !== columns.length) throw new Error('Cabeceras vacías o duplicadas en ' + sheet.getName());
  const table = { sheet, columns, original, values: original.map(row => [...row]), deleted: new Set() };
  if (_requestStore) _requestStore.tables[key] = table;
  return table;
}

// Primero valida y prepara todos los cambios en memoria. Solo entonces escribe bloques.
// Las filas vacías se reutilizan: borrar no desplaza fórmulas o registros de otros flujos.
function _mutateTables(fn) {
  _requestStore.staging = true;
  const result = fn(), operations = [];
  Object.entries(_requestStore.tables).forEach(([name, table]) => {
    const { sheet, columns, original, values } = table;
    const groups = new Map();
    for (let row = 1; row < values.length; row++) {
      if (columns.every((_, col) => (values[row][col] ?? '') === (original[row]?.[col] ?? ''))) continue;
      const owned = columns.map((column, col) => table.deleted.has(row) || HEADERS[name].includes(column) ? col : -1).filter(col => col >= 0);
      for (let i = 0; i < owned.length;) {
        const start = owned[i]; let end = start;
        while (++i < owned.length && owned[i] === end + 1) end = owned[i];
        const key = start + ':' + end, blocks = groups.get(key) || [];
        const last = blocks[blocks.length - 1];
        if (last && last.row + last.height === row) last.height++;
        else blocks.push({ row, height: 1, start, width: end - start + 1 });
        groups.set(key, blocks);
      }
    }
    if (!groups.size) return;
    const range = sheet.getDataRange(), formulas = range.getFormulas ? range.getFormulas() : [];
    if (sheet.getMaxRows && values.length > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), values.length - sheet.getMaxRows());
    for (const blocks of groups.values()) for (const block of blocks) {
      const { row, height, start, width } = block;
      const read = (source, restore) => Array.from({ length: height }, (_, r) => Array.from({ length: width }, (_, c) =>
        (restore && formulas[row + r]?.[start + c]) || (source[row + r]?.[start + c] ?? '')));
      operations.push({ range: sheet.getRange(row + 1, start + 1, height, width), after: read(values, false), before: read(original, true) });
    }
  });
  const attempted = [];
  try {
    for (const operation of operations) { attempted.push(operation); operation.range.setValues(operation.after); }
    SpreadsheetApp.flush();
  } catch (error) {
    const failures = [];
    for (const operation of attempted.reverse()) {
      try { operation.range.setValues(operation.before); } catch (rollbackError) { failures.push(rollbackError.message); }
    }
    try { SpreadsheetApp.flush(); } catch (rollbackError) { failures.push(rollbackError.message); }
    if (failures.length) throw new Error(error.message + '. No se pudo revertir completamente: ' + failures.join('; '));
    throw error;
  }
  return result;
}
const _uid   = () => Utilities.getUuid();
const _now   = () => new Date().toISOString();
const _rObj  = (headers, row) => { const o={}; headers.forEach((h,i)=>{ o[h]=row[i]??null; }); return o; };

function _rows(name) {
  const { sheet: s, values: d, columns: h } = _table(name);
  if (d.length<=1) return [];
  const key = h.indexOf(_canonicalSheet(name) === 'meta' ? 'clave' : 'id');
  if (key < 0) throw new Error('Falta identificador en ' + s.getName());
  return d.slice(1).filter(r=>r[key]!==''&&r[key]!=null).map(r=>_rObj(h,r));
}

function _findRow(name, id) {
  const { sheet: s, values: v, columns } = _table(name);
  const column = columns.indexOf(_canonicalSheet(name) === 'meta' ? 'clave' : 'id');
  if (column < 0) throw new Error('Falta identificador en ' + s.getName());
  for (let i=1;i<v.length;i++) if(String(v[i][column])===String(id)) return i+1;
  return -1;
}

function _writeColumns(name) {
  const { sheet, columns } = _table(name);
  const missing = HEADERS[_canonicalSheet(name)].filter(h => !columns.includes(h));
  if (missing.length) throw new Error('Ejecuta crearBaseDeDatos() antes de guardar: faltan ' + missing.join(', ') + ' en ' + sheet.getName());
  return { sheet, columns };
}

// Escrituras por nombre de campo: compatibles con columnas antiguas, reordenadas o extra.
function _appendMapped(name, row) {
  const { sheet, columns } = _writeColumns(name), table = _table(name);
  const record = _rObj(HEADERS[_canonicalSheet(name)], row);
  const values = columns.map(column => Object.prototype.hasOwnProperty.call(record, column) ? record[column] : '');
  if (!_requestStore?.staging) {
    sheet.appendRow(values);
    if (_requestStore) delete _requestStore.tables[_canonicalSheet(name)];
    return;
  }
  const empty = table.values.findIndex((r, i) => i > 0 && columns.every((_, c) => r[c] === '' || r[c] == null));
  if (empty > 0) table.values[empty] = values;
  else table.values.push(values);
}

function _updateMapped(name, rowNumber, row) {
  const { sheet, columns } = _writeColumns(name), table = _table(name);
  HEADERS[_canonicalSheet(name)].forEach((column, index) => {
    table.values[rowNumber - 1][columns.indexOf(column)] = row[index] ?? '';
    if (!_requestStore?.staging) sheet.getRange(rowNumber, columns.indexOf(column) + 1, 1, 1).setValues([[row[index] ?? '']]);
  });
  if (_requestStore && !_requestStore.staging) delete _requestStore.tables[_canonicalSheet(name)];
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
    _deleteWhere('meta', record => record.clave === 'flowSegments:' + id);
  }
  if (name === 'nodos') _deleteWhere('conexiones', e => e.sourceId === id || e.targetId === id);
  if (name === 'equipos') _deleteWhere('meta', record => record.clave === _tagKey(id) || record.clave === 'teamFolder:' + id);
  _deleteWhere(name, record => String(record.id) === String(id));
  return { deleted: id };
}

function _deleteWhere(name, predicate) {
  const table = _table(name), headers = table.columns, values = table.values;
  for (let i = values.length - 1; i > 0; i--) {
    if (predicate(_rObj(headers, values[i]))) { values[i] = headers.map(() => ''); table.deleted.add(i); }
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
// Team labels live in the existing meta table; no schema migration or backup is needed.
function _tagKey(id) { return 'teamTag:' + id; }
function _teamTag(id) { return _rows('meta').find(row => row.clave === _tagKey(id))?.valor || ''; }
function _saveTeamTag(id, value) {
  const tag = String(value || '').trim().replace(/^#\{(.*)\}$/, '$1').replace(/^#+/, '');
  if (tag && !/^[\p{L}\p{N}_-]{1,48}$/u.test(tag)) throw new Error('Etiqueta inválida: usa hasta 48 letras, números, guiones o guiones bajos, sin espacios');
  const normalized = tag ? '#' + tag : '';
  _upsertMeta(_tagKey(id), normalized);
  return normalized;
}
function _teamsWithTags() {
  const tags = new Map(_rows('meta').map(row => [row.clave, row.valor]));
  return _rows('equipos').map(team => ({ ...team, etiqueta: tags.get(_tagKey(team.id)) || '', carpetaId: tags.get('teamFolder:' + team.id) || '' }));
}
function _createTeam(d) {
  const id=_newId('equipos', d), ts=_now();
  const row=[id, d.nombre||'Nuevo Equipo', d.descripcion||'', d.color||'#c084fc', d.icono||'👥', d.creadoEn||ts, d.actualizadoEn||ts];
  _appendMapped('equipos', row);
  const etiqueta = d.etiqueta === undefined ? '' : _saveTeamTag(id, d.etiqueta);
  const carpetaId = _saveTeamFolder(id, d.carpetaId);
  return { ..._rObj(HEADERS.equipos, row), etiqueta, carpetaId };
}
function _updateTeam(d) {
  const ri=_findRow('equipos',d.id); if(ri<0) throw new Error('Equipo no encontrado');
  const old=_rows('equipos').find(r=>r.id===d.id), ts=_now();
  const row=[d.id, d.nombre??old.nombre, d.descripcion??old.descripcion, d.color??old.color, d.icono??old.icono, old.creadoEn, ts];
  _updateMapped('equipos', ri, row);
  const etiqueta = d.etiqueta === undefined ? _teamTag(d.id) : _saveTeamTag(d.id, d.etiqueta);
  const carpetaId = d.carpetaId === undefined ? _teamFolder(d.id) : _saveTeamFolder(d.id, d.carpetaId);
  return { ..._rObj(HEADERS.equipos, row), etiqueta, carpetaId };
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
  _validateNodeDocumentation(d.flowId, _parseMeta({ metadata: meta }).metadata);
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
  _validateNodeDocumentation(old.flowId, _parseMeta({ metadata: meta }).metadata);
  const row=[d.id, old.flowId, d.tipo??old.tipo, d.titulo??old.titulo, d.descripcion??old.descripcion,
             Number(d.posX ?? old.posX) || 0, Number(d.posY ?? old.posY) || 0,
             Number(d.posZ ?? old.posZ) || 0, d.refFlowId??old.refFlowId??'', meta, old.creadoEn, ts];
  _updateMapped('nodos', ri, row);
  return _parseMeta(_rObj(HEADERS.nodos, row));
}

function _validateNodeDocumentation(flowId, metadata = {}) {
  if (metadata?.segmentId && (typeof metadata.segmentId !== 'string' || !_segments(flowId).some(s => s.id === metadata.segmentId))) throw new Error('El segmento del nodo no pertenece al flujo');
  const quality = metadata?.calidad;
  if (quality && (!['pendiente','cumple','no_cumple','no_aplica'].includes(quality.estado) || (quality.estado === 'no_aplica' && !String(quality.justificacion || '').trim()))) throw new Error('Revisión de calidad inválida');
}

// ══════════════════════════════════════════════════════════════════
//  CRUD CONEXIONES
// ══════════════════════════════════════════════════════════════════
function _createEdge(d, validatedGraph) {
  _requireRecord('flujos', d.flowId);
  const source = _requireRecord('nodos', d.sourceId), target = _requireRecord('nodos', d.targetId);
  if (source.flowId !== d.flowId || target.flowId !== d.flowId) throw new Error('Los nodos deben pertenecer al mismo flujo');
  const id=_newId('conexiones', d), ts=_now();
  const normalized = _validateConnection(d, source, target);
  if (validatedGraph !== true) _validateAnchorCapacity({ ...d, ...normalized }, _rows('conexiones').filter(e => e.flowId === d.flowId), source, target);
  const row=[id, d.flowId, d.sourceId, d.targetId, normalized.condicion, d.etiqueta||'', d.creadoEn||ts, normalized.tipo, normalized.sourceHandle, normalized.targetHandle];
  _appendMapped('conexiones', row);
  return _rObj(HEADERS.conexiones, row);
}

// RF-CFD-001: los cuatro lados sirven como origen y destino, uno por conexión.
function _validateConnection(edge, source, target) {
  if (!source || !target || String(edge.sourceId) === String(edge.targetId)) throw new Error('Conecta figuras diferentes');
  const tipo = edge.tipo || 'secuencia', condicion = edge.condicion || 'siempre';
  const anchors = ['top', 'right', 'bottom', 'left'];
  if (!['secuencia', 'discontinua'].includes(tipo)) throw new Error('Tipo de conexión inválido');
  if (!anchors.includes(edge.sourceHandle) || !anchors.includes(edge.targetHandle)) throw new Error('Anclajes inválidos: usa superior, derecho, inferior o izquierdo');
  if (!['siempre', 'positivo', 'negativo'].includes(condicion)) throw new Error('Condición inválida');
  return { tipo, condicion, sourceHandle: edge.sourceHandle, targetHandle: edge.targetHandle };
}
function _validateAnchorCapacity(edge, existing, source, target) {
  for (const [id, node] of [[edge.sourceId, source], [edge.targetId, target]]) {
    const limit = ['inicio', 'fin'].includes(node.tipo) ? 1 : 4;
    if (existing.filter(e => String(e.sourceId) === String(id) || String(e.targetId) === String(id)).length >= limit) throw new Error(limit === 1 ? 'Inicio y Fin solo permiten una conexión' : 'Máximo 4 conexiones por figura');
  }
  const used = (id, port) => existing.some(e => String(e.sourceId) === String(id) && e.sourceHandle === port || String(e.targetId) === String(id) && e.targetHandle === port);
  if (used(edge.sourceId, edge.sourceHandle) || used(edge.targetId, edge.targetHandle)) throw new Error('Anclaje ocupado: una conexión por lado');
  if (existing.some(e => String(e.sourceId) === String(edge.sourceId) && String(e.targetId) === String(edge.targetId) || String(e.sourceId) === String(edge.targetId) && String(e.targetId) === String(edge.sourceId))) throw new Error('Ya existe una conexión entre estas figuras');
}

// Guarda bajo el bloqueo de _route. Una edición conserva el ID del flujo y de sus nodos.
function _saveFullFlow(data) {
  const { flow, nodes, edges } = data;
  if (!flow || !String(flow.nombre || '').trim()) throw new Error('Nombre de flujo requerido');
  // A repeated request after a lost response must not create another flow.
  const requestId = flow.saveRequestId;
  if (requestId && !/^[a-zA-Z0-9-]{1,80}$/.test(requestId)) throw new Error('Identificador de guardado inválido');
  const receiptKey = requestId ? 'flowSave:' + requestId : '';
  const receipt = receiptKey && _rows('meta').find(row => row.clave === receiptKey);
  if (receipt) {
    const saved = JSON.parse(receipt.valor), graph = _getFullFlow(saved.flowId);
    if (graph.flow.actualizadoEn !== saved.actualizadoEn) throw new Error('El flujo cambió después de este guardado. Vuelve a abrirlo antes de guardar.');
    return graph;
  }
  if (!Array.isArray(nodes) || !nodes.length || !Array.isArray(edges)) throw new Error('Grafo inválido');
  const keys = nodes.map(n => String(n._tempId));
  if (nodes.some(n => n._tempId == null) || new Set(keys).size !== keys.length) throw new Error('IDs temporales inválidos o duplicados');
  for (const node of nodes) {
    if (!['inicio','paso','decision','fin','nota','documento','subproceso','base-datos','entrada-salida','preparacion','conector'].includes(node.tipo) || !String(node.titulo || '').trim()) throw new Error('Nodo inválido');
    const metadata = _parseMeta({ metadata: node.metadata }).metadata || {};
    node.metadata = { ...metadata, anchors: ['top', 'right', 'bottom', 'left'] };
    node.posZ = 0;
  }
  const validated = [];
  for (const edge of edges) {
    if (!keys.includes(String(edge.sourceId)) || !keys.includes(String(edge.targetId))) throw new Error('Conexión con referencia inválida');
    Object.assign(edge, _validateConnection(edge, nodes[keys.indexOf(String(edge.sourceId))], nodes[keys.indexOf(String(edge.targetId))]));
    _validateAnchorCapacity(edge, validated, nodes[keys.indexOf(String(edge.sourceId))], nodes[keys.indexOf(String(edge.targetId))]);
    validated.push(edge);
  }
  ['flujos', 'nodos', 'conexiones'].forEach(_writeColumns);
  const old = flow.id ? _getFullFlow(flow.id) : null;
  if (old && (flow.teamId !== old.flow.teamId || flow.processId !== old.flow.processId)) throw new Error('No se puede cambiar el equipo o proceso de un flujo existente');
  if (old && flow.actualizadoEn !== old.flow.actualizadoEn) throw new Error('El flujo cambió en otra sesión. Vuelve a abrirlo antes de guardar.');
  const savedFlow = old ? old.flow : _createFlow(flow);
  const segmentos = flow.segmentos === undefined ? old?.flow.segmentos || [] : flow.segmentos;
  if (flow.segmentos !== undefined) _saveSegments(savedFlow.id, segmentos);
  for (const node of nodes) {
    if (node.metadata.segmentId && !segmentos.some(s => s.id === node.metadata.segmentId)) throw new Error('El segmento del nodo no pertenece al flujo');
    const quality = node.metadata.calidad;
    if (quality && (!['pendiente','cumple','no_cumple','no_aplica'].includes(quality.estado) || (quality.estado === 'no_aplica' && !String(quality.justificacion || '').trim()))) throw new Error('Revisión de calidad inválida');
  }
  const savedNodes = nodes.map(node => {
    const previous = old && old.nodes.find(n => String(n.id) === String(node._tempId));
    return previous ? _updateNode({ ...node, id: previous.id }) : _createNode({ ...node, id: undefined, flowId: savedFlow.id });
  });
  const ids = new Map(keys.map((key, index) => [key, savedNodes[index].id]));
  const savedEdges = edges.map(edge => {
    const previous = old && old.edges.find(e => String(e.id) === String(edge._tempId));
    const sourceId = ids.get(String(edge.sourceId)), targetId = ids.get(String(edge.targetId));
    if (!previous) return _createEdge({ ...edge, id: undefined, flowId: savedFlow.id, sourceId, targetId }, true);
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
  if (receiptKey) _upsertMeta(receiptKey, JSON.stringify({ flowId: resultFlow.id, actualizadoEn: resultFlow.actualizadoEn }));
  return { flow: { ...resultFlow, segmentos }, nodes: savedNodes, edges: savedEdges };
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
    flow: { ...flow, segmentos: _segments(flow.id) },
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
