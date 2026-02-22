const swaggerDocument = {
  openapi: "3.0.3",
  info: {
    title: "Sustack Blog API",
    version: "1.0.0",
    description:
      "REST API cho nền tảng blog — hỗ trợ bài viết, bình luận đa cấp, reaction, quản lý media (Cloudinary), xác thực JWT với token blacklist trên Redis và caching layer.",
    contact: { name: "Sustack" },
  },
  servers: [
    { url: "/api/v1", description: "API v1" },
  ],
  tags: [
    { name: "Auth", description: "Đăng ký, đăng nhập, đăng xuất" },
    { name: "Posts", description: "CRUD bài viết" },
    { name: "Comments", description: "Bình luận đa cấp" },
    { name: "Reactions", description: "Like / Dislike bài viết" },
    { name: "Media", description: "Upload & quản lý ảnh — Two-Phase Upload (Cloudinary)" },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Nhập JWT token nhận được sau khi đăng nhập/đăng ký",
      },
    },
    schemas: {
      // ─── Request Bodies ───
      RegisterBody: {
        type: "object",
        required: ["name", "email", "password"],
        properties: {
          name: { type: "string", minLength: 6, maxLength: 25, example: "Nguyen Van A" },
          email: { type: "string", format: "email", example: "a@example.com" },
          password: { type: "string", minLength: 6, maxLength: 25, example: "matkhau123" },
        },
      },
      LoginBody: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email", example: "a@example.com" },
          password: { type: "string", minLength: 6, maxLength: 25, example: "matkhau123" },
        },
      },
      CreatePostBody: {
        type: "object",
        required: ["title", "content"],
        properties: {
          title: { type: "string", minLength: 10, maxLength: 100, example: "Tiêu đề bài viết mới của tôi" },
          content: { type: "string", minLength: 20, example: "Nội dung markdown dài hơn 20 ký tự cho bài viết..." },
          thumbnail: { type: "string", format: "uri", example: "https://res.cloudinary.com/demo/image/upload/sample.jpg" },
          published: { type: "boolean", default: false, example: false },
        },
      },
      UpdatePostBody: {
        type: "object",
        properties: {
          title: { type: "string", minLength: 10, maxLength: 100, example: "Tiêu đề đã cập nhật" },
          content: { type: "string", minLength: 20, example: "Nội dung markdown đã được chỉnh sửa..." },
          thumbnail: { type: "string", format: "uri" },
          published: { type: "boolean", example: true },
        },
      },
      CreateCommentBody: {
        type: "object",
        required: ["content"],
        properties: {
          content: { type: "string", minLength: 1, maxLength: 2000, example: "Bài viết rất hay!" },
          parentId: { type: "integer", description: "ID comment cha (để reply)", example: 1 },
        },
      },
      ReactionBody: {
        type: "object",
        required: ["type"],
        properties: {
          type: { type: "string", enum: ["LIKE", "DISLIKE"], example: "LIKE" },
        },
      },

      // ─── Response Models ───
      User: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          name: { type: "string", example: "Nguyen Van A" },
          email: { type: "string", example: "a@example.com" },
          role: { type: "string", enum: ["USER", "ADMIN"], example: "USER" },
        },
      },
      AuthResponse: {
        type: "object",
        properties: {
          status: { type: "string", example: "success" },
          token: { type: "string", example: "eyJhbGciOiJIUzI1NiIs..." },
          data: {
            type: "object",
            properties: {
              user: { $ref: "#/components/schemas/User" },
            },
          },
        },
      },
      Post: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          title: { type: "string", example: "Tiêu đề bài viết" },
          slug: { type: "string", example: "tieu-de-bai-viet-a1b2" },
          content: { type: "string", example: "Nội dung markdown..." },
          thumbnail: { type: "string", nullable: true, example: "https://res.cloudinary.com/..." },
          published: { type: "boolean", example: true },
          likeCount: { type: "integer", example: 5 },
          dislikeCount: { type: "integer", example: 0 },
          authorId: { type: "integer", example: 1 },
          author: {
            type: "object",
            properties: {
              name: { type: "string", example: "Nguyen Van A" },
              email: { type: "string", example: "a@example.com" },
            },
          },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      Comment: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          content: { type: "string", example: "Bài viết rất hay!" },
          postId: { type: "integer", example: 1 },
          authorId: { type: "integer", example: 1 },
          parentId: { type: "integer", nullable: true, example: null },
          deletedAt: { type: "string", format: "date-time", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          author: {
            type: "object",
            properties: {
              id: { type: "integer", example: 1 },
              name: { type: "string", example: "Nguyen Van A" },
            },
          },
          replies: {
            type: "array",
            items: { $ref: "#/components/schemas/Comment" },
          },
        },
      },
      Reaction: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          type: { type: "string", enum: ["LIKE", "DISLIKE"], example: "LIKE" },
          userId: { type: "integer", example: 1 },
          postId: { type: "integer", example: 1 },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Media: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          url: { type: "string", example: "https://res.cloudinary.com/demo/image/upload/sustack_blog/abc123.jpg" },
          publicId: { type: "string", example: "sustack_blog/abc123" },
          format: { type: "string", nullable: true, example: "jpg" },
          width: { type: "integer", nullable: true, example: 1920 },
          height: { type: "integer", nullable: true, example: 1080 },
          bytes: { type: "integer", nullable: true, example: 245000 },
          uploaderId: { type: "integer", example: 1 },
          postId: { type: "integer", nullable: true, example: null, description: "null = ảnh chưa gắn bài viết (PENDING)" },
          status: {
            type: "string",
            enum: ["PENDING", "ATTACHED"],
            example: "PENDING",
            description: "PENDING = mới upload / orphan. ATTACHED = đã gắn vào bài viết bởi Task Runner.",
          },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Error: {
        type: "object",
        properties: {
          status: { type: "string", example: "fail" },
          message: { type: "string", example: "Mô tả lỗi" },
        },
      },
    },
  },

  // ═════════════════════════════════════════════
  // PATHS
  // ═════════════════════════════════════════════
  paths: {
    // ─── AUTH ───
    "/auth/signup": {
      post: {
        tags: ["Auth"],
        summary: "Đăng ký tài khoản",
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/RegisterBody" } },
          },
        },
        responses: {
          "201": {
            description: "Đăng ký thành công",
            content: { "application/json": { schema: { $ref: "#/components/schemas/AuthResponse" } } },
          },
          "400": {
            description: "Email hoặc tên đã tồn tại / Validation lỗi",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
        },
      },
    },

    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Đăng nhập",
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/LoginBody" } },
          },
        },
        responses: {
          "200": {
            description: "Đăng nhập thành công",
            content: { "application/json": { schema: { $ref: "#/components/schemas/AuthResponse" } } },
          },
          "401": {
            description: "Thông tin đăng nhập không chính xác",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
        },
      },
    },

    "/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Đăng xuất (blacklist token)",
        description: "Token sẽ bị blacklist trong Redis với TTL bằng thời gian còn lại của JWT. Mọi request tiếp theo với token này sẽ bị từ chối.",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": {
            description: "Đăng xuất thành công",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "success" },
                    message: { type: "string", example: "Đăng xuất thành công" },
                  },
                },
              },
            },
          },
          "401": {
            description: "Không tìm thấy token / Token không hợp lệ",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
        },
      },
    },

    // ─── POSTS ───
    "/posts": {
      get: {
        tags: ["Posts"],
        summary: "Danh sách bài viết (published)",
        description: "Trả về danh sách bài viết đã publish, phân trang. Response được cache 10 phút.",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 }, description: "Số trang" },
          { name: "limit", in: "query", schema: { type: "integer", default: 10 }, description: "Số bài/trang" },
        ],
        responses: {
          "200": {
            description: "Thành công",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "success" },
                    results: { type: "integer", example: 2 },
                    total: { type: "integer", example: 15 },
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Post" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Posts"],
        summary: "Tạo bài viết",
        description: `Slug tự sinh từ title + nanoid. Mặc định \`published = false\` (nháp).

**Two-Phase Upload — Phase 2:** Khi tạo bài viết, server sẽ tạo một **Task** trong cùng DB Transaction. Task Runner (Worker Thread / Piscina pool) sẽ parse AST Markdown của \`content\`, trích xuất URL ảnh, tìm các \`Media\` record thuộc về user có URL khớp, sau đó cập nhật chúng thành \`status: ATTACHED\` và gán \`postId\`. Quá trình này chạy ngầm — response trả về ngay lập tức, không cần đợi.`,
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/CreatePostBody" } },
          },
        },
        responses: {
          "201": {
            description: "Tạo thành công",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "success" },
                    data: { $ref: "#/components/schemas/Post" },
                  },
                },
              },
            },
          },
          "400": { description: "Validation lỗi", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "401": { description: "Chưa đăng nhập", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },

    "/posts/{slug}": {
      get: {
        tags: ["Posts"],
        summary: "Chi tiết bài viết theo slug",
        description: "Bài chưa publish chỉ hiển thị cho tác giả/admin. Cache 1 giờ.",
        parameters: [
          { name: "slug", in: "path", required: true, schema: { type: "string" }, description: "Slug bài viết", example: "tieu-de-bai-viet-a1b2" },
        ],
        responses: {
          "200": {
            description: "Thành công",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "success" },
                    data: { $ref: "#/components/schemas/Post" },
                  },
                },
              },
            },
          },
          "404": { description: "Không tìm thấy bài viết", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },

    "/posts/{id}": {
      patch: {
        tags: ["Posts"],
        summary: "Cập nhật bài viết",
        description: "Partial update — chỉ gửi field cần thay đổi. Slug tự tái sinh khi đổi title. Chỉ tác giả hoặc admin.\n\nTạo Task SYNC_MEDIA mới sau khi update: ảnh cũ không còn trong content sẽ bị detach (PENDING), ảnh mới sẽ được attach (ATTACHED).",
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" }, description: "ID bài viết" },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/UpdatePostBody" } },
          },
        },
        responses: {
          "200": {
            description: "Cập nhật thành công",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "success" },
                    data: { $ref: "#/components/schemas/Post" },
                  },
                },
              },
            },
          },
          "400": { description: "Validation lỗi", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "401": { description: "Chưa đăng nhập", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "403": { description: "Không có quyền sửa", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "404": { description: "Không tìm thấy bài viết", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
      delete: {
        tags: ["Posts"],
        summary: "Xóa bài viết",
        description: "Xóa bài viết cùng toàn bộ comments, reactions (cascade), media (Cloudinary + DB). Chỉ tác giả hoặc admin.",
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" }, description: "ID bài viết" },
        ],
        responses: {
          "204": { description: "Xóa thành công" },
          "401": { description: "Chưa đăng nhập", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "403": { description: "Không có quyền xóa", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "404": { description: "Không tìm thấy bài viết", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },

    // ─── COMMENTS ───
    "/posts/{postId}/comments": {
      get: {
        tags: ["Comments"],
        summary: "Danh sách bình luận của bài viết",
        description: "Trả về comment gốc kèm replies nested 2 cấp. Comment đã xóa hiển thị `[Bình luận đã bị xóa]`.",
        parameters: [
          { name: "postId", in: "path", required: true, schema: { type: "integer" }, description: "ID bài viết" },
          { name: "page", in: "query", schema: { type: "integer", default: 1 }, description: "Số trang" },
          { name: "limit", in: "query", schema: { type: "integer", default: 10, maximum: 50 }, description: "Số comment/trang (max 50)" },
        ],
        responses: {
          "200": {
            description: "Thành công",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "success" },
                    results: { type: "integer", example: 3 },
                    total: { type: "integer", example: 12 },
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Comment" },
                    },
                  },
                },
              },
            },
          },
          "404": { description: "Không tìm thấy bài viết", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
      post: {
        tags: ["Comments"],
        summary: "Tạo bình luận / reply",
        description: "Gửi `parentId` để reply. Không cho reply vào comment đã bị xóa. Post phải tồn tại và đã published.",
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: "postId", in: "path", required: true, schema: { type: "integer" }, description: "ID bài viết" },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/CreateCommentBody" } },
          },
        },
        responses: {
          "201": {
            description: "Tạo thành công",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "success" },
                    data: { $ref: "#/components/schemas/Comment" },
                  },
                },
              },
            },
          },
          "400": { description: "Validation lỗi / Reply comment đã xóa", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "401": { description: "Chưa đăng nhập", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "404": { description: "Bài viết / Comment gốc không tồn tại", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },

    "/comments/{commentId}": {
      delete: {
        tags: ["Comments"],
        summary: "Xóa bình luận (soft delete)",
        description: "Set `deletedAt`, nội dung hiển thị `[Bình luận đã bị xóa]`. Chỉ tác giả hoặc admin.",
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: "commentId", in: "path", required: true, schema: { type: "integer" }, description: "ID bình luận" },
        ],
        responses: {
          "200": {
            description: "Xóa thành công",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "success" },
                    message: { type: "string", example: "Bình luận đã được xóa" },
                  },
                },
              },
            },
          },
          "401": { description: "Chưa đăng nhập", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "403": { description: "Không có quyền xóa", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "404": { description: "Không tìm thấy bình luận", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },

    // ─── REACTIONS ───
    "/posts/{postId}/reactions": {
      post: {
        tags: ["Reactions"],
        summary: "Toggle reaction (Like/Dislike)",
        description: `Cơ chế 3 trạng thái:
- **Chưa reaction** → tạo mới (201, action: created)
- **Cùng type** → xóa reaction (200, action: removed)
- **Khác type** → switch (200, action: switched)

Tất cả thao tác sử dụng DB transaction để đảm bảo counter chính xác.`,
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: "postId", in: "path", required: true, schema: { type: "integer" }, description: "ID bài viết" },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/ReactionBody" } },
          },
        },
        responses: {
          "201": {
            description: "Tạo reaction mới",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "success" },
                    action: { type: "string", example: "created" },
                    data: { $ref: "#/components/schemas/Reaction" },
                  },
                },
              },
            },
          },
          "200": {
            description: "Removed hoặc switched",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "success" },
                    action: { type: "string", enum: ["removed", "switched"], example: "removed" },
                    data: { nullable: true, oneOf: [{ $ref: "#/components/schemas/Reaction" }, { type: "object", nullable: true }] },
                  },
                },
              },
            },
          },
          "401": { description: "Chưa đăng nhập", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "404": { description: "Không tìm thấy bài viết", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },

    "/posts/{postId}/reactions/me": {
      get: {
        tags: ["Reactions"],
        summary: "Reaction hiện tại của user",
        description: "Trả về reaction của user cho bài viết, hoặc `null` nếu chưa react.",
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: "postId", in: "path", required: true, schema: { type: "integer" }, description: "ID bài viết" },
        ],
        responses: {
          "200": {
            description: "Thành công",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "success" },
                    data: { nullable: true, oneOf: [{ $ref: "#/components/schemas/Reaction" }, { type: "object", nullable: true }] },
                  },
                },
              },
            },
          },
          "401": { description: "Chưa đăng nhập", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },

    // ─── MEDIA ───
    "/media/upload": {
      post: {
        tags: ["Media"],
        summary: "Upload ảnh lên Cloudinary (Phase 1)",
        description: "Upload ảnh lên Cloudinary, tối đa 5 MB. Ảnh được tạo trong DB với **status: PENDING** và **postId: null**.\n\n**Two-Phase Upload flow:**\n1. **Phase 1 (endpoint này):** Client upload ảnh → nhận lại URL. Ảnh ở trạng thái `PENDING`.\n2. Client chèn URL ảnh vào nội dung Markdown của bài viết.\n3. **Phase 2 (`POST /posts` hoặc `PATCH /posts/:id`):** Task Runner parse AST Markdown, tìm ảnh của user có URL khớp → cập nhật `status: ATTACHED` + gán `postId`.\n\nẢnh `PENDING` không được nhắc đến trong bài viết nào sẽ bị Cron Job xóa tự động sau 24 giờ (chạy lúc 2h sáng).",
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["image"],
                properties: {
                  image: { type: "string", format: "binary", description: "File ảnh (max 5 MB)" },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Upload thành công",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "success" },
                    data: { $ref: "#/components/schemas/Media" },
                  },
                },
              },
            },
          },
          "400": { description: "Không có file / File không hợp lệ", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "401": { description: "Chưa đăng nhập", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },

    "/media/orphan": {
      get: {
        tags: ["Media"],
        summary: "Ảnh chưa gắn bài viết (PENDING)",
        description: "Danh sách ảnh của user hiện tại có `status: PENDING` và `postId: null` — ảnh đã upload nhưng chưa được Task Runner gắn vào bài viết nào. Hữu ích để hiển thị ảnh nháp hoặc kiểm tra trạng thái trước khi publish.",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": {
            description: "Thành công",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "success" },
                    results: { type: "integer", example: 3 },
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Media" },
                    },
                  },
                },
              },
            },
          },
          "401": { description: "Chưa đăng nhập", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },

    "/media/{id}": {
      delete: {
        tags: ["Media"],
        summary: "Xóa ảnh",
        description: "Xóa ảnh khỏi Cloudinary + DB. Chỉ người upload hoặc admin.",
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" }, description: "ID media" },
        ],
        responses: {
          "204": { description: "Xóa thành công" },
          "401": { description: "Chưa đăng nhập", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "403": { description: "Không có quyền xóa", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "404": { description: "Không tìm thấy ảnh", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },

    "/media/cleanup/orphan": {
      delete: {
        tags: ["Media"],
        summary: "Dọn ảnh PENDING (Admin only — manual trigger)",
        description: "Xóa tất cả ảnh có `status: PENDING` và `postId: null` cũ hơn N giờ khỏi Cloudinary + DB. Mặc định 24 giờ.\n\n**Lưu ý:** Cron job tự động chạy lúc 2h sáng hàng ngày với cùng logic này. Endpoint này chỉ cần dùng khi muốn trigger dọn dẹp thủ công.",
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: "hours", in: "query", schema: { type: "integer", default: 24 }, description: "Xóa orphan cũ hơn N giờ" },
        ],
        responses: {
          "200": {
            description: "Dọn dẹp thành công",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "success" },
                    data: {
                      type: "object",
                      properties: {
                        total: { type: "integer", example: 5 },
                        deleted: { type: "integer", example: 4 },
                        failed: { type: "integer", example: 1 },
                      },
                    },
                  },
                },
              },
            },
          },
          "401": { description: "Chưa đăng nhập", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          "403": { description: "Không phải admin", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
  },
};

export default swaggerDocument;
