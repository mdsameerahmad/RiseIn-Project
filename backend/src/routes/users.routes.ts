import { Router } from 'express';
import { getUserProfile, upsertUserProfile } from '../controllers/users.controller';
import { validateBody } from '../middleware/validator';
import { userProfileSchema } from '../middleware/validationSchemas';

const router = Router();

router.get('/:walletAddress', getUserProfile);
router.put('/:walletAddress', validateBody(userProfileSchema), upsertUserProfile);

export default router;
