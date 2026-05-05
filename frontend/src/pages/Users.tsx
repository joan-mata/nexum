import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi, User, AuditEntry } from '../api/users';
import { AxiosError } from 'axios';
import { PasswordInput } from '../components/PasswordInput';

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Nunca';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Ahora';
  if (mins < 60) return `Hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Hace ${days} días`;
}

export function UsersPage(): JSX.Element {
  const qc = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'users' | 'audit'>('users');

  const [createForm, setCreateForm] = useState({
    username: '',
    email: '',
    role: 'operator' as 'admin' | 'operator',
    password: '',
    confirm_password: '',
  });
  const [passwordForm, setPasswordForm] = useState({
    admin_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [formError, setFormError] = useState<string | null>(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list().then((r) => r.data),
  });

  const { data: auditLog = [] } = useQuery({
    queryKey: ['audit-log'],
    queryFn: () => usersApi.auditLog().then((r) => r.data),
    enabled: activeTab === 'audit',
  });

  const createMutation = useMutation({
    mutationFn: (data: { username: string; email: string; role: 'admin' | 'operator'; password: string }) =>
      usersApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setShowCreateModal(false);
      setCreateForm({ username: '', email: '', role: 'operator', password: '', confirm_password: '' });
    },
    onError: (err: AxiosError<{ error: string }>) => {
      setFormError(err.response?.data?.error ?? 'Error al crear usuario');
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { admin_password: string; new_password: string } }) =>
      usersApi.changePassword(id, data),
    onSuccess: () => {
      setShowPasswordModal(null);
      setPasswordForm({ admin_password: '', new_password: '', confirm_password: '' });
      alert('Contraseña cambiada correctamente');
    },
    onError: (err: AxiosError<{ error: string }>) => {
      setFormError(err.response?.data?.error ?? 'Error al cambiar contraseña');
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (id: string) => usersApi.toggleActive(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (createForm.password !== createForm.confirm_password) {
      setFormError('Las contraseñas no coinciden');
      return;
    }
    setFormError(null);
    createMutation.mutate({
      username: createForm.username,
      email: createForm.email,
      role: createForm.role,
      password: createForm.password,
    });
  };

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setFormError('Las contraseñas no coinciden');
      return;
    }
    setFormError(null);
    changePasswordMutation.mutate({
      id: showPasswordModal!,
      data: {
        admin_password: passwordForm.admin_password,
        new_password: passwordForm.new_password,
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-100">Gestión de usuarios</h1>
        <button onClick={() => { setFormError(null); setShowCreateModal(true); }} className="btn-primary text-sm">
          + Crear usuario
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-800 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 text-sm rounded-md font-medium transition-colors ${
            activeTab === 'users' ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-gray-100'
          }`}
        >
          Usuarios
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2 text-sm rounded-md font-medium transition-colors ${
            activeTab === 'audit' ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-gray-100'
          }`}
        >
          Log de auditoría
        </button>
      </div>


      {activeTab === 'users' && (
        <>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-500" />
            </div>
          ) : (
            <div className="card overflow-hidden p-0">
              <table className="w-full text-sm">
                <thead className="bg-gray-700/50">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-400 font-medium">Usuario</th>
                    <th className="text-left px-4 py-3 text-gray-400 font-medium">Email</th>
                    <th className="text-center px-4 py-3 text-gray-400 font-medium">Rol</th>
                    <th className="text-center px-4 py-3 text-gray-400 font-medium">Estado</th>
                    <th className="text-left px-4 py-3 text-gray-400 font-medium">Último acceso</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {users.map((u: User) => (
                    <tr key={u.id} className="border-t border-gray-700/50 hover:bg-gray-700/30">
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-gray-100 font-medium">{u.username}</p>
                          {u.must_change_password && (
                            <p className="text-xs text-yellow-400">Debe cambiar contraseña</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-400">{u.email}</td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`badge ${
                            u.role === 'admin'
                              ? 'bg-brand-900/50 text-brand-400'
                              : 'bg-gray-700 text-gray-400'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`badge ${
                            u.is_active ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
                          }`}
                        >
                          {u.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-sm">
                        {timeAgo(u.last_login)}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => {
                            setPasswordForm({ admin_password: '', new_password: '', confirm_password: '' });
                            setFormError(null);
                            setShowPasswordModal(u.id);
                          }}
                          className="text-xs text-brand-400 hover:text-brand-300 mr-3"
                        >
                          Cambiar pass
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`¿${u.is_active ? 'Desactivar' : 'Activar'} a ${u.username}?`)) {
                              toggleActiveMutation.mutate(u.id);
                            }
                          }}
                          className={`text-xs ${
                            u.is_active
                              ? 'text-red-400 hover:text-red-300'
                              : 'text-green-400 hover:text-green-300'
                          }`}
                        >
                          {u.is_active ? 'Desactivar' : 'Activar'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {activeTab === 'audit' && (
        <div className="card overflow-hidden p-0">
          <div className="px-6 py-4 border-b border-gray-700">
            <h2 className="font-semibold text-gray-100">Últimas 50 entradas</h2>
          </div>
          <div className="overflow-x-auto">
            {auditLog.length === 0 ? (
              <p className="text-center text-gray-500 py-8">Sin registros</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-700/50">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-400 font-medium">Fecha</th>
                    <th className="text-left px-4 py-3 text-gray-400 font-medium">Usuario</th>
                    <th className="text-left px-4 py-3 text-gray-400 font-medium">Acción</th>
                    <th className="text-left px-4 py-3 text-gray-400 font-medium">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLog.map((entry: AuditEntry) => (
                    <tr key={entry.id} className="border-t border-gray-700/50 hover:bg-gray-700/30">
                      <td className="px-4 py-3 text-gray-400 whitespace-nowrap text-xs">
                        {new Date(entry.created_at).toLocaleString('es-ES')}
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        {entry.username ?? '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-300">{entry.action}</td>
                      <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                        {entry.ip_address ?? '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-100">Crear usuario</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-100 text-xl">×</button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="label">Nombre de usuario *</label>
                <input
                  type="text"
                  className="input"
                  value={createForm.username}
                  onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                  required
                  minLength={3}
                />
              </div>
              <div>
                <label className="label">Email *</label>
                <input
                  type="email"
                  className="input"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">Rol *</label>
                <select
                  className="input"
                  value={createForm.role}
                  onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as 'admin' | 'operator' })}
                >
                  <option value="operator">Operator</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="label">Contraseña temporal *</label>
                <PasswordInput
                  className="input"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  required
                  minLength={10}
                />
                <p className="text-xs text-gray-500 mt-1">El usuario deberá cambiarla en el primer acceso</p>
              </div>
              <div>
                <label className="label">Confirmar contraseña *</label>
                <PasswordInput
                  className="input"
                  value={createForm.confirm_password}
                  onChange={(e) => setCreateForm({ ...createForm, confirm_password: e.target.value })}
                  required
                  minLength={10}
                />
              </div>
              {formError && (
                <div className="bg-red-900/30 border border-red-700 text-red-400 text-sm rounded-lg px-4 py-3">
                  {formError}
                </div>
              )}
              <div className="flex gap-3">
                <button type="submit" disabled={createMutation.isPending} className="btn-primary flex-1">
                  {createMutation.isPending ? 'Creando...' : 'Crear usuario'}
                </button>
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn-secondary flex-1">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-100">Cambiar contraseña</h2>
              <button onClick={() => setShowPasswordModal(null)} className="text-gray-400 hover:text-gray-100 text-xl">×</button>
            </div>
            <form onSubmit={handlePasswordChange} className="p-6 space-y-4">
              <div>
                <label className="label">Tu contraseña de admin *</label>
                <PasswordInput
                  className="input"
                  value={passwordForm.admin_password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, admin_password: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">Nueva contraseña *</label>
                <PasswordInput
                  className="input"
                  value={passwordForm.new_password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                  required
                  minLength={10}
                />
                <p className="text-xs text-gray-500 mt-1">Mín. 10 caracteres, mayúsculas, minúsculas, números y símbolos</p>
              </div>
              <div>
                <label className="label">Confirmar nueva contraseña *</label>
                <PasswordInput
                  className="input"
                  value={passwordForm.confirm_password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                  required
                  minLength={10}
                />
              </div>
              {formError && (
                <div className="bg-red-900/30 border border-red-700 text-red-400 text-sm rounded-lg px-4 py-3">
                  {formError}
                </div>
              )}
              <div className="flex gap-3">
                <button type="submit" className="btn-primary flex-1">Cambiar contraseña</button>
                <button type="button" onClick={() => setShowPasswordModal(null)} className="btn-secondary flex-1">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
