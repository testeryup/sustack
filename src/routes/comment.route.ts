import { Router } from 'express';
import { createComment, getCommentsByPost, deleteComment } from '../controllers/comment.controller';
import { protect } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { createCommentSchema, deleteCommentSchema, getCommentsSchema } from '../schemas/comment.schema';

const router = Router({ mergeParams: true }); // mergeParams để nhận :postId từ parent router

// Public: xem bình luận
router.get('/', validate(getCommentsSchema), getCommentsByPost);

// Authenticated: tạo + xóa
router.post('/', protect, validate(createCommentSchema), createComment);

// Lưu ý: route xóa dùng /comments/:commentId riêng (không cần postId)
// Sẽ được mount ở app.ts riêng

export default router;
