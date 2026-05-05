import client from './client';

export interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'operator';
  is_active: boolean;
  must_change_password: boolean;
  created_at: string;
  updated_at: string;
  last_login: string | null;
  failed_login_attempts: number;
  locked_until: string | null;
}

export interface InviteResponse {
  invite_token: string;
  expires_at: string;
  user: { id: string; username: string; email: string; role: string };
}

export interface AuditEntry {
  id: string;
  user_id: string | null;
  username: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export const usersApi = {
  list: () => client.get<User[]>('/users'),
  invite: (data: { username: string; email: string; role: 'admin' | 'operator' }) =>
    client.post<InviteResponse>('/users/invite', data),
  acceptInvite: (data: { invite_token: string; password: string }) =>
    client.post('/users/accept-invite', data),
  changePassword: (id: string, data: { admin_password: string; new_password: string }) =>
    client.put(`/users/${id}/password`, data),
  toggleActive: (id: string) => client.put(`/users/${id}/deactivate`),
  auditLog: () => client.get<AuditEntry[]>('/users/audit-log'),
};
