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

const transactionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  type: transactionTypeEnum,
  amount: z.number().positive(),
  currency: z.enum(['EUR', 'USD']),
  exchange_rate: z.number().positive().optional().nullable(),
  lender_id: z.string().uuid().optional().nullable(),
  exit_account_id: z.string().uuid().optional().nullable(),
  description: z.string().min(1).max(1000),
  reference_transaction_id: z.string().uuid().optional().nullable(),
  status: z.enum(['pending', 'confirmed', 'cancelled']).default('confirmed'),
  notes: z.string().optional().nullable(),
});

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
    const parsed = transactionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
      return;
    }

    const transaction = await TransactionsService.create(parsed.data, req.user!.userId);
    res.status(201).json(transaction);
  },

  getById: async (req: Request, res: Response): Promise<void> => {
    const transaction = await TransactionsService.findById(req.params['id']!);
    if (!transaction) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }
    res.json(transaction);
  },

  update: async (req: Request, res: Response): Promise<void> => {
    const parsed = transactionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
      return;
    }

    const transaction = await TransactionsService.update(req.params['id']!, parsed.data);
    if (!transaction) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }
    res.json(transaction);
  },

  cancel: async (req: Request, res: Response): Promise<void> => {
    const result = await TransactionsService.cancel(req.params['id']!);
    if (!result) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }
    res.json({ message: 'Transaction cancelled successfully' });
  },
};
