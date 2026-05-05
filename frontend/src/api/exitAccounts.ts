import client from './client';

export interface ExitAccount {
  id: string;
  name: string;
  account_number: string | null;
  bank_name: string | null;
  currency: 'EUR' | 'USD';
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ExitAccountInput {
  name: string;
  account_number?: string | null;
  bank_name?: string | null;
  currency: 'EUR' | 'USD';
  notes?: string | null;
}

export const exitAccountsApi = {
  list: () => client.get<ExitAccount[]>('/exit-accounts'),
  create: (data: ExitAccountInput) => client.post<ExitAccount>('/exit-accounts', data),
  update: (id: string, data: ExitAccountInput) =>
    client.put<ExitAccount>(`/exit-accounts/${id}`, data),
  deactivate: (id: string) => client.delete(`/exit-accounts/${id}`),
};
