import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/admin.middleware';
import { UsersController } from '../controllers/users.controller';

const router = Router();

// POST /accept-invite is PUBLIC — must be before requireAuth/requireAdmin
router.post('/accept-invite', UsersController.acceptInvite);

// All routes below require authentication + admin role
router.use(requireAuth);
router.use(requireAdmin);

router.get('/', UsersController.list);
router.post('/invite', UsersController.invite);
router.put('/:id/password', UsersController.changePassword);
router.put('/:id/deactivate', UsersController.toggleActive);
router.get('/audit-log', UsersController.getAuditLog);

export default router;
