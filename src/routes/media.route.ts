import { Router } from 'express';
import { uploadImage, deleteImage, getMyOrphanMedia, cleanupOrphan } from '../controllers/media.controller.js';
import { protect } from '../middlewares/auth.middleware.js';
import { restrictTo } from '../middlewares/restrict.middleware.js';
import { upload } from '../middlewares/upload.middleware.js';

const router = Router();

// Tất cả routes đều cần đăng nhập
router.use(protect);

router.post('/upload', upload.single('image'), uploadImage);
router.get('/orphan', getMyOrphanMedia);
router.delete('/:id', deleteImage);

// Admin only: dọn rác ảnh orphan hàng loạt
router.delete('/cleanup/orphan', restrictTo('ADMIN'), cleanupOrphan);

export default router;