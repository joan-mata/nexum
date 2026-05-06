import pool from '../db/pool';

export const SettingsService = {
  getSidebar: async (): Promise<{ to: string; label: string }[]> => {
    const { rows } = await pool.query(
      `SELECT value FROM app_settings WHERE key = 'sidebar'`
    );
    return (rows[0]?.value as { to: string; label: string }[]) ?? [];
  },

  updateSidebar: async (config: { to: string; label: string }[]): Promise<void> => {
    await pool.query(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES ('sidebar', $1::jsonb, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1::jsonb, updated_at = NOW()`,
      [JSON.stringify(config)]
    );
  },
};
