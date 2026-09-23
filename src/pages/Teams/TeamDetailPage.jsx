import { FLOW_STATES, normalizeStatus } from '../../workflow/model';
import React, { useState } from 'react';
import { useData } from '../../context/dataStore';
import { Modal, Empty, Badge } from '../../components/UI';
import FlowBuilder from '../../components/FlowBuilder';
import { toast } from '../../hooks/useToast';

export default function TeamDetailPage({ team, onBack, onOpenFlow }) {
  const {
    processes, flows, nodes,
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
      const result = await saveFullFlow({ flow: { ...flow, teamId: team.id }, nodes: rawNodes, edges: rawEdges });
      toast.success('Flujo creado con ' + rawNodes.length + ' nodos ✓');
      setShowFlowModal(false);
      onOpenFlow(result.flow);
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
          <button className="btn btn-primary"   onClick={() => setShowFlowModal(true)} disabled={!teamProcesses.length}>+ Flujo</button>
        </div>
      </div>

      {/* Content: two-column layout */}
      <div className="page-content team-content">

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
                      aria-label={`Eliminar proceso ${proc.nombre}`}
                      onClick={() => { if (window.confirm('¿Eliminar el proceso? Debe estar sin flujos.')) deleteProcess(proc.id).then(() => toast.info('Proceso eliminado')).catch(err => toast.error(err.message)); }}
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
                        dot={FLOW_STATES[normalizeStatus(flow.estado)]}
                      >
                        {FLOW_STATES[normalizeStatus(flow.estado)]}
                      </Badge>
                      <Badge variant="purple">{nodes[flow.id] ? fNodes.length : '—'} nodos</Badge>
                      <Badge variant="gray">v{flow.version}</Badge>
                      <button
                        className="btn btn-danger btn-xs"
                        style={{ marginLeft: 'auto' }}
                        aria-label={`Eliminar flujo ${flow.nombre}`}
                        onClick={e => { e.stopPropagation(); if (window.confirm('¿Eliminar el flujo y todos sus nodos y conexiones?')) deleteFlow(flow.id).then(() => toast.info('Flujo eliminado')).catch(err => toast.error(err.message)); }}
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
