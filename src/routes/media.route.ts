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

// Admin only: dọn rác ảnh orphan hàng loạt (PHẢI đặt trước /:id để Express không nhầm "cleanup" là id)
router.delete('/cleanup/orphan', restrictTo('ADMIN'), cleanupOrphan);

router.delete('/:id', deleteImage);

export default router;