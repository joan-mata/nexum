import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { authApi } from '../api/auth';
import { AxiosError } from 'axios';
import { setAccessToken } from '../api/client';
import { PasswordInput } from '../components/PasswordInput';

const rules = [
  { label: 'Mínimo 10 caracteres', test: (p: string) => p.length >= 10 },
  { label: 'Una mayúscula', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Una minúscula', test: (p: string) => /[a-z]/.test(p) },
  { label: 'Un número', test: (p: string) => /[0-9]/.test(p) },
  { label: 'Un símbolo (!@#$...)', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

export function ChangePasswordPage(): JSX.Element {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const allRulesMet = rules.every((r) => r.test(newPassword));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!allRulesMet) return;
    if (newPassword !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      await authApi.changeOwnPassword(currentPassword, newPassword);
      setAccessToken(null);
      navigate('/login', { replace: true });
    } catch (err) {
      const axiosErr = err as AxiosError<{ error: string }>;
      setError(axiosErr.response?.data?.error ?? 'Error al cambiar la contraseña.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-brand-400 mb-2">Nexum</h1>
          <p className="text-gray-500 text-sm">Debes cambiar tu contraseña antes de continuar</p>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-100 mb-6">Cambiar contraseña</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">Contraseña actual</label>
              <PasswordInput
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="input"
                placeholder="••••••••••••"
                disabled={isLoading}
                required
              />
            </div>

            <div>
              <label className="label">Nueva contraseña</label>
              <PasswordInput
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="input"
                disabled={isLoading}
                required
              />
              {newPassword.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {rules.map((r) => (
                    <li key={r.label} className={`flex items-center gap-2 text-xs ${r.test(newPassword) ? 'text-green-400' : 'text-red-400'}`}>
                      <span>{r.test(newPassword) ? '✓' : '✗'}</span>
                      {r.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <label className="label">Confirmar nueva contraseña</label>
              <PasswordInput
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="input"
                placeholder="••••••••••••"
                disabled={isLoading}
                required
              />
              {confirm.length > 0 && newPassword !== confirm && (
                <p className="text-xs text-red-400 mt-1">Las contraseñas no coinciden</p>
              )}
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-700 text-red-400 text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !currentPassword || !allRulesMet || newPassword !== confirm}
              className="btn-primary w-full py-2.5"
            >
              {isLoading ? 'Guardando...' : 'Cambiar contraseña'}
            </button>
          </form>

          <button
            onClick={handleLogout}
            className="mt-4 w-full text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
