import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { usersApi } from '../api/users';
import { AxiosError } from 'axios';

export function AcceptInvitePage(): JSX.Element {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [form, setForm] = useState({
    invite_token: searchParams.get('token') ?? '',
    password: '',
    confirm_password: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirm_password) {
      setError('Las contraseñas no coinciden');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await usersApi.acceptInvite({
        invite_token: form.invite_token,
        password: form.password,
      });
      setSuccess(true);
    } catch (err) {
      const axiosErr = err as AxiosError<{ error: string }>;
      setError(axiosErr.response?.data?.error ?? 'Error al aceptar la invitación');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="card text-center space-y-4">
            <div className="text-5xl">✓</div>
            <h2 className="text-xl font-bold text-green-400">Contraseña establecida</h2>
            <p className="text-gray-400 text-sm">
              Tu cuenta está lista. Ya puedes iniciar sesión con tu usuario y contraseña.
            </p>
            <button
              onClick={() => navigate('/login')}
              className="btn-primary w-full"
            >
              Ir al login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-brand-400">Nexum</h1>
          <p className="text-gray-400 mt-1 text-sm">Activar cuenta</p>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-100 mb-6">Establece tu contraseña</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Token de invitación *</label>
              <input
                type="text"
                className="input font-mono text-sm"
                value={form.invite_token}
                onChange={(e) => setForm({ ...form, invite_token: e.target.value })}
                placeholder="Pega aquí el token recibido"
                required
              />
            </div>
            <div>
              <label className="label">Nueva contraseña *</label>
              <input
                type="password"
                className="input"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                minLength={12}
                autoComplete="new-password"
              />
              <p className="text-xs text-gray-500 mt-1">
                Mín. 12 caracteres, mayúsculas, minúsculas, números y símbolos
              </p>
            </div>
            <div>
              <label className="label">Confirmar contraseña *</label>
              <input
                type="password"
                className="input"
                value={form.confirm_password}
                onChange={(e) => setForm({ ...form, confirm_password: e.target.value })}
                required
                minLength={12}
                autoComplete="new-password"
              />
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-700 text-red-400 text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? 'Activando...' : 'Activar cuenta'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500">
          ¿Ya tienes cuenta?{' '}
          <button
            onClick={() => navigate('/login')}
            className="text-brand-400 hover:text-brand-300"
          >
            Iniciar sesión
          </button>
        </p>
      </div>
    </div>
  );
}
