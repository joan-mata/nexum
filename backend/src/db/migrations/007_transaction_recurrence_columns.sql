ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS recurrence_type VARCHAR(20) CHECK (recurrence_type IN ('none', 'weekly', 'monthly')),
  ADD COLUMN IF NOT EXISTS recurrence_end_date DATE;
