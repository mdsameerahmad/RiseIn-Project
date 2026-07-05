import { Router } from 'express';
import { getReputation } from '../controllers/reputation.controller';

const router = Router();

router.get('/:walletAddress', getReputation);

export default router;
