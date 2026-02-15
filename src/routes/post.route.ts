import { Router } from 'express';
import * as postController from '../controllers/post.controller';
import { protect } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { postSchema, updatePostSchema } from '../schemas/post.schema';
import reactionRouter from './reaction.route';
import commentRouter from './comment.route';

const router = Router();

// Nested routes: /api/v1/posts/:postId/reactions
router.use('/:postId/reactions', reactionRouter);
// Nested routes: /api/v1/posts/:postId/comments
router.use('/:postId/comments', commentRouter);

router.get('/', postController.getAllPosts);
router.get('/:slug', postController.getPostBySlug);

router.use(protect);
router.post('/', validate(postSchema), postController.createPost);
router.patch('/:id', validate(updatePostSchema), postController.updatePost);
router.delete('/:id', postController.deletePost);

export default router;