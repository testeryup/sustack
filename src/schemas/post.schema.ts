import { z } from 'zod';

export const postSchema = z.object({
  body: z.object({
    title: z.string().min(10, 'Tiêu đề quá ngắn').max(100),
    content: z.string().min(20, 'Nội dung quá ngắn'),
    thumbnail: z.string().url().optional(),
    published: z.boolean().optional().default(false),
  }),
});

export const updatePostSchema = z.object({
  body: postSchema.shape.body.partial(), // Cho phép gửi lên một phần dữ liệu
});