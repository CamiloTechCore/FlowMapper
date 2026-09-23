# FlowMapper

FlowMapper es una aplicación web para diseñar, documentar y consultar los flujos de trabajo de una organización. Organiza la información en equipos, procesos y flujos, con un editor gráfico 2D y una biblioteca central desde la que se pueden abrir, modificar y recorrer los diagramas.

Su arquitectura combina una interfaz React con un backend en Google Apps Script y almacenamiento en Google Sheets. Está orientada a centralizar el conocimiento operativo con una infraestructura sencilla y un costo de administración reducido.

## Objetivo general

Centralizar la documentación de los procesos de los equipos mediante flujos visuales e interconectados, facilitando su creación, actualización y consulta para comprender las actividades, decisiones y relaciones que conforman la operación.

## Objetivos específicos

- Organizar los flujos en una biblioteca por equipo y proceso para facilitar su localización y mantenimiento.
- Representar actividades y decisiones mediante figuras y conexiones en un lienzo 2D interactivo.
- Permitir recorrer las rutas de un proceso y navegar hacia otros flujos relacionados.
- Documentar actividades con descripciones, enlaces y comentarios ubicados dentro del diagrama.
- Gestionar los estados Borrador, Activo, Validación y Desactivado desde el editor.
- Reducir la pérdida de progreso mediante borradores locales y autoguardado por inactividad.
- Aprovechar Google Sheets como almacenamiento central para disminuir la necesidad de contratar y administrar una base de datos dedicada, aceptando sus limitaciones de rendimiento.

## Funcionalidades principales

El editor ofrece una biblioteca de formas, cuadrícula, arrastre, zoom, minimapa y herramientas para copiar, pegar y eliminar elementos. Las figuras conectables disponen de cuatro anclajes, uno por lado, con una conexión por anclaje. Las decisiones admiten dos salidas: la primera se identifica como Sí y la siguiente como No.

Cada flujo conserva sus nodos, conexiones, posiciones, comentarios y referencias a otros flujos. La biblioteca permite consultar y editar los diagramas; la vista general muestra las relaciones entre los flujos de un equipo. El recorrido permite avanzar por las actividades, elegir una rama y volver a pasos anteriores.

Los borradores se conservan en el navegador. Tras dos minutos de inactividad, el editor intenta guardar los cambios pendientes como Borrador en la biblioteca si el diseño es válido y el backend está disponible. Un borrador local no equivale a una confirmación de guardado en Google Sheets.

El alcance del aplicativo es diseñar, guardar y recorrer flujos. No ejecuta automáticamente las actividades representadas ni las integraciones descritas en los nodos.

## Tecnologías

| Tecnología | Uso en el proyecto |
| --- | --- |
| React 19 y React DOM | Componentes e interfaz de usuario. |
| React Router 7 | Navegación entre biblioteca, equipos y vistas de flujos. |
| React Flow (`@xyflow/react` 12) | Lienzo 2D, nodos, conexiones, zoom y minimapa. |
| JavaScript, JSX y TypeScript 6 | Implementación de la aplicación y configuración del proyecto. |
| Vite 8 | Servidor de desarrollo y compilación del frontend. |
| CSS y SVG | Tema visual, figuras y adaptación de la interfaz. |
| Google Apps Script | API HTTP para consultar, validar y guardar datos. |
| Google Sheets | Almacenamiento central de equipos, procesos y diagramas. |
| `localStorage` | Recuperación de borradores en el navegador. |
| Node.js y npm | Instalación de dependencias y herramientas de desarrollo. |
| Oxlint, Node Test Runner y Playwright | Revisión de código y pruebas de lógica y navegador. |

## Arquitectura y almacenamiento

El navegador se comunica por HTTP con la aplicación web de Apps Script. El archivo `Code.gs` procesa las solicitudes y accede a un único archivo de Google Sheets. El frontend y el backend se publican por separado.

La información se distribuye en las siguientes tablas, relacionadas mediante identificadores:

| Tabla | Información |
| --- | --- |
| `equipos` | Equipos responsables de los procesos. |
| `procesos` | Procesos pertenecientes a cada equipo. |
| `flujos` | Nombre, descripción, estado y pertenencia de cada flujo. |
| `nodos` | Actividades, decisiones, comentarios, posiciones y referencias a otros flujos. |
| `conexiones` | Origen, destino, anclajes, condiciones y etiquetas de las conexiones. |
| `meta` | Información de configuración y versión del esquema. |

El backend reconoce los nombres de las hojas sin distinguir mayúsculas y minúsculas. Los encabezados y los identificadores forman parte del contrato de datos y deben conservarse.

## Instalación local

### Requisitos

- Node.js 22.12 o posterior y npm, compatibles con la versión de Vite del proyecto.
- Una cuenta de Google con acceso de edición al archivo de Sheets y al proyecto de Apps Script.
- Acceso a Internet y un navegador moderno.
- Los archivos del proyecto, incluidos `package.json`, `package-lock.json` y `Code.gs`.

### Preparar el backend

Para una instalación nueva:

1. Crea un archivo de Google Sheets y un proyecto de Google Apps Script.
2. Copia el contenido de `Code.gs` al editor de Apps Script.
3. Configura la constante `SPREADSHEET_ID` con el identificador del archivo de Sheets. Es el segmento situado entre `/d/` y `/edit` en su dirección.
4. Ejecuta `crearBaseDeDatos()` desde Apps Script y autoriza los permisos solicitados. Esta función prepara las hojas y sus encabezados.
5. Selecciona **Implementar → Nueva implementación → Aplicación web**.
6. Configura la ejecución con la cuenta que tiene acceso a la hoja y publica la implementación.
7. Conserva la URL de la aplicación web terminada en `/exec` para configurar el frontend.

El cliente actual realiza solicitudes sin autenticación propia. Para que funcione con esta arquitectura, la implementación debe permitir acceso anónimo, normalmente mediante la opción **Cualquier usuario**, si la política de la cuenta lo permite. Esta configuración también permite que quien tenga la URL invoque las operaciones de lectura y escritura: los equipos de la biblioteca no constituyen permisos de acceso. Un uso con información restringida requiere incorporar autenticación y autorización antes de publicarlo. Consulta la [documentación de implementación y permisos de Apps Script](https://developers.google.com/apps-script/guides/web).

Si utilizas una base y una implementación existentes, conserva su `SPREADSHEET_ID` y URL. No necesitas recrear las hojas para instalar el frontend. Para revisar la estructura sin modificarla puedes ejecutar `validarBaseDeDatos()`; ejecuta la preparación del esquema únicamente si faltan tablas o columnas necesarias.

### Preparar el frontend

Abre en una terminal la carpeta que contiene `package.json`. Opcionalmente, abre `FlowMapper.code-workspace` en VS Code.

Instala las dependencias:

```bash
npm ci
```

Crea un archivo `.env` en esa misma carpeta y agrega la URL de tu implementación:

```dotenv
VITE_GAS_URL=https://script.google.com/macros/s/TU_IMPLEMENTACION/exec
```

También se admite `VITE_API_URL` por compatibilidad; si defines ambas variables, se utiliza `VITE_GAS_URL`. Las variables `VITE_*` se incorporan al frontend y no deben contener secretos.

Inicia la aplicación:

```bash
npm run dev
```

Abre la dirección que indique Vite, normalmente `http://localhost:5173`. Reinicia el servidor si modificas `.env`.

### Comprobar la instalación

Abre la URL `/exec?action=ping` de tu implementación. La respuesta debe ser JSON e incluir `success: true` y `data.pong: true`. Esto comprueba que el servicio responde; la lectura de la biblioteca comprueba además el acceso a los datos.

Desde la aplicación, crea un equipo y un proceso de prueba, guarda un flujo y vuelve a abrirlo después de recargar la página. Comprueba que conserva sus actividades y conexiones.

## Implementación en producción

### Publicar el frontend

1. Configura `VITE_GAS_URL` con la implementación que utilizará el entorno de producción.
2. Compila el proyecto:

```bash
npm run build
```

3. Publica el contenido de `dist/` en un alojamiento de archivos estáticos con HTTPS.
4. Configura el alojamiento para servir `index.html` cuando se solicite una ruta de la aplicación, como `/equipos/...` o `/flujos/...`. Esta reescritura permite abrir enlaces directos y recargar páginas con React Router.
5. Comprueba el acceso a la biblioteca y la recuperación de un flujo desde la dirección publicada.

Para revisar la compilación localmente puedes ejecutar `npm run preview`. Este comando sirve para previsualizar el resultado, no sustituye el alojamiento de producción. Si cambia la URL del backend, recompila y publica de nuevo el frontend.

### Actualizar el backend

Guarda el contenido actualizado de `Code.gs` en Apps Script. En **Implementar → Administrar implementaciones**, edita la implementación existente, selecciona **Nueva versión** y pulsa **Implementar**. Así conservas su URL.

Editar `Code.gs` en VS Code no actualiza por sí solo el backend publicado. Los cambios que únicamente optimizan las operaciones sobre las mismas tablas no requieren recrear la base.

## Google Sheets: beneficios de centralizar la información

Usar un único archivo permite mantener una fuente común para equipos, procesos y flujos. Evita dispersar diagramas entre archivos personales y facilita que la aplicación consulte información organizada con la misma estructura.

Desde el punto de vista de costos, esta arquitectura evita contratar una instancia de base de datos dedicada para el alcance actual. También reduce el trabajo de instalar un motor, administrar un servidor y mantener su infraestructura. El ahorro depende del volumen de uso y de los recursos de Google que la organización ya tenga disponibles; no implica que el costo total del aplicativo sea cero. Pueden existir costos de cuenta o plan, almacenamiento, alojamiento web y mantenimiento.

La información tabular facilita la inspección y exportación de los registros por parte de quienes administran la solución. El acceso directo a Sheets debe reservarse para tareas controladas, porque modificar encabezados, identificadores o relaciones puede afectar la aplicación.

## Desventajas y compromiso de rendimiento

**El principal compromiso es reducir infraestructura y costos a cambio de sacrificar velocidad de lectura y capacidad de concurrencia.** Abrir un flujo puede requerir esperar varios segundos mientras el navegador consulta Apps Script y este lee las tablas de Sheets.

| Limitación | Efecto en el aplicativo |
| --- | --- |
| Latencia entre navegador, Apps Script y Sheets | Cargar, guardar o eliminar puede requerir varios segundos y variar entre solicitudes. |
| Lectura de tablas completas en el backend actual | Aunque se solicite un solo flujo, el trabajo aumenta conforme crecen las tablas de flujos, nodos y conexiones. |
| Escrituras protegidas por un bloqueo compartido | Varios usuarios guardando al mismo tiempo pueden generar esperas. |
| Cuotas de Apps Script | Al alcanzar límites de ejecución o uso, las solicitudes pueden fallar. |
| Integridad gestionada por la aplicación | Las relaciones y la recuperación ante fallos dependen del código; no hay una transacción de base de datos que abarque todas las hojas. |
| Edición directa en Sheets | Un cambio manual puede eludir las validaciones del editor. |
| Caché temporal en el navegador | Una consulta puede reutilizar durante unos segundos información obtenida antes de una modificación externa. |

Las cuotas dependen del tipo de cuenta y pueden cambiar. La referencia aplicable es la [documentación oficial de límites de Apps Script](https://developers.google.com/apps-script/guides/services/quotas).

Para reducir las esperas, el proyecto lee cada tabla una vez por solicitud, agrupa las escrituras por bloques y evita revisar todo el esquema antes de cada guardado. El frontend comparte lecturas simultáneas, utiliza una caché en memoria de 15 segundos y reutiliza la respuesta de un guardado confirmado. Las escrituras invalidan esa caché. El procesamiento por lotes sigue las [prácticas recomendadas de Google](https://developers.google.com/apps-script/guides/support/best-practices).

Estas medidas reducen llamadas, pero **no garantizan que todas las operaciones terminen en menos de cinco segundos**. Ese tiempo es un objetivo que debe medirse en la implementación publicada, con el volumen real de datos y usuarios. La red, la disponibilidad de Google y las esperas por concurrencia también influyen.

La arquitectura resulta adecuada cuando se priorizan una administración sencilla y un costo inicial reducido, y se toleran esperas de lectura. Si el crecimiento exige respuestas estrictamente rápidas, muchas escrituras simultáneas o controles de acceso más detallados, será necesario revisar el almacenamiento y la arquitectura del backend.
