import { Router } from 'express';
import { getNotifications, markNotificationAsRead } from '../controllers/notifications.controller';

const router = Router();

router.get('/', getNotifications);
router.patch('/:id/read', markNotificationAsRead);

export default router;
