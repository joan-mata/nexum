export interface User {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  role: 'admin' | 'operator';
  is_active: boolean;
  must_change_password: boolean;
  created_at: Date;
  updated_at: Date;
  last_login: Date | null;
  failed_login_attempts: number;
  locked_until: Date | null;
}

export interface RefreshToken {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  used_at: Date | null;
  revoked_at: Date | null;
  created_at: Date;
}

export interface Lender {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  created_by: string | null;
}

export interface ExitAccount {
  id: string;
  name: string;
  account_number: string | null;
  bank_name: string | null;
  currency: 'EUR' | 'USD';
  notes: string | null;
  is_active: boolean;
  created_at: Date;
}

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
  exit_account_id: string | null;
  description: string;
  reference_transaction_id: string | null;
  status: TransactionStatus;
  notes: string | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ScheduledEvent {
  id: string;
  expected_date: string;
  type: string;
  description: string;
  estimated_amount: number | null;
  currency: 'EUR' | 'USD' | null;
  lender_id: string | null;
  is_completed: boolean;
  completed_transaction_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: Date;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
}

export interface JwtPayload {
  userId: string;
  username: string;
  role: 'admin' | 'operator';
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest extends Express.Request {
  user?: JwtPayload;
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
