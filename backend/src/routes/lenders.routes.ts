import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { LendersController } from '../controllers/lenders.controller';

const router = Router();
router.use(requireAuth);

router.get('/', LendersController.list);
router.post('/', LendersController.create);
router.get('/:id/stats', LendersController.getStats);
router.get('/:id', LendersController.getById);
router.put('/:id', LendersController.update);
router.delete('/:id', LendersController.deactivate);

export default router;
