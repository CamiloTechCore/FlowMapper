import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../context/dataStore';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
export default function LibraryFolders({ selected, onSelect }) {
  const { folders, teams, processes, flows, fetchFolders } = useData(), { isAdmin } = useAuth();
  const [form, setForm] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  async function remove(id) {
    if (!window.confirm('¿Eliminar esta carpeta vacía?')) return;
    setBusy(true); setError('');
    try { await api.deleteFolder(id); await fetchFolders(); if (selected === id) onSelect(''); } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <section className="folder-library"><div className="folder-heading"><h2>Carpetas y grupos</h2>{isAdmin && <button className="btn btn-secondary btn-sm" onClick={() => setForm({ nombre: '', descripcion: '' })}>+ Nueva carpeta</button>}</div>
    {form && isAdmin && <form className="folder-form" onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); try { await api.saveFolder(form); await fetchFolders(); setForm(null); } catch (err) { setError(err.message); } finally { setBusy(false); } }}><label>Nombre<input className="form-input" required value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} /></label><label>Descripción<input className="form-input" value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} /></label><button className="btn btn-primary" disabled={busy}>Guardar carpeta</button><button type="button" className="btn btn-secondary" onClick={() => setForm(null)}>Cancelar</button></form>}
    {error && <p role="alert">{error}</p>}<div className="folder-grid">{[...folders, { id: 'ungrouped', nombre: 'Sin carpeta' }].map(folder => {
      const members = teams.filter(t => folder.id === 'ungrouped' ? !t.carpetaId : t.carpetaId === folder.id);
      if (folder.id === 'ungrouped' && !members.length) return null;
      return <details className="glass-card folder-card" key={folder.id} open={selected === folder.id}><summary>{folder.nombre} · {members.length} equipos / grupos</summary>{folder.descripcion && <p>{folder.descripcion}</p>}<button className="btn btn-secondary btn-sm" onClick={() => onSelect(folder.id)}>Ver flujos</button>{isAdmin && folder.id !== 'ungrouped' && <><button className="btn btn-secondary btn-sm" onClick={() => setForm(folder)}>Editar carpeta</button><button className="btn btn-danger btn-sm" disabled={members.length > 0 || busy} onClick={() => remove(folder.id)}>Eliminar</button></>}
        {members.map(team => <details key={team.id}><summary>{team.nombre} {team.etiqueta}</summary><Link to={'/equipos/' + team.id}>Ver equipo / grupo</Link>{processes.filter(p => p.teamId === team.id).map(p => <details key={p.id}><summary>{p.nombre}</summary>{flows.filter(f => f.processId === p.id).map(f => <p key={f.id}><Link to={'/flujos/' + f.id}>{f.nombre}</Link></p>)}</details>)}</details>)}
      </details>;
    })}</div></section>;
}
