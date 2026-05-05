import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { ExitAccountsController } from '../controllers/exit-accounts.controller';

const router = Router();
router.use(requireAuth);

router.get('/', ExitAccountsController.list);
router.post('/', ExitAccountsController.create);
router.put('/:id', ExitAccountsController.update);
router.delete('/:id', ExitAccountsController.deactivate);

export default router;
