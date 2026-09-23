# Editor visual 2D y biblioteca

## Implementación

- Editor blanco con paleta lateral, cuadrícula infinita, zoom, minimapa y propiedades a la derecha, siguiendo la referencia visual de diagrams.net proporcionada por el usuario.
- Figuras SVG: óvalo, rectángulo, rombo y cilindro. La forma puede cambiarse en las propiedades sin cambiar el tipo funcional del nodo.
- Nodos individuales: activador, variables, datos, transformación, decisión, integración, IA, modelo, formato, notificación, paso, fin y flujo vinculado.
- Conexiones dirigidas, ramas Sí/No, bifurcaciones, retornos y dependencias de modelo discontinuas. Validación tanto en cliente como en `Code.gs`.
- Puertos adicionales y parámetros por nodo; adjuntos como referencias para integraciones y notificaciones.
- Biblioteca con tablas agrupadas por equipo, búsqueda, ordenación y filtro por proceso. Los filtros de equipo/proceso permanecen en la URL.
- Creación desde la biblioteca: al guardar aparece la fila con acceso al mapa. Creación desde un equipo: abre el mapa y permite volver a la biblioteca del equipo.
- Modificación desde el mapa. Mantiene el ID del flujo, sus nodos y conexiones existentes; limpia elementos eliminados y evita sobrescribir una versión cambiada en otra sesión.
- Mapa 2D navegable con selección, desplazamiento, zoom y centrado suave. Recorrido manual de decisiones y ramas, regreso a pasos anteriores y elección de activador si hay varios.
- Tema blanco general mediante `white-theme.css`; transiciones cortas entre páginas, respetando movimiento reducido. `index.css` permanece idéntico al original.
- Se retiró la dependencia Three.js. El código anterior se conserva como referencia en `docs/backups/NeuralMap.3d-retirado.jsx.txt`, fuera de la aplicación.

## Persistencia y actualización del servidor

El backend local es **1.2.0**. La última consulta remota de esta actualización devolvió **1.1.0**, un equipo y un proceso, sin flujos. La actualización remota está **pendiente**. Sigue `ACTUALIZAR-APPS-SCRIPT.md`: reemplazar código, ejecutar `crearBaseDeDatos()` y actualizar la implementación a una nueva versión.

Se añaden tres columnas a `Conexiones`, con respaldo previo. Los campos existentes de los nodos se conservan, incluida la columna histórica `posZ`, que los nuevos diagramas guardan como cero. La posición del editor se almacena en `metadata.editorPosition`; las coordenadas antiguas se convierten a 2D al abrirlas.

Las escrituras de grafos usan un bloqueo. Ante un error, la creación elimina el flujo parcial y una edición intenta restaurar las filas originales del flujo, incluidas columnas adicionales y fórmulas. Google Sheets no ofrece una transacción entre estas tablas: una interrupción de ejecución o un segundo error durante la restauración puede requerir revisión manual; el error se comunica al cliente.

El editor consulta la versión y el esquema antes de guardar. Si el servidor no está actualizado o el guardado falla, mantiene el diseño abierto y muestra el motivo. Se puede descargar una copia JSON del diseño; no implica guardado remoto ni compatibilidad de importación `.drawio`.

## Verificación

Resultado final: **27 pruebas de backend/modelo/migración y 9 pruebas de navegador aprobadas**. `npm run lint` finaliza sin advertencias y `npm run build` genera `dist/` correctamente. Permanece un aviso de Vite por el archivo JavaScript de 506 kB (159 kB comprimido); no impide la compilación. El servidor local `http://127.0.0.1:5173/` y el módulo actualizado respondieron HTTP 200.

Se comprobó el centrado del nodo seleccionado, la conservación de la edición tras recargar, la ausencia de lienzos WebGL/vista 3D y el fondo blanco. `src/index.css` mantiene el SHA-256 `097C21AC45A19A1980AA98F3FC73D39D2B235FF44CB214410EFCF2AEB456E350`.

Las pruebas de backend ejecutan el `Code.gs` del proyecto en un entorno simulado de Google Apps Script. Las pruebas de navegador interceptan todas las llamadas al servidor: **no crean datos reales en Google Sheets ni envían correo, ni consultan GitHub/IA**.

Cobertura: migración conservadora, fallos de escritura, restauración de ediciones, IDs estables, detección de versiones obsoletas, conexiones válidas/inválidas, ramas, splits, ciclos, dependencias, parámetros, puertos y adjuntos; creación de equipo/proceso/flujo, biblioteca, reapertura, edición, arrastre de paleta/nodo/puertos, desplazamiento del mapa y móvil.

Capturas de referencia: `editor-visual-desktop.png`, `biblioteca-desktop.png`, `mapa-visual-desktop.png`, `editor-visual-mobile.png`, `biblioteca-mobile.png` y `mapa-visual-mobile.png`, en `docs/validation/`.

El alcance acordado es diseño, persistencia y navegación manual. Los nodos de programación, HTTP, IA, correo y transformación no ejecutan servicios ni expresiones. La disposición y los símbolos se inspiran en diagrams.net; no se incorpora su motor ni se garantiza compatibilidad de archivos con esa aplicación.
