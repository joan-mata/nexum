import { Request, Response } from 'express';
import { z } from 'zod';
import { TransactionsService } from '../services/transactions.service';

const transactionTypeEnum = z.enum([
  'loan_received',
  'transfer_out',
  'return_received',
  'lender_payment',
  'exchange_fee',
  'transfer_fee',
  'other_expense',
  'cash_withdrawal',
  'reinvestment',
]);

const transactionBaseSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener formato AAAA-MM-DD'),
  type: transactionTypeEnum,
  amount: z.number().positive(),
  currency: z.enum(['EUR', 'USD']),
  exchange_rate: z.number().positive().optional().nullable(),
  lender_id: z.string().uuid().optional().nullable(),
  exit_account_name: z.string().max(255).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  reference_transaction_id: z.string().uuid().optional().nullable(),
  status: z.enum(['pending', 'confirmed', 'cancelled']).default('confirmed'),
  notes: z.string().optional().nullable(),
  commission_exchange_amount: z.number().min(0).optional().nullable(),
  commission_exchange_currency: z.enum(['EUR', 'USD']).optional(),
  commission_transfer_amount: z.number().min(0).optional().nullable(),
  commission_transfer_currency: z.enum(['EUR', 'USD']).optional(),
});

const transactionSchema = transactionBaseSchema;

const createTransactionSchema = transactionBaseSchema.extend({
  recurrence_type: z.enum(['none', 'weekly', 'monthly']).default('none'),
  recurrence_end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  commission_exchange_amount: z.number().min(0).optional().nullable(),
  commission_exchange_currency: z.enum(['EUR', 'USD']).default('EUR'),
  commission_transfer_amount: z.number().min(0).optional().nullable(),
  commission_transfer_currency: z.enum(['EUR', 'USD']).default('USD'),
}).refine(
  (d) => d.recurrence_type === 'none' || !!d.recurrence_end_date,
  { message: 'Se requiere fecha de fin para transacciones recurrentes', path: ['recurrence_end_date'] }
).refine(
  (d) => d.recurrence_type === 'none' || !d.recurrence_end_date || d.recurrence_end_date > d.date,
  { message: 'La fecha de fin debe ser posterior a la fecha de inicio', path: ['recurrence_end_date'] }
);

export const TransactionsController = {
  list: async (req: Request, res: Response): Promise<void> => {
    const { date_from, date_to, type, lender_id, currency, status, page, limit } = req.query;

    const result = await TransactionsService.findAll({
      date_from: date_from as string | undefined,
      date_to: date_to as string | undefined,
      type: type as string | undefined,
      lender_id: lender_id as string | undefined,
      currency: currency as string | undefined,
      status: status as string | undefined,
      page: page as string | undefined,
      limit: limit as string | undefined,
    });

    res.json(result);
  },

  getSummary: async (_req: Request, res: Response): Promise<void> => {
    const summary = await TransactionsService.getSummary();
    res.json(summary);
  },

  create: async (req: Request, res: Response): Promise<void> => {
    const parsed = createTransactionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() });
      return;
    }

    const transaction = await TransactionsService.create(parsed.data, req.user!.userId);
    res.status(201).json(transaction);
  },

  getById: async (req: Request, res: Response): Promise<void> => {
    const transaction = await TransactionsService.findById(req.params['id']!);
    if (!transaction) {
      res.status(404).json({ error: 'Transacción no encontrada' });
      return;
    }
    res.json(transaction);
  },

  update: async (req: Request, res: Response): Promise<void> => {
    const parsed = transactionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() });
      return;
    }

    const transaction = await TransactionsService.update(req.params['id']!, parsed.data);
    if (!transaction) {
      res.status(404).json({ error: 'Transacción no encontrada' });
      return;
    }
    res.json(transaction);
  },

  updateRecurrenceEnd: async (req: Request, res: Response): Promise<void> => {
    const { end_date } = req.body;
    if (!end_date || !/^\d{4}-\d{2}-\d{2}$/.test(end_date)) {
      res.status(400).json({ error: 'end_date debe tener formato AAAA-MM-DD' });
      return;
    }
    try {
      const result = await TransactionsService.updateRecurrenceEnd(req.params['id']!, end_date);
      if (!result) { res.status(404).json({ error: 'Transacción no encontrada' }); return; }
      res.json(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error interno';
      res.status(400).json({ error: msg });
    }
  },

  updateAllRecurring: async (req: Request, res: Response): Promise<void> => {
    const parsed = transactionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() });
      return;
    }
    const result = await TransactionsService.updateAllRecurring(req.params['id']!, parsed.data);
    if (!result) {
      res.status(404).json({ error: 'Transacción no encontrada' });
      return;
    }
    res.json({ updated: result.length });
  },

  cancel: async (req: Request, res: Response): Promise<void> => {
    const result = await TransactionsService.cancel(req.params['id']!);
    if (!result) {
      res.status(404).json({ error: 'Transacción no encontrada' });
      return;
    }
    res.json({ message: 'Transacción cancelada correctamente' });
  },

  hardDelete: async (req: Request, res: Response): Promise<void> => {
    const result = await TransactionsService.hardDelete(req.params['id']!);
    if (!result) {
      res.status(404).json({ error: 'Transacción no encontrada' });
      return;
    }
    res.json({ message: 'Transacción eliminada permanentemente' });
  },
};
