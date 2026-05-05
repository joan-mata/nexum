import pool from '../db/pool';

export const CalendarService = {
  findEvents: async (from?: string, to?: string) => {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (from) { conditions.push(`expected_date >= $${idx++}`); params.push(from); }
    if (to)   { conditions.push(`expected_date <= $${idx++}`); params.push(to); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await pool.query(
      `SELECT se.*, l.name AS lender_name
       FROM scheduled_events se
       LEFT JOIN lenders l ON l.id = se.lender_id
       ${where}
       ORDER BY expected_date ASC`,
      params
    );
    return rows;
  },

  createEvent: async (data: {
    expected_date: string;
    type: string;
    description: string;
    estimated_amount?: number | null;
    currency?: 'EUR' | 'USD' | null;
    lender_id?: string | null;
    notes?: string | null;
  }, createdBy: string) => {
    const { rows } = await pool.query(
      `INSERT INTO scheduled_events
         (expected_date, type, description, estimated_amount, currency, lender_id, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        data.expected_date,
        data.type,
        data.description,
        data.estimated_amount ?? null,
        data.currency ?? null,
        data.lender_id ?? null,
        data.notes ?? null,
        createdBy,
      ]
    );
    return rows[0];
  },

  updateEvent: async (id: string, data: {
    expected_date: string;
    type: string;
    description: string;
    estimated_amount?: number | null;
    currency?: 'EUR' | 'USD' | null;
    lender_id?: string | null;
    notes?: string | null;
  }) => {
    const { rows } = await pool.query(
      `UPDATE scheduled_events SET
         expected_date=$1, type=$2, description=$3, estimated_amount=$4,
         currency=$5, lender_id=$6, notes=$7
       WHERE id=$8 RETURNING *`,
      [
        data.expected_date,
        data.type,
        data.description,
        data.estimated_amount ?? null,
        data.currency ?? null,
        data.lender_id ?? null,
        data.notes ?? null,
        id,
      ]
    );
    return rows[0] ?? null;
  },

  completeEvent: async (id: string, completedTransactionId: string | null | undefined) => {
    const { rows } = await pool.query(
      `UPDATE scheduled_events SET
         is_completed = true,
         completed_transaction_id = $1
       WHERE id = $2 RETURNING *`,
      [completedTransactionId ?? null, id]
    );
    return rows[0] ?? null;
  },
};
