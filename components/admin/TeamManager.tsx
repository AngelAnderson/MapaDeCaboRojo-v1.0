import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../services/supabase';

interface AdminUser {
  id: string;
  email: string;
  name: string;
  created_at: string;
  last_sign_in_at: string | null;
}

interface TeamManagerProps {
  showToast: (msg: string, type: 'success' | 'error') => void;
}

async function apiCall(action: string, method: 'GET' | 'POST', body?: object): Promise<any> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`/api/ops?action=${action}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Error');
  return json;
}

export const TeamManager: React.FC<TeamManagerProps> = ({ showToast }) => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string; name: string; last_sign_in_at: string | null } | null>(null);

  // Add user form
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  // Reset password modal
  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  // Own profile editing
  const [profileName, setProfileName] = useState('');
  const [profilePassword, setProfilePassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiCall('list', 'GET');
      setUsers(data.users);

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const me = data.users.find((u: AdminUser) => u.id === user.id);
        setCurrentUser({
          id: user.id,
          email: user.email || '',
          name: me?.name || user.user_metadata?.name || '',
          last_sign_in_at: me?.last_sign_in_at || null,
        });
        setProfileName(me?.name || user.user_metadata?.name || '');
      }
    } catch (err: any) {
      showToast(err.message || 'Error loading users', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleCreate = async () => {
    if (!newEmail || !newPassword) return showToast('Email y contraseña requeridos', 'error');
    setCreating(true);
    try {
      await apiCall('create', 'POST', { email: newEmail, password: newPassword, name: newName });
      showToast('Usuario creado exitosamente', 'success');
      setNewEmail(''); setNewPassword(''); setNewName('');
      await loadUsers();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (user: AdminUser) => {
    if (!confirm(`¿Seguro que quieres eliminar a ${user.email}?`)) return;
    try {
      await apiCall('delete', 'POST', { userId: user.id });
      showToast('Usuario eliminado', 'success');
      await loadUsers();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleResetPassword = async () => {
    if (!resetTarget || !resetPassword) return showToast('Nueva contraseña requerida', 'error');
    setResetting(true);
    try {
      await apiCall('reset-password', 'POST', { userId: resetTarget.id, newPassword: resetPassword });
      showToast('Contraseña actualizada', 'success');
      setResetTarget(null);
      setResetPassword('');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setResetting(false);
    }
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      if (profileName !== currentUser?.name) {
        await apiCall('update-profile', 'POST', { name: profileName });
      }
      if (profilePassword) {
        if (!currentUser) return;
        await apiCall('reset-password', 'POST', { userId: currentUser.id, newPassword: profilePassword });
        setProfilePassword('');
      }
      showToast('Perfil actualizado', 'success');
      await loadUsers();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('es-PR', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const otherUsers = users.filter((u) => u.id !== currentUser?.id);

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">

      {/* ── My Profile ─────────────────────────────────────────────────────────── */}
      <section className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
          <i className="fa-solid fa-circle-user text-teal-400"></i>
          Mi Perfil
        </h3>

        {currentUser ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-teal-600/20 flex items-center justify-center text-teal-400 text-lg font-bold">
                {(currentUser.name || currentUser.email).charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-bold text-white">{currentUser.email}</p>
                <p className="text-xs text-slate-500">Último acceso: {formatDate(currentUser.last_sign_in_at)}</p>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase ml-1 mb-1 block">Nombre</label>
              <input
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="Tu nombre"
                className="w-full bg-slate-900 border border-slate-700 text-white p-3 rounded-xl focus:border-teal-500 outline-none transition-colors text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase ml-1 mb-1 block">Nueva contraseña (opcional)</label>
              <input
                type="password"
                value={profilePassword}
                onChange={(e) => setProfilePassword(e.target.value)}
                placeholder="Dejar en blanco para no cambiar"
                className="w-full bg-slate-900 border border-slate-700 text-white p-3 rounded-xl focus:border-teal-500 outline-none transition-colors text-sm"
              />
            </div>

            <button
              onClick={handleSaveProfile}
              disabled={savingProfile}
              className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 px-5 rounded-xl shadow-lg shadow-teal-900/20 active:scale-95 transition-all flex items-center gap-2 text-sm"
            >
              {savingProfile ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-floppy-disk"></i>}
              Guardar perfil
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center py-6">
            <i className="fa-solid fa-circle-notch fa-spin text-teal-400 text-xl"></i>
          </div>
        )}
      </section>

      {/* ── Add User ───────────────────────────────────────────────────────────── */}
      <section className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
          <i className="fa-solid fa-user-plus text-teal-400"></i>
          Agregar Usuario
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nombre"
            className="bg-slate-900 border border-slate-700 text-white p-3 rounded-xl focus:border-teal-500 outline-none transition-colors text-sm"
          />
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="Email"
            className="bg-slate-900 border border-slate-700 text-white p-3 rounded-xl focus:border-teal-500 outline-none transition-colors text-sm"
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Contraseña"
            className="bg-slate-900 border border-slate-700 text-white p-3 rounded-xl focus:border-teal-500 outline-none transition-colors text-sm"
          />
        </div>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="mt-3 bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 px-5 rounded-xl shadow-lg shadow-teal-900/20 active:scale-95 transition-all flex items-center gap-2 text-sm"
        >
          {creating ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-plus"></i>}
          Crear usuario
        </button>
      </section>

      {/* ── User List ──────────────────────────────────────────────────────────── */}
      <section className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-700 flex items-center gap-2">
          <i className="fa-solid fa-users text-teal-400"></i>
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Equipo</h3>
          <span className="ml-auto text-xs text-slate-500">{otherUsers.length} usuario{otherUsers.length !== 1 ? 's' : ''}</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <i className="fa-solid fa-circle-notch fa-spin text-teal-400 text-xl"></i>
          </div>
        ) : otherUsers.length === 0 ? (
          <div className="py-10 text-center text-slate-500 text-sm">No hay otros usuarios</div>
        ) : (
          <div className="divide-y divide-slate-700">
            {otherUsers.map((user) => (
              <div key={user.id} className="flex items-center gap-3 px-5 py-3.5">
                <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 font-bold text-sm shrink-0">
                  {(user.name || user.email).charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white text-sm truncate">{user.email}</p>
                  <p className="text-xs text-slate-500">
                    {user.name && <span className="mr-2">{user.name}</span>}
                    Último acceso: {formatDate(user.last_sign_in_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => { setResetTarget(user); setResetPassword(''); }}
                    className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded-lg font-bold transition-colors flex items-center gap-1"
                  >
                    <i className="fa-solid fa-key text-[10px]"></i>
                    Reset
                  </button>
                  <button
                    onClick={() => handleDelete(user)}
                    className="text-xs bg-red-900/40 hover:bg-red-900/70 text-red-400 px-3 py-1.5 rounded-lg font-bold transition-colors flex items-center gap-1"
                  >
                    <i className="fa-solid fa-trash text-[10px]"></i>
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Reset Password Modal ───────────────────────────────────────────────── */}
      {resetTarget && (
        <div className="fixed inset-0 bg-slate-900/80 z-[6000] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h4 className="text-white font-bold mb-1">Resetear contraseña</h4>
            <p className="text-slate-400 text-sm mb-4 truncate">{resetTarget.email}</p>

            <input
              type="password"
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              placeholder="Nueva contraseña"
              autoFocus
              className="w-full bg-slate-900 border border-slate-700 text-white p-3 rounded-xl focus:border-teal-500 outline-none transition-colors text-sm mb-4"
            />

            <div className="flex gap-3">
              <button
                onClick={() => { setResetTarget(null); setResetPassword(''); }}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-2.5 rounded-xl transition-colors text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleResetPassword}
                disabled={resetting}
                className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 rounded-xl shadow-lg shadow-teal-900/20 active:scale-95 transition-all flex items-center justify-center gap-2 text-sm"
              >
                {resetting ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-check"></i>}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
