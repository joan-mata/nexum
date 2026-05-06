import { Request, Response } from 'express';
import { z } from 'zod';
import { LendersService } from '../services/lenders.service';

const lenderSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const LendersController = {
  list: async (_req: Request, res: Response): Promise<void> => {
    const lenders = await LendersService.findAll();
    res.json(lenders);
  },

  create: async (req: Request, res: Response): Promise<void> => {
    const parsed = lenderSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() });
      return;
    }

    const { name, email, phone, notes } = parsed.data;
    const lender = await LendersService.create(name, email, phone, notes, req.user!.userId);
    res.status(201).json(lender);
  },

  getById: async (req: Request, res: Response): Promise<void> => {
    const lender = await LendersService.findById(req.params['id']!);
    if (!lender) {
      res.status(404).json({ error: 'Prestamista no encontrado' });
      return;
    }
    res.json(lender);
  },

  getStats: async (req: Request, res: Response): Promise<void> => {
    const result = await LendersService.getStats(req.params['id']!);
    if (!result) {
      res.status(404).json({ error: 'Prestamista no encontrado' });
      return;
    }
    res.json(result);
  },

  update: async (req: Request, res: Response): Promise<void> => {
    const parsed = lenderSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() });
      return;
    }

    const { name, email, phone, notes } = parsed.data;
    const lender = await LendersService.update(req.params['id']!, name, email, phone, notes);
    if (!lender) {
      res.status(404).json({ error: 'Prestamista no encontrado' });
      return;
    }
    res.json(lender);
  },

  deactivate: async (req: Request, res: Response): Promise<void> => {
    const result = await LendersService.deactivate(req.params['id']!);
    if (!result) {
      res.status(404).json({ error: 'Prestamista no encontrado' });
      return;
    }
    res.json({ message: 'Prestamista desactivado correctamente' });
  },
};
