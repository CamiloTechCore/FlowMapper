# Validación del Code.gs adjunto — 22/09/2026

> Informe histórico de la versión adjunta antes de adaptarla. El `Code.gs` local ya se actualizó a la versión 1.1.0 con migración conservadora y compatibilidad con la API anterior. Consulta [ACTUALIZAR-APPS-SCRIPT.md](ACTUALIZAR-APPS-SCRIPT.md). La actualización remota sigue pendiente.

Resultado: sintaxis JavaScript válida, pero el contrato del adjunto no es compatible con el frontend actual. La implementación remota no se pudo inspeccionar porque redirige a autenticación de Google.

## Pruebas realizadas

- Análisis sintáctico del adjunto mediante `vm.Script`: correcto. No equivale a una ejecución real de los servicios de Google Apps Script.
- Ejecución local de `doGet` del adjunto con respuesta JSON simulada: `ping`, `getTeams`, `getStats` y `getFullFlow` devolvieron `{success:false,message:"Acción GET no válida"}`.
- GET reales a la URL entregada con acciones `ping`, `getTeams`, `getStats` y `getData&sheet=Equipos`: HTTP 200, contenido `text/html`, destino `accounts.google.com`, título `Sign in - Google Accounts`.
- La URL efectiva de `.env` ya coincide con la URL entregada. Cambiarla por la misma no resuelve el problema.
- Las ocho pruebas del backend local `Code.gs` siguen pasando con servicios GAS simulados.
- No se hicieron POST remotos, cambios de permisos, despliegues ni escrituras en Google Sheets.

## Incompatibilidades

| Aspecto | Adjunto | Aplicación actual |
| --- | --- | --- |
| Lecturas | `getData` con `sheet` | `ping`, `getTeams`, `getAllProcesses`, `getAllFlows`, `getStats`, `getFullFlow`, etc. |
| Escrituras | `insertRow` con `sheet` y `payload` | Acciones por entidad y `saveFullFlow` |
| Respuesta al crear | `success` y `message` | `success` y `data` con el registro y su ID |
| Identificadores/fechas | Se esperan dentro de `payload`; no se generan | El backend genera IDs y fechas |
| Actualización/borrado | No implementados | El cliente declara estas acciones y la UI permite eliminar |
| Nodos | 10 columnas; termina en `posZ, metadata, creadoEn` | 12 columnas; termina en `posZ, refFlowId, metadata, creadoEn, actualizadoEn` |
| Hoja inexistente | Devuelve un arreglo vacío | Debe distinguirse del caso de una hoja existente sin registros |

## Antes de reemplazar el backend

El `Code.gs` del proyecto implementa el contrato actual, pero su setup inicial solo añade encabezados a hojas vacías. **No migra las columnas de hojas antiguas con datos**. Si se utiliza con el esquema del adjunto, las escrituras por posición de `nodos` no coincidirían con los encabezados existentes a partir de `refFlowId`.

Hay que respaldar la hoja y adaptar sus encabezados y filas conservando la correspondencia por nombre de columna, especialmente `metadata` y `creadoEn`. También debe verificarse la resolución de los nombres de pestañas (`Equipos`/`equipos`, etc.) y la existencia de la hoja `meta` que usa el backend actual. Esta validación no modificó el esquema real.

Después debe actualizarse la implementación con el backend compatible y resolverse el acceso al WebApp. El frontend actual envía peticiones sin autenticación; la política de acceso debe ser compatible con ese modelo o se necesita implementar autenticación en el cliente/backend. Dar acceso a la URL no añade las acciones que faltan en el código adjunto.

La comprobación remota de aceptación es una respuesta JSON a `?action=ping` con `success:true` y `data.pong:true`, seguida de lecturas válidas a `getTeams`, `getAllProcesses`, `getAllFlows` y `getStats`. El código desplegado no puede confirmarse a partir de una página de inicio de sesión.
