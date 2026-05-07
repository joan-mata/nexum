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
    commission_exchange_amount?: number | null;
    commission_exchange_currency?: 'EUR' | 'USD';
    commission_transfer_amount?: number | null;
    commission_transfer_currency?: 'EUR' | 'USD';
  }, createdBy: string) => {
    const { amount_in_eur, amount_in_usd } = calcAmounts(data.amount, data.currency, data.exchange_rate);
    const recurrenceType = data.recurrence_type ?? 'none';
    const recurrenceEndDate = data.recurrence_end_date ?? null;
    const isRecurring = recurrenceType !== 'none' && recurrenceEndDate;

    const SQL = `INSERT INTO transactions
       (date, type, amount, currency, exchange_rate, amount_in_usd, amount_in_eur,
        lender_id, exit_account_name, description, reference_transaction_id, status, notes, created_by, recurrence_master_id,
        recurrence_type, recurrence_end_date)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
     RETURNING *`;

    const params = (date: string, masterId: string | null, recType: string | null = null, recEnd: string | null = null) => [
      date, data.type, data.amount, data.currency, data.exchange_rate ?? null,
      amount_in_usd, amount_in_eur, data.lender_id ?? null, data.exit_account_name ?? null,
      data.description ?? null, data.reference_transaction_id ?? null, data.status,
      data.notes ?? null, createdBy, masterId, recType, recEnd,
    ];

    if (!isRecurring) {
      const hasCommissions = (data.commission_exchange_amount != null) || (data.commission_transfer_amount != null);
      if (!hasCommissions) {
        const { rows } = await pool.query(SQL, params(data.date, null));
        return rows[0];
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const { rows } = await client.query(SQL, params(data.date, null));
        const main = rows[0];

        const commissionSQL = `INSERT INTO transactions
           (date, type, amount, currency, exchange_rate, amount_in_usd, amount_in_eur,
            lender_id, exit_account_name, description, reference_transaction_id, status, notes, created_by, recurrence_master_id,
            recurrence_type, recurrence_end_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         RETURNING *`;

        if (data.commission_exchange_amount != null) {
          const exchCurrency = data.commission_exchange_currency ?? 'EUR';
          const { amount_in_eur: cEur, amount_in_usd: cUsd } = calcAmounts(data.commission_exchange_amount, exchCurrency, data.exchange_rate);
          await client.query(commissionSQL, [
            data.date, 'exchange_fee', data.commission_exchange_amount, exchCurrency, data.exchange_rate ?? null,
            cUsd, cEur, data.lender_id ?? null, null,
            'Comisión de cambio', main.id, data.status,
            null, createdBy, null, 'none', null,
          ]);
        }

        if (data.commission_transfer_amount != null) {
          const transCurrency = data.commission_transfer_currency ?? 'USD';
          const { amount_in_eur: cEur, amount_in_usd: cUsd } = calcAmounts(data.commission_transfer_amount, transCurrency, data.exchange_rate);
          await client.query(commissionSQL, [
            data.date, 'transfer_fee', data.commission_transfer_amount, transCurrency, data.exchange_rate ?? null,
            cUsd, cEur, data.lender_id ?? null, null,
            'Comisión de transferencia', main.id, data.status,
            null, createdBy, null, 'none', null,
          ]);
        }

        await client.query('COMMIT');
        return main;
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    }

    const instanceDates = generateRecurringDates(data.date, recurrenceType, recurrenceEndDate);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(SQL, params(data.date, null, recurrenceType, recurrenceEndDate));
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
    commission_exchange_amount?: number | null;
    commission_exchange_currency?: 'EUR' | 'USD';
    commission_transfer_amount?: number | null;
    commission_transfer_currency?: 'EUR' | 'USD';
  }) => {
    const { amount_in_eur, amount_in_usd } = calcAmounts(data.amount, data.currency, data.exchange_rate);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
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

      if (!rows[0]) {
        await client.query('ROLLBACK');
        return null;
      }

      const commissionSQL = `INSERT INTO transactions
         (date, type, amount, currency, exchange_rate, amount_in_usd, amount_in_eur,
          lender_id, exit_account_name, description, reference_transaction_id, status, notes, created_by, recurrence_master_id,
          recurrence_type, recurrence_end_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`;

      // Handle exchange_fee commission
      const { rows: exchRows } = await client.query(
        `SELECT id FROM transactions WHERE reference_transaction_id = $1 AND type = 'exchange_fee' AND status != 'cancelled'`,
        [id]
      );
      if (data.commission_exchange_amount != null) {
        const exchCurrency = data.commission_exchange_currency ?? 'EUR';
        const { amount_in_eur: cEur, amount_in_usd: cUsd } = calcAmounts(data.commission_exchange_amount, exchCurrency, data.exchange_rate);
        if (exchRows.length > 0) {
          await client.query(
            `UPDATE transactions SET amount=$1, currency=$2, amount_in_eur=$3, amount_in_usd=$4, updated_at=NOW()
             WHERE id=$5`,
            [data.commission_exchange_amount, exchCurrency, cEur, cUsd, exchRows[0].id]
          );
        } else {
          await client.query(commissionSQL, [
            data.date, 'exchange_fee', data.commission_exchange_amount, exchCurrency, data.exchange_rate ?? null,
            cUsd, cEur, data.lender_id ?? null, null,
            'Comisión de cambio', id, data.status,
            null, rows[0].created_by, null, 'none', null,
          ]);
        }
      } else if (exchRows.length > 0) {
        await client.query(`DELETE FROM transactions WHERE id=$1`, [exchRows[0].id]);
      }

      // Handle transfer_fee commission
      const { rows: transRows } = await client.query(
        `SELECT id FROM transactions WHERE reference_transaction_id = $1 AND type = 'transfer_fee' AND status != 'cancelled'`,
        [id]
      );
      if (data.commission_transfer_amount != null) {
        const transCurrency = data.commission_transfer_currency ?? 'USD';
        const { amount_in_eur: cEur, amount_in_usd: cUsd } = calcAmounts(data.commission_transfer_amount, transCurrency, data.exchange_rate);
        if (transRows.length > 0) {
          await client.query(
            `UPDATE transactions SET amount=$1, currency=$2, amount_in_eur=$3, amount_in_usd=$4, updated_at=NOW()
             WHERE id=$5`,
            [data.commission_transfer_amount, transCurrency, cEur, cUsd, transRows[0].id]
          );
        } else {
          await client.query(commissionSQL, [
            data.date, 'transfer_fee', data.commission_transfer_amount, transCurrency, data.exchange_rate ?? null,
            cUsd, cEur, data.lender_id ?? null, null,
            'Comisión de transferencia', id, data.status,
            null, rows[0].created_by, null, 'none', null,
          ]);
        }
      } else if (transRows.length > 0) {
        await client.query(`DELETE FROM transactions WHERE id=$1`, [transRows[0].id]);
      }

      await client.query('COMMIT');
      return rows[0];
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
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

  hardDelete: async (id: string) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query('SELECT id, recurrence_master_id FROM transactions WHERE id = $1', [id]);
      if (rows.length === 0) { await client.query('ROLLBACK'); return null; }

      // Delete linked commissions (exchange_fee / transfer_fee children)
      await client.query('DELETE FROM transactions WHERE reference_transaction_id = $1', [id]);

      // If master of a recurring series, delete all instances first
      await client.query('DELETE FROM transactions WHERE recurrence_master_id = $1', [id]);

      await client.query('DELETE FROM transactions WHERE id = $1', [id]);

      await client.query('COMMIT');
      return { id };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },
};
