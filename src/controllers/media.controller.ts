import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/appError';
import {
  uploadToCloudinary,
  saveMediaRecord,
  deleteMedia,
  getOrphanMedia,
  cleanupOrphanMedia,
} from '../services/media.service.js';

/**
 * Upload ảnh lên Cloudinary + lưu record vào DB.
 * POST /api/v1/media/upload
 */
export const uploadImage = catchAsync(async (req: any, res: any, next: any) => {
  if (!req.file) {
    return next(new AppError('Vui lòng chọn một file ảnh', 400));
  }

  const result = await uploadToCloudinary(req.file.buffer);

  const media = await saveMediaRecord({
    url: result.secure_url,
    publicId: result.public_id,
    format: result.format ?? null,
    width: result.width ?? null,
    height: result.height ?? null,
    bytes: result.bytes ?? null,
    uploaderId: req.user.id,
  });

  res.status(201).json({
    status: 'success',
    data: media,
  });
});

/**
 * Xóa ảnh khỏi Cloudinary + DB.
 * DELETE /api/v1/media/:id
 */
export const deleteImage = catchAsync(async (req: any, res: any, next: any) => {
  const mediaId = Number(req.params.id);

  const { prisma } = await import('../lib/prisma');
  const media = await prisma.media.findUnique({ where: { id: mediaId } });

  if (!media) {
    return next(new AppError('Không tìm thấy ảnh', 404));
  }

  if (media.uploaderId !== req.user.id && req.user.role !== 'ADMIN') {
    return next(new AppError('Bạn không có quyền xóa ảnh này', 403));
  }

  await deleteMedia(mediaId);

  res.status(204).json({ status: 'success', data: null });
});

/**
 * Lấy danh sách ảnh orphan (chưa gắn bài viết) của user hiện tại.
 * GET /api/v1/media/orphan
 */
export const getMyOrphanMedia = catchAsync(async (req: any, res: any) => {
  const media = await getOrphanMedia(req.user.id);

  res.status(200).json({
    status: 'success',
    results: media.length,
    data: media,
  });
});

/**
 * Admin: dọn dẹp toàn bộ ảnh orphan quá hạn.
 * DELETE /api/v1/media/cleanup
 */
export const cleanupOrphan = catchAsync(async (req: any, res: any) => {
  const hours = Number(req.query.hours) || 24;
  const result = await cleanupOrphanMedia(hours);

  res.status(200).json({
    status: 'success',
    data: result,
  });
});