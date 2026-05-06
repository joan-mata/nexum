import { Request, Response } from 'express';
import { z } from 'zod';
import { CalendarService } from '../services/calendar.service';

const eventSchema = z.object({
  expected_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener formato AAAA-MM-DD'),
  type: z.string().min(1).max(30),
  description: z.string().min(1).max(1000),
  estimated_amount: z.number().positive().optional().nullable(),
  currency: z.enum(['EUR', 'USD']).optional().nullable(),
  lender_id: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
  recurrence_type: z.enum(['none', 'weekly', 'monthly']).default('none'),
  recurrence_end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
}).refine(
  (d) => d.recurrence_type === 'none' || !!d.recurrence_end_date,
  { message: 'Se requiere fecha de fin para eventos recurrentes', path: ['recurrence_end_date'] }
).refine(
  (d) => d.recurrence_type === 'none' || !d.recurrence_end_date || d.recurrence_end_date > d.expected_date,
  { message: 'La fecha de fin debe ser posterior a la fecha de inicio', path: ['recurrence_end_date'] }
);

const updateSchema = z.object({
  expected_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener formato AAAA-MM-DD'),
  type: z.string().min(1).max(30),
  description: z.string().min(1).max(1000),
  estimated_amount: z.number().positive().optional().nullable(),
  currency: z.enum(['EUR', 'USD']).optional().nullable(),
  lender_id: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const completeSchema = z.object({
  completed_transaction_id: z.string().uuid().optional().nullable(),
});

export const CalendarController = {
  listEvents: async (req: Request, res: Response): Promise<void> => {
    const { from, to } = req.query;
    const rows = await CalendarService.findEvents(from as string | undefined, to as string | undefined);
    res.json(rows);
  },

  createEvent: async (req: Request, res: Response): Promise<void> => {
    const parsed = eventSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() });
      return;
    }

    const event = await CalendarService.createEvent(parsed.data, req.user!.userId);
    res.status(201).json(event);
  },

  updateEvent: async (req: Request, res: Response): Promise<void> => {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() });
      return;
    }

    const event = await CalendarService.updateEvent(req.params['id']!, parsed.data);
    if (!event) {
      res.status(404).json({ error: 'Evento no encontrado' });
      return;
    }
    res.json(event);
  },

  completeEvent: async (req: Request, res: Response): Promise<void> => {
    const parsed = completeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() });
      return;
    }

    const event = await CalendarService.completeEvent(req.params['id']!, parsed.data.completed_transaction_id);
    if (!event) {
      res.status(404).json({ error: 'Evento no encontrado' });
      return;
    }
    res.json(event);
  },

  detachEvent: async (req: Request, res: Response): Promise<void> => {
    const event = await CalendarService.detachFromRecurrence(req.params['id']!);
    if (!event) {
      res.status(404).json({ error: 'Evento no encontrado o ya desanclado' });
      return;
    }
    res.json(event);
  },

  cancelSeries: async (req: Request, res: Response): Promise<void> => {
    const result = await CalendarService.cancelSeries(req.params['id']!);
    if (!result) {
      res.status(404).json({ error: 'Serie no encontrada' });
      return;
    }
    res.json({ ok: true });
  },
};
