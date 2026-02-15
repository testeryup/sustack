import { Router } from 'express';
import * as postController from '../controllers/post.controller';
import { protect } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { postSchema, updatePostSchema } from '../schemas/post.schema';
import { cache } from '../middlewares/cache.middleware';
import { getPostListKey, getPostSlugKey } from '../utils/cacheKeys';
import reactionRouter from './reaction.route';
import commentRouter from './comment.route';

const router = Router();

// Nested routes: /api/v1/posts/:postId/reactions
router.use('/:postId/reactions', reactionRouter);
// Nested routes: /api/v1/posts/:postId/comments
router.use('/:postId/comments', commentRouter);

router.get('/', cache((req) => getPostListKey(Number(req.query.page) || 1, Number(req.query.limit) || 10), 600), postController.getAllPosts);
router.get('/:slug', cache((req) => getPostSlugKey(req.params.slug as string), 3600), postController.getPostBySlug);

router.use(protect);
router.post('/', validate(postSchema), postController.createPost);
router.patch('/:id', validate(updatePostSchema), postController.updatePost);
router.delete('/:id', postController.deletePost);

export default router;