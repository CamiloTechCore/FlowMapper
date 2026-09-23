# FlowMapper

Gestión de equipos, procesos y flujos con editor visual y navegación **exclusivamente 2D**, tema blanco y recorrido por decisiones. Implementación adaptada al proyecto existente: **React 19 + Vite + React Flow + Google Apps Script**. La distribución del editor sigue la referencia de diagrams.net: paleta de formas, lienzo cuadriculado y panel de propiedades.

## Ejecutar

Para trabajar en **VS Code**, abre `FlowMapper.code-workspace` de esta carpeta. Incluye los archivos actuales del frontend, `Code.gs`, pruebas, documentación y la configuración local `.env`.

En **Terminal → Ejecutar tarea** están disponibles las tareas `FlowMapper: iniciar aplicación`, revisión de código, pruebas de backend, pruebas de navegador y compilación. `Ctrl+Shift+B` compila a `dist/`. Con el servidor iniciado, `F5` abre Edge para depurar. Si el puerto 5173 ya está ocupado por la aplicación, usa ese servidor; la tarea evita iniciar otra instancia en un puerto distinto. La tarea `FlowMapper: verificar proyecto` ejecuta lint, pruebas de backend y build en secuencia.

El backend `Code.gs` se edita en VS Code, pero guardarlo localmente no lo despliega automáticamente en Google Apps Script. Consulta las instrucciones de actualización para publicar futuras modificaciones.

Desde `C:\Users\PC\Documents\Proyectos\FlowsMapper\FlowsMapper`:

```powershell
npm ci
# Solo si todavía no tienes .env:
Copy-Item .env.example .env
npm run dev
```

Abre la dirección que muestra Vite (normalmente http://localhost:5173). También se admite `npm start`.

Configura la URL del WebApp en `.env`:

```dotenv
VITE_GAS_URL=https://script.google.com/macros/s/TU_ID/exec
```

Se conserva compatibilidad con **VITE_API_URL**, la variable que ya tenía este proyecto. `VITE_GAS_URL` tiene prioridad si ambas están definidas. Reinicia Vite después de cambiarla. No se utiliza `REACT_APP_GAS_URL`: esa variable correspondía al proyecto Create React App de referencia. `.env` está excluido de Git.

## Conectar Google Apps Script

1. Abre el proyecto de Apps Script con acceso al Spreadsheet y sustituye su código por el `Code.gs` de esta carpeta. Conserva una copia de la versión desplegada si contiene otras funcionalidades.
2. Verifica que `SPREADSHEET_ID` corresponde a la base deseada. Se conservó el ID del archivo entregado.
3. Ejecuta `validarBaseDeDatos()` para revisar el esquema sin cambios. Después ejecuta `crearBaseDeDatos()` (también funciona el nombre anterior `setupSpreadsheet`) y autoriza el acceso. Reutiliza `Equipos`, `Procesos`, `Flujos`, `Nodos` y `Conexiones` aunque tengan mayúsculas; crea las tablas que falten y `meta`. Copia las tablas cuyo esquema cambia a pestañas `_backup_...` y añade columnas al final, sin reordenar ni borrar las celdas existentes. Las escrituras identifican los campos por sus encabezados.
4. Implementa como aplicación web, ejecutada con la cuenta que tiene acceso a la hoja. El cliente de referencia usa peticiones anónimas: el WebApp necesita permitirlas para funcionar con este frontend. La versión actual no incluye inicio de sesión ni control de acceso propio; revisa que ese modelo sea adecuado antes de publicar datos o habilitar escrituras.
5. Copia la URL terminada en `/exec` a `.env`. Puedes actualizar la versión de una implementación existente para conservar su URL.
6. En **Configuración → Probar Conexión**, verifica que la respuesta contiene `data.pong: true`. Tener una URL definida no implica que el backend esté conectado.

**Estado de esta actualización:** el archivo local `Code.gs` es **1.3.0**. La consulta remota más reciente a `getSchemaStatus` todavía devuelve **1.1.0** (consulta del 23/09/2026: un equipo, un proceso, un flujo, nueve nodos y ocho conexiones). Debes publicar la versión nueva para guardar desde el editor. El diagnóstico de la versión antigua no conoce las columnas nuevas y por eso puede informar `requiereMigracion:false`. No se realizaron escrituras en Google Sheets desde esta tarea; las pruebas de guardado usan el `Code.gs` real con servicios GAS simulados.

Este frontend añade la acción **`saveFullFlow`**: debes implementar el `Code.gs` actualizado, no solamente la versión original de Claude.

La versión **1.3.0** mantiene `getData` e `insertRow` del script anterior, devuelve los registros creados y conserva los IDs suministrados (rechazando duplicados). `GET /exec` sin parámetros responde a `ping`; `getSchemaStatus` diagnostica la migración sin escribir. Consulta [las instrucciones de actualización](docs/ACTUALIZAR-APPS-SCRIPT.md). Las copias locales previas están en `docs/backups/`.

## Uso

1. **Equipos:** crea un equipo y abre su tarjeta.
2. **Procesos:** agrega un proceso al equipo.
3. **Biblioteca → Nuevo flujo:** selecciona el equipo y abre el constructor. Indica el proceso y el nombre.
4. Añade figuras por clic o arrastre desde **General, Misc, Advanced, Arrows y Flowchart**. Cambia título, descripción y forma en el inspector. El texto se ajusta y la figura crece cuando lo necesita.
5. Cada figura tiene **cuatro anclajes**: superior, derecho, inferior e izquierdo. Cada lado admite una conexión como origen o destino; se permiten **cuatro conexiones totales a figuras diferentes**, contando entradas y salidas. Conecta arrastrando o mediante **Conectar nodos**.
6. **Arrows** permite elegir líneas continuas o discontinuas. Arrastrar el estilo al lienzo lo activa para la siguiente conexión entre anclajes. Selecciona una conexión para cambiar estilo, etiqueta y resultado **Sí / No / Siempre**. Se admiten bifurcaciones y ciclos entre figuras mientras haya lados libres.
7. Selecciona varias figuras con **Mayús + clic** o **Mayús + arrastrar**. Usa **Ctrl/Cmd+C**, **Ctrl/Cmd+V**, **Suprimir** o **Retroceso**; también hay botones. Copiar conserva conexiones internas y pegar genera IDs nuevos. Copiar una conexión seleccionada incluye sus dos extremos. El portapapeles es interno, válido mientras la aplicación permanezca abierta. Los atajos respetan la edición de texto en campos.
8. Desplázate por el fondo, usa zoom, minimapa, **Ordenar** y **Ver todo**. Guarda para registrar el flujo en la **biblioteca**, agrupada por equipo y filtrable por proceso.
9. **Abrir mapa** muestra el diagrama 2D. **Recorrer** permite elegir rutas manualmente y regresar a pasos anteriores. Puede comenzar en una figura Inicio o, si no existe, en una raíz o la primera figura del diagrama.
10. **Editar flujo** conserva el ID del flujo y de sus elementos existentes. Los grafos anteriores se adaptan visualmente a cuatro lados sin descartar conexiones. Si exceden el límite o tienen conexiones paralelas, se muestran los errores y hay que corregirlos antes de guardar.

Eliminar un flujo también elimina sus nodos y conexiones. Para eliminar un proceso o equipo primero hay que quitar sus dependencias. No se permite borrar un flujo referenciado desde otro. El editor avisa antes de descartar cambios y conserva el diseño abierto si falla el guardado. **Exportar JSON** descarga una copia del diseño; no es un archivo `.drawio`.

El alcance es **diseñar, guardar y recorrer** diagramas de flujo generales, según RF-CFD-001. Se retiró la biblioteca de automatizaciones tipo n8n y los puertos dinámicos. Los metadatos anteriores se conservan como referencia; no se ejecutan automatizaciones ni servicios externos.

## Diseño conservado

`src/index.css` se mantiene **sin modificar**. El tema blanco solicitado se aplica mediante estilos complementarios que sustituyen visualmente el fondo anterior sin editar ese archivo:

- `src/styles/claude-design.css`: sistema de componentes del archivo entregado.
- `src/styles/gallery.css`: estilos de galería extraídos del README.
- `src/styles/integration.css`: compatibilidad con el tema claro, legibilidad, avisos y adaptación móvil.
- `src/styles/workflow.css` y `workflow-shapes.css`: distribución del editor y mapa.
- `src/styles/diagram.css`: biblioteca por categorías, figuras SVG y texto adaptable con cuatro anclajes.
- `src/styles/library.css`: biblioteca con tabla por equipo.
- `src/styles/white-theme.css`: tema blanco final, paneles del mapa y transiciones suaves; respeta la preferencia de movimiento reducido.

El tema blanco se carga al final. Las fuentes de Google requieren conexión; hay fuentes de sistema como alternativa. Se retiró Three.js y no se crean escenas ni lienzos WebGL.

## Estructura

```text
Code.gs                        Backend para Apps Script
src/main.tsx                   Entrada Vite
src/AppShell.jsx               Rutas, navegación y proveedores
src/context/                   Estado compartido
src/services/                  API y variables de entorno Vite
src/components/                Constructor y mapa React Flow, sidebar y UI
src/workflow/model.js          Figuras, cuatro anclajes, portapapeles y validación del grafo
src/pages/                     Biblioteca, equipos, detalle, mapa y configuración
src/index.css                  CSS original conservado
src/styles/                    Estilos complementarios
tests/                         Pruebas de backend y navegador
docs/README-Claude.md          Documento de referencia original
docs/VALIDACION.md             Hallazgos, correcciones y límites
```

Se mantuvieron JSX y JavaScript de los archivos entregados junto con la entrada TypeScript. `allowJs` permite esta integración; los JSX no cuentan con comprobación estricta de tipos. Las pruebas funcionales cubren los recorridos principales.

## Verificar y compilar

```powershell
npm run lint
npm test
npx playwright install chromium
npm run test:e2e
npm run build
npm run preview
```

Las pruebas E2E levantan un servidor aislado en el puerto 5174 e interceptan todas las llamadas GAS; no modifican la base real. `npm run build` crea **dist/**, no `build/`. Consulta [la validación del editor 2D](docs/EDITOR-VISUAL-2D.md) y las capturas en `docs/validation/`.

Para alojamiento estático, sirve `dist/` y configura la redirección de rutas desconocidas a `index.html` para BrowserRouter. Define `VITE_GAS_URL` antes de compilar. No se ha publicado el aplicativo.

El respaldo de los archivos anteriores está en la carpeta hermana `respaldo-antes-integracion-20260922/`. Los archivos originales en Downloads permanecen intactos.
