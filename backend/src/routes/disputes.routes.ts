import { Router } from 'express';
import { createDispute } from '../controllers/disputes.controller';
import { validateBody } from '../middleware/validator';
import { disputeSchema } from '../middleware/validationSchemas';

const router = Router();

router.post('/', validateBody(disputeSchema), createDispute);

export default router;
