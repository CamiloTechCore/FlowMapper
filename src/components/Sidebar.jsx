import { GAS_URL } from '../services/config';
import { useData } from '../context/dataStore';

const NAV = [
  { id: 'gallery',  icon: '🗂',  label: 'Biblioteca de Flujos' },
  { id: 'overview', icon: '⌘', label: 'Vista general' },
  { id: 'teams',    icon: '👥',  label: 'Equipos' },
];

export default function Sidebar({ page, onNav, selectedTeam, onSelectTeam }) {
  const { teams, flows } = useData();
  const gasUrl = GAS_URL;

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-mark">⚡ FlowMapper</div>
        <div className="sidebar-logo-sub">Gestión de Flujos de Trabajo</div>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        <div className="sidebar-section-label">Navegación</div>
        {NAV.map(item => (
          <button type="button"
            key={item.id}
            className={`nav-item ${page === item.id && !selectedTeam ? 'active' : ''}`}
            onClick={() => { onNav(item.id); onSelectTeam(null); }}
          >
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}

        {teams.length > 0 && (
          <>
            <div className="sidebar-section-label" style={{ marginTop: 6 }}>Acceso Rápido</div>
            {teams.slice(0, 6).map(t => {
              const count = flows.filter(f => f.teamId === t.id).length;
              return (
                <button type="button"
                  key={t.id}
                  className={`nav-item ${selectedTeam?.id === t.id ? 'active' : ''}`}
                  onClick={() => { onNav('teams'); onSelectTeam(t); }}
                >
                  <span className="nav-icon">{t.icono}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13 }} className="truncate">{t.nombre}</div>
                    <div className="nav-sub">{count} flujo{count !== 1 ? 's' : ''}</div>
                  </div>
                </button>
              );
            })}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <div>⚡ FlowMapper v1.0</div>
        <div style={{ marginTop: 4 }}>
          {gasUrl
            ? <span style={{ color: 'var(--green)' }}>● URL GAS configurada</span>
            : <span style={{ color: 'var(--amber)' }}>● Modo sin backend</span>}
        </div>
      </div>
    </aside>
  );
}
