import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { formatDate } from '../utils/date';
import { settingsApi, SidebarItem } from '../api/settings';

const DEFAULT_NAV: { to: string; label: string; icon: string }[] = [
  { to: '/dashboard',    label: 'Dashboard',      icon: '◈' },
  { to: '/transactions', label: 'Transacciones',  icon: '↕' },
  { to: '/lenders',      label: 'Prestamistas',   icon: '👤' },
  { to: '/calendar',     label: 'Calendario',     icon: '▦' },
  { to: '/this-month',   label: 'Mensual',        icon: '◷' },
  { to: '/statistics',   label: 'Estadísticas',   icon: '▣' },
];

const ADMIN_NAV = [{ to: '/users', label: 'Usuarios', icon: '◎' }];

function applyConfig(
  config: SidebarItem[]
): { to: string; label: string; icon: string }[] {
  if (!config.length) return DEFAULT_NAV;

  const iconMap = Object.fromEntries(DEFAULT_NAV.map((n) => [n.to, n.icon]));
  const defaultSet = new Set(DEFAULT_NAV.map((n) => n.to));

  const ordered = config
    .filter((c) => defaultSet.has(c.to))
    .map((c) => ({ to: c.to, label: c.label, icon: iconMap[c.to] ?? '' }));

  // Append any new routes not yet in saved config
  for (const d of DEFAULT_NAV) {
    if (!ordered.find((o) => o.to === d.to)) ordered.push(d);
  }
  return ordered;
}

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps): JSX.Element {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<{ to: string; label: string; icon: string }[]>([]);

  const { data: savedConfig = [] } = useQuery({
    queryKey: ['sidebar-config'],
    queryFn: () => settingsApi.getSidebar().then((r) => r.data),
  });

  const saveMutation = useMutation({
    mutationFn: (config: SidebarItem[]) => settingsApi.updateSidebar(config),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sidebar-config'] });
      setEditing(false);
    },
  });

  const navItems = applyConfig(savedConfig);

  const openEdit = () => {
    setDraft(navItems.map((n) => ({ ...n })));
    setEditing(true);
  };

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...draft];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap]!, next[idx]!];
    setDraft(next);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? 'bg-brand-600 text-white'
        : 'text-gray-400 hover:bg-gray-700 hover:text-gray-100'
    }`;

  return (
    <div className="flex h-screen bg-gray-900 overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-gray-950 border-r border-gray-800 flex flex-col transform transition-transform lg:relative lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="px-6 py-5 border-b border-gray-800">
          <h1 className="text-xl font-bold text-brand-400 tracking-tight">Nexum</h1>
          <p className="text-xs text-gray-500 mt-0.5">Control financiero</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={navLinkClass}
              onClick={() => setSidebarOpen(false)}
            >
              <span className="text-lg leading-none">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}

          {user?.role === 'admin' && (
            <>
              <div className="pt-4 pb-2 px-4">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Administración
                </p>
              </div>
              {ADMIN_NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={navLinkClass}
                  onClick={() => setSidebarOpen(false)}
                >
                  <span className="text-lg leading-none">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
              <button
                onClick={openEdit}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-800 hover:text-gray-300 transition-colors mt-1"
              >
                <span className="text-lg leading-none">⚙</span>
                Personalizar menú
              </button>
            </>
          )}
        </nav>

        {/* User info */}
        <div className="px-4 py-4 border-t border-gray-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-sm font-bold">
              {user?.username?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-100 truncate">{user?.username}</p>
              <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-gray-800 rounded-lg transition-colors"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between shrink-0">
          <button
            className="lg:hidden text-gray-400 hover:text-gray-100"
            onClick={() => setSidebarOpen(true)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-4 ml-auto">
            <span className="text-sm text-gray-500">
              {formatDate(new Date(), {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>

      {/* Edit sidebar modal (admin only) */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-sm">
            <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-100">Personalizar menú</h2>
              <button
                onClick={() => setEditing(false)}
                className="text-gray-400 hover:text-gray-100 text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
              {draft.map((item, idx) => (
                <div key={item.to} className="flex items-center gap-2 bg-gray-700/40 rounded-lg px-3 py-2">
                  <span className="text-gray-500 text-base leading-none w-5 text-center shrink-0">
                    {item.icon}
                  </span>
                  <input
                    type="text"
                    className="flex-1 bg-transparent text-sm text-gray-100 outline-none border-b border-transparent focus:border-gray-500 py-0.5"
                    value={item.label}
                    maxLength={30}
                    onChange={(e) => {
                      const next = [...draft];
                      next[idx] = { ...next[idx]!, label: e.target.value };
                      setDraft(next);
                    }}
                  />
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button
                      onClick={() => move(idx, -1)}
                      disabled={idx === 0}
                      className="text-gray-500 hover:text-gray-200 disabled:opacity-20 leading-none text-xs px-1"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => move(idx, 1)}
                      disabled={idx === draft.length - 1}
                      className="text-gray-500 hover:text-gray-200 disabled:opacity-20 leading-none text-xs px-1"
                    >
                      ▼
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-6 py-4 border-t border-gray-700 flex gap-3">
              <button
                onClick={() => saveMutation.mutate(draft.map(({ to, label }) => ({ to, label })))}
                disabled={saveMutation.isPending}
                className="btn-primary flex-1"
              >
                {saveMutation.isPending ? 'Guardando...' : 'Guardar'}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="btn-secondary flex-1"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
