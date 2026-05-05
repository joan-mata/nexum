import client from './client';
import type { Transaction } from './transactions';

export interface DashboardKPI {
  total_capital_managed_eur: number;
  total_capital_managed_usd: number;
  total_returns_eur: number;
  total_fees_eur: number;
  total_payments_eur: number;
  balance_eur: number;
}

export interface OverviewResponse {
  kpi: DashboardKPI;
  recent_transactions: Transaction[];
  upcoming_events: ScheduledEvent[];
}

export interface ScheduledEvent {
  id: string;
  expected_date: string;
  type: string;
  description: string;
  estimated_amount: number | null;
  currency: 'EUR' | 'USD' | null;
  lender_id: string | null;
  lender_name: string | null;
  is_completed: boolean;
  completed_transaction_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface CashflowMonth {
  month: string;
  inflows_eur: number;
  outflows_eur: number;
}

export interface CurrencyBreakdownItem {
  currency: 'EUR' | 'USD';
  type: string;
  total_amount: number;
  count: number;
}

export const dashboardApi = {
  overview: () => client.get<OverviewResponse>('/dashboard/overview'),
  cashflow: () => client.get<CashflowMonth[]>('/dashboard/cashflow'),
  currencyBreakdown: () => client.get<CurrencyBreakdownItem[]>('/dashboard/currency-breakdown'),
};
