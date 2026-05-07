import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/admin.middleware';
import { TransactionsController } from '../controllers/transactions.controller';

const router = Router();
router.use(requireAuth);

router.get('/', TransactionsController.list);
router.get('/summary', TransactionsController.getSummary);
router.post('/', TransactionsController.create);
router.get('/:id', TransactionsController.getById);
router.put('/:id', TransactionsController.update);
router.put('/:id/recurring', TransactionsController.updateAllRecurring);
router.put('/:id/recurrence-end', TransactionsController.updateRecurrenceEnd);
router.delete('/:id/permanent', requireAdmin, TransactionsController.hardDelete);
router.delete('/:id', TransactionsController.cancel);

export default router;
