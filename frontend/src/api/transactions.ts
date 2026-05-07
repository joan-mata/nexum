import client from './client';

export type TransactionType =
  | 'loan_received'
  | 'transfer_out'
  | 'return_received'
  | 'lender_payment'
  | 'exchange_fee'
  | 'transfer_fee'
  | 'other_expense'
  | 'cash_withdrawal'
  | 'reinvestment';

export type TransactionStatus = 'pending' | 'confirmed' | 'cancelled';

export interface Transaction {
  id: string;
  date: string;
  type: TransactionType;
  amount: number;
  currency: 'EUR' | 'USD';
  exchange_rate: number | null;
  amount_in_usd: number | null;
  amount_in_eur: number | null;
  lender_id: string | null;
  lender_name: string | null;
  exit_account_name: string | null;
  description: string;
  reference_transaction_id: string | null;
  status: TransactionStatus;
  notes: string | null;
  recurrence_master_id: string | null;
  recurrence_end_date: string | null;
  series_recurrence_end_date: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TransactionInput {
  date: string;
  type: TransactionType;
  amount: number;
  currency: 'EUR' | 'USD';
  exchange_rate?: number | null;
  lender_id?: string | null;
  exit_account_name?: string | null;
  description: string;
  reference_transaction_id?: string | null;
  status?: TransactionStatus;
  notes?: string | null;
  commission_eur?: number | null;
  commission_usd?: number | null;
}

export interface TransactionListResponse {
  data: Transaction[];
  total: number;
  page: number;
  limit: number;
}

export interface TransactionFilters {
  date_from?: string;
  date_to?: string;
  type?: TransactionType;
  lender_id?: string;
  currency?: 'EUR' | 'USD';
  status?: TransactionStatus;
  page?: number;
  limit?: number;
}

export interface TransactionSummary {
  total_loaned_eur: number;
  total_loaned_usd: number;
  total_returned_eur: number;
  total_returned_usd: number;
  total_payments_eur: number;
  total_fees_eur: number;
  confirmed_count: number;
  pending_count: number;
}

export const transactionsApi = {
  list: (filters: TransactionFilters = {}) =>
    client.get<TransactionListResponse>('/transactions', { params: filters }),
  summary: () => client.get<TransactionSummary>('/transactions/summary'),
  get: (id: string) => client.get<Transaction>(`/transactions/${id}`),
  create: (data: TransactionInput) => client.post<Transaction>('/transactions', data),
  update: (id: string, data: TransactionInput) =>
    client.put<Transaction>(`/transactions/${id}`, data),
  cancel: (id: string) => client.delete(`/transactions/${id}`),
  updateAllRecurring: (id: string, data: TransactionInput) =>
    client.put(`/transactions/${id}/recurring`, data),
  updateRecurrenceEnd: (id: string, end_date: string) =>
    client.put(`/transactions/${id}/recurrence-end`, { end_date }),
};

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  loan_received: 'Préstamo recibido',
  transfer_out: 'Transferencia salida',
  return_received: 'Retorno recibido',
  lender_payment: 'Pago a prestamista',
  exchange_fee: 'Comisión de cambio',
  transfer_fee: 'Comisión de transferencia',
  other_expense: 'Otro gasto',
  cash_withdrawal: 'Retirada de efectivo',
  reinvestment: 'Reinversión',
};

// Types that are inflows (positive)
export const INFLOW_TYPES: TransactionType[] = [
  'loan_received',
  'return_received',
  'reinvestment',
];
