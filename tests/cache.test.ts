/**
 * Unit tests for cache service — mocks redisClient to test logic in isolation.
 */
import { jest } from '@jest/globals';

// ── Mock redisClient trước khi import module ──
const mockGet = jest.fn<any>();
const mockSetEx = jest.fn<any>();
const mockDel = jest.fn<any>();
const mockScan = jest.fn<any>();

jest.unstable_mockModule('../src/lib/redis', () => ({
  redisClient: {
    isOpen: true,
    get: mockGet,
    setEx: mockSetEx,
    del: mockDel,
    scan: mockScan,
  },
}));

const { getCachedData, setCachedData, invalidateCache, invalidatePattern } =
  await import('../src/services/cache.service');

describe('Cache Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── getCachedData ──
  describe('getCachedData', () => {
    it('trả về parsed JSON khi cache hit', async () => {
      const data = { status: 'success', data: [{ id: 1 }] };
      mockGet.mockResolvedValue(JSON.stringify(data));

      const result = await getCachedData('test-key');
      expect(result).toEqual(data);
      expect(mockGet).toHaveBeenCalledWith('test-key');
    });

    it('trả về null khi cache miss', async () => {
      mockGet.mockResolvedValue(null);

      const result = await getCachedData('missing-key');
      expect(result).toBeNull();
    });

    it('trả về null khi Redis throw error (fail gracefully)', async () => {
      mockGet.mockRejectedValue(new Error('Connection lost'));

      const result = await getCachedData('error-key');
      expect(result).toBeNull();
    });
  });

  // ── setCachedData ──
  describe('setCachedData', () => {
    it('ghi data vào Redis với TTL đúng', async () => {
      mockSetEx.mockResolvedValue('OK');
      const data = { status: 'success' };

      await setCachedData('my-key', data, 600);

      expect(mockSetEx).toHaveBeenCalledWith('my-key', 600, JSON.stringify(data));
    });

    it('không throw khi Redis lỗi', async () => {
      mockSetEx.mockRejectedValue(new Error('Write failed'));

      await expect(setCachedData('key', {}, 60)).resolves.toBeUndefined();
    });
  });

  // ── invalidateCache ──
  describe('invalidateCache', () => {
    it('xóa key cụ thể', async () => {
      mockDel.mockResolvedValue(1);

      await invalidateCache('post:slug:my-post');
      expect(mockDel).toHaveBeenCalledWith('post:slug:my-post');
    });

    it('không throw khi Redis lỗi', async () => {
      mockDel.mockRejectedValue(new Error('Del failed'));

      await expect(invalidateCache('key')).resolves.toBeUndefined();
    });
  });

  // ── invalidatePattern ──
  describe('invalidatePattern', () => {
    it('scan và xóa tất cả keys matching pattern', async () => {
      mockScan
        .mockResolvedValueOnce({ cursor: '0', keys: ['posts:list:page:1:limit:10', 'posts:list:page:2:limit:10'] });
      mockDel.mockResolvedValue(2);

      await invalidatePattern('posts:list:*');

      expect(mockScan).toHaveBeenCalledWith('0', { MATCH: 'posts:list:*', COUNT: 100 });
      expect(mockDel).toHaveBeenCalledWith(['posts:list:page:1:limit:10', 'posts:list:page:2:limit:10']);
    });

    it('xử lý multi-page scan (cursor != 0)', async () => {
      mockScan
        .mockResolvedValueOnce({ cursor: '42', keys: ['key1'] })
        .mockResolvedValueOnce({ cursor: '0', keys: ['key2'] });
      mockDel.mockResolvedValue(1);

      await invalidatePattern('test:*');

      expect(mockScan).toHaveBeenCalledTimes(2);
      expect(mockDel).toHaveBeenCalledTimes(2);
    });

    it('không gọi del khi không có keys', async () => {
      mockScan.mockResolvedValueOnce({ cursor: '0', keys: [] });

      await invalidatePattern('empty:*');

      expect(mockDel).not.toHaveBeenCalled();
    });
  });
});
