import { Request, Response } from 'express';
import { z } from 'zod';
import { CalendarService } from '../services/calendar.service';

const eventSchema = z.object({
  expected_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
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
      res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
      return;
    }

    const event = await CalendarService.createEvent(parsed.data, req.user!.userId);
    res.status(201).json(event);
  },

  updateEvent: async (req: Request, res: Response): Promise<void> => {
    const parsed = eventSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
      return;
    }

    const event = await CalendarService.updateEvent(req.params['id']!, parsed.data);
    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }
    res.json(event);
  },

  completeEvent: async (req: Request, res: Response): Promise<void> => {
    const parsed = completeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
      return;
    }

    const event = await CalendarService.completeEvent(req.params['id']!, parsed.data.completed_transaction_id);
    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }
    res.json(event);
  },
};
