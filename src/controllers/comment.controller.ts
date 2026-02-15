import { prisma } from '../lib/prisma';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/appError';

// Projection chung: ẩn content nếu soft-deleted
const commentSelect = {
  id: true,
  content: true,
  postId: true,
  authorId: true,
  parentId: true,
  deletedAt: true,
  createdAt: true,
  author: { select: { id: true, name: true } },
};

/**
 * Format comment cho response: ẩn nội dung nếu đã bị soft delete.
 */
const formatComment = (comment: any) => ({
  ...comment,
  content: comment.deletedAt ? '[Bình luận đã bị xóa]' : comment.content,
});

/**
 * Tạo bình luận (gốc hoặc reply).
 * POST /api/v1/posts/:postId/comments
 */
export const createComment = catchAsync(async (req: any, res: any, next: any) => {
  const postId = Number(req.params.postId);
  const { content, parentId } = req.body;
  const authorId: number = req.user.id;

  // 1. Kiểm tra bài viết tồn tại + published
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post || !post.published) {
    return next(new AppError('Không tìm thấy bài viết', 404));
  }

  // 2. Nếu là reply → kiểm tra parent comment
  if (parentId) {
    const parent = await prisma.comment.findUnique({
      where: { id: parentId },
    });
    if (!parent || parent.postId !== postId) {
      return next(new AppError('Bình luận gốc không tồn tại hoặc không thuộc bài viết này', 404));
    }
    if (parent.deletedAt) {
      return next(new AppError('Không thể reply bình luận đã bị xóa', 400));
    }
  }

  // 3. Tạo comment
  const comment = await prisma.comment.create({
    data: {
      content,
      postId,
      authorId,
      parentId: parentId ?? null,
    },
    select: commentSelect,
  });

  res.status(201).json({
    status: 'success',
    data: comment,
  });
});

/**
 * Lấy danh sách bình luận (gốc) của bài viết, kèm replies nested 1 cấp.
 * GET /api/v1/posts/:postId/comments
 */
export const getCommentsByPost = catchAsync(async (req: any, res: any, next: any) => {
  const postId = Number(req.params.postId);
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  // Kiểm tra bài viết tồn tại
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) {
    return next(new AppError('Không tìm thấy bài viết', 404));
  }

  // Lấy comment gốc (parentId = null) + replies nested
  const [comments, total] = await Promise.all([
    prisma.comment.findMany({
      where: { postId, parentId: null },
      select: {
        ...commentSelect,
        replies: {
          select: {
            ...commentSelect,
            replies: {
              select: commentSelect, // Nested 2 cấp
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.comment.count({ where: { postId, parentId: null } }),
  ]);

  // Format: ẩn content nếu soft-deleted (đệ quy)
  const formatNested = (c: any): any => ({
    ...formatComment(c),
    replies: c.replies?.map(formatNested) ?? [],
  });

  res.status(200).json({
    status: 'success',
    results: comments.length,
    total,
    data: comments.map(formatNested),
  });
});

/**
 * Soft delete bình luận.
 * DELETE /api/v1/comments/:commentId
 */
export const deleteComment = catchAsync(async (req: any, res: any, next: any) => {
  const commentId = Number(req.params.commentId);

  // 1. Tìm comment
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
  });
  if (!comment || comment.deletedAt) {
    return next(new AppError('Không tìm thấy bình luận', 404));
  }

  // 2. Kiểm tra quyền: tác giả hoặc ADMIN
  if (comment.authorId !== req.user.id && req.user.role !== 'ADMIN') {
    return next(new AppError('Bạn không có quyền xóa bình luận này', 403));
  }

  // 3. Soft delete
  await prisma.comment.update({
    where: { id: commentId },
    data: { deletedAt: new Date() },
  });

  res.status(200).json({
    status: 'success',
    message: 'Bình luận đã được xóa',
  });
});
