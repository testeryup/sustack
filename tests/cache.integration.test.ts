/**
 * Integration tests — kiểm tra cache middleware hoạt động đúng trên Post endpoints.
 * Yêu cầu Redis chạy (dùng env thật hoặc test Redis).
 */
import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/lib/prisma';
import { redisClient, connectRedis } from '../src/lib/redis';

describe('Post Cache Integration', () => {
  const testUser = { name: 'CacheTest', email: 'cache_test@test.com', password: 'password123' };
  let token: string;
  let postId: number;
  let postSlug: string;

  beforeAll(async () => {
    // Kết nối Redis
    if (!redisClient.isOpen) {
      await connectRedis();
    }

    // Dọn dữ liệu cũ
    await prisma.reaction.deleteMany({ where: { user: { email: testUser.email } } });
    await prisma.comment.deleteMany({ where: { author: { email: testUser.email } } });
    await prisma.post.deleteMany({ where: { author: { email: testUser.email } } });
    await prisma.user.deleteMany({ where: { email: testUser.email } });

    // Tạo user + lấy token
    const res = await request(app).post('/api/v1/auth/signup').send(testUser);
    token = res.body.token;

    // Tạo 1 post published
    const postRes = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Cache Test Post Title',
        content: 'Nội dung đủ dài để pass Zod validation schema nha bạn.',
        published: true,
      });
    postId = postRes.body.data.id;
    postSlug = postRes.body.data.slug;
  });

  afterAll(async () => {
    // Dọn dữ liệu
    await prisma.reaction.deleteMany({ where: { user: { email: testUser.email } } });
    await prisma.comment.deleteMany({ where: { author: { email: testUser.email } } });
    await prisma.post.deleteMany({ where: { author: { email: testUser.email } } });
    await prisma.user.deleteMany({ where: { email: testUser.email } });

    // Dọn cache keys liên quan
    if (redisClient.isOpen) {
      const keys = await redisClient.keys('posts:*');
      const slugKeys = await redisClient.keys('post:slug:*');
      const allKeys = [...keys, ...slugKeys];
      if (allKeys.length > 0) await redisClient.del(allKeys);
      await redisClient.quit();
    }

    await prisma.$disconnect();
  });

  // ── GET /api/v1/posts — Cache list ──
  describe('GET /api/v1/posts (cache)', () => {
    it('lần đầu trả về data từ DB, lần 2 trả về từ cache (cùng kết quả)', async () => {
      // Lần 1: cache miss → query DB
      const res1 = await request(app).get('/api/v1/posts?page=1&limit=5');
      expect(res1.status).toBe(200);
      expect(res1.body.status).toBe('success');

      // Lần 2: cache hit → cùng kết quả
      const res2 = await request(app).get('/api/v1/posts?page=1&limit=5');
      expect(res2.status).toBe(200);
      expect(res2.body).toEqual(res1.body);
    });

    it('cache bị xóa sau khi tạo post mới (invalidation)', async () => {
      // Warm cache
      await request(app).get('/api/v1/posts?page=1&limit=5');

      // Kiểm tra cache tồn tại
      const cachedBefore = await redisClient.get('posts:list:page:1:limit:5');
      expect(cachedBefore).not.toBeNull();

      // Tạo post mới → invalidate cache
      const newPost = await request(app)
        .post('/api/v1/posts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Post Invalidation Test',
          content: 'Nội dung đủ dài để pass Zod validation schema nha bạn.',
          published: true,
        });

      // Cache đã bị xóa
      const cachedAfter = await redisClient.get('posts:list:page:1:limit:5');
      expect(cachedAfter).toBeNull();

      // Dọn post vừa tạo
      await prisma.post.delete({ where: { id: newPost.body.data.id } });
    });
  });

  // ── GET /api/v1/posts/:slug — Cache detail ──
  describe('GET /api/v1/posts/:slug (cache)', () => {
    it('cache data sau lần gọi đầu tiên', async () => {
      // Lần 1
      const res1 = await request(app).get(`/api/v1/posts/${postSlug}`);
      expect(res1.status).toBe(200);

      // Kiểm tra cache được set
      const cached = await redisClient.get(`post:slug:${postSlug}`);
      expect(cached).not.toBeNull();
      expect(JSON.parse(cached!)).toEqual(res1.body);
    });

    it('cache bị xóa sau khi update post (invalidation)', async () => {
      // Warm cache
      await request(app).get(`/api/v1/posts/${postSlug}`);

      // Update post
      await request(app)
        .patch(`/api/v1/posts/${postId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Nội dung đã cập nhật, đủ dài để pass Zod validation schema.' });

      // Cache cũ bị xóa
      const cached = await redisClient.get(`post:slug:${postSlug}`);
      expect(cached).toBeNull();
    });

    it('cache bị xóa sau khi delete post', async () => {
      // Tạo post tạm
      const tmp = await request(app)
        .post('/api/v1/posts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Temporary Post Delete Test',
          content: 'Nội dung đủ dài để pass Zod validation schema nha bạn.',
          published: true,
        });
      const tmpSlug = tmp.body.data.slug;

      // Warm cache
      await request(app).get(`/api/v1/posts/${tmpSlug}`);
      const cachedBefore = await redisClient.get(`post:slug:${tmpSlug}`);
      expect(cachedBefore).not.toBeNull();

      // Delete post
      await request(app)
        .delete(`/api/v1/posts/${tmp.body.data.id}`)
        .set('Authorization', `Bearer ${token}`);

      // Cache đã bị xóa
      const cachedAfter = await redisClient.get(`post:slug:${tmpSlug}`);
      expect(cachedAfter).toBeNull();
    });
  });
});
