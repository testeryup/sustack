import slugify from 'slugify';
import { nanoid } from 'nanoid';
import { prisma } from '../lib/prisma';
import { catchAsync } from '../utils/catchAsync';
import { AppError } from '../utils/appError';
import { deleteFromCloudinary } from '../services/media.service';
import { invalidateCache, invalidatePattern } from '../services/cache.service';
import { getPostSlugKey, POST_LIST_PATTERN } from '../utils/cacheKeys';

export const createPost = catchAsync(async (req: any, res: any) => {
  const { title, content, thumbnail, published } = req.body;

  const slug = `${slugify(title, { lower: true, strict: true })}-${nanoid(4)}`;

  const post = await prisma.post.create({
    data: {
      title,
      content,
      slug,
      thumbnail,
      published,
      authorId: req.user.id,
    },
  });

  await invalidatePattern(POST_LIST_PATTERN);

  res.status(201).json({ status: 'success', data: post });
});

export const getAllPosts = catchAsync(async (req: any, res: any) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where: { published: true },
      include: { author: { select: { name: true, email: true } } },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.post.count({ where: { published: true } }),
  ]);

  res.status(200).json({ status: 'success', results: posts.length, total, data: posts });
});

export const updatePost = catchAsync(async (req: any, res: any, next: any) => {
  const { id } = req.params;
  
  // 1. Tìm bài viết
  const post = await prisma.post.findUnique({ where: { id: Number(id) } });
  if (!post) return next(new AppError('Không tìm thấy bài viết', 404));

  // 2. Kiểm tra quyền (Chỉ tác giả hoặc ADMIN)
  if (post.authorId !== req.user.id && req.user.role !== 'ADMIN') {
    return next(new AppError('Bạn không có quyền sửa bài này', 403));
  }

  // 3. Chỉ cho phép cập nhật các field an toàn (chặn authorId, slug injection)
  const { title, content, thumbnail, published } = req.body;
  const updateData: Record<string, any> = {};
  if (title !== undefined) {
    updateData.title = title;
    // Tự động tạo slug mới khi đổi tiêu đề
    updateData.slug = `${slugify(title, { lower: true, strict: true })}-${nanoid(4)}`;
  }
  if (content !== undefined) updateData.content = content;
  if (thumbnail !== undefined) updateData.thumbnail = thumbnail;
  if (published !== undefined) updateData.published = published;

  const updatedPost = await prisma.post.update({
    where: { id: Number(id) },
    data: updateData,
  });

  // Invalidate old slug cache and list cache
  await invalidateCache(getPostSlugKey(post.slug));
  if (updatedPost.slug !== post.slug) {
    await invalidateCache(getPostSlugKey(updatedPost.slug));
  }
  await invalidatePattern(POST_LIST_PATTERN);

  res.status(200).json({ status: 'success', data: updatedPost });
});

export const deletePost = catchAsync(async (req: any, res: any, next: any) => {
  const { id } = req.params;
  const postId = Number(id);

  // 1. Tìm bài viết kèm media liên quan
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: { media: true },
  });
  if (!post) return next(new AppError('Không tìm thấy bài viết', 404));

  // 2. Kiểm tra quyền (Chỉ tác giả hoặc ADMIN)
  if (post.authorId !== req.user.id && req.user.role !== 'ADMIN') {
    return next(new AppError('Bạn không có quyền xóa bài này', 403));
  }

  // 3. Soft delete tất cả comment của bài viết
  await prisma.comment.updateMany({
    where: { postId },
    data: { deletedAt: new Date() },
  });

  // 4. Xóa media trên Cloudinary + DB
  if (post.media.length > 0) {
    await Promise.allSettled(
      post.media.map((m) => deleteFromCloudinary(m.publicId))
    );
    await prisma.media.deleteMany({ where: { postId } });
  }

  // 5. Xóa comments khỏi DB (đã soft delete ở trên, giờ xóa hẳn vì post bị xóa)
  await prisma.comment.deleteMany({ where: { postId } });

  // 6. Xóa bài viết (reactions cascade tự động nhờ onDelete: Cascade)
  await prisma.post.delete({ where: { id: postId } });

  await invalidateCache(getPostSlugKey(post.slug));
  await invalidatePattern(POST_LIST_PATTERN);

  res.status(204).json({ status: 'success', data: null });
});

export const getPostBySlug = catchAsync(async (req: any, res: any, next: any) => {
  const { slug } = req.params;
  const post = await prisma.post.findUnique({
    where: { slug },
    include: { author: { select: { name: true, email: true } } },
  });

  if (!post || (!post.published && post.authorId !== req.user?.id && req.user?.role !== 'ADMIN')) {
    return next(new AppError('Không tìm thấy bài viết', 404));
  }

  res.status(200).json({ status: 'success', data: post });
});