# Registro de cambios locales

## Editor 2D, biblioteca y tema blanco

- Sustituido el constructor secuencial por nodos individuales configurables, con formas y distribución inspiradas en diagrams.net.
- Añadidos puertos, decisiones, retornos, bifurcaciones y dependencias de IA, con validación y persistencia en Code.gs 1.2.0.
- Biblioteca en tabla por equipo/proceso; apertura, navegación 2D y edición del mismo flujo.
- Tema blanco moderno, transiciones entre páginas y panel de detalle que no tapa el mapa. Retiradas la vista 3D y la dependencia Three.js.
- `src/index.css` permanece sin cambios. Los nuevos estilos son complementarios.
- El endpoint remoto sigue publicando 1.1.0. Hay un equipo y un proceso existentes; no se crearon ni modificaron datos remotos durante las pruebas. Pendiente publicar el nuevo `Code.gs` siguiendo `ACTUALIZAR-APPS-SCRIPT.md`.
- Detalle y alcance de validación en `EDITOR-VISUAL-2D.md`. Todos los cambios están guardados en el proyecto que abre `FlowMapper.code-workspace`.

## Proyecto preparado para VS Code — 22/09/2026

- Se creó `FlowMapper.code-workspace`, que abre directamente la carpeta interior con `package.json`, `src/` y `Code.gs`.
- Se añadieron tareas del editor para iniciar Vite, ejecutar lint, probar backend/migración, probar navegador y compilar producción, más una verificación secuencial.
- Se añadió una configuración de depuración en Edge para el servidor local y reconocimiento JavaScript de los archivos `.gs`.
- Los cambios del frontend, backend, pruebas, documentación y URL activa ya están guardados en esta misma carpeta. No se creó una segunda copia del aplicativo.
- `.env` permanece local y excluido de Git. `src/index.css` conserva el diseño original.
- Guardar `Code.gs` en VS Code no publica cambios en Apps Script; la implementación remota se gestiona por separado.

## Conexión remota verificada — 22/09/2026

Después de actualizar el acceso de la implementación, la URL configurada respondió correctamente a `ping`, `getSchemaStatus`, `getTeams`, `getAllProcesses`, `getAllFlows` y `getStats`: HTTP 200 y JSON con `success:true`. El backend reporta versión `1.1.0`, `requiereMigracion:false` y cero registros en las cinco tablas de negocio.

También se verificó la aplicación local en Chromium contra el backend real: **Configuración → Probar Conexión** mostró `Conexión exitosa` (respuesta del servidor: `2026-09-22T22:47:34.985Z`), sin solicitudes GAS fallidas. Esta comprobación confirma la conexión desde el navegador, además de las consultas de servidor.

El bloqueo de inicio de sesión descrito más abajo está resuelto. Solo se hicieron lecturas; todavía no se ha probado un guardado real en Google Sheets desde esta tarea.

## Nueva URL de Apps Script — 22/09/2026

- Se sustituyó el endpoint anterior de `.env` por la nueva URL `/exec` entregada por el usuario.
- La configuración activa usa `VITE_GAS_URL`. Se eliminó la definición anterior de `VITE_API_URL` para evitar valores divergentes; el cliente conserva compatibilidad con ambas variables.
- `.env` permanece excluido de Git. La URL de entorno no se añadió al código fuente ni a `.env.example`.
- Se probaron únicamente lecturas: `ping`, `getSchemaStatus`, `getStats` y `getTeams`. Las cuatro devolvieron HTTP 200 con HTML y redirección a `accounts.google.com`, título `Sign in - Google Accounts`.
- La nueva URL está registrada, pero la conexión y la versión del backend remoto continúan sin verificarse debido a esa redirección. No se ejecutaron migraciones ni escrituras remotas.
- El `Code.gs` local adaptado y `src/index.css` permanecen sin cambios en esta actualización de URL.

El proyecto no tiene un repositorio Git inicializado. Este registro corresponde a archivos guardados en disco, no a un commit.
