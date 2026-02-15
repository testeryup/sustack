import { z } from 'zod';

export const reactionSchema = z.object({
  params: z.object({
    postId: z.coerce.number().int().positive('postId không hợp lệ'),
  }),
  body: z.object({
    type: z.enum(['LIKE', 'DISLIKE'], {
      error: 'Loại reaction phải là LIKE hoặc DISLIKE',
    })
  }),
});
