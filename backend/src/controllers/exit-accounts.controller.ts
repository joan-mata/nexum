import { Request, Response } from 'express';
import { z } from 'zod';
import { ExitAccountsService } from '../services/exit-accounts.service';

const exitAccountSchema = z.object({
  name: z.string().min(1).max(255),
  account_number: z.string().max(255).optional().nullable(),
  bank_name: z.string().max(255).optional().nullable(),
  currency: z.enum(['EUR', 'USD']),
  notes: z.string().optional().nullable(),
});

export const ExitAccountsController = {
  list: async (_req: Request, res: Response): Promise<void> => {
    const accounts = await ExitAccountsService.findAll();
    res.json(accounts);
  },

  create: async (req: Request, res: Response): Promise<void> => {
    const parsed = exitAccountSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
      return;
    }

    const account = await ExitAccountsService.create(parsed.data);
    res.status(201).json(account);
  },

  update: async (req: Request, res: Response): Promise<void> => {
    const parsed = exitAccountSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
      return;
    }

    const account = await ExitAccountsService.update(req.params['id']!, parsed.data);
    if (!account) {
      res.status(404).json({ error: 'Exit account not found' });
      return;
    }
    res.json(account);
  },

  deactivate: async (req: Request, res: Response): Promise<void> => {
    const result = await ExitAccountsService.deactivate(req.params['id']!);
    if (!result) {
      res.status(404).json({ error: 'Exit account not found' });
      return;
    }
    res.json({ message: 'Exit account deactivated successfully' });
  },
};
