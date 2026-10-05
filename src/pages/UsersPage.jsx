import { useEffect, useState } from 'react';
import api from '../services/api';
export default function UsersPage() {
  const [users, setUsers] = useState([]), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ nombre: '', correo: '', password: '', activo: true });
  useEffect(() => { api.getUsers().then(setUsers).catch(e => setError(e.message)); }, []);
  return <div className="page-content"><h1>Usuarios</h1><p>Un administrador. Todas las demás cuentas tienen acceso de lectura. La contraseña temporal reemplaza la clave de acceso al guardar y se elimina después de generar el hash. Al editar, déjala vacía para conservar la clave actual.</p>
    <form className="glass-card users-form" onSubmit={async e => {
      e.preventDefault(); setBusy(true); setError('');
      try { await api.saveReader(form); setUsers(await api.getUsers()); setForm({ nombre: '', correo: '', password: '', activo: true }); }
      catch (err) { setError(err.message); } finally { setBusy(false); }
    }}>{[['nombre','Nombre'],['correo','Correo'],['password','Contraseña']].map(([key,label]) => <label className="form-group" key={key}>{label}<input className="form-input" type={key === 'correo' ? 'email' : key === 'password' ? 'password' : 'text'} required={key !== 'password' || !form.id} minLength={key === 'password' ? 12 : undefined} maxLength={key === 'password' ? 256 : undefined} autoComplete={key === 'password' ? 'new-password' : undefined} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} /></label>)}<label><input type="checkbox" checked={form.activo} onChange={e => setForm({ ...form, activo: e.target.checked })} /> Acceso activo</label><button className="btn btn-primary" disabled={busy}>Guardar lector</button></form>
    {error && <p role="alert">{error}</p>}<table className="library-table"><thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Acceso</th><th>Acción</th></tr></thead><tbody>{users.map(u => <tr key={u.id}><td>{u.nombre}</td><td>{u.correo}</td><td>{u.rol}</td><td>{String(u.activo) === 'true' ? 'Activo' : 'Desactivado'}</td><td>{u.rol === 'lector' && <button className="btn btn-secondary btn-sm" onClick={() => setForm({ ...u, password: '', activo: String(u.activo) === 'true' })}>Editar lector</button>}</td></tr>)}</tbody></table>
  </div>;
}
