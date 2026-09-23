import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams, useLocation } from 'react-router-dom';
import { DataProvider } from './context/DataContext';
import { useData } from './context/dataStore';
import Sidebar from './components/Sidebar';
import { Empty, LoadingScreen, ToastContainer } from './components/UI';
import GalleryPage from './pages/Gallery/GalleryPage';
import TeamsPage from './pages/Teams/TeamsPage';
import TeamDetailPage from './pages/Teams/TeamDetailPage';
import FlowMapPage from './pages/FlowMap/FlowMapPage';
//import ConfigPage from './pages/Config/ConfigPage';
import { GAS_URL } from './services/config';

function TeamRoute() {
  const { teamId } = useParams();
  const { teams, isLoading } = useData();
  const navigate = useNavigate();
  const team = teams.find(t => t.id === teamId);
  if (isLoading('teams')) return <LoadingScreen />;
  return team ? <TeamDetailPage team={team} onBack={() => navigate('/equipos')} onOpenFlow={f => navigate('/flujos/' + f.id)} />
    : <Empty title="Equipo no encontrado" action={<button className="btn btn-secondary" onClick={() => navigate('/equipos')}>Ver equipos</button>} />;
}

function FlowRoute() {
  const { flowId } = useParams();
  const { flows, isLoading } = useData();
  const navigate = useNavigate();
  const flow = flows.find(f => f.id === flowId);
  if (isLoading('flows')) return <LoadingScreen />;
  return flow ? <FlowMapPage key={flow.id} flow={flow} onBack={() => navigate('/?equipo=' + flow.teamId)} />
    : <Empty title="Flujo no encontrado" action={<button className="btn btn-secondary" onClick={() => navigate('/')}>Volver a la galería</button>} />;
}

function Shell() {
  const { fetchTeams, fetchAllFlows, fetchAllProcesses, teams, error } = useData();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const page = pathname.startsWith('/equipos') ? 'teams' : pathname === '/configuracion' ? 'config' : 'gallery';
  const selectedTeam = teams.find(t => pathname === '/equipos/' + t.id);
  const reload = () => { fetchTeams(); fetchAllFlows(); fetchAllProcesses(); };
  useEffect(() => {
    if (GAS_URL) { fetchTeams(); fetchAllFlows(); fetchAllProcesses(); }
  }, [fetchTeams, fetchAllFlows, fetchAllProcesses]);
  return <div className="app-shell">
    {!pathname.startsWith('/flujos/') && <Sidebar page={page} selectedTeam={selectedTeam}
      onNav={p => navigate({ gallery: '/', teams: '/equipos', config: '/configuracion' }[p])}
      onSelectTeam={t => { if (t) navigate('/equipos/' + t.id); }} />}
    <main className="main-area">
      {(!GAS_URL || error) && <div className="connection-notice" role="alert">
        <span>{error || 'Configura la URL de Google Apps Script para cargar y guardar tus datos.'}</span>
        {GAS_URL && <button className="btn btn-secondary btn-sm" onClick={reload}>Reintentar</button>}
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/configuracion')}>Configuración</button>
      </div>}
      <div className="route-content" key={pathname}><Routes>
        <Route path="/" element={<GalleryPage onOpenFlow={f => navigate('/flujos/' + f.id)} />} />
        <Route path="/equipos" element={<TeamsPage onSelectTeam={t => navigate('/equipos/' + t.id)} />} />
        <Route path="/equipos/:teamId" element={<TeamRoute />} />
        <Route path="/flujos/:flowId" element={<FlowRoute />} />
        {/* <Route path="/configuracion" element={<ConfigPage />} /> */}
        <Route path="/constructor" element={<Navigate to="/equipos" replace />} />
        <Route path="/mapa" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Empty title="Página no encontrada" action={<button className="btn btn-secondary" onClick={() => navigate('/')}>Ir al inicio</button>} />} />
      </Routes></div>
    </main>
    <ToastContainer />
  </div>;
}

export default function AppShell() {
  return <BrowserRouter><DataProvider><Shell /></DataProvider></BrowserRouter>;
}
