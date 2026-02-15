import request from 'supertest';
import app from '../src/app';
import { prisma } from '../src/lib/prisma';

describe('Comment API', () => {
  const userA = { name: 'CommentTestA', email: 'comment_a@test.com', password: 'password123' };
  const userB = { name: 'CommentTestB', email: 'comment_b@test.com', password: 'password123' };
  let tokenA: string;
  let tokenB: string;
  let postId: number;
  let commentId: number;
  let replyId: number;

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
        title: 'Bài viết test comment nha',
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
  // POST /api/v1/posts/:postId/comments — Tạo bình luận
  // ============================================================
  describe('POST /api/v1/posts/:postId/comments', () => {
    it('Nên từ chối nếu chưa đăng nhập (401)', async () => {
      const res = await request(app)
        .post(`/api/v1/posts/${postId}/comments`)
        .send({ content: 'Comment ẩn danh' });

      expect(res.status).toBe(401);
    });

    it('Nên từ chối nếu nội dung trống (400)', async () => {
      const res = await request(app)
        .post(`/api/v1/posts/${postId}/comments`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ content: '' });

      expect(res.status).toBe(400);
    });

    it('Nên tạo bình luận gốc thành công (201)', async () => {
      const res = await request(app)
        .post(`/api/v1/posts/${postId}/comments`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ content: 'Bình luận gốc từ UserA' });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data.content).toBe('Bình luận gốc từ UserA');
      expect(res.body.data.parentId).toBeNull();
      expect(res.body.data.postId).toBe(postId);

      commentId = res.body.data.id;
    });

    it('Nên tạo reply thành công (201) với parentId', async () => {
      const res = await request(app)
        .post(`/api/v1/posts/${postId}/comments`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ content: 'Reply từ UserB', parentId: commentId });

      expect(res.status).toBe(201);
      expect(res.body.data.parentId).toBe(commentId);

      replyId = res.body.data.id;
    });

    it('Nên từ chối reply nếu parent comment không tồn tại (404)', async () => {
      const res = await request(app)
        .post(`/api/v1/posts/${postId}/comments`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ content: 'Reply vào comment ma', parentId: 999999 });

      expect(res.status).toBe(404);
    });

    it('Nên từ chối nếu bài viết không tồn tại (404)', async () => {
      const res = await request(app)
        .post('/api/v1/posts/999999/comments')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ content: 'Comment vào bài ma' });

      expect(res.status).toBe(404);
    });

    it('Nên từ chối comment trên bài chưa publish (404)', async () => {
      // Tạo bài nháp
      const draftRes = await request(app)
        .post('/api/v1/posts')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          title: 'Bài nháp không nên comment',
          content: 'Nội dung đủ dài để pass Zod validation schema nhé.',
        });

      const res = await request(app)
        .post(`/api/v1/posts/${draftRes.body.data.id}/comments`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ content: 'Comment vào bài nháp' });

      expect(res.status).toBe(404);

      // Dọn dẹp bài nháp
      await prisma.post.delete({ where: { id: draftRes.body.data.id } });
    });
  });

  // ============================================================
  // GET /api/v1/posts/:postId/comments — Lấy danh sách bình luận
  // ============================================================
  describe('GET /api/v1/posts/:postId/comments', () => {
    it('Nên trả về danh sách comment gốc kèm replies (200)', async () => {
      const res = await request(app)
        .get(`/api/v1/posts/${postId}/comments`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body).toHaveProperty('total');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);

      // Comment gốc phải có replies
      const rootComment = res.body.data.find((c: any) => c.id === commentId);
      expect(rootComment).toBeDefined();
      expect(rootComment.replies.length).toBeGreaterThanOrEqual(1);
      expect(rootComment.replies[0].id).toBe(replyId);
    });

    it('Nên hỗ trợ phân trang (page & limit)', async () => {
      const res = await request(app)
        .get(`/api/v1/posts/${postId}/comments?page=1&limit=1`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeLessThanOrEqual(1);
    });

    it('Nên trả 404 nếu bài viết không tồn tại', async () => {
      const res = await request(app)
        .get('/api/v1/posts/999999/comments');

      expect(res.status).toBe(404);
    });
  });

  // ============================================================
  // DELETE /api/v1/comments/:commentId — Soft delete
  // ============================================================
  describe('DELETE /api/v1/comments/:commentId', () => {
    let commentToDeleteId: number;

    beforeAll(async () => {
      // Tạo comment riêng để test xóa
      const res = await request(app)
        .post(`/api/v1/posts/${postId}/comments`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ content: 'Comment sẽ bị xóa' });
      commentToDeleteId = res.body.data.id;
    });

    it('Nên từ chối nếu chưa đăng nhập (401)', async () => {
      const res = await request(app)
        .delete(`/api/v1/comments/${commentToDeleteId}`);

      expect(res.status).toBe(401);
    });

    it('Nên từ chối nếu không phải tác giả (403)', async () => {
      const res = await request(app)
        .delete(`/api/v1/comments/${commentToDeleteId}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect(res.status).toBe(403);
    });

    it('Nên soft delete thành công (200)', async () => {
      const res = await request(app)
        .delete(`/api/v1/comments/${commentToDeleteId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/đã được xóa/);

      // Xác nhận DB: deletedAt không null
      const deleted = await prisma.comment.findUnique({ where: { id: commentToDeleteId } });
      expect(deleted).not.toBeNull();
      expect(deleted!.deletedAt).not.toBeNull();
    });

    it('Comment đã soft delete hiển thị "[Bình luận đã bị xóa]" trong listing', async () => {
      const res = await request(app)
        .get(`/api/v1/posts/${postId}/comments`);

      const deletedComment = findCommentById(res.body.data, commentToDeleteId);
      expect(deletedComment).toBeDefined();
      expect(deletedComment!.content).toBe('[Bình luận đã bị xóa]');
    });

    it('Nên trả 404 khi xóa lại comment đã soft delete', async () => {
      const res = await request(app)
        .delete(`/api/v1/comments/${commentToDeleteId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(404);
    });

    it('Nên trả 404 nếu comment không tồn tại', async () => {
      const res = await request(app)
        .delete('/api/v1/comments/999999')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(404);
    });
  });

  // ============================================================
  // Edge case: reply vào comment đã bị soft delete
  // ============================================================
  describe('Reply vào comment đã soft delete', () => {
    it('Nên từ chối reply vào comment đã bị xóa (400)', async () => {
      // Tạo comment + soft delete
      const createRes = await request(app)
        .post(`/api/v1/posts/${postId}/comments`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ content: 'Comment sẽ bị xóa rồi bị reply' });
      const deletedId = createRes.body.data.id;

      await request(app)
        .delete(`/api/v1/comments/${deletedId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      // Thử reply
      const res = await request(app)
        .post(`/api/v1/posts/${postId}/comments`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ content: 'Reply vào đã xóa', parentId: deletedId });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/reply.*xóa/i);
    });
  });
});

// Helper: tìm comment theo ID trong tree (nested replies)
function findCommentById(comments: any[], id: number): any | undefined {
  for (const c of comments) {
    if (c.id === id) return c;
    if (c.replies) {
      const found = findCommentById(c.replies, id);
      if (found) return found;
    }
  }
  return undefined;
}
