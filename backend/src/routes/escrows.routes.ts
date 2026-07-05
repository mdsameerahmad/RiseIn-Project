import { Router } from 'express';
import { getEscrows, getEscrowById, attachMilestoneMetadata } from '../controllers/escrows.controller';
import { validateBody } from '../middleware/validator';
import { milestoneMetadataSchema } from '../middleware/validationSchemas';

const router = Router();

router.get('/', getEscrows);
router.get('/:escrowId', getEscrowById);
router.post('/:escrowId/metadata', validateBody(milestoneMetadataSchema), attachMilestoneMetadata);

export default router;
