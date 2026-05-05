import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { DashboardController } from '../controllers/dashboard.controller';

const router = Router();
router.use(requireAuth);

router.get('/overview', DashboardController.overview);
router.get('/cashflow', DashboardController.cashflow);
router.get('/currency-breakdown', DashboardController.currencyBreakdown);

export default router;
