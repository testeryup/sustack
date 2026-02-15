import { z } from 'zod';

export const createCommentSchema = z.object({
  params: z.object({
    postId: z.coerce.number().int().positive('postId không hợp lệ'),
  }),
  body: z.object({
    content: z.string().min(1, 'Nội dung bình luận không được để trống').max(2000, 'Bình luận quá dài (tối đa 2000 ký tự)'),
    parentId: z.number().int().positive().optional(),
  }),
});

export const deleteCommentSchema = z.object({
  params: z.object({
    commentId: z.coerce.number().int().positive('commentId không hợp lệ'),
  }),
});

export const getCommentsSchema = z.object({
  params: z.object({
    postId: z.coerce.number().int().positive('postId không hợp lệ'),
  }),
  query: z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(50).optional().default(10),
  }),
});
