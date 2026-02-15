import { Router } from 'express';
import { toggleReaction, getMyReaction } from '../controllers/reaction.controller';
import { protect } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { reactionSchema } from '../schemas/reaction.schema';

const router = Router({ mergeParams: true }); // mergeParams để nhận :postId từ parent router

router.use(protect);

router.post('/', validate(reactionSchema), toggleReaction);
router.get('/me', getMyReaction);

export default router;
