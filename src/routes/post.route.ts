import { Router } from 'express';
import * as postController from '../controllers/post.controller';
import { protect } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { postSchema, updatePostSchema } from '../schemas/post.schema';

const router = Router();

router.get('/', postController.getAllPosts);
router.get('/:slug', postController.getPostBySlug);

router.use(protect);
router.post('/', validate(postSchema), postController.createPost);
router.patch('/:id', validate(updatePostSchema), postController.updatePost);
router.delete('/:id', postController.deletePost);

export default router;