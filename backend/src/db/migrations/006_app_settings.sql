CREATE TABLE IF NOT EXISTS app_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO app_settings (key, value)
VALUES ('sidebar', '[]'::jsonb)
ON CONFLICT (key) DO NOTHING;
