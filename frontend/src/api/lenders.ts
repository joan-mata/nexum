import client from './client';

export interface Lender {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  account_number: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  total_loaned_eur: number;
  total_paid_eur: number;
}

export interface LenderStats {
  lender: Lender;
  stats: {
    total_loaned_eur: number;
    total_loaned_usd: number;
    total_paid_eur: number;
    total_paid_usd: number;
    total_returned_eur: number;
    transaction_count: number;
  };
  transactions: import('./transactions').Transaction[];
}

export interface LenderInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  account_number?: string | null;
  notes?: string | null;
}

export const lendersApi = {
  list: () => client.get<Lender[]>('/lenders'),
  get: (id: string) => client.get<Lender>(`/lenders/${id}`),
  getStats: (id: string) => client.get<LenderStats>(`/lenders/${id}/stats`),
  create: (data: LenderInput) => client.post<Lender>('/lenders', data),
  update: (id: string, data: LenderInput) => client.put<Lender>(`/lenders/${id}`, data),
  deactivate: (id: string) => client.delete(`/lenders/${id}`),
};
