import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

// Simula únicamente servicios de GAS. Ejecuta el Code.gs real sin tocar Google Sheets.
export function createBackend({ sheets = {}, initialize = true } = {}) {
  const tables = new Map(Object.entries(sheets).map(([name, rows]) => [name, structuredClone(rows)]));
  const events = [];
  let failure = null;
  let copyFailure = false;
  let locked = false;
  function sheet(name) {
    if (!tables.has(name)) return null;
    const rows = tables.get(name);
    let maxColumns = Math.max(26, ...rows.map(row => row.length));
    const current = {
      getName: () => name,
      setName(next) { if (tables.has(next)) throw new Error('Hoja duplicada'); tables.delete(name); name = next; tables.set(name, rows); return current; },
      getLastRow: () => rows.length,
      getLastColumn: () => Math.max(0, ...rows.map(row => row.length)),
      getMaxColumns: () => maxColumns,
      insertColumnsAfter(after, count) { maxColumns += count; },
      getDataRange: () => current.getRange(1, 1, Math.max(1, rows.length), Math.max(1, current.getLastColumn())),
      copyTo() {
        if (copyFailure) { copyFailure = false; throw new Error('Fallo de respaldo simulado'); }
        const copyName = 'Copy_' + randomUUID();
        tables.set(copyName, structuredClone(rows)); events.push({ type: 'backup', name });
        return sheet(copyName);
      },
      appendRow(row) {
        if (failure === name) { failure = null; throw new Error('Fallo de escritura simulado'); }
        rows.push([...row]);
      },
      deleteRow: index => rows.splice(index - 1, 1),
      getRange(row, column, height = 1, width = 1) {
        const range = {
          getValues: () => Array.from({ length: height }, (_, i) => Array.from({ length: width }, (_, j) => rows[row - 1 + i]?.[column - 1 + j] ?? '')),
          setValues(values) {
            if (failure === name) { failure = null; throw new Error('Fallo de escritura simulado'); }
            values.forEach((valuesRow, i) => { rows[row - 1 + i] ||= []; valuesRow.forEach((value, j) => { rows[row - 1 + i][column - 1 + j] = value; }); });
            events.push({ type: 'write', name, row, column }); return range;
          },
          setBackground: () => range, setFontColor: () => range, setFontWeight: () => range, setFontSize: () => range,
          protect: () => ({ setDescription() {}, setWarningOnly() {} }),
        };
        return range;
      },
      setFrozenRows() {}, setRowHeight() {}, autoResizeColumns() {},
    };
    return current;
  }
  const spreadsheet = { getSheetByName: sheet, getSheets: () => [...tables.keys()].map(sheet), insertSheet(name) { if (tables.has(name)) throw new Error('Hoja duplicada'); tables.set(name, []); return sheet(name); } };
  const context = vm.createContext({
    SpreadsheetApp: { openById: () => spreadsheet, flush: () => events.push({ type: 'flush' }) },
    Utilities: { getUuid: randomUUID }, Logger: { log() {} },
    LockService: { getScriptLock: () => ({ waitLock() { if (locked) throw new Error('Bloqueo recursivo'); locked = true; events.push({ type: 'lock' }); }, hasLock: () => locked, releaseLock() { locked = false; events.push({ type: 'unlock' }); } }) },
    ContentService: { MimeType: { JSON: 'application/json' }, createTextOutput() {
      return { value: '', setMimeType() { return this; }, setContent(value) { this.value = value; return this; } };
    } },
  });
  vm.runInContext(readFileSync(new URL('../Code.gs', import.meta.url), 'utf8'), context);
  if (initialize) context.crearBaseDeDatos();
  function request(action, payload = {}, method = /^(get|ping)/.test(action) ? 'GET' : 'POST') {
    const event = method === 'GET' ? { parameter: { action, ...payload } } : { postData: { contents: JSON.stringify({ action, ...payload }) } };
    return JSON.parse(context[method === 'GET' ? 'doGet' : 'doPost'](event).value);
  }
  return { request, tables, events, runSetup: () => context.setupSpreadsheet(), diagnose: () => context.validarBaseDeDatos(),
    failNextWrite: name => { failure = name; }, failNextCopy: () => { copyFailure = true; } };
}

export function seedHierarchy(backend) {
  const team = backend.request('createTeam', { nombre: 'Soporte', color: '#c084fc', icono: '👥' }).data;
  const process = backend.request('createProcess', { teamId: team.id, nombre: 'Atención de tickets' }).data;
  return { team, process };
}

export function graphPayload(team, process) {
  return {
    flow: { nombre: 'Resolver ticket', teamId: team.id, processId: process.id },
    nodes: [
      { _tempId: 1, tipo: 'inicio', titulo: 'Inicio', posX: -3 },
      { _tempId: 'decision-id', tipo: 'decision', titulo: '¿Resuelto?', posX: 0 },
      { _tempId: 3, tipo: 'fin', titulo: 'Fin', posX: 3 },
      { _tempId: 'escalar-id', tipo: 'paso', titulo: 'Escalar', posY: -3 },
    ],
    edges: [
      { sourceId: 1, targetId: 'decision-id', condicion: 'siempre' },
      { sourceId: 'decision-id', targetId: '3', condicion: 'positivo', etiqueta: 'Sí' },
      { sourceId: 'decision-id', targetId: 'escalar-id', condicion: 'negativo', etiqueta: 'No' },
      { sourceId: 'escalar-id', targetId: 3, condicion: 'siempre' },
    ],
  };
}
