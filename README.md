# Sustack — Blog REST API

Backend API cho nền tảng blog, hỗ trợ đầy đủ chức năng bài viết, bình luận đa cấp, reaction (like/dislike), quản lý media qua Cloudinary, xác thực JWT với blacklist token trên Redis và caching layer.

> **Live URL**: [https://sustack-backend.onrender.com](https://sustack-backend.onrender.com)

Tài khoản đăng nhập mặc định đã được nhập sẵn ở route login

Report (ngắn gọn): `https://drive.google.com/file/d/1afa1zflhMYO36mOAXc1Q_WkH9MNOJK8d/view?usp=sharing`

## Mục lục

- [Tech Stack](#tech-stack)
- [Kiến trúc dự án](#kiến-trúc-dự-án)
- [Cài đặt & Chạy](#cài-đặt--chạy)
- [Biến môi trường](#biến-môi-trường)
- [Database Schema](#database-schema)
- [API Endpoints](#api-endpoints)
  - [Auth](#auth)
  - [Posts](#posts)
  - [Comments](#comments)
  - [Reactions](#reactions)
  - [Media](#media)
- [Xác thực & Phân quyền](#xác-thực--phân-quyền)
- [Caching](#caching)
- [Background Jobs](#background-jobs)
- [Validation](#validation)
- [Error Handling](#error-handling)
- [Swagger UI](#swagger-ui)
- [Testing](#testing)
- [Docker & Deployment](#docker--deployment)

---

## Tech Stack

| Layer | Công nghệ |
|-------|-----------|
| Runtime | Node.js 20 + TypeScript (ESM) |
| Framework | Express 5 |
| ORM | Prisma 7 (PostgreSQL, `@prisma/adapter-pg`) |
| Database | PostgreSQL 15 — hosted trên **Supabase** (connection pooling via PgBouncer) |
| Cache / Token Blacklist | Redis 5 — hosted trên **Redis Cloud** |
| Auth | JWT (`jsonwebtoken`) + bcryptjs |
| Validation | Zod 4 |
| Media Storage | Cloudinary |
| Upload | Multer (memory storage) |
| Background Jobs | `piscina` (Worker Thread Pool) + `node-cron` |
| Markdown AST | `unified` + `remark-parse` + `unist-util-visit` |
| Security | Helmet, CORS, express-rate-limit |
| Testing | Jest 30 + ts-jest + Supertest |
| Containerization | Docker (multi-stage build) |
| Deployment | Render (Web Service) |

---

## Kiến trúc dự án

```
sustack/
├── server.ts                 # Entry point — khởi tạo Redis, Task Runner, Cron, listen
├── src/
│   ├── app.ts                # Express app — middleware stack, route mounts
│   ├── controllers/          # Request handlers (business logic)
│   │   ├── auth.controller.ts
│   │   ├── post.controller.ts
│   │   ├── comment.controller.ts
│   │   ├── reaction.controller.ts
│   │   └── media.controller.ts
│   ├── routes/               # Route definitions
│   │   ├── auth.route.ts
│   │   ├── post.route.ts     # Mount nested comment & reaction routers
│   │   ├── comment.route.ts
│   │   ├── reaction.route.ts
│   │   └── media.route.ts
│   ├── middlewares/
│   │   ├── auth.middleware.ts     # JWT verify + blacklist check
│   │   ├── cache.middleware.ts    # Read-through Redis cache
│   │   ├── error.middleware.ts    # Global error handler
│   │   ├── restrict.middleware.ts # Role-based authorization
│   │   ├── upload.middleware.ts   # Multer config (5 MB, image only)
│   │   └── validate.middleware.ts # Zod schema validation
│   ├── services/
│   │   ├── cache.service.ts       # Redis CRUD + token blacklist
│   │   ├── media.service.ts       # Cloudinary upload/delete + DB operations
│   │   └── cron.service.ts        # Scheduled cleanup jobs (node-cron)
│   ├── workers/
│   │   ├── ast-worker.ts          # Worker Thread — parse Markdown AST (remark), extract image publicIds
│   │   └── task-runner.ts         # Task Runner — Piscina pool, quét bảng Task, gọi syncMediaStatus()
│   ├── schemas/              # Zod validation schemas
│   │   ├── user.schema.ts
│   │   ├── post.schema.ts
│   │   ├── comment.schema.ts
│   │   └── reaction.schema.ts
│   ├── utils/
│   │   ├── appError.ts       # Custom AppError class
│   │   ├── catchAsync.ts     # Async error wrapper
│   │   ├── cacheKeys.ts      # Cache key generators
│   │   ├── jwt.ts            # signToken / verifyToken
│   │   └── password.ts       # hashPassword / comparePassword
│   └── lib/
│       ├── prisma.ts         # Prisma client singleton
│       └── redis.ts          # Redis client + connect
├── prisma/
│   ├── schema.prisma         # Database schema
│   └── migrations/           # SQL migrations
├── generated/prisma/         # Prisma generated client
├── tests/                    # Test suite
│   ├── auth.test.ts          # Unit tests (mocked)
│   ├── authentication.test.ts # Integration tests
│   ├── post.test.ts
│   ├── comment.test.ts
│   ├── reaction.test.ts
│   ├── cache.test.ts         # Cache service unit tests
│   └── cache-integration.test.ts
├── Dockerfile                # Multi-stage Docker build
├── docker-compose.yml        # Local Docker orchestration
├── .dockerignore
├── jest.config.cjs
├── tsconfig.json
├── prisma.config.ts
└── package.json
```
### Use Case Diagram

```mermaid
flowchart LR
    subgraph Actors
        Guest(("Guest"))
        User(("User"))
        Admin(("Admin"))
    end

    subgraph Auth["Authentication"]
        A1["Đăng ký tài khoản"]
        A2["Đăng nhập"]
        A3["Đăng xuất\n(Blacklist Token)"]
    end

    subgraph Posts["Posts"]
        P1["Xem danh sách bài viết"]
        P2["Xem chi tiết bài viết\n(theo slug)"]
        P3["Tạo bài viết\n(Markdown + SEO slug)"]
        P4["Sửa bài viết\n(chỉ tác giả)"]
        P5["Xóa bài viết\n(cascade comments,\nreactions, media)"]
    end

    subgraph Comments["Comments"]
        C1["Xem bình luận\n(phân trang)"]
        C2["Tạo bình luận"]
        C3["Reply bình luận\n(đa cấp)"]
        C4["Xóa bình luận\n(Soft Delete)"]
    end

    subgraph Reactions["Reactions"]
        R1["Toggle Like/Dislike\n(3 trạng thái)"]
        R2["Xem reaction hiện tại"]
    end

    subgraph Media["Media (Two-Phase Upload)"]
        M1["Phase 1: Upload ảnh\n(PENDING — Cloudinary, max 5MB)"]
        M2["Xem ảnh PENDING (orphan)"]
        M3["Xóa ảnh"]
        M4["Dọn ảnh PENDING thủ công"]
        M5["Phase 2: Publish Post\n→ Task Runner gắn ảnh\n(PENDING → ATTACHED)"]
    end

    Guest --> A1
    Guest --> A2
    Guest --> P1
    Guest --> P2
    Guest --> C1

    User --> A3
    User --> P3
    User --> P4
    User --> P5
    User --> C2
    User --> C3
    User --> C4
    User --> R1
    User --> R2
    User --> M1
    User --> M2
    User --> M3
    User --> M5

    Admin -.->|"Sửa/Xóa\nbài viết bất kỳ"| P4
    Admin -.->|"Sửa/Xóa\nbài viết bất kỳ"| P5
    Admin -.->|"Xóa bình luận\nbất kỳ"| C4
    Admin -->|"Admin Only"| M4
```

---

## Cài đặt & Chạy

### Yêu cầu

- Node.js ≥ 20
- PostgreSQL (hoặc tài khoản [Supabase](https://supabase.com))
- Redis (hoặc tài khoản [Redis Cloud](https://redis.io/cloud/))
- Tài khoản [Cloudinary](https://cloudinary.com)
- Docker (optional, cho deployment)

### Cài đặt local

```bash
# Clone repo
git clone <repo-url>
cd sustack

# Cài dependencies
npm install

# Tạo file .env (xem phần Biến môi trường)
cp .env.example .env

# Generate Prisma client
npx prisma generate

# Chạy migration
npx prisma migrate deploy
```

### Chạy

```bash
# Development (hot reload)
npm run dev

# Build production
npm run build

# Test
npm test
```

### Chạy với Docker

```bash
# Build và chạy
docker-compose up --build

# Chạy nền
docker-compose up --build -d

# Xem logs
docker-compose logs -f app

# Dừng
docker-compose down
```

---

## Biến môi trường

| Biến | Mô tả | Ví dụ |
|------|--------|-------|
| `DATABASE_URL` | PostgreSQL connection string (pooling) | `postgresql://user:pass@host:5432/db?pgbouncer=true` |
| `DIRECT_URL` | Direct connection (dùng cho migration) | `postgresql://user:pass@host:5432/db` |
| `REDIS_HOST` | Redis Cloud host | `redis-xxxxx.cloud.redislabs.com` |
| `REDIS_PORT` | Redis port | `10393` |
| `REDIS_USERNAME` | Redis username | `default` |
| `REDIS_PASSWORD` | Redis password | — |
| `JWT_SECRET` | Secret key cho JWT (≥ 32 ký tự random) | `my-super-secret-key` |
| `JWT_EXPIRES_IN` | Thời gian hết hạn JWT | `1d` |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | `my-cloud` |
| `CLOUDINARY_API_KEY` | Cloudinary API key | `123456789` |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | `abc-xyz` |
| `PORT` | Port server (default 3000) | `3000` |
| `NODE_ENV` | Environment | `development` / `production` |

> **Lưu ý Supabase**: `DATABASE_URL` dùng pooling connection (qua PgBouncer, port 6543 hoặc 5432 tuỳ config). `DIRECT_URL` dùng direct connection cho `prisma migrate deploy`.

---

## Database Schema

### Chi tiết
![database](https://github.com/testeryup/sustack/blob/main/images/database.png)

### Entity Relationship

```
User 1──n Post
User 1──n Comment
User 1──n Reaction
User 1──n Media

Post 1──n Comment
Post 1──n Reaction
Post 1──n Media (onDelete: SetNull — Media.postId → null khi Post bị xóa)

Comment 1──n Comment (self-relation: replies)

Task (độc lập — Outbox, không có FK)
```

### Models

#### User

| Field | Type | Mô tả |
|-------|------|--------|
| `id` | `Int` (PK, auto) | |
| `email` | `String` (unique) | |
| `password` | `String` | Bcrypt hash |
| `name` | `String` | |
| `role` | `UserRole` | `USER` (default) \| `ADMIN` |

#### Post

| Field | Type | Mô tả |
|-------|------|--------|
| `id` | `Int` (PK, auto) | |
| `title` | `String` | |
| `slug` | `String` (unique) | SEO-friendly URL, auto-generated |
| `content` | `Text` | Markdown thô |
| `thumbnail` | `String?` | URL ảnh từ Cloudinary |
| `published` | `Boolean` | Default `false` (nháp) |
| `likeCount` | `Int` | Cached counter cho SSR |
| `dislikeCount` | `Int` | Cached counter cho SSR |
| `authorId` | `Int` (FK → User) | |
| `createdAt` | `DateTime` | |
| `updatedAt` | `DateTime` | |

#### Comment

| Field | Type | Mô tả |
|-------|------|--------|
| `id` | `Int` (PK, auto) | |
| `content` | `String` | Plain text |
| `postId` | `Int` (FK → Post) | |
| `authorId` | `Int` (FK → User) | |
| `parentId` | `Int?` (FK → Comment) | Self-relation cho reply đa cấp |
| `deletedAt` | `DateTime?` | Soft delete — hiển thị `[Bình luận đã bị xóa]` |
| `createdAt` | `DateTime` | |

#### Reaction

| Field | Type | Mô tả |
|-------|------|--------|
| `id` | `Int` (PK, auto) | |
| `type` | `ReactionType` | `LIKE` \| `DISLIKE` |
| `userId` | `Int` (FK → User) | |
| `postId` | `Int` (FK → Post, cascade delete) | |
| `createdAt` | `DateTime` | |

> Unique constraint: `[userId, postId]` — mỗi user chỉ 1 reaction/bài.

#### Media

| Field | Type | Mô tả |
|-------|------|--------|
| `id` | `Int` (PK, auto) | |
| `url` | `String` | Secure URL từ Cloudinary |
| `publicId` | `String` (unique) | ID trên Cloudinary |
| `format` | `String?` | jpg, png, webp... |
| `width` | `Int?` | Pixel |
| `height` | `Int?` | Pixel |
| `bytes` | `Int?` | Kích thước file |
| `status` | `MediaStatus` | `PENDING` (default) \| `ATTACHED` — xem Two-Phase Upload |
| `uploaderId` | `Int` (FK → User) | |
| `postId` | `Int?` (FK → Post, SET NULL) | `null` = PENDING (orphan/nháp) |
| `createdAt` | `DateTime` | |

#### Task

Bảng Outbox — lưu các công việc xử lý ngầm cần thực hiện.

| Field | Type | Mô tả |
|-------|------|--------|
| `id` | `Int` (PK, auto) | |
| `type` | `String` | Loại task, ví dụ: `SYNC_MEDIA` |
| `status` | `TaskStatus` | `PENDING` → `PROCESSING` → `COMPLETED` \| `FAILED` |
| `payload` | `Json` | Dữ liệu task, ví dụ: `{ content, postId, userId }` |
| `createdAt` | `DateTime` | |
| `updatedAt` | `DateTime` | |

---

## API Endpoints

Base URL: `/api/v1`

### Auth

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|--------|
| `POST` | `/auth/signup` | ❌ | Đăng ký tài khoản |
| `POST` | `/auth/login` | ❌ | Đăng nhập |
| `POST` | `/auth/logout` | ✅ | Đăng xuất (blacklist token) |

#### `POST /auth/signup`

**Request body:**

```json
{
  "name": "Nguyen Van A",
  "email": "a@example.com",
  "password": "matkhau123"
}
```

**Validation:**
- `name`: 6–25 ký tự
- `email`: email hợp lệ
- `password`: 6–25 ký tự

**Response (201):**

```json
{
  "status": "success",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "data": {
    "user": {
      "id": 1,
      "name": "Nguyen Van A",
      "email": "a@example.com",
      "role": "USER"
    }
  }
}
```

#### `POST /auth/login`

**Request body:**

```json
{
  "email": "a@example.com",
  "password": "matkhau123"
}
```

**Response (200):** Giống signup.

**Lỗi (401):** `"Thông tin đăng nhập không chính xác"`

#### `POST /auth/logout`

**Headers:** `Authorization: Bearer <token>`

**Response (200):**

```json
{
  "status": "success",
  "message": "Đăng xuất thành công"
}
```

Token sẽ bị blacklist trong Redis với TTL bằng thời gian còn lại của JWT. Mọi request tiếp theo với token này sẽ bị từ chối (401).

---

### Posts

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|--------|
| `GET` | `/posts` | ❌ | Danh sách bài viết (published) |
| `GET` | `/posts/:slug` | ❌ | Chi tiết bài viết theo slug |
| `POST` | `/posts` | ✅ | Tạo bài viết |
| `PATCH` | `/posts/:id` | ✅ | Cập nhật bài viết (tác giả/admin) |
| `DELETE` | `/posts/:id` | ✅ | Xóa bài viết (tác giả/admin) |

#### `GET /posts`

**Query params:**

| Param | Type | Default | Mô tả |
|-------|------|---------|--------|
| `page` | int | 1 | Trang hiện tại |
| `limit` | int | 10 | Số bài/trang |

**Response (200):**

```json
{
  "status": "success",
  "results": 2,
  "data": {
    "posts": [
      {
        "id": 1,
        "title": "Tiêu đề bài viết",
        "slug": "tieu-de-bai-viet-a1b2",
        "content": "Nội dung markdown...",
        "thumbnail": "https://res.cloudinary.com/...",
        "published": true,
        "likeCount": 5,
        "dislikeCount": 0,
        "author": { "id": 1, "name": "Nguyen Van A" },
        "createdAt": "2026-02-15T00:00:00.000Z",
        "updatedAt": "2026-02-15T00:00:00.000Z"
      }
    ]
  }
}
```

> Response được cache 600 giây (10 phút). Cache tự động invalidate khi tạo/sửa/xóa bài.

#### `GET /posts/:slug`

> Cache 3600 giây (1 giờ). Bài chưa publish chỉ hiển thị cho tác giả/admin.

#### `POST /posts`

**Headers:** `Authorization: Bearer <token>`

**Request body:**

```json
{
  "title": "Tiêu đề bài viết dài hơn 10 ký tự",
  "content": "Nội dung markdown, có thể chứa ảnh: ![alt](https://res.cloudinary.com/...)",
  "thumbnail": "https://res.cloudinary.com/...",
  "published": false
}
```

**Validation:**
- `title`: 10–100 ký tự
- `content`: ≥ 20 ký tự
- `thumbnail`: URL hợp lệ (optional)
- `published`: boolean (optional, default `false`)

Slug tự sinh từ title + nanoid(4), ví dụ: `tieu-de-bai-viet-a1b2`.

**Two-Phase Upload:** Sau khi tạo post, server tạo Task `SYNC_MEDIA` trong cùng Transaction. Task Runner sẽ xử lý ngầm để gắn ảnh vào post (xem [Two-Phase Upload](#two-phase-upload-giống-medium)).

#### `PATCH /posts/:id`

Cập nhật partial — chỉ gửi field cần thay đổi. Slug tự tái sinh khi đổi title. Chỉ tác giả hoặc admin.

#### `DELETE /posts/:id`

Xóa bài viết cùng toàn bộ comments, reactions (cascade), media (Cloudinary + DB). Chỉ tác giả hoặc admin.

---

### Comments

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|--------|
| `GET` | `/posts/:postId/comments` | ❌ | Danh sách comment (phân trang) |
| `POST` | `/posts/:postId/comments` | ✅ | Tạo comment / reply |
| `DELETE` | `/comments/:commentId` | ✅ | Soft delete comment |

#### `GET /posts/:postId/comments`

**Query params:** `page` (default 1), `limit` (default 10, max 50)

Trả về comment gốc (root) kèm 2 cấp replies. Comment đã xóa hiển thị `[Bình luận đã bị xóa]` để giữ thread liền mạch.

#### `POST /posts/:postId/comments`

**Request body:**

```json
{
  "content": "Nội dung bình luận",
  "parentId": 5
}
```

- `content`: 1–2000 ký tự
- `parentId`: optional — ID comment cha để tạo reply
- Không cho reply vào comment đã bị soft delete
- Post phải tồn tại và đã published

#### `DELETE /comments/:commentId`

Soft delete — set `deletedAt`, nội dung hiển thị `[Bình luận đã bị xóa]`. Chỉ tác giả hoặc admin.

---

### Reactions

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|--------|
| `POST` | `/posts/:postId/reactions` | ✅ | Toggle reaction |
| `GET` | `/posts/:postId/reactions/me` | ✅ | Reaction hiện tại của user |

#### `POST /posts/:postId/reactions`

**Request body:**

```json
{
  "type": "LIKE"
}
```

**Cơ chế toggle 3 trạng thái (transaction):**

| Trạng thái | Hành vi | Response |
|------------|---------|----------|
| Chưa reaction | Tạo mới + tăng counter | `201 created` |
| Đã LIKE → gửi LIKE | Xóa reaction + giảm counter | `200 removed` |
| Đã LIKE → gửi DISLIKE | Switch type + cập nhật cả 2 counter | `200 switched` |

#### `GET /posts/:postId/reactions/me`

Trả về reaction hiện tại (`{ type: "LIKE" }`) hoặc `null`.

---

### Media

| Method | Endpoint | Auth | Mô tả |
|--------|----------|------|--------|
| `POST` | `/media/upload` | ✅ | Upload ảnh → trạng thái PENDING (Phase 1) |
| `GET` | `/media/orphan` | ✅ | Ảnh PENDING chưa gắn bài viết |
| `DELETE` | `/media/:id` | ✅ | Xóa ảnh |
| `DELETE` | `/media/cleanup/orphan` | ✅ Admin | Dọn ảnh PENDING thủ công |

#### Two-Phase Upload (giống Medium)

```
Phase 1 — Upload:
  Client → POST /media/upload
        ← { url, publicId, status: "PENDING", postId: null }

Phase 2 — Publish:
  Client → POST /posts { title, content: "...![alt](url)...", published: true }
        ← 201 (response ngay lập tức)

  Background (async):
    Transaction → tạo Post + Task (SYNC_MEDIA) atomically
    Task Runner (setInterval 10s) → lấy Task PENDING
    Piscina Worker Pool → parse AST Markdown (remark)
                       → trích xuất publicIds từ image nodes
    syncMediaStatus() → Transaction:
      1. Detach ảnh cũ của post (ATTACHED → PENDING, postId: null)
      2. Attach ảnh mới (PENDING → ATTACHED, postId: X)
         — chỉ ảnh thuộc về chủ bài viết

Cleanup (Cron 2h sáng):
  Ảnh PENDING + postId: null + createdAt < 24h trước
  → xóa khỏi Cloudinary (batch API) + DB
```

#### `POST /media/upload`

**Content-Type:** `multipart/form-data`

| Field | Type | Mô tả |
|-------|------|--------|
| `image` | File | Ảnh (jpg/png/webp...), max 5 MB |

**Response (201):**

```json
{
  "status": "success",
  "data": {
    "id": 1,
    "url": "https://res.cloudinary.com/demo/image/upload/sustack_blog/abc123.jpg",
    "publicId": "sustack_blog/abc123",
    "format": "jpg",
    "width": 1920,
    "height": 1080,
    "bytes": 245000,
    "status": "PENDING",
    "postId": null
  }
}
```

#### `GET /media/orphan`

Trả về ảnh có `status: PENDING` và `postId: null` của user hiện tại. Hữu ích để hiển thị ảnh nháp.

#### `DELETE /media/cleanup/orphan`

**Query:** `?hours=24` (default 24). Admin only. Cron job cũng chạy logic tương tự tự động lúc 2h sáng.

---

## Xác thực & Phân quyền

### JWT Authentication

1. Đăng nhập/đăng ký → nhận JWT token
2. Gửi token trong header: `Authorization: Bearer <token>`
3. Middleware `protect` xác thực:
   - Kiểm tra token có trong Redis blacklist không
   - Verify JWT signature + expiry
   - Load user từ DB, gán vào `req.user`

### Token Blacklist (Logout)

Khi logout, token được thêm vào Redis với key `blacklist:token:<token>` và TTL bằng thời gian còn lại của JWT. Token đã blacklist sẽ bị từ chối ở bước đầu tiên của middleware `protect`.

### Phân quyền

- **`protect`**: Yêu cầu đăng nhập (bất kỳ role nào)
- **`restrictTo('ADMIN')`**: Chỉ cho phép role ADMIN
- **Ownership check**: Sửa/xóa bài viết, comment chỉ cho phép tác giả hoặc admin (kiểm tra trong controller)

---

## Caching

Sử dụng Redis làm read-through cache layer cho các endpoint GET.

### Cơ chế

1. Middleware `cache(keyGenerator, ttl)` kiểm tra Redis
2. **Cache hit** → trả response ngay từ Redis
3. **Cache miss** → tiếp tục xử lý, intercept `res.json()` để cache response (chỉ status 200)

### Cache Keys

| Key Pattern | TTL | Endpoint |
|-------------|-----|----------|
| `posts:list:page:{p}:limit:{l}` | 600s (10 phút) | `GET /posts` |
| `post:slug:{slug}` | 3600s (1 giờ) | `GET /posts/:slug` |
| `blacklist:token:{token}` | JWT remaining TTL | Token blacklist |

### Invalidation

Cache tự động xóa khi:
- **Tạo bài viết** → invalidate `posts:list:*` (pattern)
- **Sửa bài viết** → invalidate `posts:list:*` + `post:slug:{old}` + `post:slug:{new}`
- **Xóa bài viết** → invalidate `posts:list:*` + `post:slug:{slug}`

Tất cả cache operations đều fail gracefully — nếu Redis down, app vẫn hoạt động bình thường.

---

## Background Jobs

Hệ thống xử lý ngầm gồm hai thành phần: **Task Runner** (Worker Pool) và **Cron Jobs**.

### Transaction Outbox + Worker Pool (Task Runner)

**Vấn đề cần giải quyết:** Sau khi user tạo/sửa bài viết chứa ảnh Markdown, cần parse AST để biết ảnh nào cần gắn vào bài — nhưng đây là tác vụ CPU-intensive, không nên chạy trên main event loop của Node.js.

**Giải pháp:** Transaction Outbox Pattern + Piscina Worker Pool.

```
POST /posts
  │
  ├── prisma.$transaction()
  │     ├── post.create(...)             ← tạo bài viết
  │     └── task.create({ SYNC_MEDIA })  ← ghi Task vào DB atomically
  │
  └── Response 201 (trả về ngay)

  Background (task-runner.ts — setInterval 10s):
    ┌─────────────────────────────────────────┐
    │  Quét Task PENDING (FIFO)               │
    │  → updateMany status: PROCESSING        │  ← atomic claim, tránh race condition
    │  → piscina.run({ content })             │
    │       ↓ Worker Thread (ast-worker.ts)   │
    │       unified + remark-parse            │
    │       visit(tree, 'image', ...)         │
    │       return publicIds[]               │
    │  → syncMediaStatus(publicIds, payload)  │
    │       Transaction:                      │
    │       1. Detach ảnh cũ → PENDING        │
    │       2. Attach ảnh mới → ATTACHED      │
    │          (chỉ ảnh của chủ bài viết)     │
    │  → update Task: COMPLETED / FAILED      │
    └─────────────────────────────────────────┘
```

**Worker Pool config (`Piscina`):**

| Param | Giá trị | Lý do |
|-------|---------|-------|
| `minThreads` | 1 | Luôn sẵn 1 thread |
| `maxThreads` | 2 | Giới hạn CPU, không làm treo server Render |
| `idleTimeout` | 30s | Thread tắt nếu không dùng → tiết kiệm RAM |

### Cron Jobs (cron.service.ts)

| Lịch | Việc | Chi tiết |
|------|------|----------|
| `0 2 * * *` (2h sáng) | Dọn ảnh PENDING > 24h | Xóa khỏi Cloudinary (`delete_resources` batch) + DB |
| `0 3 * * *` (3h sáng) | Dọn Task cũ > 7 ngày | Xóa Task `COMPLETED`/`FAILED` khỏi DB |

---

## Validation

Sử dụng **Zod** qua middleware `validate(schema)`. Schema validate `{ body, query, params }`.

| Schema | Field | Rules |
|--------|-------|-------|
| **userRegister** | `name` | string, 6–25 |
| | `email` | email hợp lệ |
| | `password` | string, 6–25 |
| **userLogin** | `email` | email hợp lệ |
| | `password` | string, 6–25 |
| **post** | `title` | string, 10–100 |
| | `content` | string, ≥ 20 |
| | `thumbnail` | url, optional |
| | `published` | boolean, optional |
| **updatePost** | `*` | Tất cả optional (partial) |
| **createComment** | `params.postId` | int, positive |
| | `content` | string, 1–2000 |
| | `parentId` | int, optional |
| **deleteComment** | `params.commentId` | int, positive |
| **getComments** | `query.page` | int, default 1 |
| | `query.limit` | int, 1–50, default 10 |
| **reaction** | `params.postId` | int, positive |
| | `type` | `LIKE` \| `DISLIKE` |

Lỗi validation trả về `400` với message mô tả cụ thể từng field.

---

## Error Handling

Global error handler phân biệt môi trường:

### Development

Trả về đầy đủ error + stack trace:

```json
{
  "status": "fail",
  "error": { ... },
  "message": "...",
  "stack": "Error: ... at ..."
}
```

### Production

| Loại lỗi | HTTP | Message |
|-----------|------|---------|
| Operational (AppError) | statusCode | Message gốc |
| Prisma P2002 (unique) | 409 | `"Dữ liệu đã tồn tại (trùng lặp unique)"` |
| Prisma P2025 (not found) | 404 | `"Không tìm thấy bản ghi"` |
| Prisma P2003 (FK) | 400 | `"Dữ liệu tham chiếu không hợp lệ"` |
| Unknown | 500 | `"Đã xảy ra lỗi từ phía máy chủ"` |

---

## Swagger UI

API được tích hợp Swagger UI tại endpoint `/api-docs` để test trực quan tất cả endpoints.

### Truy cập

```
http://localhost:3000/api-docs
```

### Tính năng

- Giao diện trực quan liệt kê tất cả 17 endpoints, nhóm theo tag (Auth, Posts, Comments, Reactions, Media)
- **Try it out** — gửi request trực tiếp từ trình duyệt
- **Authorize** — nhập JWT token (click nút 🔒 Authorize) để test các endpoint cần xác thực
- Hiển thị đầy đủ request body schema, response schema, validation rules và mô tả chi tiết
- Hỗ trợ upload file (multipart/form-data) cho endpoint Media

### Workflow test thông qua Swagger UI

1. Gọi `POST /auth/signup` hoặc `POST /auth/login` để lấy token
2. Click nút **Authorize** (🔓) ở góc trên → nhập token vào field `BearerAuth`
3. Bây giờ tất cả endpoint yêu cầu auth sẽ tự động gửi kèm `Authorization: Bearer <token>`
4. Sử dụng **Try it out** trên từng endpoint để test

---

## Testing

### Chạy tests

```bash
# Chạy toàn bộ test suite
npm test

# Chạy file cụ thể
npx cross-env NODE_OPTIONS=--experimental-vm-modules npx jest --runInBand "tests/auth.test.ts"
```

### Test Suite

| File | Loại | Mô tả | Tests |
|------|------|--------|-------|
| `auth.test.ts` | Unit | Login, register, logout, protect middleware (mocked) | 16 |
| `authentication.test.ts` | Integration | Signup, login end-to-end | 4 |
| `post.test.ts` | Integration | CRUD bài viết, phân trang, ownership | ~15 |
| `comment.test.ts` | Integration | Comment, reply, soft delete, multi-level | ~17 |
| `reaction.test.ts` | Integration | Toggle like/dislike, counters | ~9 |
| `cache.test.ts` | Unit | Cache service functions (mocked Redis) | 10 |
| `cache-integration.test.ts` | Integration | Cache hit/miss, invalidation | 5 |

**Tổng: 82 tests**

### Stack test

- **Jest 30** với ESM support (`--experimental-vm-modules`)
- **ts-jest** cho TypeScript
- **Supertest** cho integration tests (HTTP)
- **jest.unstable_mockModule** cho unit tests (mock dependencies)
- Chạy `--runInBand` để tránh conflict giữa các test qua DB

---

## Docker & Deployment

### Kiến trúc hạ tầng

```
┌─────────────────────┐
│   Render (Docker)    │
│   sustack-backend    │
│   ┌───────────────┐  │
│   │  Node.js App  │──┼──→ Supabase (PostgreSQL + PgBouncer)
│   │  + tsx runner  │  │
│   │  + Prisma 7   │──┼──→ Redis Cloud (Cache + Token Blacklist)
│   └───────────────┘  │
│          │            │
│          └────────────┼──→ Cloudinary (Media Storage)
└─────────────────────┘
```

### Dockerfile (Multi-stage Build)

Build 2 giai đoạn để tối ưu image size:

| Stage | Mục đích |
|-------|----------|
| **Builder** | Install all deps, `prisma generate`, `tsc` compile |
| **Runner** | Copy dist + generated, install production deps only, run với `tsx` |

> **Lưu ý Prisma 7**: Prisma 7 generate `.ts` files với `.ts` import paths. TypeScript compiler không rewrite extensions khi compile sang `.js`. Do đó, `dist/generated/` được ghi đè bằng file `.ts` gốc và chạy qua `tsx` runtime.

### Startup sequence trong Docker

```
1. npx prisma migrate deploy   → Chạy pending migrations lên Supabase
2. tsx dist/server.js           → Khởi động Express server
   ├── Connect Redis Cloud
   └── Listen on $PORT
```

### docker-compose.yml

Chỉ chứa service `app` — database (Supabase) và cache (Redis Cloud) đều là managed services bên ngoài:

```yaml
services:
  app:
    build: .
    restart: always
    ports:
      - "3000:3000"
    env_file:
      - .env
    environment:
      - NODE_ENV=production
```

### Deploy lên Render

1. Push code lên GitHub
2. Tạo **Web Service** trên [render.com](https://render.com) → chọn **Docker** runtime
3. Kết nối GitHub repo, chọn branch `main`
4. Thêm **Environment Variables** (tất cả biến trong `.env`)
5. Deploy — Render tự build từ Dockerfile và chạy container
6. Mỗi lần push lên `main`, Render auto redeploy

### Chạy Docker local

```bash
# Build và chạy
docker-compose up --build

# Chạy nền
docker-compose up --build -d

# Xem logs
docker-compose logs -f app

# Dừng
docker-compose down
```

---

## License

ISC