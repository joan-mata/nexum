import pool from '../db/pool';

export const LendersService = {
  findAll: async () => {
    const { rows } = await pool.query(
      `SELECT l.*,
         COALESCE(SUM(CASE WHEN t.type = 'loan_received' AND t.status = 'confirmed' THEN t.amount_in_eur ELSE 0 END), 0) AS total_loaned_eur,
         COALESCE(SUM(CASE WHEN t.type = 'lender_payment' AND t.status = 'confirmed' THEN t.amount_in_eur ELSE 0 END), 0) AS total_paid_eur
       FROM lenders l
       LEFT JOIN transactions t ON t.lender_id = l.id
       WHERE l.is_active = true
       GROUP BY l.id
       ORDER BY l.name ASC`
    );
    return rows;
  },

  create: async (
    name: string,
    email: string | null | undefined,
    phone: string | null | undefined,
    notes: string | null | undefined,
    createdBy: string
  ) => {
    const { rows } = await pool.query(
      `INSERT INTO lenders (name, email, phone, notes, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, email ?? null, phone ?? null, notes ?? null, createdBy]
    );
    return rows[0];
  },

  findById: async (id: string) => {
    const { rows } = await pool.query('SELECT * FROM lenders WHERE id = $1', [id]);
    return rows[0] ?? null;
  },

  getStats: async (lenderId: string) => {
    const { rows: lenderRows } = await pool.query('SELECT * FROM lenders WHERE id = $1', [lenderId]);

    if (lenderRows.length === 0) return null;

    const { rows: stats } = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN type = 'loan_received' AND status = 'confirmed' THEN amount_in_eur ELSE 0 END), 0) AS total_loaned_eur,
         COALESCE(SUM(CASE WHEN type = 'loan_received' AND status = 'confirmed' THEN amount_in_usd ELSE 0 END), 0) AS total_loaned_usd,
         COALESCE(SUM(CASE WHEN type = 'lender_payment' AND status = 'confirmed' THEN amount_in_eur ELSE 0 END), 0) AS total_paid_eur,
         COALESCE(SUM(CASE WHEN type = 'lender_payment' AND status = 'confirmed' THEN amount_in_usd ELSE 0 END), 0) AS total_paid_usd,
         COALESCE(SUM(CASE WHEN type = 'return_received' AND status = 'confirmed' THEN amount_in_eur ELSE 0 END), 0) AS total_returned_eur,
         COUNT(*) FILTER (WHERE status = 'confirmed') AS transaction_count
       FROM transactions
       WHERE lender_id = $1`,
      [lenderId]
    );

    const { rows: transactions } = await pool.query(
      `SELECT * FROM transactions WHERE lender_id = $1 ORDER BY date DESC, created_at DESC`,
      [lenderId]
    );

    return { lender: lenderRows[0], stats: stats[0], transactions };
  },

  update: async (
    id: string,
    name: string,
    email: string | null | undefined,
    phone: string | null | undefined,
    notes: string | null | undefined
  ) => {
    const { rows } = await pool.query(
      `UPDATE lenders SET name = $1, email = $2, phone = $3, notes = $4, updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [name, email ?? null, phone ?? null, notes ?? null, id]
    );
    return rows[0] ?? null;
  },

  deactivate: async (id: string) => {
    const { rows } = await pool.query(
      'UPDATE lenders SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id',
      [id]
    );
    return rows[0] ?? null;
  },
};
