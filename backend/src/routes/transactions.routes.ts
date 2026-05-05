import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { TransactionsController } from '../controllers/transactions.controller';

const router = Router();
router.use(requireAuth);

router.get('/', TransactionsController.list);
router.get('/summary', TransactionsController.getSummary);
router.post('/', TransactionsController.create);
router.get('/:id', TransactionsController.getById);
router.put('/:id', TransactionsController.update);
router.delete('/:id', TransactionsController.cancel);

export default router;
