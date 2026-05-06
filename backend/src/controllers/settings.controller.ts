import { Request, Response } from 'express';
import { z } from 'zod';
import { SettingsService } from '../services/settings.service';

const sidebarSchema = z.array(
  z.object({
    to: z.string().min(1),
    label: z.string().min(1).max(50),
  })
);

export const SettingsController = {
  getSidebar: async (_req: Request, res: Response): Promise<void> => {
    const config = await SettingsService.getSidebar();
    res.json(config);
  },

  updateSidebar: async (req: Request, res: Response): Promise<void> => {
    const parsed = sidebarSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Datos inválidos', details: parsed.error.flatten() });
      return;
    }
    await SettingsService.updateSidebar(parsed.data);
    res.json({ ok: true });
  },
};
