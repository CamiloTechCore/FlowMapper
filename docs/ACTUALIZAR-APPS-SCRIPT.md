# Actualizar FlowMapper a Code.gs 1.2.0

El archivo listo para copiar es `../Code.gs`. **La versión local es 1.2.0 y la implementación remota todavía responde 1.1.0.** Esta actualización es necesaria para el editor de diagramas 2D. Desde esta tarea solo se verificaron lecturas remotas; no se ejecutaron migraciones ni escrituras reales.

La versión nueva añade `tipo`, `sourceHandle` y `targetHandle` al final de la tabla `Conexiones`. Esto permite guardar secuencias, dependencias de modelo y puertos dinámicos. Guarda configuración, forma y posición 2D en `Nodos.metadata`. No elimina columnas antiguas ni registros. Admite editar el grafo conservando el mismo flujo.

## Pasos

1. Entra con la cuenta que administra el proyecto de Apps Script asociado a tu URL `/exec`.
2. Reemplaza **todo el contenido** de su `Code.gs` por el archivo actualizado. No lo agregues debajo del código anterior: duplicaría `SPREADSHEET_ID`, `doGet` y `doPost`. Si tienes otros archivos con esas mismas funciones o constantes, conserva una copia y deja una sola definición activa.
3. Guarda y ejecuta `validarBaseDeDatos`. Con este código debe devolver versión **1.2.0** y las columnas faltantes en `Conexiones`: `tipo`, `sourceHandle`, `targetHandle`. No escribe datos. Si también partes de una versión anterior a 1.1.0, puede indicar `refFlowId` y `actualizadoEn` en `Nodos`.
4. Ejecuta `crearBaseDeDatos` y autoriza los servicios de Google. También puedes ejecutar `setupSpreadsheet`, que ahora es un alias de la misma migración.
5. Revisa el registro: debe listar `RESPALDO`, `ADAPTADA` y/o `OK`. Los respaldos se crean dentro del mismo Spreadsheet con nombres `_backup_conexiones_...` (y de otras tablas que cambien); no se eliminan automáticamente.
6. Actualiza la implementación web existente a una nueva versión que incluya este código. Guardar en el editor no actualiza por sí solo una implementación versionada. Si conservas la implementación existente, utiliza su misma URL `/exec`; si creas otra, actualiza `.env` y reinicia Vite. [Documentación de implementaciones de Google](https://developers.google.com/apps-script/concepts/deployments).
7. Revisa el acceso del WebApp. Si una consulta termina en **Sign in - Google Accounts**, el acceso no es compatible con este cliente. Este frontend hace peticiones sin autenticación: el acceso de la implementación debe permitirlas, o habrá que añadir autenticación. [Documentación de aplicaciones web de Google](https://developers.google.com/apps-script/guides/web).
8. Abre la URL con `?action=ping`: debe devolver JSON con `success:true`, `data.pong:true` y `data.version:"1.2.0"`. Después consulta `?action=getSchemaStatus` (debe indicar **versión 1.2.0** y `requiereMigracion:false`). Un diagnóstico servido por 1.1.0 no reconoce las columnas nuevas aunque diga que no hay migración pendiente.
9. En FlowMapper, abre **Configuración → Probar Conexión** y después consulta los equipos existentes.

## Qué conserva la migración

- Reutiliza las pestañas existentes independientemente de mayúsculas/minúsculas y espacios exteriores. No renombra tus pestañas.
- No mueve columnas, borra filas ni reescribe los valores anteriores de las tablas de negocio.
- Añade al final los encabezados faltantes. En `Nodos`, `metadata` y `creadoEn` conservan su posición y sus valores; los campos nuevos quedan vacíos en las filas anteriores hasta que se actualicen.
- Las operaciones de creación y actualización localizan cada columna por su encabezado. Las columnas adicionales y sus fórmulas se conservan al actualizar registros.
- Antes de añadir columnas a una tabla existente crea una copia completa de esa pestaña usando `Sheet.copyTo`. [Referencia de Google](https://developers.google.com/apps-script/reference/spreadsheet/sheet#copyTo(Spreadsheet)).
- Valida todas las tablas antes de iniciar. Ante encabezados duplicados/vacíos, registros sin ID, IDs duplicados o nombres ambiguos de pestañas, se detiene con un mensaje que identifica el problema.
- Puede repetirse: las columnas ya presentes no se duplican y las tablas que no cambian no generan copias nuevas.
- Conserva `inicializadoEn` en `meta`; actualiza allí la versión del backend y la referencia al último respaldo.

La migración no reconstruye registros que ya estuvieran dañados ni inventa IDs para filas sin identificador. Si ocurre un error de permisos/cuota durante la ejecución, pueden quedar algunas tablas adaptadas y otras pendientes; las tablas anteriores y sus respaldos se conservan, y se puede repetir tras corregir el error. No es una transacción global del Spreadsheet.

## Compatibilidad

- API actual: equipos, procesos, flujos, nodos, conexiones, estadísticas y `saveFullFlow`.
- API anterior: `getData&sheet=Equipos` y POST `insertRow` con `sheet` y `payload`. Solo acepta las tablas de la aplicación; rechaza otras pestañas y los respaldos. `insertRow` conserva el ID proporcionado si es único, genera uno si falta y devuelve `data` más el mensaje de éxito anterior.
- Todas las escrituras requieren POST. Las peticiones se serializan con un bloqueo y se vacían los cambios pendientes antes de liberar el bloqueo. [Referencia de Google](https://developers.google.com/apps-script/reference/lock/lock).
- Abrir `/exec` sin parámetros muestra `ping`, sin leer ni modificar las hojas.
- Los nombres de campos deben conservar su escritura: `teamId`, `flowId`, `metadata`, etc. No se interpretan cambios arbitrarios como `EquipoID`.

## Verificación local

Consulta el resultado actual en [EDITOR-VISUAL-2D.md](EDITOR-VISUAL-2D.md). `src/index.css` conserva el SHA-256 `097C21AC45A19A1980AA98F3FC73D39D2B235FF44CB214410EFCF2AEB456E350`.

Se ejecutan pruebas contra el `Code.gs` real con servicios de Google simulados. Cubren la migración de las tablas antiguas, respaldo antes de escribir, idempotencia, columnas reordenadas, metadata/fechas, conservación de fórmulas adicionales, compatibilidad de IDs, fallos de respaldo/escritura, bloqueo de esquemas ambiguos y los recorridos de creación y eliminación de grafos.

```powershell
npm test
npm run test:e2e
npm run lint
npm run build
```

Los tests no prueban permisos, cuotas reales ni persistencia en el Spreadsheet remoto. El CSS no se modificó durante esta adaptación.

Copias de referencia: `docs/backups/Code.antes-editor-1.1.0.gs.txt`, `docs/backups/Code.antes-migracion.gs.txt` y `docs/backups/Code.adjunto-original.gs.txt`.
