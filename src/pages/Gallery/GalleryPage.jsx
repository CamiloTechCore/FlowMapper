import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useData } from '../../context/dataStore';
import { Empty, Badge, Modal } from '../../components/UI';
import FlowBuilder from '../../components/FlowBuilder';
import { toast } from '../../hooks/useToast';
import '../../styles/library.css';

export default function GalleryPage({ onOpenFlow }) {
  const { flows, teams, processes, saveFullFlow, isLoading } = useData();
  const [params, setParams] = useSearchParams();
  const teamFilter = params.get('equipo') || '', processFilter = params.get('proceso') || '';
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('recent');
  const [choosing, setChoosing] = useState(false);
  const [builderTeam, setBuilderTeam] = useState(null);
  const [newTeam, setNewTeam] = useState('');
  const [savedId, setSavedId] = useState(null);
  const filtered = flows.filter(flow => {
    const team = teams.find(t => t.id === flow.teamId), process = processes.find(p => p.id === flow.processId);
    return (!teamFilter || flow.teamId === teamFilter) && (!processFilter || flow.processId === processFilter)
      && [flow.nombre, flow.descripcion, team?.nombre, process?.nombre].join(' ').toLocaleLowerCase().includes(search.toLocaleLowerCase());
  }).sort((a, b) => sort === 'name' ? a.nombre.localeCompare(b.nombre, 'es') : String(b.actualizadoEn).localeCompare(String(a.actualizadoEn)));
  const groups = teams.map(team => ({ team, items: filtered.filter(f => f.teamId === team.id) })).filter(group => group.items.length);
  const updateFilter = (team, process = '') => setParams({ ...(team ? { equipo: team } : {}), ...(process ? { proceso: process } : {}) });
  const selectedTeam = teams.find(t => t.id === newTeam);
  return <div className="library-page">
    <header className="topbar"><div><span className="topbar-title">Biblioteca de flujos</span><p className="library-subtitle">Organiza por equipo. Diseña por proceso. Explora cada recorrido.</p></div><div className="topbar-actions"><Link className="btn btn-secondary" to="/equipos">Gestionar equipos</Link><button className="btn btn-primary" onClick={() => { setNewTeam(teamFilter || teams[0]?.id || ''); setChoosing(true); }}>+ Nuevo flujo</button></div></header>
    <div className="page-content library-content">
      <div className="library-overview"><div><strong>{teams.length}</strong><span>Equipos</span></div><div><strong>{processes.length}</strong><span>Procesos</span></div><div><strong>{flows.length}</strong><span>Flujos guardados</span></div><div className="library-overview-note"><span>Equipo → Proceso → Flujo</span><small>Abre un mapa para explorar sus decisiones y conexiones.</small></div></div>
      <div className="library-filters"><input className="form-input" aria-label="Buscar en biblioteca" placeholder="🔍 Buscar flujo..." value={search} onChange={e => setSearch(e.target.value)} /><select className="form-select" aria-label="Filtrar por equipo" value={teamFilter} onChange={e => updateFilter(e.target.value)}><option value="">Todos los equipos</option>{teams.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}</select><select className="form-select" aria-label="Filtrar por proceso" value={processFilter} onChange={e => updateFilter(teamFilter, e.target.value)}><option value="">Todos los procesos</option>{processes.filter(p => !teamFilter || p.teamId === teamFilter).map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select><select className="form-select" aria-label="Ordenar flujos" value={sort} onChange={e => setSort(e.target.value)}><option value="recent">Última actualización</option><option value="name">Nombre A–Z</option></select>{(teamFilter || processFilter || search) && <button className="btn btn-secondary btn-sm" onClick={() => { updateFilter(''); setSearch(''); }}>Limpiar filtros</button>}</div>
      <div className="library-result-count">{filtered.length} {filtered.length === 1 ? 'flujo disponible' : 'flujos disponibles'}</div>
      {filtered.length === 0 ? <Empty icon="🗂" title={isLoading('flows') ? 'Cargando flujos…' : 'No hay flujos'} sub={flows.length ? 'Prueba otro equipo, proceso o término de búsqueda.' : 'Crea un equipo y sus procesos para guardar tu primer flujo.'} /> : groups.map(({ team, items }) => <section className="library-team" key={team.id} aria-label={`Flujos de ${team.nombre}`}><div className="library-team-heading"><span className="library-team-icon" style={{ background: `${team.color || '#a78bfa'}22` }}>{team.icono || '👥'}</span><div><h2>{team.nombre}</h2><small>{processes.filter(p => p.teamId === team.id).length} procesos · {items.length} flujos en esta vista</small></div><Link to={'/equipos/' + team.id} className="btn btn-secondary btn-sm">Ver procesos →</Link></div><div className="library-table-wrap"><table className="library-table"><caption className="library-sr-only">Flujos del equipo {team.nombre}</caption><thead><tr><th scope="col">Flujo</th><th scope="col">Proceso</th><th scope="col">Estado</th><th scope="col">Versión</th><th scope="col">Actualizado</th><th scope="col">Mapa</th></tr></thead><tbody>{items.map(flow => <tr key={flow.id} className={savedId === flow.id ? 'library-saved' : ''}><td><button className="library-flow-title" onClick={() => onOpenFlow(flow)}>{flow.nombre}</button>{flow.descripcion && <p>{flow.descripcion}</p>}{savedId === flow.id && <span className="library-saved-label">Recién guardado</span>}</td><td>{processes.find(p => p.id === flow.processId)?.nombre || 'Sin proceso'}</td><td><Badge variant={flow.estado === 'activo' ? 'green' : 'amber'}>{flow.estado || 'borrador'}</Badge></td><td>v{flow.version}</td><td>{flow.actualizadoEn && !Number.isNaN(Date.parse(flow.actualizadoEn)) ? new Date(flow.actualizadoEn).toLocaleDateString('es-CO') : '—'}</td><td><button className="btn btn-primary btn-sm" aria-label={`Abrir mapa de ${flow.nombre}`} onClick={() => onOpenFlow(flow)}>Abrir mapa ↗</button></td></tr>)}</tbody></table></div></section>)}
    </div>
    {choosing && <Modal title="Nuevo flujo · Selecciona el equipo" onClose={() => setChoosing(false)}><div className="modal-body"><label className="form-label" htmlFor="new-flow-team">Equipo</label><select id="new-flow-team" className="form-select" value={newTeam} onChange={e => setNewTeam(e.target.value)}><option value="">Seleccionar equipo…</option>{teams.map(team => <option key={team.id} value={team.id}>{team.nombre}</option>)}</select>{selectedTeam && !processes.some(p => p.teamId === newTeam) && <p style={{ marginTop: 16 }}>Este equipo aún no tiene procesos. <Link to={'/equipos/' + newTeam}>Crear un proceso</Link></p>}{!teams.length && <p><Link to="/equipos">Crear el primer equipo</Link></p>}</div><div className="modal-footer"><button className="btn btn-secondary" onClick={() => setChoosing(false)}>Cancelar</button><button className="btn btn-primary" disabled={!selectedTeam || !processes.some(p => p.teamId === newTeam)} onClick={() => { setBuilderTeam(selectedTeam); setChoosing(false); }}>Abrir constructor</button></div></Modal>}
    {builderTeam && <FlowBuilder processes={processes.filter(p => p.teamId === builderTeam.id)} allFlows={flows} teamId={builderTeam.id} onClose={() => setBuilderTeam(null)} onSave={async payload => { const result = await saveFullFlow(payload); setBuilderTeam(null); setSavedId(result.flow.id); updateFilter(result.flow.teamId); setSearch(''); toast.success('Flujo guardado en la biblioteca'); }} />}
  </div>;
}
