import { useRef, useState } from 'react';
import { nodeUrl } from '../workflow/links';
import '../styles/node-link.css';

export default function NodeLink({ flowId, nodeId, saved = true }) {
  const input = useRef(null);
  const [status, setStatus] = useState('');
  const url = saved && flowId ? nodeUrl(window.location.origin, flowId, nodeId) : '';
  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(url);
      setStatus('Enlace copiado.');
    } catch {
      input.current?.focus(); input.current?.select();
      setStatus('Selecciona y copia el enlace con Ctrl+C o ⌘C.');
    }
  }
  return <section className="node-link" aria-label="Enlace directo del nodo">
    <small>ID del nodo</small><code>{nodeId}</code>
    {url ? <><label>URL del nodo<input ref={input} readOnly value={url} onFocus={e => e.target.select()} /></label><button type="button" className="btn btn-secondary btn-sm" onClick={copyUrl}>Copiar URL del nodo</button><span role="status">{status}</span></>
      : <p>Guarda el avance para habilitar el enlace de este nodo.</p>}
  </section>;
}
