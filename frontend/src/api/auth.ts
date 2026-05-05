import client from './client';

export interface LoginResponse {
  access_token: string;
  user: {
    id: string;
    username: string;
    email: string;
    role: 'admin' | 'operator';
    must_change_password: boolean;
  };
}

export const authApi = {
  login: (username: string, password: string) =>
    client.post<LoginResponse>('/auth/login', { username, password }),

  refresh: () =>
    client.post<{ access_token: string }>('/auth/refresh'),

  logout: () =>
    client.post('/auth/logout'),

  logoutAll: () =>
    client.post('/auth/logout-all'),
};
