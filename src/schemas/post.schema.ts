import { z } from 'zod';

export const createPostSchema = z.object({
  body: z.object({
    title: z
      .string({ error: 'Tiêu đề là bắt buộc' })
      .min(5, 'Tiêu đề phải có ít nhất 5 ký tự')
      .max(100, 'Tiêu đề không được quá 100 ký tự'),
    
    content: z
      .string({ error: 'Nội dung bài viết là bắt buộc' })
      .min(20, 'Nội dung Markdown phải có ít nhất 20 ký tự'),
    
    thumbnail: z
      .string()
      .url('Định dạng ảnh không hợp lệ')
      .optional(),
      
    published: z.boolean().optional(),
  }),
});

// Tự động sinh Type để dùng trong Controller
export type CreatePostInput = z.infer<typeof createPostSchema>['body'];