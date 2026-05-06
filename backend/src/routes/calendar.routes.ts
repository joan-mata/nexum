import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { CalendarController } from '../controllers/calendar.controller';

const router = Router();
router.use(requireAuth);

router.get('/events', CalendarController.listEvents);
router.post('/events', CalendarController.createEvent);
router.put('/events/:id', CalendarController.updateEvent);
router.put('/events/:id/complete', CalendarController.completeEvent);
router.put('/events/:id/detach', CalendarController.detachEvent);
router.delete('/events/series/:id', CalendarController.cancelSeries);

export default router;
