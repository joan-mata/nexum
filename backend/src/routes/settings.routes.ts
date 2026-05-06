import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/admin.middleware';
import { SettingsController } from '../controllers/settings.controller';

const router = Router();

router.use(requireAuth);
router.get('/sidebar', SettingsController.getSidebar);
router.put('/sidebar', requireAdmin, SettingsController.updateSidebar);

export default router;
