/**
 * Unit tests for authentication — covers login, register, logout controllers
 * and protect middleware with token blacklist.
 * Mocks prisma, redis, jwt, and password utils to test logic in isolation.
 */
import { jest } from "@jest/globals";

// ── Set env for tests ──
process.env.JWT_SECRET = "test-secret";
process.env.JWT_EXPIRES_IN = "1h";

// ── Mock dependencies ──
const mockFindUnique = jest.fn<any>();
const mockFindFirst = jest.fn<any>();
const mockCreate = jest.fn<any>();
const mockDeleteMany = jest.fn<any>();

jest.unstable_mockModule("../src/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: mockFindUnique,
      findFirst: mockFindFirst,
      create: mockCreate,
      deleteMany: mockDeleteMany,
    },
  },
}));

const mockHashPassword = jest.fn<any>();
const mockComparePassword = jest.fn<any>();

jest.unstable_mockModule("../src/utils/password", () => ({
  hashPassword: mockHashPassword,
  comparePassword: mockComparePassword,
}));

const mockSignToken = jest.fn<any>();
const mockVerifyToken = jest.fn<any>();

jest.unstable_mockModule("../src/utils/jwt", () => ({
  signToken: mockSignToken,
  verifyToken: mockVerifyToken,
}));

const mockBlacklistToken = jest.fn<any>();
const mockIsTokenBlacklisted = jest.fn<any>();

jest.unstable_mockModule("../src/services/cache.service", () => ({
  blacklistToken: mockBlacklistToken,
  isTokenBlacklisted: mockIsTokenBlacklisted,
  getCachedData: jest.fn(),
  setCachedData: jest.fn(),
  invalidateCache: jest.fn(),
  invalidatePattern: jest.fn(),
}));

// Mock jsonwebtoken for auth.middleware
const mockJwtVerify = jest.fn<any>();
jest.unstable_mockModule("jsonwebtoken", () => ({
  default: { verify: mockJwtVerify, sign: jest.fn() },
  verify: mockJwtVerify,
  sign: jest.fn(),
}));

// ── Import after mocks ──
const { loginController, registerController, logoutController } = await import(
  "../src/controllers/auth.controller"
);

const { protect } = await import("../src/middlewares/auth.middleware");

// ── Helper to create mock req/res/next ──
function createMocks(overrides: Record<string, any> = {}) {
  const req: any = {
    headers: {},
    body: {},
    ...overrides,
  };
  const res: any = {
    status: jest.fn().mockReturnThis() as any,
    json: jest.fn().mockReturnThis() as any,
  };
  const next = jest.fn() as any;
  return { req, res, next };
}

describe("Auth Controllers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ═══════════════════════════════════════
  // LOGIN
  // ═══════════════════════════════════════
  describe("loginController", () => {
    const loginHandler = (loginController as any);

    it("đăng nhập thành công với thông tin hợp lệ", async () => {
      const user = {
        id: 1,
        name: "Test User",
        email: "test@example.com",
        password: "hashedpw",
        role: "USER",
      };
      mockFindUnique.mockResolvedValue(user);
      mockComparePassword.mockResolvedValue(true);
      mockSignToken.mockReturnValue("jwt-token-123");

      const { req, res, next } = createMocks({
        body: { email: "test@example.com", password: "password123" },
      });

      await loginHandler(req, res, next);

      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { email: "test@example.com" },
      });
      expect(mockComparePassword).toHaveBeenCalledWith("password123", "hashedpw");
      expect(mockSignToken).toHaveBeenCalledWith(1, "USER");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "success",
          token: "jwt-token-123",
          data: {
            user: expect.not.objectContaining({ password: expect.anything() }),
          },
        })
      );
    });

    it("trả về 401 khi user không tồn tại", async () => {
      mockFindUnique.mockResolvedValue(null);

      const { req, res, next } = createMocks({
        body: { email: "notexist@example.com", password: "password123" },
      });

      await loginHandler(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Thông tin đăng nhập không chính xác",
          statusCode: 401,
        })
      );
    });

    it("trả về 401 khi mật khẩu sai", async () => {
      const user = {
        id: 1,
        email: "test@example.com",
        password: "hashedpw",
        role: "USER",
      };
      mockFindUnique.mockResolvedValue(user);
      mockComparePassword.mockResolvedValue(false);

      const { req, res, next } = createMocks({
        body: { email: "test@example.com", password: "wrongpw" },
      });

      await loginHandler(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Thông tin đăng nhập không chính xác",
          statusCode: 401,
        })
      );
    });

    it("không trả về password trong response", async () => {
      const user = {
        id: 1,
        name: "Test User",
        email: "test@example.com",
        password: "hashedpw",
        role: "USER",
      };
      mockFindUnique.mockResolvedValue(user);
      mockComparePassword.mockResolvedValue(true);
      mockSignToken.mockReturnValue("token");

      const { req, res, next } = createMocks({
        body: { email: "test@example.com", password: "password123" },
      });

      await loginHandler(req, res, next);

      const responseBody = res.json.mock.calls[0][0];
      expect(responseBody.data.user).not.toHaveProperty("password");
    });
  });

  // ═══════════════════════════════════════
  // REGISTER
  // ═══════════════════════════════════════
  describe("registerController", () => {
    const registerHandler = (registerController as any);

    it("đăng ký thành công với thông tin hợp lệ", async () => {
      const createdUser = {
        id: 1,
        name: "New User",
        email: "new@example.com",
        password: "hashedpw",
        role: "USER",
      };

      mockFindFirst.mockResolvedValue(null); // no existing user
      mockHashPassword.mockResolvedValue("hashedpw");
      mockCreate.mockResolvedValue(createdUser);
      mockFindUnique.mockResolvedValue(createdUser);
      mockSignToken.mockReturnValue("new-token");

      const { req, res, next } = createMocks({
        body: { name: "New User", email: "new@example.com", password: "password123" },
      });

      await registerHandler(req, res, next);

      expect(mockFindFirst).toHaveBeenCalledWith({
        where: {
          OR: [{ email: "new@example.com" }, { name: "New User" }],
        },
      });
      expect(mockHashPassword).toHaveBeenCalledWith("password123");
      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          name: "New User",
          email: "new@example.com",
          password: "hashedpw",
        },
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "success",
          token: "new-token",
        })
      );
    });

    it("trả về 400 khi email hoặc tên đã tồn tại", async () => {
      mockFindFirst.mockResolvedValue({ id: 1, email: "exist@example.com" });

      const { req, res, next } = createMocks({
        body: { name: "Exist", email: "exist@example.com", password: "password123" },
      });

      await registerHandler(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringMatching(/đã tồn tại/),
          statusCode: 400,
        })
      );
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("trả về 400 khi tạo user thất bại (findUnique trả null)", async () => {
      mockFindFirst.mockResolvedValue(null);
      mockHashPassword.mockResolvedValue("hashedpw");
      mockCreate.mockResolvedValue({});
      mockFindUnique.mockResolvedValue(null); // simulate failure

      const { req, res, next } = createMocks({
        body: { name: "Fail User", email: "fail@example.com", password: "password123" },
      });

      await registerHandler(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Đăng ký thất bại",
          statusCode: 400,
        })
      );
    });

    it("không trả về password trong response khi đăng ký thành công", async () => {
      const createdUser = {
        id: 1,
        name: "New User",
        email: "new@example.com",
        password: "hashedpw",
        role: "USER",
      };

      mockFindFirst.mockResolvedValue(null);
      mockHashPassword.mockResolvedValue("hashedpw");
      mockCreate.mockResolvedValue(createdUser);
      mockFindUnique.mockResolvedValue(createdUser);
      mockSignToken.mockReturnValue("token");

      const { req, res, next } = createMocks({
        body: { name: "New User", email: "new@example.com", password: "password123" },
      });

      await registerHandler(req, res, next);

      const responseBody = res.json.mock.calls[0][0];
      expect(responseBody.data.user).not.toHaveProperty("password");
    });
  });

  // ═══════════════════════════════════════
  // LOGOUT
  // ═══════════════════════════════════════
  describe("logoutController", () => {
    const logoutHandler = (logoutController as any);

    it("đăng xuất thành công và blacklist token", async () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600; // 1h from now
      mockVerifyToken.mockReturnValue({ id: 1, role: "USER", exp: futureExp });
      mockBlacklistToken.mockResolvedValue(undefined);

      const { req, res, next } = createMocks({
        headers: { authorization: "Bearer valid-token-123" },
      });

      await logoutHandler(req, res, next);

      expect(mockVerifyToken).toHaveBeenCalledWith("valid-token-123");
      expect(mockBlacklistToken).toHaveBeenCalledWith(
        "valid-token-123",
        expect.any(Number)
      );
      // TTL should be roughly 3600 (could be 3599 due to timing)
      const ttlArg = mockBlacklistToken.mock.calls[0]?.[1];
      expect(ttlArg).toBeGreaterThan(3500);
      expect(ttlArg).toBeLessThanOrEqual(3600);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: "success",
        message: "Đăng xuất thành công",
      });
    });

    it("trả về 401 khi không có token", async () => {
      const { req, res, next } = createMocks({
        headers: {},
      });

      await logoutHandler(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Không tìm thấy token",
          statusCode: 401,
        })
      );
    });

    it("không blacklist khi token đã hết hạn (ttl <= 0)", async () => {
      const pastExp = Math.floor(Date.now() / 1000) - 100; // expired
      mockVerifyToken.mockReturnValue({ id: 1, role: "USER", exp: pastExp });

      const { req, res, next } = createMocks({
        headers: { authorization: "Bearer expired-token" },
      });

      await logoutHandler(req, res, next);

      expect(mockBlacklistToken).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});

// ═══════════════════════════════════════
// PROTECT MIDDLEWARE
// ═══════════════════════════════════════
describe("Protect Middleware", () => {
  const protectHandler = (protect as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("cho phép truy cập khi token hợp lệ và không bị blacklist", async () => {
    mockIsTokenBlacklisted.mockResolvedValue(false);
    mockJwtVerify.mockReturnValue({ id: 1, role: "USER" });
    mockFindUnique.mockResolvedValue({
      id: 1,
      name: "User",
      email: "user@test.com",
      role: "USER",
    });

    const { req, res, next } = createMocks({
      headers: { authorization: "Bearer good-token" },
    });

    await protectHandler(req, res, next);

    expect(mockIsTokenBlacklisted).toHaveBeenCalledWith("good-token");
    expect(mockJwtVerify).toHaveBeenCalledWith("good-token", expect.any(String));
    expect(req.user).toBeDefined();
    expect(req.user.id).toBe(1);
    expect(next).toHaveBeenCalledWith(); // called without error
  });

  it("trả về 401 khi không có token", async () => {
    const { req, res, next } = createMocks({
      headers: {},
    });

    await protectHandler(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Cần đăng nhập để truy cập",
        statusCode: 401,
      })
    );
  });

  it("trả về 401 khi token đã bị blacklist", async () => {
    mockIsTokenBlacklisted.mockResolvedValue(true);

    const { req, res, next } = createMocks({
      headers: { authorization: "Bearer blacklisted-token" },
    });

    await protectHandler(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Token đã bị vô hiệu hóa, vui lòng đăng nhập lại",
        statusCode: 401,
      })
    );
    expect(mockJwtVerify).not.toHaveBeenCalled(); // should not proceed to verify
  });

  it("trả về 401 khi user không tồn tại trong DB", async () => {
    mockIsTokenBlacklisted.mockResolvedValue(false);
    mockJwtVerify.mockReturnValue({ id: 999, role: "USER" });
    mockFindUnique.mockResolvedValue(null);

    const { req, res, next } = createMocks({
      headers: { authorization: "Bearer token-orphan-user" },
    });

    await protectHandler(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Người dùng không tồn tại",
        statusCode: 401,
      })
    );
  });

  it("gán req.user khi xác thực thành công", async () => {
    const user = {
      id: 5,
      name: "Admin",
      email: "admin@test.com",
      role: "ADMIN",
    };
    mockIsTokenBlacklisted.mockResolvedValue(false);
    mockJwtVerify.mockReturnValue({ id: 5, role: "ADMIN" });
    mockFindUnique.mockResolvedValue(user);

    const { req, res, next } = createMocks({
      headers: { authorization: "Bearer admin-token" },
    });

    await protectHandler(req, res, next);

    expect(req.user).toEqual(user);
  });
});
