import pool from '../db/pool';

export const DashboardService = {
  getOverview: async () => {
    const { rows: kpi } = await pool.query(`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'loan_received' AND status = 'confirmed' THEN amount_in_eur ELSE 0 END), 0) AS total_capital_managed_eur,
        COALESCE(SUM(CASE WHEN type = 'loan_received' AND status = 'confirmed' THEN amount_in_usd ELSE 0 END), 0) AS total_capital_managed_usd,
        COALESCE(SUM(CASE WHEN type = 'return_received' AND status = 'confirmed' THEN amount_in_eur ELSE 0 END), 0) AS total_returns_eur,
        COALESCE(SUM(CASE WHEN type IN ('exchange_fee','transfer_fee','other_expense') AND status = 'confirmed' THEN amount_in_eur ELSE 0 END), 0) AS total_fees_eur,
        COALESCE(SUM(CASE WHEN type = 'lender_payment' AND status = 'confirmed' THEN amount_in_eur ELSE 0 END), 0) AS total_payments_eur,
        COALESCE(
          SUM(CASE WHEN type = 'return_received' AND status = 'confirmed' THEN amount_in_eur ELSE 0 END) -
          SUM(CASE WHEN type IN ('transfer_out','lender_payment','exchange_fee','transfer_fee','other_expense','cash_withdrawal') AND status = 'confirmed' THEN amount_in_eur ELSE 0 END) +
          SUM(CASE WHEN type IN ('loan_received','reinvestment') AND status = 'confirmed' THEN amount_in_eur ELSE 0 END)
        , 0) AS balance_eur
      FROM transactions
    `);

    const { rows: recent } = await pool.query(`
      SELECT t.*, l.name AS lender_name
      FROM transactions t
      LEFT JOIN lenders l ON l.id = t.lender_id
      ORDER BY t.date DESC, t.created_at DESC
      LIMIT 10
    `);

    const { rows: upcoming } = await pool.query(`
      SELECT se.*, l.name AS lender_name
      FROM scheduled_events se
      LEFT JOIN lenders l ON l.id = se.lender_id
      WHERE se.is_completed = false AND se.expected_date >= CURRENT_DATE
        AND se.expected_date <= CURRENT_DATE + INTERVAL '30 days'
      ORDER BY se.expected_date ASC
      LIMIT 10
    `);

    return { kpi: kpi[0], recent_transactions: recent, upcoming_events: upcoming };
  },

  getCashflow: async () => {
    const { rows } = await pool.query(`
      SELECT
        TO_CHAR(date_trunc('month', date), 'YYYY-MM') AS month,
        COALESCE(SUM(CASE WHEN type IN ('loan_received','return_received','reinvestment') AND status = 'confirmed' THEN amount_in_eur ELSE 0 END), 0) AS inflows_eur,
        COALESCE(SUM(CASE WHEN type IN ('transfer_out','lender_payment','exchange_fee','transfer_fee','other_expense','cash_withdrawal') AND status = 'confirmed' THEN amount_in_eur ELSE 0 END), 0) AS outflows_eur
      FROM transactions
      WHERE date >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY date_trunc('month', date)
      ORDER BY date_trunc('month', date) ASC
    `);
    return rows;
  },

  getCurrencyBreakdown: async () => {
    const { rows } = await pool.query(`
      SELECT
        currency,
        type,
        COALESCE(SUM(amount) FILTER (WHERE status = 'confirmed'), 0) AS total_amount,
        COUNT(*) FILTER (WHERE status = 'confirmed') AS count
      FROM transactions
      GROUP BY currency, type
      ORDER BY currency, type
    `);
    return rows;
  },
};
