import { Request, Response } from 'express';
import { DashboardService } from '../services/dashboard.service';

export const DashboardController = {
  overview: async (_req: Request, res: Response): Promise<void> => {
    const data = await DashboardService.getOverview();
    res.json(data);
  },

  cashflow: async (_req: Request, res: Response): Promise<void> => {
    const rows = await DashboardService.getCashflow();
    res.json(rows);
  },

  currencyBreakdown: async (_req: Request, res: Response): Promise<void> => {
    const rows = await DashboardService.getCurrencyBreakdown();
    res.json(rows);
  },
};
