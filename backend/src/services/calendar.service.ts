import pool from '../db/pool';

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function generateRecurringDates(
  startDate: string,
  type: 'weekly' | 'monthly',
  endDate: string
): string[] {
  const dates: string[] = [];
  const end = new Date(endDate + 'T12:00:00Z');
  const current = new Date(startDate + 'T12:00:00Z');
  const MAX_INSTANCES = 156;

  for (let i = 0; i < MAX_INSTANCES; i++) {
    if (type === 'weekly') {
      current.setUTCDate(current.getUTCDate() + 7);
    } else {
      current.setUTCMonth(current.getUTCMonth() + 1);
    }
    if (current > end) break;
    dates.push(toDateStr(current));
  }
  return dates;
}

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
    recurrence_type?: 'none' | 'weekly' | 'monthly';
    recurrence_end_date?: string | null;
  }, createdBy: string) => {
    const recurrenceType = data.recurrence_type ?? 'none';
    const recurrenceEndDate = data.recurrence_end_date ?? null;
    const isRecurring = recurrenceType !== 'none' && recurrenceEndDate;

    if (!isRecurring) {
      const { rows } = await pool.query(
        `INSERT INTO scheduled_events
           (expected_date, type, description, estimated_amount, currency, lender_id, notes, created_by, recurrence_type)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'none')
         RETURNING *`,
        [
          data.expected_date, data.type, data.description,
          data.estimated_amount ?? null, data.currency ?? null,
          data.lender_id ?? null, data.notes ?? null, createdBy,
        ]
      );
      return rows[0];
    }

    const instanceDates = generateRecurringDates(data.expected_date, recurrenceType, recurrenceEndDate);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        `INSERT INTO scheduled_events
           (expected_date, type, description, estimated_amount, currency, lender_id, notes, created_by, recurrence_type, recurrence_end_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING *`,
        [
          data.expected_date, data.type, data.description,
          data.estimated_amount ?? null, data.currency ?? null,
          data.lender_id ?? null, data.notes ?? null, createdBy,
          recurrenceType, recurrenceEndDate,
        ]
      );
      const master = rows[0];

      for (const date of instanceDates) {
        await client.query(
          `INSERT INTO scheduled_events
             (expected_date, type, description, estimated_amount, currency, lender_id, notes, created_by, recurrence_type, recurrence_master_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'none',$9)`,
          [
            date, data.type, data.description,
            data.estimated_amount ?? null, data.currency ?? null,
            data.lender_id ?? null, data.notes ?? null, createdBy, master.id,
          ]
        );
      }

      await client.query('COMMIT');
      return master;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
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
        data.expected_date, data.type, data.description,
        data.estimated_amount ?? null, data.currency ?? null,
        data.lender_id ?? null, data.notes ?? null, id,
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

  detachFromRecurrence: async (id: string) => {
    const { rows } = await pool.query(
      `UPDATE scheduled_events
       SET recurrence_master_id = NULL, recurrence_type = 'none'
       WHERE id = $1 AND recurrence_master_id IS NOT NULL
       RETURNING *`,
      [id]
    );
    return rows[0] ?? null;
  },

  cancelSeries: async (masterId: string) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        `SELECT id FROM scheduled_events WHERE id = $1 AND recurrence_type != 'none'`,
        [masterId]
      );
      if (rows.length === 0) return null;

      await client.query(
        `DELETE FROM scheduled_events WHERE recurrence_master_id = $1 AND is_completed = false`,
        [masterId]
      );
      await client.query(`DELETE FROM scheduled_events WHERE id = $1`, [masterId]);

      await client.query('COMMIT');
      return { cancelled: true };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },
};
