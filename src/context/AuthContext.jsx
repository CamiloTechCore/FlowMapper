import { createContext, useContext, useEffect, useState } from 'react';
import api, { setSessionToken } from '../services/api';
const AuthContext = createContext(null);
// oxlint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    let cancelled = false;
    async function restore() {
      try {
        const saved = JSON.parse(sessionStorage.getItem('flowmapper.session') || 'null');
        if (!saved || saved.expiresAt <= Date.now()) return;
        setSessionToken(saved.sessionToken);
        const user = await api.getSession();
        if (!cancelled) setSession({ ...saved, user });
      } catch { try { sessionStorage.removeItem('flowmapper.session'); } catch { /* Almacenamiento restringido. */ } setSessionToken(''); }
      finally { if (!cancelled) setChecking(false); }
    }
    restore();
    return () => { cancelled = true; };
  }, []);
  function clear() { setSessionToken(''); try { sessionStorage.removeItem('flowmapper.session'); } catch { /* La sesión del servidor ya se invalida al salir. */ } setSession(null); }
  useEffect(() => {
    window.addEventListener('flowmapper-session-expired', clear);
    const timer = session ? setTimeout(clear, Math.max(0, session.expiresAt - Date.now())) : null;
    return () => { window.removeEventListener('flowmapper-session-expired', clear); clearTimeout(timer); };
  }, [session]);
  async function login(email, password) {
    const result = await api.login(email, password);
    setSessionToken(result.sessionToken);
    try { sessionStorage.setItem('flowmapper.session', JSON.stringify(result)); } catch { /* Sin almacenamiento, la sesión solo dura mientras esta página permanezca abierta. */ }
    setSession(result);
  }
  async function logout() { try { await api.logout(); } finally { clear(); } }
  return <AuthContext.Provider value={{ user: session?.user, isAdmin: session?.user.rol === 'administrador', checking, login, logout }}>{children}</AuthContext.Provider>;
}

export function LoginPage() {
  const { login, checking } = useAuth();
  const [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  return <main className="login-page"><form className="glass-card login-card" onSubmit={async e => {
    e.preventDefault(); setBusy(true); setError('');
    try { await login(email.trim(), password); setPassword(''); } catch (err) { setError(err.message); } finally { setBusy(false); }
  }}><h1>FlowMapper</h1><p>Biblioteca documental de procesos y playbooks</p><label className="form-group">Correo<input className="form-input" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} /></label><label className="form-group">Contraseña<input className="form-input" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></label>{error && <p role="alert">{error}</p>}<button className="btn btn-primary" disabled={busy || checking}>{busy || checking ? 'Verificando acceso…' : 'Iniciar sesión'}</button><small>El administrador autoriza las cuentas de lectura.</small></form></main>;
}
