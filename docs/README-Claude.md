# ⚡ FlowMapper

Aplicación de gestión dinámica de flujos de trabajo con mapa neuronal 3D interactivo.  
**Stack:** React 18 · Three.js · Google Apps Script · Google Sheets como base de datos.  
**Estética:** Glassmorphism iOS 26 — vidrio líquido, paleta deep-space, tipografía Outfit + Inter.

---

## Índice

1. [Arquitectura general](#1-arquitectura-general)
2. [Estructura del proyecto](#2-estructura-del-proyecto)
3. [Backend: Google Apps Script](#3-backend-google-apps-script)
4. [Frontend: React](#4-frontend-react)
5. [Instalación paso a paso](#5-instalación-paso-a-paso)
6. [Variables de entorno](#6-variables-de-entorno)
7. [Archivos ya creados](#7-archivos-ya-creados)
8. [Archivos que debes completar](#8-archivos-que-debes-completar)
9. [Modelo de datos](#9-modelo-de-datos)
10. [API: acciones disponibles](#10-api-acciones-disponibles)
11. [Design system](#11-design-system)
12. [Flujo de uso de la aplicación](#12-flujo-de-uso-de-la-aplicación)
13. [Despliegue](#13-despliegue)
14. [Troubleshooting](#14-troubleshooting)

---

## 1. Arquitectura general

```
┌─────────────────────────────────────────────┐
│            FRONTEND (React + Node)           │
│                                             │
│  ┌──────────┐  ┌────────────┐  ┌─────────┐ │
│  │ Galería  │  │  Equipos   │  │ FlowMap │ │
│  │ de Flujos│  │ + Procesos │  │  3D     │ │
│  └──────────┘  └────────────┘  └─────────┘ │
│                    │                        │
│          src/services/api.js                │
│       (fetch via REACT_APP_GAS_URL)         │
└──────────────────┬──────────────────────────┘
                   │  HTTP GET / POST
                   ▼
┌─────────────────────────────────────────────┐
│         BACKEND (Google Apps Script)         │
│                  Code.gs                    │
│                                             │
│   doGet() / doPost()  →  route_()          │
│   crearBaseDeDatos()  (setup inicial)       │
└──────────────────┬──────────────────────────┘
                   │  SpreadsheetApp API
                   ▼
┌─────────────────────────────────────────────┐
│  Google Sheets  ID: 12-RXAOuu_sVS479Cdr… │
│                                             │
│  Hoja: equipos     Hoja: procesos           │
│  Hoja: flujos      Hoja: nodos              │
│  Hoja: conexiones  Hoja: meta               │
└─────────────────────────────────────────────┘
```

El frontend **nunca** accede directamente a Google Sheets.  
Toda la comunicación pasa por la URL del WebApp desplegado en GAS,  
almacenada en la variable de entorno `REACT_APP_GAS_URL`.

---

## 2. Estructura del proyecto

```
flowmapper/
│
├── Code.gs                        ← Backend completo (Google Apps Script)
├── package.json                   ← Dependencias React
├── .env.example                   ← Plantilla de variables de entorno
├── .env                           ← TU archivo local (NO subir a git)
│
└── src/
    ├── index.js                   ← Punto de entrada React  ← CREAR
    ├── index.css                  ← Design system completo  ✓ LISTO
    ├── App.jsx                    ← Shell principal + router ← CREAR
    │
    ├── services/
    │   └── api.js                 ← Capa fetch → GAS        ✓ LISTO
    │
    ├── context/
    │   └── DataContext.jsx        ← Estado global + CRUD     ✓ LISTO
    │
    ├── hooks/
    │   └── useToast.js            ← Sistema de notificaciones ✓ LISTO
    │
    ├── components/
    │   ├── UI.jsx                 ← Modal, Toast, Badge, Empty ✓ LISTO
    │   ├── NeuralMap.jsx          ← Mapa 3D Three.js           ✓ LISTO
    │   ├── Sidebar.jsx            ← Navegación lateral         ✓ LISTO
    │   └── FlowBuilder.jsx        ← Formulario crear flujo     ✓ LISTO
    │
    └── pages/
        ├── Gallery/
        │   └── GalleryPage.jsx    ← Galería visual de flujos   ← CREAR
        ├── Teams/
        │   ├── TeamsPage.jsx      ← Lista de equipos           ← CREAR
        │   └── TeamDetailPage.jsx ← Detalle equipo + procesos  ← CREAR
        ├── FlowMap/
        │   └── FlowMapPage.jsx    ← Mapa 3D + walk mode        ✓ LISTO
        └── Config/
            └── ConfigPage.jsx     ← Configuración GAS URL      ← CREAR
```

---

## 3. Backend: Google Apps Script

### 3.1 Configuración en `Code.gs`

El Spreadsheet ID ya está fijado en el código:

```javascript
const SPREADSHEET_ID = '12-RXAOuu_sVS479CdrhjBeKO9Tdej-93lhe6gPEnku0';
```

No necesitas cambiarlo. El archivo **Code.gs** incluido en este proyecto contiene todo lo necesario.

### 3.2 Pasos para desplegar

1. Ve a [script.google.com](https://script.google.com) e inicia sesión con la cuenta que tiene acceso al Spreadsheet.

2. Crea un **nuevo proyecto** → elimina el código por defecto → pega el contenido completo de `Code.gs`.

3. Ejecuta la función **`crearBaseDeDatos`** manualmente (menú superior → Ejecutar):
   - Esto crea las 6 hojas en el Spreadsheet: `equipos`, `procesos`, `flujos`, `nodos`, `conexiones`, `meta`.
   - Las cabeceras se crean con formato visual y protección de advertencia.
   - Solo necesitas ejecutarla una vez. Si la ejecutas de nuevo, detecta que las hojas ya existen y no las sobreescribe.

4. Despliega como **WebApp**:
   - Menú → **Implementar** → **Nueva implementación**
   - Tipo: `Aplicación web`
   - Ejecutar como: `Yo (tu cuenta de Google)`
   - Quién tiene acceso: `Cualquier persona`
   - Haz clic en **Implementar**

5. Copia la URL generada. Tendrá este formato:
   ```
   https://script.google.com/macros/s/AKfycb.../exec
   ```

6. Pega esa URL en tu archivo `.env` (ver sección 6).

### 3.3 Lo que hace `Code.gs`

| Función | Descripción |
|---|---|
| `crearBaseDeDatos()` | Crea las 6 hojas con cabeceras formateadas y protegidas |
| `doGet(e)` / `doPost(e)` | Punto de entrada HTTP. GET para lecturas, POST para escrituras |
| `route_(e)` | Enrutador interno que despacha según el parámetro `action` |
| CRUD equipos | `_createTeam`, `_updateTeam`, `deleteTeam`, `getTeams` |
| CRUD procesos | `_createProcess`, `_updateProcess`, `deleteProcess`, `getProcesses` |
| CRUD flujos | `_createFlow`, `_updateFlow`, `deleteFlow`, `getFlows`, `getAllFlows` |
| CRUD nodos | `_createNode`, `_updateNode`, `deleteNode`, `getNodes`, `batchCreateNodes` |
| CRUD conexiones | `_createEdge`, `deleteEdge`, `getEdges`, `batchCreateEdges` |
| `_getFullFlow(flowId)` | Devuelve flow + nodes + edges en una sola llamada |
| `_getStats()` | Totales globales de cada entidad |
| `onOpen()` | Menú personalizado en Google Sheets para acceso rápido |

---

## 4. Frontend: React

### 4.1 Dependencias (`package.json`)

```json
{
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "react-router-dom": "^6.20.0",
  "three": "^0.160.0",
  "react-scripts": "5.0.1"
}
```

> **Nota:** `@react-three/fiber` y `@react-three/drei` están listados en package.json  
> pero el componente `NeuralMap.jsx` usa **Three.js puro** (sin R3F) para mayor control  
> sobre la cámara orbital, los raycasts y el loop de animación. Puedes eliminarlos del package.json si lo prefieres.

### 4.2 Cómo funciona el estado global

`DataContext.jsx` usa `useReducer` con las siguientes claves de estado:

```javascript
{
  teams:     [],          // array de equipos
  processes: [],          // array de procesos
  flows:     [],          // array de flujos
  nodes:     {},          // { [flowId]: Node[] }
  edges:     {},          // { [flowId]: Edge[] }
  stats:     null,        // { teams, processes, flows, nodes, edges }
  loading:   {},          // { [key]: boolean }
  error:     null,
}
```

Todo componente que necesite datos usa el hook:

```javascript
import { useData } from '../context/DataContext';
const { teams, createTeam, fetchTeams, ... } = useData();
```

### 4.3 Cómo funciona `api.js`

Lee `process.env.REACT_APP_GAS_URL` y construye las llamadas:

- **GET** para acciones que empiezan con `get` o son `ping` / `getStats`
- **POST** con `Content-Type: text/plain` para todo lo demás (requerido por GAS)

```javascript
import api from '../services/api';

// Ejemplos de uso
const teams  = await api.getTeams();
const team   = await api.createTeam({ nombre: 'Soporte', icono: '🎧', color: '#c084fc' });
const graph  = await api.getFullFlow('flow-uuid');
```

### 4.4 Sistema de notificaciones (`useToast.js`)

Importable desde cualquier lugar sin necesidad de props:

```javascript
import { toast } from '../hooks/useToast';

toast.success('Equipo creado ✓');
toast.error('Error al guardar');
toast.info('Tip: haz clic en un nodo');
toast.warn('Sin conexión con GAS');
```

El `ToastContainer` debe estar montado una sola vez en `App.jsx`.

### 4.5 Mapa neuronal 3D (`NeuralMap.jsx`)

Props del componente:

```jsx
<NeuralMap
  nodes={nodes}           // Node[]  — array de nodos del flujo
  edges={edges}           // Edge[]  — array de conexiones
  activeNodeId={id}       // string  — nodo resaltado con pulso
  onNodeClick={handler}   // (node) => void
/>
```

**Tipos de nodo y su representación 3D:**

| tipo | Geometría Three.js | Color |
|---|---|---|
| `inicio` | SphereGeometry | `#4ade80` verde |
| `paso` | BoxGeometry | `#60a5fa` azul |
| `decision` | OctahedronGeometry | `#facc15` amarillo |
| `fin` | SphereGeometry | `#c084fc` púrpura |
| `flujo-externo` | TorusGeometry | `#67e8f9` cyan |

**Controles:**
- Arrastrar → rotar cámara orbital
- Scroll → zoom (radio 3–28)
- Clic en nodo → seleccionar + zoom suave a r=6
- Hover → tooltip flotante con tipo, título y descripción

**Colores de conexión:**
- `condicion: 'positivo'` → `#4ade80` verde
- `condicion: 'negativo'` → `#f87171` rojo
- `condicion: 'siempre'`  → `#aaaacc` gris

---

## 5. Instalación paso a paso

### Paso 1 — Clonar / descomprimir el proyecto

```bash
# Si usas git
git clone <tu-repo> flowmapper
cd flowmapper

# O descomprime el zip y entra a la carpeta
cd flowmapper
```

### Paso 2 — Instalar dependencias

```bash
npm install
```

### Paso 3 — Configurar el backend GAS

Sigue la sección [3.2 Pasos para desplegar](#32-pasos-para-desplegar) y obtén la URL del WebApp.

### Paso 4 — Configurar variables de entorno

```bash
cp .env.example .env
```

Edita `.env` y pega tu URL:

```env
REACT_APP_GAS_URL=https://script.google.com/macros/s/TU_ID_AQUI/exec
```

### Paso 5 — Completar los archivos pendientes

Ver sección [8. Archivos que debes completar](#8-archivos-que-debes-completar).

### Paso 6 — Iniciar en desarrollo

```bash
npm start
```

Abre [http://localhost:3000](http://localhost:3000).

### Paso 7 — Verificar conexión con GAS

Desde la página de **Configuración** de la app (ícono ⚙️ en el sidebar), prueba la conexión. Deberías ver `{ pong: true }`.

---

## 6. Variables de entorno

Crea el archivo `.env` en la raíz del proyecto (nunca lo subas a git):

```env
# URL del WebApp de Google Apps Script (OBLIGATORIO)
REACT_APP_GAS_URL=https://script.google.com/macros/s/AKfycb.../exec
```

> **¿Por qué `text/plain` en las peticiones POST?**  
> GAS rechaza `application/json` en `doPost()` en ciertas configuraciones de despliegue.  
> `api.js` ya usa `Content-Type: text/plain` y parsea el body con `JSON.parse()` dentro del `.gs`.  
> No cambie esto a menos que estés seguro de que tu despliegue lo soporta.

---

## 7. Archivos ya creados

Estos archivos están **completos y listos**. No necesitas modificarlos salvo personalización:

| Archivo | Qué contiene |
|---|---|
| `Code.gs` | Backend GAS completo: CRUD, routing, setup de Sheets |
| `src/services/api.js` | Capa fetch con todas las llamadas a GAS |
| `src/context/DataContext.jsx` | Estado global con useReducer + todas las acciones |
| `src/hooks/useToast.js` | Sistema de notificaciones globales |
| `src/index.css` | Design system completo: tokens, glassmorphism, componentes CSS |
| `src/components/UI.jsx` | Modal, Toast, Badge, Empty, StatCard, Confirm, Spinner |
| `src/components/NeuralMap.jsx` | Mapa 3D con Three.js: nodos, edges, órbita, raycast, tooltips |
| `src/components/Sidebar.jsx` | Navegación lateral con acceso rápido a equipos |
| `src/components/FlowBuilder.jsx` | Formulario de creación de flujos con pasos, condiciones y flujos externos |
| `src/pages/FlowMap/FlowMapPage.jsx` | Página de visualización 3D con modo walk |

---

## 8. Archivos que debes completar

### 8.1 `src/index.js` — Punto de entrada

```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { DataProvider } from './context/DataContext';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <DataProvider>
      <App />
    </DataProvider>
  </React.StrictMode>
);
```

---

### 8.2 `src/App.jsx` — Shell principal

```jsx
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import { ToastContainer } from './components/UI';
import { useData } from './context/DataContext';

import GalleryPage    from './pages/Gallery/GalleryPage';
import TeamsPage      from './pages/Teams/TeamsPage';
import TeamDetailPage from './pages/Teams/TeamDetailPage';
import FlowMapPage    from './pages/FlowMap/FlowMapPage';
import ConfigPage     from './pages/Config/ConfigPage';

export default function App() {
  const { fetchTeams, fetchAllFlows, fetchAllProcesses } = useData();
  const [page,         setPage]         = useState('gallery');
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [openFlow,     setOpenFlow]     = useState(null);

  // Carga inicial de datos
  useEffect(() => {
    fetchTeams();
    fetchAllFlows();
    fetchAllProcesses();
  }, []); // eslint-disable-line

  // Navegación a mapa de flujo
  const handleOpenFlow = (flow) => {
    setOpenFlow(flow);
    setPage('flowmap');
  };

  // FlowMap es pantalla completa
  if (page === 'flowmap' && openFlow) {
    return (
      <>
        <FlowMapPage
          flow={openFlow}
          onBack={() => {
            setOpenFlow(null);
            setPage(selectedTeam ? 'teams' : 'gallery');
          }}
        />
        <ToastContainer />
      </>
    );
  }

  // Página activa
  let PageContent;
  if (page === 'teams' && selectedTeam) {
    PageContent = (
      <TeamDetailPage
        team={selectedTeam}
        onBack={() => setSelectedTeam(null)}
        onOpenFlow={handleOpenFlow}
      />
    );
  } else if (page === 'teams') {
    PageContent = (
      <TeamsPage
        onSelectTeam={(t) => setSelectedTeam(t)}
      />
    );
  } else if (page === 'config') {
    PageContent = <ConfigPage />;
  } else {
    PageContent = <GalleryPage onOpenFlow={handleOpenFlow} />;
  }

  return (
    <div className="app-shell">
      <Sidebar
        page={page}
        onNav={(p) => { setPage(p); setSelectedTeam(null); setOpenFlow(null); }}
        selectedTeam={selectedTeam}
        onSelectTeam={setSelectedTeam}
      />
      <div className="main-area">
        {PageContent}
      </div>
      <ToastContainer />
    </div>
  );
}
```

---

### 8.3 `src/pages/Gallery/GalleryPage.jsx` — Galería de flujos

```jsx
import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../../context/DataContext';
import { Empty, Badge, StatCard } from '../../components/UI';
import * as THREE from 'three';

// Mini preview 3D giratorio para cada card de la galería
function MiniPreview({ nodes, edges }) {
  const ref = useRef();
  useEffect(() => {
    if (!ref.current || !nodes || nodes.length === 0) return;
    const el = ref.current;
    const W = el.clientWidth || 300, H = el.clientHeight || 160;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setClearColor(0, 0);
    el.appendChild(renderer.domElement);

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 100);
    camera.position.set(0, 0, 8);
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const pl = new THREE.PointLight(0xc084fc, 2, 20);
    pl.position.set(2, 2, 2);
    scene.add(pl);

    const COLORS = { inicio: 0x4ade80, paso: 0x60a5fa, decision: 0xfacc15, fin: 0xc084fc, 'flujo-externo': 0x67e8f9 };
    const posMap = {};
    nodes.forEach(nd => {
      const pos = new THREE.Vector3(parseFloat(nd.posX) || 0, parseFloat(nd.posY) || 0, parseFloat(nd.posZ) || 0);
      posMap[nd.id] = pos;
      const color = COLORS[nd.tipo] || COLORS.paso;
      const mesh  = new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 8, 8),
        new THREE.MeshPhongMaterial({ color, emissive: color, emissiveIntensity: 0.5, transparent: true, opacity: 0.9 })
      );
      mesh.position.copy(pos);
      scene.add(mesh);
    });
    edges.forEach(ed => {
      const sp = posMap[ed.sourceId], tp = posMap[ed.targetId];
      if (!sp || !tp) return;
      const c = ed.condicion === 'positivo' ? 0x4ade80 : ed.condicion === 'negativo' ? 0xf87171 : 0x8888aa;
      scene.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([sp, tp]),
        new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: 0.4 })
      ));
    });

    let raf, theta = 0;
    const go = () => {
      raf = requestAnimationFrame(go);
      theta += 0.008;
      camera.position.set(8 * Math.sin(theta), 1, 8 * Math.cos(theta));
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    };
    go();
    return () => {
      cancelAnimationFrame(raf);
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [nodes]); // eslint-disable-line

  return <div ref={ref} style={{ width: '100%', height: '100%' }} />;
}

export default function GalleryPage({ onOpenFlow }) {
  const { flows, teams, processes, nodes, edges, stats, fetchStats } = useData();
  const [search,     setSearch]     = useState('');
  const [filterTeam, setFilterTeam] = useState('');

  useEffect(() => { fetchStats(); }, []); // eslint-disable-line

  const filtered = flows.filter(f => {
    const okName = f.nombre.toLowerCase().includes(search.toLowerCase());
    const okTeam = !filterTeam || f.teamId === filterTeam;
    return okName && okTeam;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Topbar */}
      <div className="topbar">
        <span className="topbar-title">🗺 Galería de Flujos</span>
        <div className="topbar-actions">
          <input
            className="form-input"
            placeholder="🔍 Buscar flujo..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: 200 }}
          />
          <select
            className="form-select"
            value={filterTeam}
            onChange={e => setFilterTeam(e.target.value)}
            style={{ width: 170 }}
          >
            <option value="">Todos los equipos</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.icono} {t.nombre}</option>)}
          </select>
        </div>
      </div>

      <div className="page-content">
        {/* Stats */}
        {stats && (
          <div className="stat-grid">
            <StatCard icon="👥" value={stats.teams}     label="Equipos"    color="var(--p-300)" />
            <StatCard icon="📋" value={stats.processes} label="Procesos"   color="var(--cyan)"  />
            <StatCard icon="🔗" value={stats.flows}     label="Flujos"     color="var(--green)" />
            <StatCard icon="🟣" value={stats.nodes}     label="Nodos"      color="var(--amber)" />
          </div>
        )}

        {/* Gallery grid */}
        {filtered.length === 0 ? (
          <Empty
            icon="🗺"
            title="No hay flujos"
            sub="Crea equipos y flujos desde la sección Equipos"
          />
        ) : (
          <div className="flow-gallery">
            {filtered.map(flow => {
              const team    = teams.find(t => t.id === flow.teamId);
              const process = processes.find(p => p.id === flow.processId);
              const fNodes  = nodes[flow.id] || [];
              const fEdges  = edges[flow.id] || [];

              return (
                <div
                  key={flow.id}
                  className="gallery-card"
                  onClick={() => onOpenFlow(flow)}
                >
                  {/* 3D preview */}
                  <div className="gallery-preview">
                    {fNodes.length > 0
                      ? <MiniPreview nodes={fNodes} edges={fEdges} />
                      : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 36, opacity: 0.18 }}>🔗</div>
                    }
                  </div>

                  {/* Body */}
                  <div className="gallery-body">
                    <div className="gallery-title">{flow.nombre}</div>
                    <div className="gallery-meta">
                      {team    && <span>{team.icono} {team.nombre}</span>}
                      {process && <><span>·</span><span>{process.nombre}</span></>}
                      <span>· v{flow.version}</span>
                    </div>
                    {flow.descripcion && (
                      <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 8, lineHeight: 1.45 }}>
                        {flow.descripcion}
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="gallery-footer">
                    <Badge
                      variant={flow.estado === 'activo' ? 'green' : flow.estado === 'borrador' ? 'amber' : 'gray'}
                      dot={flow.estado}
                    >
                      {flow.estado}
                    </Badge>
                    <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{fNodes.length} nodos</span>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={e => { e.stopPropagation(); onOpenFlow(flow); }}
                    >
                      🔍 Ver mapa
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
```

Agrega al final de `index.css` los estilos de galería:

```css
/* ── Gallery ─────────────────────────────────────────────── */
.flow-gallery {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}
.gallery-card {
  border-radius: var(--r-lg); overflow: hidden; cursor: pointer;
  background: linear-gradient(145deg, var(--glass-sm) 0%, var(--glass-xs) 100%);
  backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border);
  transition: all 0.3s var(--ease-out);
}
.gallery-card:hover {
  border-color: var(--glass-border-accent);
  box-shadow: var(--shadow-lg), 0 0 0 1px rgba(192,132,252,0.12), 0 0 50px rgba(192,132,252,0.06);
  transform: translateY(-3px);
}
.gallery-preview {
  height: 160px; position: relative; overflow: hidden;
  background: radial-gradient(ellipse at 50% 50%, rgba(124,58,237,0.12) 0%, rgba(4,4,10,0.85) 100%);
}
.gallery-body   { padding: 16px; }
.gallery-title  { font-family: var(--font-display); font-size: 15px; font-weight: 700; margin-bottom: 5px; }
.gallery-meta   { font-size: 11px; color: var(--text-3); display: flex; flex-wrap: wrap; gap: 6px; }
.gallery-footer {
  padding: 12px 16px;
  border-top: 1px solid rgba(255,255,255,0.05);
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
}
```

---

### 8.4 `src/pages/Teams/TeamsPage.jsx` — Lista de equipos

```jsx
import React, { useState } from 'react';
import { useData } from '../../context/DataContext';
import { Modal, Empty, Badge } from '../../components/UI';
import { toast } from '../../hooks/useToast';

const EMOJIS = ['👥','🎯','💼','🚀','🔧','🎨','📊','🧩','⚡','🛡','🌐','🔬','🎓','🏆','🤝','💡'];

export default function TeamsPage({ onSelectTeam }) {
  const { teams, processes, flows, createTeam, deleteTeam } = useData();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ nombre: '', descripcion: '', color: '#c084fc', icono: '👥' });
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!form.nombre.trim()) { toast.error('El equipo necesita un nombre'); return; }
    setSaving(true);
    try {
      await createTeam(form);
      toast.success('Equipo creado ✓');
      setShowModal(false);
      setForm({ nombre: '', descripcion: '', color: '#c084fc', icono: '👥' });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    try {
      await deleteTeam(id);
      toast.info('Equipo eliminado');
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="topbar">
        <span className="topbar-title">👥 Equipos de Trabajo</span>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Nuevo Equipo</button>
      </div>

      <div className="page-content">
        {teams.length === 0 ? (
          <Empty
            icon="👥"
            title="Sin equipos aún"
            sub="Crea tu primer equipo para comenzar a organizar los flujos"
            action={<button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Crear Equipo</button>}
          />
        ) : (
          <div className="grid-3">
            {teams.map(team => {
              const procs = processes.filter(p => p.teamId === team.id);
              const fls   = flows.filter(f => f.teamId === team.id);
              return (
                <div
                  key={team.id}
                  className="card glass-card"
                  onClick={() => onSelectTeam(team)}
                >
                  <div className="card-header">
                    <div className="card-icon" style={{ background: team.color + '22', borderColor: team.color + '44' }}>
                      {team.icono}
                    </div>
                    <div>
                      <div className="card-title">{team.nombre}</div>
                      <div className="card-sub">{procs.length} procesos · {fls.length} flujos</div>
                    </div>
                  </div>
                  {team.descripcion && <div className="card-desc">{team.descripcion}</div>}
                  <div className="card-footer">
                    <Badge variant="purple">{procs.length} procesos</Badge>
                    <Badge variant="cyan">{fls.length} flujos</Badge>
                    <button
                      className="btn btn-danger btn-xs"
                      style={{ marginLeft: 'auto' }}
                      onClick={(e) => handleDelete(e, team.id)}
                    >
                      🗑
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showModal && (
        <Modal title="👥 Nuevo Equipo" onClose={() => setShowModal(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Nombre</label>
              <input
                className="form-input"
                placeholder="Ej: Equipo de Soporte"
                value={form.nombre}
                onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
                autoFocus
              />
            </div>
            <div className="form-group">
              <label className="form-label">Descripción</label>
              <textarea
                className="form-textarea"
                placeholder="¿De qué se encarga este equipo?"
                value={form.descripcion}
                onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))}
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Color</label>
                <input
                  type="color"
                  style={{ width: '100%', height: 42, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, cursor: 'pointer', padding: 4 }}
                  value={form.color}
                  onChange={e => setForm(p => ({ ...p, color: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Icono</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {EMOJIS.map(emoji => (
                    <span
                      key={emoji}
                      onClick={() => setForm(p => ({ ...p, icono: emoji }))}
                      style={{
                        fontSize: 20, cursor: 'pointer', padding: '4px 6px', borderRadius: 8,
                        background: form.icono === emoji ? 'rgba(192,132,252,0.2)' : 'transparent',
                        border: `1px solid ${form.icono === emoji ? 'rgba(192,132,252,0.4)' : 'transparent'}`,
                        transition: 'all 0.15s',
                      }}
                    >
                      {emoji}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>
              {saving ? '⏳ Creando...' : '✓ Crear Equipo'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
```

---

### 8.5 `src/pages/Teams/TeamDetailPage.jsx` — Detalle de equipo

```jsx
import React, { useState } from 'react';
import { useData } from '../../context/DataContext';
import { Modal, Empty, Badge } from '../../components/UI';
import FlowBuilder from '../../components/FlowBuilder';
import { toast } from '../../hooks/useToast';

export default function TeamDetailPage({ team, onBack, onOpenFlow }) {
  const {
    processes, flows, nodes, edges,
    createProcess, deleteProcess,
    saveFullFlow, deleteFlow,
  } = useData();

  const [showProcModal,  setShowProcModal]  = useState(false);
  const [showFlowModal,  setShowFlowModal]  = useState(false);
  const [procForm,       setProcForm]       = useState({ nombre: '', descripcion: '' });
  const [saving,         setSaving]         = useState(false);

  const teamProcesses = processes.filter(p => p.teamId === team.id);
  const teamFlows     = flows.filter(f => f.teamId === team.id);

  const handleCreateProcess = async () => {
    if (!procForm.nombre.trim()) { toast.error('Escribe un nombre para el proceso'); return; }
    setSaving(true);
    try {
      await createProcess({ ...procForm, teamId: team.id, orden: teamProcesses.length + 1 });
      toast.success('Proceso creado ✓');
      setShowProcModal(false);
      setProcForm({ nombre: '', descripcion: '' });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveFlow = async ({ flow, nodes: rawNodes, edges: rawEdges }) => {
    try {
      await saveFullFlow({ flow: { ...flow, teamId: team.id }, nodes: rawNodes, edges: rawEdges });
      toast.success('Flujo creado con ' + rawNodes.length + ' nodos ✓');
      setShowFlowModal(false);
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Topbar */}
      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-secondary btn-sm" onClick={onBack}>← Equipos</button>
          <div
            className="card-icon"
            style={{ width: 36, height: 36, borderRadius: 10, fontSize: 18, background: team.color + '22', borderColor: team.color + '44' }}
          >
            {team.icono}
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16 }}>{team.nombre}</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{teamProcesses.length} procesos · {teamFlows.length} flujos</div>
          </div>
        </div>
        <div className="topbar-actions">
          <button className="btn btn-secondary" onClick={() => setShowProcModal(true)}>+ Proceso</button>
          <button className="btn btn-primary"   onClick={() => setShowFlowModal(true)}>+ Flujo</button>
        </div>
      </div>

      {/* Content: two-column layout */}
      <div className="page-content" style={{ flexDirection: 'row', gap: 24, alignItems: 'flex-start' }}>

        {/* Left: processes list */}
        <div style={{ width: 220, flexShrink: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-3)', marginBottom: 10 }}>
            Procesos
          </div>
          {teamProcesses.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.5 }}>
              Sin procesos.<br/>Agrega uno con el botón de arriba.
            </div>
          ) : (
            teamProcesses.map(proc => {
              const count = teamFlows.filter(f => f.processId === proc.id).length;
              return (
                <div
                  key={proc.id}
                  className="glass-card"
                  style={{ borderRadius: 12, padding: 12, marginBottom: 8 }}
                >
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{proc.nombre}</div>
                  {proc.descripcion && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3, lineHeight: 1.4 }}>{proc.descripcion}</div>}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                    <Badge variant="cyan">{count} flujo{count !== 1 ? 's' : ''}</Badge>
                    <button
                      className="btn btn-danger btn-xs"
                      onClick={() => deleteProcess(proc.id).then(() => toast.info('Proceso eliminado'))}
                    >🗑</button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right: flows grid */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-3)', marginBottom: 10 }}>
            Flujos del Equipo
          </div>
          {teamFlows.length === 0 ? (
            <Empty
              icon="🔗"
              title="Sin flujos"
              sub="Crea el primer flujo para este equipo usando el botón + Flujo"
            />
          ) : (
            <div className="grid-2">
              {teamFlows.map(flow => {
                const proc   = teamProcesses.find(p => p.id === flow.processId);
                const fNodes = nodes[flow.id] || [];
                return (
                  <div
                    key={flow.id}
                    className="card glass-card"
                    onClick={() => onOpenFlow(flow)}
                  >
                    <div className="card-header">
                      <div>
                        <div className="card-title" style={{ fontSize: 14 }}>{flow.nombre}</div>
                        {proc && <div className="card-sub">{proc.nombre}</div>}
                      </div>
                    </div>
                    {flow.descripcion && <div className="card-desc" style={{ fontSize: 12 }}>{flow.descripcion}</div>}
                    <div className="card-footer">
                      <Badge
                        variant={flow.estado === 'activo' ? 'green' : flow.estado === 'borrador' ? 'amber' : 'gray'}
                        dot={flow.estado}
                      >
                        {flow.estado}
                      </Badge>
                      <Badge variant="purple">{fNodes.length} nodos</Badge>
                      <Badge variant="gray">v{flow.version}</Badge>
                      <button
                        className="btn btn-danger btn-xs"
                        style={{ marginLeft: 'auto' }}
                        onClick={e => { e.stopPropagation(); deleteFlow(flow.id).then(() => toast.info('Flujo eliminado')); }}
                      >🗑</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Process modal */}
      {showProcModal && (
        <Modal title="📋 Nuevo Proceso" onClose={() => setShowProcModal(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Nombre</label>
              <input
                className="form-input"
                placeholder="Ej: Gestión de Tickets"
                value={procForm.nombre}
                onChange={e => setProcForm(p => ({ ...p, nombre: e.target.value }))}
                autoFocus
              />
            </div>
            <div className="form-group">
              <label className="form-label">Descripción</label>
              <textarea
                className="form-textarea"
                placeholder="¿Qué cubre este proceso?"
                value={procForm.descripcion}
                onChange={e => setProcForm(p => ({ ...p, descripcion: e.target.value }))}
              />
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => setShowProcModal(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={handleCreateProcess} disabled={saving}>
              {saving ? '⏳...' : '✓ Crear Proceso'}
            </button>
          </div>
        </Modal>
      )}

      {/* Flow builder modal */}
      {showFlowModal && (
        <FlowBuilder
          processes={teamProcesses}
          allFlows={flows}
          teamId={team.id}
          onSave={handleSaveFlow}
          onClose={() => setShowFlowModal(false)}
        />
      )}
    </div>
  );
}
```

---

### 8.6 `src/pages/Config/ConfigPage.jsx` — Configuración

```jsx
import React, { useState } from 'react';
import { toast } from '../../hooks/useToast';
import api from '../../services/api';

export default function ConfigPage() {
  const [url,     setUrl]     = useState(process.env.REACT_APP_GAS_URL || '');
  const [testing, setTesting] = useState(false);
  const [result,  setResult]  = useState(null);

  const testConnection = async () => {
    setTesting(true);
    setResult(null);
    try {
      const data = await api.ping();
      setResult({ ok: true, msg: 'Conexión exitosa — ' + data.ts });
      toast.success('GAS conectado ✓');
    } catch (err) {
      setResult({ ok: false, msg: err.message });
      toast.error('Error: ' + err.message);
    } finally {
      setTesting(false);
    }
  };

  const runSetup = async () => {
    setTesting(true);
    try {
      const data = await api.setup();
      toast.success('Base de datos verificada ✓');
      setResult({ ok: true, msg: 'Setup OK. Hojas: ' + (data.log || []).join(', ') });
    } catch (err) {
      toast.error(err.message);
      setResult({ ok: false, msg: err.message });
    } finally {
      setTesting(false);
    }
  };

  const steps = [
    'Ve a script.google.com con la cuenta que tiene acceso al Spreadsheet',
    'Crea un nuevo proyecto y pega el contenido completo de Code.gs',
    'Ejecuta manualmente la función crearBaseDeDatos() (Menú → Ejecutar)',
    'Ve a Implementar → Nueva implementación → Aplicación web',
    'Configuración: Ejecutar como: Yo | Acceso: Cualquier persona',
    'Copia la URL generada (termina en /exec)',
    'Pégala en tu archivo .env como REACT_APP_GAS_URL=<url>',
    'Reinicia el servidor de desarrollo (npm start)',
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="topbar">
        <span className="topbar-title">⚙️ Configuración</span>
      </div>
      <div className="page-content" style={{ maxWidth: 660 }}>

        {/* URL actual */}
        <div className="glass-card" style={{ borderRadius: 'var(--r-lg)', padding: 20 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
            🔗 Google Apps Script — WebApp URL
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16, lineHeight: 1.5 }}>
            La URL se configura en el archivo <code style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 6px', borderRadius: 4 }}>.env</code> como
            <code style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 6px', borderRadius: 4, marginLeft: 4 }}>REACT_APP_GAS_URL</code>.
            Reinicia el servidor tras modificar el .env.
          </div>

          <div
            style={{
              fontFamily: 'monospace', fontSize: 12, padding: '10px 14px',
              background: 'rgba(0,0,0,0.35)', borderRadius: 'var(--r-sm)',
              border: '1px solid rgba(255,255,255,0.08)', color: 'var(--cyan)',
              wordBreak: 'break-all', marginBottom: 16,
            }}
          >
            {url || '⚠️ No configurada — define REACT_APP_GAS_URL en .env'}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-primary" onClick={testConnection} disabled={testing || !url}>
              {testing ? '⏳ Probando...' : '🔌 Probar Conexión'}
            </button>
            <button className="btn btn-secondary" onClick={runSetup} disabled={testing || !url}>
              📦 Verificar Base de Datos
            </button>
          </div>

          {result && (
            <div
              style={{
                marginTop: 14, padding: '10px 14px', borderRadius: 'var(--r-sm)',
                background: result.ok ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)',
                border: `1px solid ${result.ok ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}`,
                color: result.ok ? 'var(--green)' : 'var(--red)',
                fontSize: 12,
              }}
            >
              {result.ok ? '✓ ' : '✗ '}{result.msg}
            </div>
          )}
        </div>

        {/* Setup guide */}
        <div className="glass-card" style={{ borderRadius: 'var(--r-lg)', padding: 20 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, marginBottom: 14 }}>
            📋 Instrucciones de Despliegue GAS
          </div>
          {steps.map((step, i) => (
            <div
              key={i}
              style={{
                display: 'flex', gap: 12, padding: '10px 0',
                borderBottom: i < steps.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
              }}
            >
              <span style={{ color: 'var(--p-300)', fontWeight: 700, fontSize: 13, minWidth: 18 }}>{i + 1}.</span>
              <span style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>{step}</span>
            </div>
          ))}
        </div>

        {/* .env snippet */}
        <div className="glass-card" style={{ borderRadius: 'var(--r-lg)', padding: 20 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, marginBottom: 10 }}>
            📄 Contenido del archivo .env
          </div>
          <pre style={{
            fontFamily: 'monospace', fontSize: 12, lineHeight: 1.7,
            background: 'rgba(0,0,0,0.35)', padding: 14, borderRadius: 'var(--r-sm)',
            border: '1px solid rgba(255,255,255,0.07)', color: 'var(--cyan2)',
            overflowX: 'auto',
          }}>
{`# Copia .env.example como .env en la raíz del proyecto
# Nunca subas .env a git

REACT_APP_GAS_URL=https://script.google.com/macros/s/TU_ID/exec`}
          </pre>
        </div>

      </div>
    </div>
  );
}
```

---

## 9. Modelo de datos

### Hoja `equipos`
| Campo | Tipo | Descripción |
|---|---|---|
| id | UUID | Generado por GAS |
| nombre | string | Nombre del equipo |
| descripcion | string | Descripción breve |
| color | hex | Color del equipo (#c084fc) |
| icono | emoji | Ícono representativo |
| creadoEn | ISO 8601 | Timestamp de creación |
| actualizadoEn | ISO 8601 | Timestamp de última edición |

### Hoja `procesos`
| Campo | Tipo | Descripción |
|---|---|---|
| id | UUID | — |
| teamId | UUID | Referencia a equipo |
| nombre | string | — |
| descripcion | string | — |
| orden | number | Para ordenar en UI |
| creadoEn / actualizadoEn | ISO 8601 | — |

### Hoja `flujos`
| Campo | Tipo | Descripción |
|---|---|---|
| id | UUID | — |
| processId | UUID | Referencia a proceso |
| teamId | UUID | Referencia a equipo (desnormalizado para queries rápidas) |
| nombre | string | — |
| descripcion | string | — |
| version | string | "1.0", "2.3", etc. |
| estado | enum | `activo` \| `borrador` \| `inactivo` |

### Hoja `nodos`
| Campo | Tipo | Descripción |
|---|---|---|
| id | UUID | — |
| flowId | UUID | Referencia a flujo |
| tipo | enum | `inicio` \| `paso` \| `decision` \| `fin` \| `flujo-externo` |
| titulo | string | Texto del nodo |
| descripcion | string | Detalle ampliado |
| posX / posY / posZ | float | Posición en espacio 3D |
| refFlowId | UUID | Si tipo=flujo-externo, apunta al flujo destino |
| metadata | JSON string | Datos adicionales (conditions, etc.) |

### Hoja `conexiones`
| Campo | Tipo | Descripción |
|---|---|---|
| id | UUID | — |
| flowId | UUID | Flujo al que pertenece |
| sourceId | UUID | Nodo origen |
| targetId | UUID | Nodo destino |
| condicion | enum | `siempre` \| `positivo` \| `negativo` |
| etiqueta | string | Texto a mostrar en la arista |

---

## 10. API: acciones disponibles

Todas se invocan como `?action=<nombre>` en GET o en el body JSON en POST.

### Lectura (GET)
```
ping                    → { pong: true, ts }
getStats                → { teams, processes, flows, nodes, edges }
getTeams                → Team[]
getProcesses?teamId=    → Process[]
getAllProcesses          → Process[]
getFlows?processId=     → Flow[]
getAllFlows              → Flow[]
getNodes?flowId=        → Node[]
getEdges?flowId=        → Edge[]
getFullFlow?flowId=     → { flow, nodes[], edges[] }
```

### Escritura (POST body JSON)
```
setup                                          → { ok, log[] }
createTeam     { nombre, descripcion, color, icono }
updateTeam     { id, ...campos }
deleteTeam     { id }
createProcess  { teamId, nombre, descripcion, orden }
updateProcess  { id, ...campos }
deleteProcess  { id }
createFlow     { processId, teamId, nombre, descripcion, version, estado }
updateFlow     { id, ...campos }
deleteFlow     { id }
createNode     { flowId, tipo, titulo, descripcion, posX, posY, posZ, refFlowId, metadata }
updateNode     { id, ...campos }
deleteNode     { id }
batchCreateNodes { flowId, nodes: Node[] }
createEdge     { flowId, sourceId, targetId, condicion, etiqueta }
deleteEdge     { id }
batchCreateEdges { flowId, edges: Edge[] }
```

---

## 11. Design system

### Paleta de colores
```
Fondo void:   #04040a     Fondo deep:  #07071a
Púrpura-300:  #c084fc     Púrpura-600: #7c3aed
Cyan:         #67e8f9     Verde:       #4ade80
Ámbar:        #facc15     Rojo:        #f87171
```

### Tipografía
- **Display / títulos:** `Outfit` (weights 600–900)
- **UI / cuerpo:** `Inter` (weights 400–700)
- Google Fonts CDN ya incluido en `index.css`

### Clases CSS reutilizables
```css
/* Superficies */
.glass          /* blur(20px) borde 8% opacidad */
.glass-heavy    /* blur(40px) fondo oscuro sólido */
.glass-card     /* con hover: elevación + borde acento */

/* Layout */
.app-shell      /* flex row 100vh */
.main-area      /* flex col, overflow hidden */
.page-content   /* scrollable, padding 28px, gap 20px */
.topbar         /* barra superior 62px */
.sidebar        /* panel lateral 256px */

/* Tipografía */
.text-display   /* font-family Outfit */
.text-muted     /* color text-3 */
.text-accent    /* color p-300 (púrpura) */

/* Componentes */
.btn .btn-primary .btn-secondary .btn-danger .btn-icon .btn-sm .btn-xs
.form-input .form-select .form-textarea .form-group .form-label .form-row
.card .card-header .card-title .card-sub .card-desc .card-footer .card-icon
.badge .badge-purple .badge-cyan .badge-green .badge-amber .badge-gray
.dot .dot-green .dot-amber .dot-red
.grid-2 .grid-3 .grid-4 .stat-grid
.empty .empty-icon .empty-title .empty-sub
.modal-overlay .modal .modal-wide .modal-header .modal-title .modal-footer
.toast-stack .toast .toast-success .toast-error .toast-info .toast-warn
.canvas-wrap .canvas-hint
.spinner .loading-screen

/* Animaciones */
.fade-in .slide-up .pulse .spin
```

---

## 12. Flujo de uso de la aplicación

```
1. CONFIGURAR
   ├── Desplegar Code.gs como WebApp en GAS
   ├── Ejecutar crearBaseDeDatos() manualmente
   └── Agregar URL en .env → reiniciar npm start

2. CREAR ESTRUCTURA
   └── Equipos (👥)
       └── Procesos (📋)
           └── Flujos (🔗)
               └── Nodos + Conexiones (guardados en batch al crear el flujo)

3. NAVEGAR
   ├── Galería → cards con mini-preview 3D giratorio de cada flujo
   └── Clic → FlowMapPage (pantalla completa)

4. EN EL MAPA 3D
   ├── Modo lectura: clic en nodo → panel info lateral con salidas
   └── Modo Recorrer: botón ▶
       ├── Inicia en nodo tipo "inicio"
       ├── Muestra panel central con el nodo activo
       ├── Botones de condición (✓ Positivo / ✗ Negativo / → Continuar)
       ├── Puntos de progreso en la barra inferior (clicables)
       └── Al llegar a nodo tipo "fin" → toast de éxito

5. FLUJOS EXTERNOS
   └── Nodo tipo "flujo-externo" indica salto a otro flujo
       → refFlowId apunta al flujo destino (visualizado como info en el panel)
```

---

## 13. Despliegue

### Producción (Vercel / Netlify / GitHub Pages)

```bash
# Build de producción
npm run build

# La carpeta /build contiene los archivos estáticos listos para subir
```

> **Importante:** la variable `REACT_APP_GAS_URL` debe estar configurada  
> en el panel de variables de entorno de tu plataforma de hosting,  
> no solo en el archivo `.env` local.

### GitHub Pages
```bash
npm install --save-dev gh-pages

# En package.json agrega:
# "homepage": "https://TU_USUARIO.github.io/flowmapper",
# "predeploy": "npm run build",
# "deploy": "gh-pages -d build"

npm run deploy
```

---

## 14. Troubleshooting

| Síntoma | Causa probable | Solución |
|---|---|---|
| `REACT_APP_GAS_URL no configurado` | Falta el .env | Copia `.env.example` → `.env`, agrega la URL, reinicia `npm start` |
| `HTTP 401` en las llamadas | WebApp no público | En GAS: Implementar → Administrar → Editar → Acceso: Cualquier persona |
| `Hoja no encontrada` | No se ejecutó el setup | Ejecuta `crearBaseDeDatos()` en GAS o llama a `?action=setup` |
| Los datos no se guardan | El WebApp está en borrador | En GAS: Implementar → Nueva implementación (no editar la misma) |
| Canvas 3D en blanco | Nodos sin posición | Verifica que posX/posY/posZ no sean null en la hoja `nodos` |
| `CORS error` en fetch | GAS no redirige bien | Asegúrate de usar `redirect: 'follow'` en el fetch (ya incluido en `api.js`) |
| Tooltips 3D no aparecen | Z-index o pointer-events | El div del tooltip debe estar fuera del canvas con `pointerEvents: none` |
| Mini-preview en galería vacío | Nodos sin cargar | El contexto solo carga el grafo completo al abrir FlowMapPage. Llama `fetchFullFlow` por cada flujo si quieres precarga |

---

## Notas finales

- **No subas `.env` a git.** Agrega `.env` a tu `.gitignore`.
- Cada vez que **redespliegues** el WebApp en GAS (nueva implementación), la URL cambia. Actualiza el `.env` y redespliega el frontend.
- La función `crearBaseDeDatos()` es **idempotente**: puedes ejecutarla múltiples veces sin borrar datos.
- Para **migrar datos** entre Spreadsheets, cambia `SPREADSHEET_ID` en `Code.gs` y vuelve a desplegar.

---

*FlowMapper — Arquitectura de flujos visuales con Google Sheets como base de datos y Three.js como motor de visualización.*
