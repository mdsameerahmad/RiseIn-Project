import { Router } from 'express';
import { getEventsByEscrowId } from '../controllers/events.controller';

const router = Router();

router.get('/:escrowId', getEventsByEscrowId);

export default router;
