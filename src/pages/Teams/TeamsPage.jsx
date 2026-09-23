import React, { useState } from 'react';
import { useData } from '../../context/dataStore';
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
    if (!window.confirm('¿Eliminar este equipo? Primero debes eliminar sus procesos.')) return;
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
                      aria-label={`Eliminar equipo ${team.nombre}`}
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
