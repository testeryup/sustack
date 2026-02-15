import request from "supertest";
import app from '../src/app';
import { prisma } from '../src/lib/prisma';
import { be } from "zod/locales";
import { CLIENT_RENEG_LIMIT } from "node:tls";

describe('Authentication API', () => {
        const testUser = {
            name: 'User Test',
            email: 'test@example.com',
            password: 'password123',
        };
        beforeAll(async () => {
            // Clean up the test user if it already exists
            await prisma.user.deleteMany({
                where: {
                    email: testUser.email,
                },
            });
        });

        afterAll(async () => {
            // Clean up the test user after tests
            await prisma.user.deleteMany({
                where: {
                    email: testUser.email,
                },
            });
            await prisma.$disconnect();
        });

        describe('POST /api/v1/auth/signup', () => {
            it('Nên đăng ký thành công và trả về mã 201 cùng Token', async () => {
                const res = await request(app)
                    .post('/api/v1/auth/signup')
                    .set('Content-Type', 'application/json')
                    .send(testUser);

                expect(res.status).toBe(201);
                expect(res.body.status).toBe('success');
                expect(res.body).toHaveProperty('token');
                expect(res.body.data.user.email).toBe(testUser.email);
                expect(res.body.data.user).not.toHaveProperty('password');
            });

            it('Nên thất bại nếu email đã tồn tại (Lỗi P2002)', async () => {
                const res = await request(app)
                    .post('/api/v1/auth/signup')
                    .set('Content-Type', 'application/json')
                    .send(testUser);

                expect(res.status).toBe(400); // Mã lỗi từ Global Error Handler
                expect(res.body.message).toMatch(/đã tồn tại/);
            });
        });

        describe('POST /api/v1/auth/login', () => {
            it('Nên đăng nhập thành công với thông tin đúng', async () => {
                const res = await request(app)
                    .post('/api/v1/auth/login')
                    .set('Content-Type', 'application/json')
                    .send({
                        email: testUser.email,
                        password: testUser.password,
                    });

                expect(res.status).toBe(200);
                expect(res.body).toHaveProperty('token');
            });

            it('Nên bị từ chối với mật khẩu sai (Lỗi 401)', async () => {
                const res = await request(app)
                    .post('/api/v1/auth/login')
                    .set('Content-Type', 'application/json')
                    .send({
                        email: testUser.email,
                        password: 'wrongpassword',
                    });

                expect(res.status).toBe(401);
                expect(res.body.message).toBe('Thông tin đăng nhập không chính xác');
            });
        });
    }
)