import pool from '../db/pool';
import { generateRecurringDates } from '../utils/recurrence';
import { TransactionType, TransactionStatus } from '../types';

function calcAmounts(
  amount: number,
  currency: 'EUR' | 'USD',
  exchangeRate: number | null | undefined
): { amount_in_eur: number | null; amount_in_usd: number | null } {
  if (currency === 'EUR') {
    const amountInUsd = exchangeRate ? amount * exchangeRate : null;
    return { amount_in_eur: amount, amount_in_usd: amountInUsd };
  } else {
    const amountInEur = exchangeRate ? amount / exchangeRate : null;
    return { amount_in_eur: amountInEur, amount_in_usd: amount };
  }
}

export interface TransactionFilters {
  date_from?: string;
  date_to?: string;
  type?: string;
  lender_id?: string;
  currency?: string;
  status?: string;
  page?: string;
  limit?: string;
}

export const TransactionsService = {
  findAll: async (filters: TransactionFilters) => {
    const { date_from, date_to, type, lender_id, currency, status, page = '1', limit = '50' } = filters;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (date_from) { conditions.push(`t.date >= $${paramIdx++}`); params.push(date_from); }
    if (date_to)   { conditions.push(`t.date <= $${paramIdx++}`); params.push(date_to); }
    if (type)      { conditions.push(`t.type = $${paramIdx++}`); params.push(type); }
    if (lender_id) { conditions.push(`t.lender_id = $${paramIdx++}`); params.push(lender_id); }
    if (currency)  { conditions.push(`t.currency = $${paramIdx++}`); params.push(currency); }
    if (status)    { conditions.push(`t.status = $${paramIdx++}`); params.push(status); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
    const offset = (pageNum - 1) * limitNum;

    params.push(limitNum, offset);

    const { rows } = await pool.query(
      `SELECT t.*, l.name AS lender_name,
         CASE WHEN t.recurrence_master_id IS NOT NULL THEN tm.recurrence_end_date ELSE t.recurrence_end_date END AS series_recurrence_end_date
       FROM transactions t
       LEFT JOIN lenders l ON l.id = t.lender_id
       LEFT JOIN transactions tm ON tm.id = t.recurrence_master_id
       ${where}
       ORDER BY t.date DESC, t.created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx}`,
      params
    );

    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) FROM transactions t ${where}`,
      params.slice(0, -2)
    );

    return {
      data: rows,
      total: parseInt(countRows[0].count),
      page: pageNum,
      limit: limitNum,
    };
  },

  getSummary: async () => {
    const { rows } = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN type = 'loan_received' AND status = 'confirmed' THEN amount_in_eur ELSE 0 END), 0) AS total_loaned_eur,
         COALESCE(SUM(CASE WHEN type = 'loan_received' AND status = 'confirmed' THEN amount_in_usd ELSE 0 END), 0) AS total_loaned_usd,
         COALESCE(SUM(CASE WHEN type = 'return_received' AND status = 'confirmed' THEN amount_in_eur ELSE 0 END), 0) AS total_returned_eur,
         COALESCE(SUM(CASE WHEN type = 'return_received' AND status = 'confirmed' THEN amount_in_usd ELSE 0 END), 0) AS total_returned_usd,
         COALESCE(SUM(CASE WHEN type IN ('lender_payment') AND status = 'confirmed' THEN amount_in_eur ELSE 0 END), 0) AS total_payments_eur,
         COALESCE(SUM(CASE WHEN type IN ('exchange_fee', 'transfer_fee', 'other_expense') AND status = 'confirmed' THEN amount_in_eur ELSE 0 END), 0) AS total_fees_eur,
         COUNT(*) FILTER (WHERE status = 'confirmed') AS confirmed_count,
         COUNT(*) FILTER (WHERE status = 'pending') AS pending_count
       FROM transactions`
    );
    return rows[0];
  },

  create: async (data: {
    date: string;
    type: TransactionType;
    amount: number;
    currency: 'EUR' | 'USD';
    exchange_rate?: number | null;
    lender_id?: string | null;
    exit_account_name?: string | null;
    description?: string | null;
    reference_transaction_id?: string | null;
    status: TransactionStatus;
    notes?: string | null;
    recurrence_type?: 'none' | 'weekly' | 'monthly';
    recurrence_end_date?: string | null;
  }, createdBy: string) => {
    const { amount_in_eur, amount_in_usd } = calcAmounts(data.amount, data.currency, data.exchange_rate);
    const recurrenceType = data.recurrence_type ?? 'none';
    const recurrenceEndDate = data.recurrence_end_date ?? null;
    const isRecurring = recurrenceType !== 'none' && recurrenceEndDate;

    const SQL = `INSERT INTO transactions
       (date, type, amount, currency, exchange_rate, amount_in_usd, amount_in_eur,
        lender_id, exit_account_name, description, reference_transaction_id, status, notes, created_by, recurrence_master_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     RETURNING *`;

    const params = (date: string, masterId: string | null) => [
      date, data.type, data.amount, data.currency, data.exchange_rate ?? null,
      amount_in_usd, amount_in_eur, data.lender_id ?? null, data.exit_account_name ?? null,
      data.description ?? null, data.reference_transaction_id ?? null, data.status,
      data.notes ?? null, createdBy, masterId,
    ];

    if (!isRecurring) {
      const { rows } = await pool.query(SQL, params(data.date, null));
      return rows[0];
    }

    const instanceDates = generateRecurringDates(data.date, recurrenceType, recurrenceEndDate);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(SQL, params(data.date, null));
      const master = rows[0];
      for (const date of instanceDates) {
        await client.query(SQL, params(date, master.id));
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

  findById: async (id: string) => {
    const { rows } = await pool.query(
      `SELECT t.*, l.name AS lender_name,
         CASE WHEN t.recurrence_master_id IS NOT NULL THEN tm.recurrence_end_date ELSE t.recurrence_end_date END AS series_recurrence_end_date
       FROM transactions t
       LEFT JOIN lenders l ON l.id = t.lender_id
       LEFT JOIN transactions tm ON tm.id = t.recurrence_master_id
       WHERE t.id = $1`,
      [id]
    );
    return rows[0] ?? null;
  },

  update: async (id: string, data: {
    date: string;
    type: TransactionType;
    amount: number;
    currency: 'EUR' | 'USD';
    exchange_rate?: number | null;
    lender_id?: string | null;
    exit_account_name?: string | null;
    description?: string | null;
    reference_transaction_id?: string | null;
    status: TransactionStatus;
    notes?: string | null;
  }) => {
    const { amount_in_eur, amount_in_usd } = calcAmounts(data.amount, data.currency, data.exchange_rate);

    const { rows } = await pool.query(
      `UPDATE transactions SET
         date=$1, type=$2, amount=$3, currency=$4, exchange_rate=$5,
         amount_in_usd=$6, amount_in_eur=$7, lender_id=$8, exit_account_name=$9,
         description=$10, reference_transaction_id=$11, status=$12, notes=$13, updated_at=NOW()
       WHERE id=$14 RETURNING *`,
      [
        data.date,
        data.type,
        data.amount,
        data.currency,
        data.exchange_rate ?? null,
        amount_in_usd,
        amount_in_eur,
        data.lender_id ?? null,
        data.exit_account_name ?? null,
        data.description,
        data.reference_transaction_id ?? null,
        data.status,
        data.notes ?? null,
        id,
      ]
    );
    return rows[0] ?? null;
  },

  updateAllRecurring: async (id: string, data: {
    type: TransactionType;
    amount: number;
    currency: 'EUR' | 'USD';
    exchange_rate?: number | null;
    lender_id?: string | null;
    exit_account_name?: string | null;
    description?: string | null;
    status: TransactionStatus;
    notes?: string | null;
  }) => {
    const { amount_in_eur, amount_in_usd } = calcAmounts(data.amount, data.currency, data.exchange_rate);

    // Resolve master id: if this tx IS the master, use its id; otherwise use its recurrence_master_id
    const { rows: txRows } = await pool.query(
      'SELECT recurrence_master_id FROM transactions WHERE id = $1',
      [id]
    );
    if (!txRows[0]) return null;
    const masterId: string = txRows[0].recurrence_master_id ?? id;

    // Update master + all instances (keep individual date and reference_transaction_id)
    const { rows } = await pool.query(
      `UPDATE transactions SET
         type=$1, amount=$2, currency=$3, exchange_rate=$4,
         amount_in_usd=$5, amount_in_eur=$6, lender_id=$7, exit_account_name=$8,
         description=$9, status=$10, notes=$11, updated_at=NOW()
       WHERE id = $12 OR recurrence_master_id = $12
       RETURNING id`,
      [
        data.type, data.amount, data.currency, data.exchange_rate ?? null,
        amount_in_usd, amount_in_eur, data.lender_id ?? null,
        data.exit_account_name ?? null, data.description,
        data.status, data.notes ?? null, masterId,
      ]
    );
    return rows;
  },

  updateRecurrenceEnd: async (id: string, newEndDate: string) => {
    const { rows: txRows } = await pool.query(
      'SELECT recurrence_master_id, date FROM transactions WHERE id = $1',
      [id]
    );
    if (!txRows[0]) return null;
    const masterId: string = txRows[0].recurrence_master_id ?? id;

    const { rows: masterRows } = await pool.query(
      'SELECT recurrence_type, recurrence_end_date, date FROM transactions WHERE id = $1',
      [masterId]
    );
    if (!masterRows[0]) return null;
    const { recurrence_type, recurrence_end_date: currentEnd, date: masterDate } = masterRows[0];

    if (newEndDate <= masterDate) {
      throw new Error('La fecha de fin debe ser posterior al inicio de la serie');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      if (newEndDate < currentEnd) {
        // Verificar que no haya instancias confirmadas después de la nueva fecha de corte
        const { rows: blocked } = await client.query(
          `SELECT COUNT(*) FROM transactions
           WHERE (id = $1 OR recurrence_master_id = $1)
             AND date > $2 AND status = 'confirmed'`,
          [masterId, newEndDate]
        );
        if (parseInt(blocked[0].count) > 0) {
          throw new Error(
            'No se puede cortar la serie: hay transacciones ya confirmadas en las fechas que se eliminarían'
          );
        }
        // Cortar: cancelar instancias posteriores a la nueva fecha
        await client.query(
          `UPDATE transactions SET status = 'cancelled', updated_at = NOW()
           WHERE (id = $1 OR recurrence_master_id = $1) AND date > $2`,
          [masterId, newEndDate]
        );
      } else if (newEndDate > currentEnd) {
        // Ampliar: generar nuevas instancias entre la fecha actual de fin y la nueva
        const newDates = generateRecurringDates(currentEnd, recurrence_type, newEndDate);
        for (const date of newDates) {
          await client.query(
            `INSERT INTO transactions
               (date, type, amount, currency, exchange_rate, amount_in_usd, amount_in_eur,
                lender_id, exit_account_name, description, status, notes, created_by, recurrence_master_id)
             SELECT $1, type, amount, currency, exchange_rate, amount_in_usd, amount_in_eur,
                lender_id, exit_account_name, description, status, notes, created_by, id
             FROM transactions WHERE id = $2`,
            [date, masterId]
          );
        }
      }

      await client.query(
        'UPDATE transactions SET recurrence_end_date = $1, updated_at = NOW() WHERE id = $2',
        [newEndDate, masterId]
      );

      await client.query('COMMIT');
      return { masterId, newEndDate };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },

  cancel: async (id: string) => {
    const { rows } = await pool.query(
      "UPDATE transactions SET status = 'cancelled', updated_at = NOW() WHERE id = $1 RETURNING id",
      [id]
    );
    return rows[0] ?? null;
  },
};
