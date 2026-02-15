import { z } from 'zod';

export const reactionSchema = z.object({
  params: z.object({
    postId: z.coerce.number().int().positive('postId không hợp lệ'),
  }),
  body: z.object({
    type: z.enum(['LIKE', 'DISLIKE'], {
      required_error: 'Loại reaction là bắt buộc',
      invalid_type_error: 'Loại reaction phải là LIKE hoặc DISLIKE',
    }),
  }),
});
