export const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  operator: 'Operador',
};

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  user_created: 'Usuario creado',
  user_invited: 'Usuario invitado',
  user_activated: 'Usuario activado',
  user_deactivated: 'Usuario desactivado',
  user_password_changed: 'Contraseña cambiada (admin)',
  user_own_password_changed: 'Contraseña cambiada',
  login_success: 'Inicio de sesión',
  login_failed: 'Intento de acceso fallido',
  login_locked: 'Cuenta bloqueada',
  logout: 'Cierre de sesión',
  logout_all: 'Cierre de todas las sesiones',
  token_refresh: 'Token renovado',
};

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}
