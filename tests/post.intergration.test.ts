import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/lib/prisma';

describe('Post API', () => {
  // --- Setup: 2 users để test quyền ---
  const userA = { name: 'PostTestA', email: 'post_a@test.com', password: 'password123' };
  const userB = { name: 'PostTestB', email: 'post_b@test.com', password: 'password123' };
  let tokenA: string;
  let tokenB: string;

  // Lưu lại các post ID/slug tạo ra để dọn dẹp + dùng giữa các test
  let createdPostId: number;
  let createdPostSlug: string;

  beforeAll(async () => {
    // Dọn dẹp dữ liệu cũ (nếu test trước bị crash)
    await prisma.media.deleteMany({ where: { uploader: { email: { in: [userA.email, userB.email] } } } });
    await prisma.reaction.deleteMany({ where: { user: { email: { in: [userA.email, userB.email] } } } });
    await prisma.comment.deleteMany({ where: { author: { email: { in: [userA.email, userB.email] } } } });
    await prisma.post.deleteMany({ where: { author: { email: { in: [userA.email, userB.email] } } } });
    await prisma.user.deleteMany({ where: { email: { in: [userA.email, userB.email] } } });

    // Đăng ký 2 user
    const resA = await request(app).post('/api/v1/auth/signup').send(userA);
    tokenA = resA.body.token;

    const resB = await request(app).post('/api/v1/auth/signup').send(userB);
    tokenB = resB.body.token;
  });

  afterAll(async () => {
    await prisma.media.deleteMany({ where: { uploader: { email: { in: [userA.email, userB.email] } } } });
    await prisma.reaction.deleteMany({ where: { user: { email: { in: [userA.email, userB.email] } } } });
    await prisma.comment.deleteMany({ where: { author: { email: { in: [userA.email, userB.email] } } } });
    await prisma.post.deleteMany({ where: { author: { email: { in: [userA.email, userB.email] } } } });
    await prisma.user.deleteMany({ where: { email: { in: [userA.email, userB.email] } } });
    await prisma.$disconnect();
  });

  // ============================================================
  // POST /api/v1/posts — Tạo bài viết
  // ============================================================
  describe('POST /api/v1/posts', () => {
    it('Nên từ chối nếu chưa đăng nhập (401)', async () => {
      const res = await request(app)
        .post('/api/v1/posts')
        .send({ title: 'Tiêu đề bài viết test', content: 'Nội dung bài viết đủ dài để pass validation nha.' });

      expect(res.status).toBe(401);
    });

    it('Nên từ chối nếu thiếu/sai validation — tiêu đề quá ngắn (400)', async () => {
      const res = await request(app)
        .post('/api/v1/posts')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ title: 'Ngắn', content: 'Nội dung bài viết đủ dài để pass validation nha.' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Tiêu đề quá ngắn/);
    });

    it('Nên từ chối nếu nội dung quá ngắn (400)', async () => {
      const res = await request(app)
        .post('/api/v1/posts')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ title: 'Tiêu đề bài viết hợp lệ', content: 'Quá ngắn' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/Nội dung quá ngắn/);
    });

    it('Nên tạo bài viết thành công (201) + slug tự sinh', async () => {
      const res = await request(app)
        .post('/api/v1/posts')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          title: 'Tiêu đề bài viết test',
          content: 'Nội dung Markdown đủ dài để pass Zod validation schema.',
          published: true,
        });

      // Gán biến trước để tránh cascade fail nếu assertion sau lỗi
      createdPostId = res.body.data.id;
      createdPostSlug = res.body.data.slug;

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('slug');
      // slugify chuyển tiếng Việt: "đề" → "dje", nên chỉ check có suffix nanoid
      expect(res.body.data.slug).toMatch(/-[a-zA-Z0-9_-]{4}$/);
      expect(res.body.data.title).toBe('Tiêu đề bài viết test');
      expect(res.body.data.published).toBe(true);
    });

    it('Nên tạo bài nháp (published = false) mặc định', async () => {
      const res = await request(app)
        .post('/api/v1/posts')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          title: 'Bài viết nháp không publish',
          content: 'Nội dung đủ dài để pass validation schema Zod.',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.published).toBe(false);

      // Dọn dẹp bài nháp
      await prisma.post.delete({ where: { id: res.body.data.id } });
    });
  });

  // ============================================================
  // GET /api/v1/posts — Lấy danh sách bài viết (public)
  // ============================================================
  describe('GET /api/v1/posts', () => {
    it('Nên trả về danh sách bài viết published (200)', async () => {
      const res = await request(app).get('/api/v1/posts');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('results');
    });

    it('Nên hỗ trợ phân trang (page & limit)', async () => {
      const res = await request(app).get('/api/v1/posts?page=1&limit=1');

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeLessThanOrEqual(1);
    });

    it('Không trả về bài viết chưa publish cho public', async () => {
      // Tạo bài nháp
      const draft = await prisma.post.create({
        data: {
          title: 'Draft hidden',
          slug: 'draft-hidden-xyz',
          content: 'Nội dung chỉ tác giả thấy',
          published: false,
          authorId: (await prisma.user.findUnique({ where: { email: userA.email } }))!.id,
        },
      });

      const res = await request(app).get('/api/v1/posts');
      const slugs = res.body.data.map((p: any) => p.slug);
      expect(slugs).not.toContain('draft-hidden-xyz');

      await prisma.post.delete({ where: { id: draft.id } });
    });
  });

  // ============================================================
  // GET /api/v1/posts/:slug — Lấy chi tiết bài viết
  // ============================================================
  describe('GET /api/v1/posts/:slug', () => {
    it('Nên trả về bài viết published theo slug (200)', async () => {
      const res = await request(app).get(`/api/v1/posts/${createdPostSlug}`);

      expect(res.status).toBe(200);
      expect(res.body.data.slug).toBe(createdPostSlug);
      expect(res.body.data.author).toHaveProperty('name');
      expect(res.body.data.author).toHaveProperty('email');
      // Không lộ password
      expect(res.body.data.author).not.toHaveProperty('password');
    });

    it('Nên trả về 404 nếu slug không tồn tại', async () => {
      const res = await request(app).get('/api/v1/posts/slug-khong-ton-tai-abc');

      expect(res.status).toBe(404);
    });

    it('Nên ẩn bài nháp với người dùng ẩn danh (404)', async () => {
      // Tạo bài nháp
      const draft = await prisma.post.create({
        data: {
          title: 'Secret Draft',
          slug: 'secret-draft-xyz',
          content: 'Hidden content',
          published: false,
          authorId: (await prisma.user.findUnique({ where: { email: userA.email } }))!.id,
        },
      });

      const res = await request(app).get('/api/v1/posts/secret-draft-xyz');
      expect(res.status).toBe(404);

      await prisma.post.delete({ where: { id: draft.id } });
    });
  });

  // ============================================================
  // PATCH /api/v1/posts/:id — Cập nhật bài viết
  // ============================================================
  describe('PATCH /api/v1/posts/:id', () => {
    it('Nên từ chối nếu chưa đăng nhập (401)', async () => {
      const res = await request(app)
        .patch(`/api/v1/posts/${createdPostId}`)
        .send({ title: 'Title mới đủ dài nha bạn' });

      expect(res.status).toBe(401);
    });

    it('Nên từ chối nếu không phải tác giả (403)', async () => {
      const res = await request(app)
        .patch(`/api/v1/posts/${createdPostId}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ title: 'UserB cố sửa bài UserA' });

      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/không có quyền/);
    });

    it('Nên cập nhật thành công + sinh slug mới khi đổi tiêu đề (200)', async () => {
      const newTitle = 'Tiêu đề đã được cập nhật mới';
      const res = await request(app)
        .patch(`/api/v1/posts/${createdPostId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ title: newTitle });

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe(newTitle);
      // Slug phải thay đổi theo tiêu đề mới
      expect(res.body.data.slug).not.toBe(createdPostSlug);
      expect(res.body.data.slug).toMatch(/-[a-zA-Z0-9_-]{4}$/);

      // Cập nhật slug mới cho các test sau
      createdPostSlug = res.body.data.slug;
    });

    it('Nên cho phép cập nhật từng field riêng lẻ (partial update)', async () => {
      const res = await request(app)
        .patch(`/api/v1/posts/${createdPostId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ published: false });

      expect(res.status).toBe(200);
      expect(res.body.data.published).toBe(false);
      // Title không đổi
      expect(res.body.data.title).toBe('Tiêu đề đã được cập nhật mới');
    });

    it('Nên trả 404 nếu bài viết không tồn tại', async () => {
      const res = await request(app)
        .patch('/api/v1/posts/999999')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ title: 'Bài viết ảo không tồn tại' });

      expect(res.status).toBe(404);
    });

    it('Không cho phép inject authorId qua body (whitelist)', async () => {
      const userBRecord = await prisma.user.findUnique({ where: { email: userB.email } });

      const res = await request(app)
        .patch(`/api/v1/posts/${createdPostId}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ authorId: userBRecord!.id });

      expect(res.status).toBe(200);
      // authorId phải giữ nguyên, không bị đổi
      const post = await prisma.post.findUnique({ where: { id: createdPostId } });
      const userARecord = await prisma.user.findUnique({ where: { email: userA.email } });
      expect(post!.authorId).toBe(userARecord!.id);
    });
  });

  // ============================================================
  // DELETE /api/v1/posts/:id — Xóa bài viết
  // ============================================================
  describe('DELETE /api/v1/posts/:id', () => {
    let postToDeleteId: number;

    beforeAll(async () => {
      // Tạo bài riêng để test xóa
      const res = await request(app)
        .post('/api/v1/posts')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          title: 'Bài viết sẽ bị xóa nha',
          content: 'Nội dung đủ dài để pass Zod validation schema.',
          published: true,
        });
      postToDeleteId = res.body.data.id;
    });

    it('Nên từ chối nếu chưa đăng nhập (401)', async () => {
      const res = await request(app).delete(`/api/v1/posts/${postToDeleteId}`);
      expect(res.status).toBe(401);
    });

    it('Nên từ chối nếu không phải tác giả (403)', async () => {
      const res = await request(app)
        .delete(`/api/v1/posts/${postToDeleteId}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(403);
    });

    it('Nên trả 404 nếu bài viết không tồn tại', async () => {
      const res = await request(app)
        .delete('/api/v1/posts/999999')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(404);
    });

    it('Nên xóa thành công bởi tác giả (204)', async () => {
      const res = await request(app)
        .delete(`/api/v1/posts/${postToDeleteId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(204);

      // Xác nhận đã xóa trong DB
      const deleted = await prisma.post.findUnique({ where: { id: postToDeleteId } });
      expect(deleted).toBeNull();
    });
  });
});
