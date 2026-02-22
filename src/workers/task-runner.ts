/**
 * Task Runner — Bộ điều phối chạy ngầm.
 *
 * Liên tục quét bảng Task để tìm task PENDING,
 * đẩy content vào Worker Pool (Piscina) để parse AST,
 * sau đó đồng bộ trạng thái Media trong DB.
 */
import { Piscina } from 'piscina';
import { fileURLToPath } from 'url';
import path from 'path';
import { prisma } from '../lib/prisma.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Khởi tạo Worker Pool với giới hạn tài nguyên
const workerExt = path.extname(__filename);
const workerPath = path.resolve(__dirname, `./ast-worker${workerExt}`)
const pool = new Piscina({
  filename: workerPath,
  minThreads: 1,
  maxThreads: 2, // Giới hạn để không làm treo server
  idleTimeout: 30_000, // Tắt thread nếu không dùng sau 30s để tiết kiệm RAM
});

interface SyncMediaPayload {
  content: string;
  thumbnail?: string | null;
  postId: number;
  userId: number;
}

/**
 * Đồng bộ trạng thái Media sau khi Worker trả về danh sách publicId.
 *
 * Logic:
 * 1. Đưa tất cả ảnh đang ATTACHED vào post này về PENDING + postId: null (tạm thời)
 * 2. Gán lại status: ATTACHED + postId cho ảnh thực sự có trong nội dung
 *    (Chỉ ảnh thuộc về chủ bài viết — chống tấn công gắn ảnh người khác)
 */
async function syncMediaStatus(publicIds: string[], payload: SyncMediaPayload) {
  const { postId, userId } = payload;

  await prisma.$transaction([
    // Bước 1: Detach toàn bộ ảnh cũ của bài viết
    prisma.media.updateMany({
      where: { postId },
      data: { postId: null, status: 'PENDING' },
    }),
    // Bước 2: Attach lại những ảnh thực sự có trong content (chỉ ảnh của chủ bài viết)
    prisma.media.updateMany({
      where: {
        publicId: { in: publicIds },
        uploaderId: userId,
      },
      data: { postId, status: 'ATTACHED' },
    }),
  ]);
}

/**
 * Xử lý một Task: parse AST → sync Media → cập nhật trạng thái Task.
 */
async function processTask(taskId: number, payload: SyncMediaPayload) {
  try {
    // Đẩy content và thumbnail vào Worker Pool để parse AST trên nhân CPU khác
    const publicIds: string[] = await pool.run({ 
      content: payload.content, 
      thumbnail: payload.thumbnail 
    });

    // Đồng bộ DB sau khi có kết quả từ Worker
    await syncMediaStatus(publicIds, payload);

    // Đánh dấu thành công
    await prisma.task.update({
      where: { id: taskId },
      data: { status: 'COMPLETED' },
    });

    console.log(`[TaskRunner] Task #${taskId} COMPLETED — ${publicIds.length} ảnh đồng bộ.`);
  } catch (error) {
    console.error(`[TaskRunner] Task #${taskId} FAILED:`, error);

    await prisma.task.update({
      where: { id: taskId },
      data: { status: 'FAILED' },
    });
  }
}

/**
 * Khởi động Task Runner — quét bảng Task mỗi 10 giây.
 */
export function startTaskRunner() {
  console.log('[TaskRunner] Đã khởi động — quét mỗi 10 giây.');

  setInterval(async () => {
    try {
      // 1. Tìm task PENDING cũ nhất (FIFO)
      const task = await prisma.task.findFirst({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
      });

      if (!task) return;

      // 2. Chuyển sang PROCESSING ngay lập tức (Atomic-like — tránh race condition)
      //    Dùng where compound để đảm bảo chỉ 1 runner "thắng" task này
      const claimed = await prisma.task.updateMany({
        where: { id: task.id, status: 'PENDING' },
        data: { status: 'PROCESSING' },
      });

      // Nếu không update được row nào → task đã bị runner khác lấy
      if (claimed.count === 0) return;

      // 3. Xử lý task
      const payload = task.payload as unknown as SyncMediaPayload;
      await processTask(task.id, payload);
    } catch (error) {
      console.error('[TaskRunner] Lỗi khi quét task:', error);
    }
  }, 10_000);
}
