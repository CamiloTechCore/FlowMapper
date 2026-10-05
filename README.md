# FlowMapper

FlowMapper es una plataforma documental para cargar, organizar y consultar los procesos de diferentes equipos como flujos de trabajo visuales. Documenta las acciones y la lógica de decisión que cada agente debe seguir según el playbook de su cliente, con énfasis en los procesos de cobranza.

## Qué hace y cuál es su objetivo

Centraliza la biblioteca de procesos, permite recorrer sus decisiones y vincula cada nodo con un segmento, un criterio de calidad y las oportunidades de mejora que se detecten. Su objetivo es dar claridad a cada gestión: qué revisar, qué preguntar, qué acción realizar, cómo negociar, cómo registrar el resultado y cómo cerrar la interacción.

La aplicación documenta y permite revisar el diseño del proceso. El recorrido es manual: no ejecuta cobranzas ni evalúa automáticamente conversaciones reales. El porcentaje de calidad corresponde a la revisión documental realizada por el administrador.

## Organización de la biblioteca

**Carpeta / grupo principal → equipos o grupos → procesos → uno o varios flujos → nodos y conexiones.**

- La carpeta agrupa equipos, por ejemplo los de un cliente o una operación. Es una agrupación lógica; no importa directorios del computador.
- Cada equipo actúa como grupo operativo y puede contener varios procesos.
- Cada proceso puede tener uno o varios flujos según el playbook.
- Dentro de cada flujo se crean segmentos: conjuntos de nodos con nombre, color, criterio y condición de transición.
- Los segmentos del diagrama son independientes de las carpetas y equipos de la biblioteca.
- Los equipos existentes permanecen en **Sin carpeta** hasta que el administrador los asigne. Sus IDs, procesos, flujos y etiquetas se conservan.

La biblioteca incluye un árbol desplegable de carpetas, equipos, procesos y enlaces a flujos. Permite filtrar por carpeta, equipo o proceso, buscar por texto y etiqueta y ordenar los flujos por nombre o actualización.

## Metodología de registro

1. Crear o seleccionar la carpeta, el equipo y el proceso correspondiente al cliente y su modelo de cobranza.
2. Consultar el playbook y registrar su referencia en la descripción del flujo o en los enlaces de los nodos relevantes. La aplicación admite documentación y enlaces; no incorpora un importador automático de playbooks.
3. Crear el flujo con sus actividades, decisiones, condiciones y rutas alternativas.
4. Definir los segmentos y sus criterios: nombre, color, instrucciones del playbook y condición para continuar al siguiente grupo.
5. Asignar cada nodo a su segmento. Para agrupar varios nodos, seleccionarlos con Mayús o Control y usar **Asignar a selección**. Cada nodo pertenece a un segmento a la vez; puede quedar sin asignar durante la elaboración.
6. Documentar las instrucciones del agente y revisar cada nodo como **Pendiente**, **Cumple**, **No cumple** o **No aplica**. Este último estado exige una justificación.
7. Guardar manualmente con **Guardar avance** para continuar editando o con **Guardar flujo / Guardar cambios** para guardar y salir.
8. Recorrer las rutas, contrastar cada segmento con el playbook y revisar la matriz de calidad documental.
9. Registrar errores y propuestas de optimización en el nodo donde se presentan. Explicar la oportunidad y el ajuste propuesto; compartir su ID o enlace directo para localizarlo.

## Modelo de cobranza y código de colores

La plantilla **Añadir criterios de cobranza** incorpora cinco segmentos editables. La presentación y el mensaje de deuda se separan para representar cinco criterios; la resolución forma parte del registro. Los nombres, colores y condiciones se adaptan al playbook de cada cliente.

| Orden | Segmento | Color | Código | Qué documenta | Condición de paso |
| --- | --- | --- | --- | --- | --- |
| 1 | Presentación / contexto | Azul | `#2563EB` | Saludo, presentación del agente, titularidad y preguntas iniciales requeridas. | Contexto y titularidad confirmados para dar el mensaje permitido. |
| 2 | Mensaje de deuda | Turquesa | `#0891B2` | Información de la deuda y pregunta sobre intención o fecha de pago. | Respuesta del cliente que da inicio a la negociación. |
| 3 | Negociación | Anaranjado | `#EA580C` | Alternativas, condiciones y decisiones autorizadas. Puede ser extensa o solo informativa. | Acuerdo, no acuerdo o interrupción que debe registrarse. |
| 4 | Registro / resolución | Morado | `#9333EA` | Resolución, comunicación posible al cliente, tipificación y registro de la gestión. | Resultado consistente con lo sucedido y con la respuesta del cliente. |
| 5 | Cierre | Verde | `#16A34A` | Despedida, confirmaciones y preguntas adicionales indicadas por el playbook. | Gestión finalizada en coherencia con el registro. |

Los nodos muestran el color y el nombre del segmento. La leyenda mantiene visible su significado y el minimapa utiliza los mismos colores. Las conexiones entre segmentos muestran origen, destino y condición de transición, sin cambiar la lógica ni las etiquetas persistidas de la conexión.

### Resolución e interrupción

La ruta con consenso y la ruta en la que el cliente termina la interacción deben registrar su resultado dentro del mismo segmento **Registro / resolución**. Pueden usar nodos y tipificaciones diferentes. La revisión de estos registros permite ubicar oportunidades de mejora en los nodos anteriores.

Si el cliente interrumpe la interacción, se documenta la gestión y la imposibilidad de dar el cierre verbal. El criterio correspondiente puede marcarse **No aplica**, con justificación. No debe registrarse como cierre verbal cumplido. Cuando sí es posible cerrar, la despedida y las preguntas adicionales deben seguir el playbook y ser coherentes con lo registrado.

## Matriz de calidad documental

La matriz se actualiza en el editor mientras se carga el flujo y se consulta también en el mapa. Muestra por segmento el total de nodos, los que cumplen, las excepciones justificadas y el porcentaje de cumplimiento.

**Cumplimiento = nodos que cumplen / nodos aplicables × 100.** Los nodos pendientes y los que no cumplen permanecen en el denominador. Los nodos sin segmento también reducen el porcentaje general. Las anotaciones de texto se excluyen. Los nodos con **No aplica** justificado se excluyen del denominador; no se convierten en cumplidos. Si no hay nodos aplicables, se muestra que no aplica, sin inventar un porcentaje.

La revisión completa exige que no haya nodos operativos sin segmento, que cada segmento tenga nodos y que sus criterios y transiciones estén definidos. Todos sus nodos deben cumplir o tener una excepción justificada. El porcentaje y el estado de revisión se muestran por separado: un segmento vacío o sin criterio no permite declarar la revisión completa.

Esta matriz sirve para revisar la documentación. Verificar el cumplimiento real de un agente requiere evidencias de la gestión; esa evaluación no se captura automáticamente en esta versión.

## Login y permisos

El acceso requiere correo y contraseña. El formulario envía las credenciales mediante POST a **Code.gs**, que consulta la hoja `usuarios` de Google Sheets y emite una sesión temporal de hasta una hora. El navegador recibe únicamente los datos públicos del usuario y el token de sesión; no descarga la hoja ni sus hashes. La sesión se mantiene en `sessionStorage` para recargar la pestaña.

Hay un único administrador en `usuarios`, configurado manualmente desde Apps Script. Las demás cuentas se crean como lectores desde la pantalla **Usuarios**. Conocer una URL de la biblioteca o del backend no concede permisos de lectura o escritura.

| Acción | Administrador | Lector |
| --- | --- | --- |
| Consultar todas las carpetas, equipos, procesos y flujos de la biblioteca | Sí | Sí |
| Buscar, filtrar y ordenar | Sí | Sí |
| Abrir mapas completos, usar zoom, minimapa y recorrido manual | Sí | Sí |
| Consultar criterios, matriz, mejoras, descripciones y enlaces | Sí | Sí |
| Navegar a flujos vinculados y copiar enlaces de nodos | Sí | Sí |
| Crear, editar o eliminar carpetas, equipos, procesos y flujos | Sí | No |
| Configurar segmentos, nodos, conexiones o revisión documental | Sí | No |
| Exportar el diseño desde el constructor | Sí | No |
| Autorizar, actualizar o desactivar lectores | Sí | No |
| Consultar la tabla de usuarios o el diagnóstico del esquema | Sí | No |
| Cerrar su propia sesión | Sí | Sí |

La interfaz de lectura presenta el aplicativo completo para consulta y navegación, sin botones ni formularios de modificación. El constructor no se monta para lectores. Las rutas del backend, incluidas las operaciones heredadas, rechazan sus escrituras. Desactivar un lector revoca su acceso en la siguiente petición al servidor; cerrar sesión elimina la sesión del servidor y del navegador.

## Requisitos funcionales

| ID | Requisito |
| --- | --- |
| RF-01 | Autenticar cuentas con correo y contraseña antes de cargar la biblioteca. |
| RF-02 | Mantener un único administrador configurado y cuentas lectoras autorizadas; rechazar cuentas no registradas. |
| RF-03 | Permitir al administrador crear, editar y desactivar lectores por correo, nombre y contraseña, y restablecer su contraseña. |
| RF-04 | Ofrecer al lector todas las vistas de consulta y navegación, sin operaciones de modificación. |
| RF-05 | Aplicar permisos en el backend a cada petición, incluidas las APIs anteriores. |
| RF-06 | Crear, renombrar, describir y eliminar carpetas vacías; organizar equipos dentro de ellas. |
| RF-07 | Conservar equipos existentes sin carpeta y mantener sus procesos y flujos. |
| RF-08 | Crear y editar equipos; crear procesos y asociar uno o varios flujos a cada proceso. |
| RF-09 | Mantener una etiqueta por equipo, heredada por sus procesos y flujos y filtrable sin distinguir mayúsculas. |
| RF-10 | Consultar el árbol de la biblioteca y filtrar por carpeta, equipo, proceso, texto o etiqueta. |
| RF-11 | Diseñar flujos en un editor 2D con formas, arrastre, zoom, selección, copiado, pegado y minimapa. |
| RF-12 | Conservar cuatro anclajes por figura y una conexión por lado; Inicio y Fin admiten una conexión total. |
| RF-13 | Mantener decisiones con dos salidas Sí / No y conexiones continuas o discontinuas. |
| RF-14 | Crear segmentos configurables con ID, nombre, color, criterio y condición de transición. |
| RF-15 | Asignar uno o varios nodos seleccionados a un segmento y mostrar su nombre y color en editor y mapa. |
| RF-16 | Ofrecer cinco segmentos iniciales de cobranza, editables según el playbook. |
| RF-17 | Mostrar las transiciones entre segmentos con su criterio sin modificar las conexiones guardadas. |
| RF-18 | Registrar revisión por nodo, justificación y oportunidades de optimización en su contexto específico. |
| RF-19 | Mostrar una matriz documental por segmento y general; distinguir pendientes, incumplimientos y excepciones. |
| RF-20 | Documentar las rutas con consenso o interrupción, el registro de la gestión y el cierre coherente con el playbook. |
| RF-21 | Recorrer manualmente ramas, volver a pasos anteriores y navegar a flujos relacionados. |
| RF-22 | Guardar avances manualmente y conservar IDs, posiciones, comentarios, referencias y segmentos. |
| RF-23 | Evitar duplicados al reintentar un guardado y rechazar ediciones de un flujo modificado en otra sesión. |
| RF-24 | Copiar enlaces directos a nodos guardados y abrirlos seleccionados y centrados. |
| RF-25 | Conservar los estados Borrador, Activo, Validación y Desactivado. Todos son consultables por lectores. |
| RF-26 | Conservar el diseño abierto ante un fallo de guardado, permitir reintentar y exportar JSON al administrador. |
| RF-27 | Añadir hojas faltantes mediante migración explícita, preservando encabezados, registros y columnas extra. |

## Requisitos no funcionales

| ID | Requisito y criterio |
| --- | --- |
| RNF-01 | Seguridad: validar credenciales y rol en servidor; denegar sin sesión, almacenar hashes con salt en Sheets y conservar el secreto de autenticación en las propiedades privadas del script. |
| RNF-02 | Privacidad: enviar tokens al backend en cuerpos POST, evitar su inclusión en URLs y no exponer usuarios mediante `getData`. |
| RNF-03 | Integridad: validar pertenencia equipo/proceso/flujo y segmento/nodo; preservar IDs y rechazar referencias inválidas. |
| RNF-04 | Compatibilidad: conservar etiquetas, grafos anteriores, posiciones, campos adicionales y sistema de guardado. |
| RNF-05 | Consistencia: bloquear escrituras concurrentes y revertir las tablas afectadas ante fallos de escritura controlados. Sheets no ofrece una transacción nativa entre hojas. |
| RNF-06 | Rendimiento: leer tablas una vez por petición, escribir por lotes y compartir lecturas simultáneas. El tiempo depende de red, cuotas y volumen; no se garantiza una latencia fija. |
| RNF-07 | Accesibilidad: identificar segmentos con texto además de color; mantener etiquetas de controles y respetar movimiento reducido. |
| RNF-08 | Usabilidad: mantener el diseño visual actual, la navegación de biblioteca y los controles de recorrido existentes. |
| RNF-09 | Adaptabilidad: permitir modificar criterios y colores por flujo; limitar a 50 segmentos por flujo en el backend. |
| RNF-10 | Mantenibilidad: separar autenticación, almacenamiento, jerarquía, segmentos y componentes visuales; verificar lógica y navegador. |
| RNF-11 | Recuperación: exigir guardado manual, advertir al salir con cambios y conservar la posibilidad de recuperar borradores antiguos. |
| RNF-12 | Disponibilidad: informar fallos de conexión y permitir reintentos. El backend utiliza únicamente Apps Script y Sheets. |

## Tecnologías y arquitectura

| Tecnología | Uso |
| --- | --- |
| React 19 y React DOM | Interfaz y componentes. |
| React Router 7 | Navegación entre biblioteca, equipos, mapas y usuarios. |
| React Flow / `@xyflow/react` 12 | Lienzo 2D, nodos, conexiones, controles y minimapa. |
| JavaScript, JSX y TypeScript 6 | Lógica de aplicación y configuración. |
| Vite 8 | Desarrollo y compilación del frontend. |
| CSS y SVG | Diseño, formas y colores de segmentos. |
| Canvas 2D y requestAnimationFrame | Fondo de puntos que reacciona al cursor, sin dependencias de animación. |
| Google Apps Script, `Code.gs` 1.7.0 | API, autenticación, permisos y escrituras. |
| Google Sheets | Biblioteca documental y registro de identidades y roles. |
| Utilities de Apps Script | HMAC-SHA256 y derivación de hashes de contraseña en el servidor. |
| Apps Script CacheService | Sesiones temporales en servidor; pueden expirar antes si se desalojan de la caché. |
| `sessionStorage` | Sesión de la pestaña. |
| `localStorage` | Lectura y eliminación de borradores antiguos; sin nuevas copias automáticas del flujo. |
| Node.js y npm | Dependencias y herramientas. |
| Oxlint, Node Test Runner y Playwright | Revisión de código y pruebas. |

El navegador envía correo y contraseña directamente al backend de Apps Script mediante POST. El servidor verifica las credenciales contra `usuarios` y devuelve una sesión de FlowMapper. A partir de allí consulta la biblioteca o solicita cambios mediante esa sesión. El servidor consulta `usuarios` para comprobar acceso y rol en cada petición. El frontend y el backend se publican por separado.

Las contraseñas se procesan con PBKDF2-HMAC-SHA256, salt individual y 600.000 iteraciones. El hash, salt, versión y parámetros se guardan juntos en `passwordEncriptada`; el nombre de la columna representa un hash irreversible, no una contraseña que pueda descifrarse. Los registros generados por Code.gs utilizan además una clave HMAC protegida por `AUTH_SECRET`. El cálculo repetido se realiza en JavaScript y se verifica contra `node:crypto`; [Utilities de Apps Script](https://developers.google.com/apps-script/reference/utilities/utilities) proporciona las operaciones iniciales y la codificación.

`AUTH_SECRET` se genera al procesar la primera contraseña y debe conservarse: cambiarlo requiere restablecer las contraseñas que dependan de él. Los hashes de importación sin ese secreto se validan y se refuerzan automáticamente en el primer login correcto. Las credenciales de 1.6.0 también se convierten al nuevo formato en el siguiente acceso. La latencia debe comprobarse en la implementación real; las pruebas locales no miden la ejecución en Google.

Después de cinco intentos fallidos por correo se bloquean nuevos intentos durante 15 minutos desde el último fallo, mediante CacheService. Este límite es temporal y puede perderse si Google desaloja la caché. Desactivar un lector o cambiar su contraseña revoca sus sesiones. La API no permite crear otro administrador ni editar el administrador desde la pantalla de lectores.

### Fondo interactivo de puntos

`src/components/point.jsx` presenta puntos de color azul grisáceo sobre fondo blanco. Se utiliza en el login y como fondo general del aplicativo, además del lienzo de edición, el mapa de lectura y la vista general de flujos. Los puntos reaccionan al cursor con un desplazamiento máximo de 2 px, sin ondas de clic ni animación automática.

Los estilos están separados en `src/components/point.css` y `src/styles/point-background.css`. El patrón usa puntos de radio 0,8 px, separación de 16 px y color `rgba(111,149,188,0.38)` constante: la reacción no aumenta su opacidad. Reemplaza la cuadrícula visual de React Flow para evitar fondos duplicados. El ajuste de posiciones de nodos a la retícula de 20 px se conserva.

Cada fondo usa un único canvas y una imagen base almacenada en memoria. Al mover el cursor, se restaura la zona anterior y se dibujan únicamente los puntos cercanos dentro de un radio de 72 px. Los eventos se reúnen en un frame y no hay un ciclo de animación permanente. La densidad de píxeles se limita a 2 para controlar el tamaño del canvas.

El fondo no captura eventos y suspende la reacción durante el arrastre, cuando la pestaña está oculta o si se prefiere movimiento reducido. Se mantienen formularios, conexiones, paneo, zoom, minimapa y recorrido de flujos. Los nodos y paneles conservan superficies legibles sobre los puntos.

## Base de datos

| Hoja | Información |
| --- | --- |
| `carpetas` | ID, nombre, descripción y fechas del grupo principal. |
| `equipos` | Equipos o grupos operativos. |
| `procesos` | Procesos relacionados con un equipo. |
| `flujos` | Nombre, descripción, versión, estado y pertenencia. |
| `nodos` | Actividades, decisiones, descripciones, posiciones, referencias y metadata. |
| `conexiones` | Origen, destino, anclajes, condición, etiqueta y estilo. |
| `usuarios` | Correo, nombre, rol, acceso, fechas y hashes de contraseña con salt y versión de credencial. |
| `meta` | Configuración, etiquetas, pertenencia a carpetas, segmentos y confirmaciones de guardado. |

### Nueva hoja `usuarios`

Encabezados: `id`, `correo`, `nombre`, `rol`, `activo`, `creadoEn`, `actualizadoEn`, `passwordTemporal`, `passwordEncriptada`.

- `correo` se normaliza en minúsculas y debe ser único. `id` identifica al usuario y sus sesiones.
- `rol` admite `administrador` o `lector`. Solo puede existir un administrador; la interfaz gestiona lectores.
- `activo` determina el acceso. No se almacenan tokens en esta hoja.
- `passwordTemporal` recibe una clave nueva de entre 12 y 256 caracteres. Al procesarla, se reemplaza `passwordEncriptada` y se vacía `passwordTemporal`. La temporal no funciona como clave alternativa de login.
- `passwordEncriptada` guarda un JSON con el hash y sus parámetros. No debe editarse manualmente. Solo hay dos columnas de contraseña en el esquema nuevo.
- Escribir una nueva temporal invalida las sesiones anteriores; la nueva clave queda operativa cuando se procesa. Si la clave es inválida o falla la escritura, se conserva el hash anterior y la temporal queda pendiente para corregirla.
- No hay registro público. Todos los usuarios, incluido el administrador, se registran en esta hoja. La pantalla **Usuarios** crea lectores y procesa sus claves al guardar, sin escribir una contraseña legible en Sheets.
- Las columnas adicionales de tablas antiguas se conservan para evitar pérdida de datos. Las credenciales antiguas se convierten al campo único durante el acceso o con `procesarContraseñasTemporales()`. Se conservan IDs y flujos.

### Procesamiento de la contraseña temporal

1. Ejecutar `instalarTriggerUsuarios()` una vez desde el editor de Apps Script. Instala `alEditarUsuarios` para procesar las filas al editar `passwordTemporal` en Sheets.
2. La nueva clave sobreescribe el hash anterior y la celda temporal queda vacía, dentro de una escritura con bloqueo y reversión ante fallos.
3. Para cambios hechos por API o importación, ejecutar `procesarContraseñasTemporales()`. Los [triggers instalables de Google](https://developers.google.com/apps-script/guides/triggers/installable) no se activan por escrituras de API. El login también procesa la temporal pendiente del usuario antes de verificar su clave.
4. No devolver ninguna de las dos columnas al navegador: `getUsers`, `getSession` y `login` solo entregan datos públicos del usuario. El acceso directo a la hoja debe limitarse a sus administradores.

### Jerarquía y segmentos sin alterar tablas existentes

La carpeta de un equipo se guarda en `meta` bajo `teamFolder:{teamId}`. Su etiqueta sigue en `teamTag:{teamId}`. Los segmentos del flujo se guardan bajo `flowSegments:{flowId}` y se devuelven en `flow.segmentos` al consultar el grafo completo. Cada segmento contiene `id`, `nombre`, `color`, `criterio` y `salida`.

El nodo conserva en `metadata` su `segmentId`, `calidad` con `estado` y `justificacion`, y `oportunidad` con el error o propuesta de mejora. Estos datos se guardan junto con el grafo. Eliminar un segmento requiere que ya no tenga nodos asignados.

## Instalación y activación

### Requisitos previos

- Node.js 22.12 o posterior compatible con Vite 8, y npm.
- Cuenta con permisos para administrar el proyecto de Apps Script y el archivo de Sheets.
- Navegador moderno y acceso a Internet. HTTPS para el frontend publicado.

### Configurar autenticación

1. Copiar el nuevo `Code.gs` al proyecto de Apps Script y ejecutar `crearBaseDeDatos()` para actualizar las hojas.
2. Si la hoja ya contiene el administrador con `passwordEncriptada`, no volver a crearlo: ejecutar `instalarTriggerUsuarios()` y publicar el backend. Para una instalación nueva, completar una fila en `usuarios` con ID único, correo, nombre, rol `administrador`, `activo = TRUE` y una contraseña temporal; ejecutar `procesarContraseñasTemporales()`.
3. Como alternativa de configuración inicial desde el editor, usar estas propiedades y ejecutar `configurarAdministrador()`:

| Propiedad | Valor |
| --- | --- |
| `ADMIN_EMAIL` | Correo del único administrador. |
| `ADMIN_PASSWORD` | Contraseña inicial de entre 12 y 256 caracteres. |
| `ADMIN_NAME` | Nombre del administrador, opcional. |

`configurarAdministrador()` crea o actualiza el único administrador en `usuarios`, genera `AUTH_SECRET` si falta y elimina `ADMIN_PASSWORD` de las propiedades al completar la operación. No está disponible mediante HTTP. No se publican credenciales predeterminadas en el código.

4. Ejecutar `instalarTriggerUsuarios()` una vez y publicar una nueva versión de la aplicación web. Acceder con el correo y la contraseña registrados en `usuarios`.
5. Abrir **Usuarios** para crear lectores con nombre, correo y contraseña temporal de al menos 12 caracteres. Al editar un lector, dejarla vacía para conservar la clave o ingresar una nueva para reemplazarla.
6. Para restablecer la contraseña del administrador, editar `passwordTemporal` en su fila y procesarla mediante el trigger o `procesarContraseñasTemporales()`.

### Preparar el backend

1. Usar el archivo de Sheets existente y conservar su ID en `SPREADSHEET_ID`. Para una instalación nueva, crear el archivo y configurar su ID.
2. Copiar `Code.gs` al editor de Apps Script.
3. Ejecutar `validarBaseDeDatos()` para diagnosticar la estructura sin escribir.
4. Ejecutar **manualmente desde Apps Script** `crearBaseDeDatos()` para crear las nuevas hojas `usuarios` y `carpetas` y completar columnas faltantes. La operación conserva datos y crea respaldos de tablas existentes cuyos encabezados cambien. Repetirla no duplica tablas ni columnas.
5. Autorizar el acceso a Sheets cuando Apps Script lo solicite.
6. Publicar como aplicación web que se ejecuta con la cuenta propietaria con acceso a Sheets. El endpoint debe aceptar peticiones del navegador, habitualmente con acceso **Cualquier usuario**; el código exige la sesión de FlowMapper para acceder a los datos. Solo `ping` y el intercambio `login` están abiertos.
7. Copiar la URL terminada en `/exec`.

Para actualizar una implementación existente, editarla en **Implementar → Administrar implementaciones**, seleccionar **Nueva versión** y publicar para conservar la URL. Modificar el archivo local no actualiza el backend remoto.

### Preparar el frontend

Desde la carpeta que contiene `package.json`:

```bash
npm ci
```

Crear o completar `.env`:

```dotenv
VITE_GAS_URL=https://script.google.com/macros/s/TU_IMPLEMENTACION/exec
```

También se admite `VITE_API_URL` por compatibilidad; `VITE_GAS_URL` tiene prioridad. Las variables `VITE_*` quedan visibles en el frontend. No incluir contraseñas, claves privadas ni credenciales de cuentas de servicio.

```bash
npm run dev
```

Abrir la dirección que muestre Vite. Reiniciar el servidor después de cambiar `.env`.

### Publicar y comprobar

```bash
npm run build
npm run preview
```

Publicar `dist/` en un alojamiento estático con HTTPS y reescritura a `index.html` para las rutas de React Router. `preview` permite revisar localmente la compilación. Si cambia la URL del backend, recompilar el frontend.

La URL `/exec?action=ping` debe devolver `success: true`, `data.pong: true` y versión `1.7.0`. Después:

1. Iniciar sesión con el administrador; verificar carpetas y usuarios.
2. Crear una carpeta, asignarle un equipo y crear un proceso con un flujo.
3. Añadir los criterios de cobranza, asignar segmentos a nodos, registrar calidad y guardar el avance.
4. Recargar y verificar IDs, colores, transiciones, etiquetas y mejoras.
5. Acceder como lector y comprobar consulta y recorrido sin edición.
6. Desactivar al lector y verificar que la siguiente consulta al servidor rechace su acceso.

## Verificación del proyecto

```bash
npm run lint
npm test
npm run test:e2e
```

Las pruebas incluyen migraciones, guardado y recuperación, IDs estables, anclajes, ramas de decisión, etiquetas, jerarquía, segmentos, matriz, permisos del backend y vistas de lector. Las pruebas locales simulan Sheets: no escriben en la base remota ni sustituyen la comprobación con cuentas reales después del despliegue.

## Límites operativos

Sheets permite centralizar la documentación con una infraestructura sencilla, pero Apps Script agrega latencia y cuotas. Los datos se leen por tablas y las escrituras comparten un bloqueo; el rendimiento debe medirse con el volumen real. Los diagramas grandes pueden requerir varios segundos. El cliente comparte lecturas simultáneas y mantiene una caché breve de grafos de 15 segundos; los cambios invalidan esa caché.

La reversión de fallos de escritura es gestionada por el código y no equivale a una transacción nativa de base de datos. Editar directamente Sheets puede eludir validaciones: su acceso de edición debe limitarse a quienes administran la solución. Los lectores del aplicativo no necesitan acceso al archivo de Sheets.

El guardado es manual. No se crean copias automáticas locales o remotas del flujo. Si falla una petición, el diseño permanece abierto para reintentar o exportar JSON. Cerrar la pestaña con cambios pendientes muestra una advertencia. Las sesiones pueden vencer anticipadamente por desalojo de CacheService; se debe iniciar sesión de nuevo.

## Conclusión

La intención de FlowMapper es servir como una plataforma documental donde se carguen y mantengan los procesos que cada agente debe seguir según el playbook. La biblioteca organiza distintos clientes, equipos y procesos; los flujos representan las actividades y la lógica de decisión de cada gestión de cobranza. Sus segmentos permiten revisar los criterios de presentación, mensaje, negociación, registro y cierre a medida que se documenta el proceso.

Cuando se detecten errores o propuestas de optimización, se referencia el nodo exacto donde está la oportunidad y se explica cómo mejorarlo: corregir la continuidad lógica, precisar una decisión o agregar acciones que den al agente mayor claridad. La matriz apoya la revisión de la documentación y sus excepciones justificadas. El administrador mantiene este conocimiento y los lectores consultan la guía completa para comprender y seguir la operación.
