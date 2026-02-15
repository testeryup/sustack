import { prisma } from '../lib/prisma';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/appError';
import type { ReactionType } from '../../generated/prisma/enums';

/**
 * Toggle reaction (Like/Dislike) trên bài viết.
 * POST /api/v1/posts/:postId/reactions
 *
 * Logic:
 *  - Chưa reaction → tạo mới, tăng counter
 *  - Cùng type → xóa reaction (un-react), giảm counter
 *  - Khác type → đổi type, cập nhật cả 2 counter
 */
export const toggleReaction = catchAsync(async (req: any, res: any, next: any) => {
  const postId = Number(req.params.postId);
  const userId: number = req.user.id;
  const type: ReactionType = req.body.type;

  // 1. Kiểm tra bài viết tồn tại + published
  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post || !post.published) {
    return next(new AppError('Không tìm thấy bài viết', 404));
  }

  // 2. Tìm reaction hiện tại
  const existing = await prisma.reaction.findUnique({
    where: { userId_postId: { userId, postId } },
  });

  let result;

  if (!existing) {
    // Case A: Chưa reaction → tạo mới
    result = await prisma.$transaction([
      prisma.reaction.create({ data: { type, userId, postId } }),
      prisma.post.update({
        where: { id: postId },
        data: type === 'LIKE'
          ? { likeCount: { increment: 1 } }
          : { dislikeCount: { increment: 1 } },
      }),
    ]);

    return res.status(201).json({
      status: 'success',
      action: 'created',
      data: result[0],
    });
  }

  if (existing.type === type) {
    // Case B: Cùng type → toggle off (xóa)
    result = await prisma.$transaction([
      prisma.reaction.delete({
        where: { id: existing.id },
      }),
      prisma.post.update({
        where: { id: postId },
        data: type === 'LIKE'
          ? { likeCount: { decrement: 1 } }
          : { dislikeCount: { decrement: 1 } },
      }),
    ]);

    return res.status(200).json({
      status: 'success',
      action: 'removed',
      data: null,
    });
  }

  // Case C: Khác type → switch (ví dụ: LIKE → DISLIKE)
  result = await prisma.$transaction([
    prisma.reaction.update({
      where: { id: existing.id },
      data: { type },
    }),
    prisma.post.update({
      where: { id: postId },
      data: type === 'LIKE'
        ? { likeCount: { increment: 1 }, dislikeCount: { decrement: 1 } }
        : { likeCount: { decrement: 1 }, dislikeCount: { increment: 1 } },
    }),
  ]);

  return res.status(200).json({
    status: 'success',
    action: 'switched',
    data: result[0],
  });
});

/**
 * Lấy reaction hiện tại của user cho một bài viết.
 * GET /api/v1/posts/:postId/reactions/me
 */
export const getMyReaction = catchAsync(async (req: any, res: any) => {
  const postId = Number(req.params.postId);
  const userId: number = req.user.id;

  const reaction = await prisma.reaction.findUnique({
    where: { userId_postId: { userId, postId } },
  });

  res.status(200).json({
    status: 'success',
    data: reaction, // null nếu chưa react
  });
});
