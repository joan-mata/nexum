ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS recurrence_master_id UUID REFERENCES transactions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_recurrence_master_id
  ON transactions(recurrence_master_id);
