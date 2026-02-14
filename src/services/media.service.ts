import { v2 as cloudinary, type ConfigOptions, type UploadApiResponse } from 'cloudinary';
import streamifier from 'streamifier';
import { prisma } from '../lib/prisma.js';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
} as ConfigOptions);

/**
 * Upload file buffer lên Cloudinary qua Stream (không lưu file tạm).
 */
export const uploadToCloudinary = (fileBuffer: Buffer): Promise<UploadApiResponse> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'sustack_blog',
        resource_type: 'image',
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result!);
      }
    );

    streamifier.createReadStream(fileBuffer).pipe(uploadStream);
  });
};

/**
 * Xóa ảnh trên Cloudinary theo publicId.
 */
export const deleteFromCloudinary = (publicId: string) => {
  return cloudinary.uploader.destroy(publicId);
};

/**
 * Lưu thông tin ảnh vào DB sau khi upload thành công.
 */
export const saveMediaRecord = (data: {
  url: string;
  publicId: string;
  format?: string | null;
  width?: number | null;
  height?: number | null;
  bytes?: number | null;
  uploaderId: number;
  postId?: number | null;
}) => {
  return prisma.media.create({ data });
};

/**
 * Xóa ảnh khỏi Cloudinary + DB.
 */
export const deleteMedia = async (mediaId: number) => {
  const media = await prisma.media.findUnique({ where: { id: mediaId } });
  if (!media) return null;

  await deleteFromCloudinary(media.publicId);
  await prisma.media.delete({ where: { id: mediaId } });
  return media;
};

/**
 * Lấy danh sách ảnh orphan (chưa gắn bài viết) của user.
 * Hữu ích để dọn rác hoặc hiển thị ảnh nháp.
 */
export const getOrphanMedia = (uploaderId: number) => {
  return prisma.media.findMany({
    where: { uploaderId, postId: null },
    orderBy: { createdAt: 'desc' },
  });
};

/**
 * Gắn media vào bài viết (khi user publish).
 */
export const attachMediaToPost = (mediaId: number, postId: number) => {
  return prisma.media.update({
    where: { id: mediaId },
    data: { postId },
  });
};

/**
 * Xóa hàng loạt media orphan quá hạn (dùng cho cron job / admin).
 * Mặc định: orphan > 24 giờ.
 */
export const cleanupOrphanMedia = async (hoursOld = 24) => {
  const cutoff = new Date(Date.now() - hoursOld * 60 * 60 * 1000);

  const orphans = await prisma.media.findMany({
    where: {
      postId: null,
      createdAt: { lt: cutoff },
    },
  });

  const results = await Promise.allSettled(
    orphans.map(async (m) => {
      await deleteFromCloudinary(m.publicId);
      await prisma.media.delete({ where: { id: m.id } });
    })
  );

  return {
    total: orphans.length,
    deleted: results.filter((r) => r.status === 'fulfilled').length,
    failed: results.filter((r) => r.status === 'rejected').length,
  };
};