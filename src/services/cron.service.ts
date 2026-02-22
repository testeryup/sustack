/**
 * Cron Service — The Janitor.
 *
 * Chạy vào giờ thấp điểm (2h sáng) để dọn dẹp:
 * 1. Media orphan (PENDING > 24h) → xóa khỏi Cloudinary + DB
 * 2. Task đã hoàn thành (COMPLETED/FAILED > 7 ngày) → xóa khỏi DB
 */
import cron from 'node-cron';
import { v2 as cloudinary } from 'cloudinary';
import { prisma } from '../lib/prisma.js';

/**
 * Dọn dẹp ảnh mồ côi (PENDING > hoursOld giờ).
 * Xóa trên Cloudinary trước, sau đó xóa record trong DB.
 */
async function cleanupOrphanMedia(hoursOld = 24) {
  const cutoff = new Date(Date.now() - hoursOld * 60 * 60 * 1000);

  const orphans = await prisma.media.findMany({
    where: {
      status: 'PENDING',
      postId: null,
      createdAt: { lt: cutoff },
    },
  });

  if (orphans.length === 0) {
    console.log('[Cron] Không có ảnh orphan cần dọn.');
    return;
  }

  // Xóa trên Cloudinary (batch API — tối đa 100/lần)
  const publicIds = orphans.map((m) => m.publicId);

  try {
    await cloudinary.api.delete_resources(publicIds);
  } catch (error) {
    console.error('[Cron] Lỗi khi xóa ảnh trên Cloudinary:', error);
  }

  // Xóa records trong DB
  const dbIds = orphans.map((m) => m.id);
  const deleted = await prisma.media.deleteMany({
    where: { id: { in: dbIds } },
  });

  console.log(`[Cron] Đã dọn ${deleted.count}/${orphans.length} ảnh orphan.`);
}

/**
 * Dọn dẹp Task cũ (COMPLETED/FAILED > daysOld ngày).
 */
async function cleanupOldTasks(daysOld = 7) {
  const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

  const deleted = await prisma.task.deleteMany({
    where: {
      status: { in: ['COMPLETED', 'FAILED'] },
      updatedAt: { lt: cutoff },
    },
  });

  if (deleted.count > 0) {
    console.log(`[Cron] Đã dọn ${deleted.count} task cũ.`);
  }
}

/**
 * Bắt đầu tất cả cron job.
 */
export function startCronJobs() {
  // Chạy lúc 2h sáng mỗi ngày: dọn ảnh orphan > 24h
  cron.schedule('0 2 * * *', async () => {
    console.log('[Cron] Bắt đầu dọn dẹp ảnh orphan...');
    await cleanupOrphanMedia(24);
  });

  // Chạy lúc 3h sáng mỗi ngày: dọn task cũ > 7 ngày
  cron.schedule('0 3 * * *', async () => {
    console.log('[Cron] Bắt đầu dọn dẹp task cũ...');
    await cleanupOldTasks(7);
  });

  console.log('[Cron] Đã đăng ký các cron job (2h: orphan media, 3h: old tasks).');
}
