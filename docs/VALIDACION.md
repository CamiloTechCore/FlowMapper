# Validación e integración — 22/09/2026

## Alcance

Comparación del proyecto local con los doce archivos de `C:\Users\PC\Downloads\files` y la sección 8 del README de Claude. El documento se utilizó como especificación técnica; no se ejecutaron sus comandos de publicación ni se modificaron servicios remotos.

## Hallazgos y cambios

| Hallazgo | Corrección |
| --- | --- |
| Pantallas de constructor y mapa eran placeholders | Galería, equipos, procesos, FlowBuilder, mapa y configuración integrados |
| API local usaba `getData`/`insertRow`, incompatibles con Code.gs | Cliente alineado con acciones `getTeams`, `createTeam`, etc. |
| Archivos entregados usaban `process.env.REACT_APP_GAS_URL` | Adaptación a Vite mediante `VITE_GAS_URL` y compatibilidad con `VITE_API_URL` |
| Faltaban clases del sistema de diseño | Archivos complementarios; `src/index.css` original preservado byte por byte |
| Aristas enviaban índices pero el contexto buscaba IDs temporales | IDs estables compartidos entre constructor y backend; conversión a UUID verificada |
| Ambas ramas de una decisión iban al mismo paso | Selectores independientes de destino para positivo y negativo |
| El guardado parcial podía dejar un flujo incompleto | Acción `saveFullFlow`, bloqueo de escrituras y reversión ante excepciones |
| Se podían borrar padres dejando dependencias huérfanas | Restricción de borrado de equipos/procesos con hijos; limpieza del grafo al eliminar flujo |
| La API aceptaba escrituras por GET | Mutaciones limitadas a POST |
| Actualizar una coordenada a cero conservaba el valor previo | Corrección del tratamiento de cero |
| La escena 3D duplicaba aristas y no liberaba geometrías | Ciclo de vida de escena, observadores, eventos, materiales y renderer corregido |
| Raycasting podía devolver el halo sin datos del nodo | Intersección limitada a las mallas de nodos |
| Salidas del panel de lectura no hacían nada | Selección del nodo destino; enlace al flujo externo |
| Galería no precargaba grafos | Precarga de miniaturas y conteos; guion mientras faltan datos |
| Sidebar decía “conectado” solo por existir una URL | Etiqueta “URL GAS configurada” y validación explícita de `pong` |
| Errores de conexión se confundían con datos vacíos | Aviso persistente, reintento y mensaje para respuestas HTML |
| Toast reasignaba estado global durante render | Suscripción con `useSyncExternalStore` |
| Modales sin control básico de teclado | Escape, foco inicial, retención/restauración de foco y atributos de diálogo |

## Evidencia

- Backend: ocho pruebas Node con el `Code.gs` real en un contexto VM y servicios de Sheets simulados. Incluyen IDs, ramas, referencias inválidas, rollback, borrados, coordenadas cero, setup repetido y contrato de lectura/escritura.
- Navegador Chromium: creación completa de equipo → proceso → flujo; recorrido hasta Fin; recuperación tras recarga; ramificación negativa; búsqueda; error HTML; vista móvil y Escape.
- Revisión visual adicional: constructor con dos destinos distintos, galería, mapa y equipos en móvil. Capturas con datos exclusivamente simulados en `docs/validation/`.
- `npm run lint`: sin advertencias después de las correcciones. Las actualizaciones de estado al inicializar WebGL tienen una excepción documentada a la regla de efectos, porque reflejan el resultado de un sistema externo.
- `npm run build`: compilación de producción correcta. Permanece advertencia por el tamaño del motor Three.js empaquetado.
- SHA-256 del `src/index.css` actual y el respaldo: `097C21AC45A19A1980AA98F3FC73D39D2B235FF44CB214410EFCF2AEB456E350`.

## Pendiente externo

Las solicitudes reales de solo lectura a `ping` y `getTeams` respondieron HTTP 200 con `text/html`; el título de la página fue **Sign in - Google Accounts**. No es una respuesta JSON válida del backend. Es necesario revisar el acceso del WebApp y desplegar el `Code.gs` actualizado con la cuenta autorizada. No se ha validado persistencia contra la hoja real.

La reversión del guardado es una compensación de errores, no una transacción de base de datos: una interrupción forzosa de Apps Script o un error durante la limpieza puede requerir revisar el flujo indicado en el mensaje. Las pruebas simulan fallos recuperables, no cuotas reales ni concurrencia distribuida de Google.

La implementación de referencia no tiene autenticación propia. El backend permite escribir a quienes tengan acceso al WebApp. La política de acceso debe resolverse antes de una publicación con datos sensibles. No se cambiaron permisos ni se publicó una URL.

La UI sigue el alcance del README: creación, lectura y eliminación. No incluye edición visual de grafos existentes. El código JSX se integra con `allowJs` y no tiene tipado estricto.
