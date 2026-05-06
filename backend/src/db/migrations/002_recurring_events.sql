ALTER TABLE scheduled_events
  ADD COLUMN IF NOT EXISTS recurrence_type VARCHAR(10) NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS recurrence_end_date DATE,
  ADD COLUMN IF NOT EXISTS recurrence_master_id UUID REFERENCES scheduled_events(id) ON DELETE SET NULL;

ALTER TABLE scheduled_events
  DROP CONSTRAINT IF EXISTS scheduled_events_recurrence_type_check;

ALTER TABLE scheduled_events
  ADD CONSTRAINT scheduled_events_recurrence_type_check
  CHECK (recurrence_type IN ('none', 'weekly', 'monthly'));

CREATE INDEX IF NOT EXISTS idx_scheduled_events_master_id
  ON scheduled_events(recurrence_master_id);
