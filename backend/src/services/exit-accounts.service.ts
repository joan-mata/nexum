import pool from '../db/pool';

export const ExitAccountsService = {
  findAll: async () => {
    const { rows } = await pool.query(
      'SELECT * FROM exit_accounts WHERE is_active = true ORDER BY name ASC'
    );
    return rows;
  },

  create: async (data: {
    name: string;
    account_number?: string | null;
    bank_name?: string | null;
    currency: 'EUR' | 'USD';
    notes?: string | null;
  }) => {
    const { rows } = await pool.query(
      `INSERT INTO exit_accounts (name, account_number, bank_name, currency, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [data.name, data.account_number ?? null, data.bank_name ?? null, data.currency, data.notes ?? null]
    );
    return rows[0];
  },

  update: async (id: string, data: {
    name: string;
    account_number?: string | null;
    bank_name?: string | null;
    currency: 'EUR' | 'USD';
    notes?: string | null;
  }) => {
    const { rows } = await pool.query(
      `UPDATE exit_accounts SET name=$1, account_number=$2, bank_name=$3, currency=$4, notes=$5
       WHERE id=$6 AND is_active=true RETURNING *`,
      [data.name, data.account_number ?? null, data.bank_name ?? null, data.currency, data.notes ?? null, id]
    );
    return rows[0] ?? null;
  },

  deactivate: async (id: string) => {
    const { rows } = await pool.query(
      'UPDATE exit_accounts SET is_active = false WHERE id = $1 RETURNING id',
      [id]
    );
    return rows[0] ?? null;
  },
};
