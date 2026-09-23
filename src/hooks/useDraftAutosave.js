import { useEffect, useRef, useState } from 'react';
import { IDLE_DRAFT_MS, writeDraft } from '../workflow/drafts';

export default function useDraftAutosave({ storageKey, snapshot, dirty, onIdle }) {
  const latest = useRef(null);
  const lastAttempt = useRef('');
  const [status, setStatus] = useState('');
  const serialized = JSON.stringify(snapshot);
  useEffect(() => { latest.current = { snapshot, dirty, onIdle, serialized }; });
  useEffect(() => {
    let timer;
    const persist = () => {
      const current = latest.current;
      if (!current?.dirty) return true;
      try { writeDraft(localStorage, storageKey, current.snapshot); return true; }
      catch { setStatus('No se pudo crear la copia local. Exporta JSON para conservar el progreso.'); return false; }
    };
    const idle = async () => {
      const current = latest.current;
      if (!current?.dirty || current.serialized === lastAttempt.current) return;
      const local = persist();
      lastAttempt.current = current.serialized;
      if (local) setStatus('Borrador conservado en este navegador.');
      const result = await current.onIdle();
      if (result && (local || result.startsWith('Borrador guardado en biblioteca'))) setStatus(result);
    };
    const activity = () => { clearTimeout(timer); timer = setTimeout(idle, IDLE_DRAFT_MS); };
    const events = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'input', 'change'];
    events.forEach(event => window.addEventListener(event, activity, { passive: true }));
    window.addEventListener('pagehide', persist);
    const visibility = () => { if (document.visibilityState === 'hidden') persist(); };
    document.addEventListener('visibilitychange', visibility);
    activity();
    return () => {
      clearTimeout(timer);
      events.forEach(event => window.removeEventListener(event, activity));
      window.removeEventListener('pagehide', persist);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [storageKey]);
  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(() => {
      try { writeDraft(localStorage, storageKey, JSON.parse(serialized)); }
      catch { setStatus('No se pudo crear la copia local. Exporta JSON para conservar el progreso.'); }
    }, 500);
    return () => clearTimeout(timer);
  }, [serialized, dirty, storageKey]);
  return status;
}
