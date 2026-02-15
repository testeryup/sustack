import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/lib/prisma';

describe('Reaction API', () => {
  const userA = { name: 'ReactTestA', email: 'react_a@test.com', password: 'password123' };
  const userB = { name: 'ReactTestB', email: 'react_b@test.com', password: 'password123' };
  let tokenA: string;
  let tokenB: string;
  let postId: number;

  beforeAll(async () => {
    // Dọn dẹp dữ liệu cũ
    await prisma.reaction.deleteMany({ where: { user: { email: { in: [userA.email, userB.email] } } } });
    await prisma.comment.deleteMany({ where: { author: { email: { in: [userA.email, userB.email] } } } });
    await prisma.media.deleteMany({ where: { uploader: { email: { in: [userA.email, userB.email] } } } });
    await prisma.post.deleteMany({ where: { author: { email: { in: [userA.email, userB.email] } } } });
    await prisma.user.deleteMany({ where: { email: { in: [userA.email, userB.email] } } });

    // Đăng ký users
    const resA = await request(app).post('/api/v1/auth/signup').send(userA);
    tokenA = resA.body.token;
    const resB = await request(app).post('/api/v1/auth/signup').send(userB);
    tokenB = resB.body.token;

    // Tạo bài viết published
    const postRes = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        title: 'Bài viết test reaction nha',
        content: 'Nội dung đủ dài để pass Zod validation schema nhé bạn.',
        published: true,
      });
    postId = postRes.body.data.id;
  });

  afterAll(async () => {
    await prisma.reaction.deleteMany({ where: { user: { email: { in: [userA.email, userB.email] } } } });
    await prisma.comment.deleteMany({ where: { author: { email: { in: [userA.email, userB.email] } } } });
    await prisma.media.deleteMany({ where: { uploader: { email: { in: [userA.email, userB.email] } } } });
    await prisma.post.deleteMany({ where: { author: { email: { in: [userA.email, userB.email] } } } });
    await prisma.user.deleteMany({ where: { email: { in: [userA.email, userB.email] } } });
    await prisma.$disconnect();
  });

  // ============================================================
  // POST /api/v1/posts/:postId/reactions — Toggle Reaction
  // ============================================================
  describe('POST /api/v1/posts/:postId/reactions', () => {
    it('Nên từ chối nếu chưa đăng nhập (401)', async () => {
      const res = await request(app)
        .post(`/api/v1/posts/${postId}/reactions`)
        .send({ type: 'LIKE' });

      expect(res.status).toBe(401);
    });

    it('Nên từ chối nếu type không hợp lệ (400)', async () => {
      const res = await request(app)
        .post(`/api/v1/posts/${postId}/reactions`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ type: 'LOVE' });

      expect(res.status).toBe(400);
    });

    it('Nên tạo LIKE thành công (201) + tăng likeCount', async () => {
      const res = await request(app)
        .post(`/api/v1/posts/${postId}/reactions`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ type: 'LIKE' });

      expect(res.status).toBe(201);
      expect(res.body.action).toBe('created');
      expect(res.body.data.type).toBe('LIKE');

      // Kiểm tra likeCount tăng
      const post = await prisma.post.findUnique({ where: { id: postId } });
      expect(post!.likeCount).toBe(1);
      expect(post!.dislikeCount).toBe(0);
    });

    it('Nên toggle off khi LIKE lần nữa (200, removed) + giảm likeCount', async () => {
      const res = await request(app)
        .post(`/api/v1/posts/${postId}/reactions`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ type: 'LIKE' });

      expect(res.status).toBe(200);
      expect(res.body.action).toBe('removed');
      expect(res.body.data).toBeNull();

      const post = await prisma.post.findUnique({ where: { id: postId } });
      expect(post!.likeCount).toBe(0);
    });

    it('Nên switch từ LIKE sang DISLIKE (200, switched)', async () => {
      // Tạo LIKE trước
      await request(app)
        .post(`/api/v1/posts/${postId}/reactions`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ type: 'LIKE' });

      // Switch sang DISLIKE
      const res = await request(app)
        .post(`/api/v1/posts/${postId}/reactions`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ type: 'DISLIKE' });

      expect(res.status).toBe(200);
      expect(res.body.action).toBe('switched');
      expect(res.body.data.type).toBe('DISLIKE');

      const post = await prisma.post.findUnique({ where: { id: postId } });
      expect(post!.likeCount).toBe(0);
      expect(post!.dislikeCount).toBe(1);
    });

    it('Nhiều user react cùng bài → counters đúng', async () => {
      // Hiện tại: userA đã DISLIKE → dislikeCount = 1
      // userB LIKE
      await request(app)
        .post(`/api/v1/posts/${postId}/reactions`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ type: 'LIKE' });

      const post = await prisma.post.findUnique({ where: { id: postId } });
      expect(post!.likeCount).toBe(1);   // userB
      expect(post!.dislikeCount).toBe(1); // userA
    });

    it('Nên trả 404 cho bài viết không tồn tại', async () => {
      const res = await request(app)
        .post('/api/v1/posts/999999/reactions')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ type: 'LIKE' });

      expect(res.status).toBe(404);
    });
  });

  // ============================================================
  // GET /api/v1/posts/:postId/reactions/me — Lấy reaction hiện tại
  // ============================================================
  describe('GET /api/v1/posts/:postId/reactions/me', () => {
    it('Nên trả về reaction hiện tại của user', async () => {
      const res = await request(app)
        .get(`/api/v1/posts/${postId}/reactions/me`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.data).not.toBeNull();
      expect(res.body.data.type).toBe('DISLIKE'); // Từ test switch ở trên
    });

    it('Nên trả null nếu user chưa react', async () => {
      // Tạo post mới mà chưa ai react
      const newPost = await request(app)
        .post('/api/v1/posts')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          title: 'Bài viết chưa có ai reaction',
          content: 'Nội dung đủ dài để pass Zod validation schema nhé.',
          published: true,
        });

      const res = await request(app)
        .get(`/api/v1/posts/${newPost.body.data.id}/reactions/me`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeNull();

      // Dọn dẹp
      await prisma.post.delete({ where: { id: newPost.body.data.id } });
    });
  });
});
