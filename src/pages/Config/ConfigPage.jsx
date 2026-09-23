import { useState } from 'react';
import { GAS_URL } from '../../services/config';
import { toast } from '../../hooks/useToast';
import api from '../../services/api';

export default function ConfigPage() {
  const url = GAS_URL;
  const [testing, setTesting] = useState(false);
  const [result,  setResult]  = useState(null);

  const testConnection = async () => {
    setTesting(true);
    setResult(null);
    try {
      const data = await api.ping();
      if (!data?.pong) throw new Error('El backend no implementa el contrato FlowMapper. Actualiza Code.gs.');
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
    'Abre el proyecto existente y reemplaza Code.gs por el archivo actualizado',
    'Ejecuta validarBaseDeDatos() para revisar las hojas sin modificar datos',
    'Ejecuta crearBaseDeDatos(): respalda las tablas que cambian y añade las columnas faltantes',
    'Actualiza la implementación web con una nueva versión del código',
    'Configuración: Ejecutar como: Yo | Acceso: Cualquier persona',
    'Copia la URL generada (termina en /exec)',
    'Pégala en tu archivo .env como VITE_GAS_URL=<url>',
    'Reinicia el servidor de desarrollo (npm run dev)',
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
            <code style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 6px', borderRadius: 4, marginLeft: 4 }}>VITE_GAS_URL</code>.
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
            {url || '⚠️ No configurada — define VITE_GAS_URL en .env'}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-primary" onClick={testConnection} disabled={testing || !url}>
              {testing ? '⏳ Probando...' : '🔌 Probar Conexión'}
            </button>
            <button className="btn btn-secondary" onClick={runSetup} disabled={testing || !url}>
              📦 Crear / verificar hojas
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

VITE_GAS_URL=https://script.google.com/macros/s/TU_ID/exec`}
          </pre>
        </div>

      </div>
    </div>
  );
}
