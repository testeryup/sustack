import { redisClient } from "../lib/redis";
import { getBlacklistTokenKey } from "../utils/cacheKeys";

export async function getCachedData<T>(key: string): Promise<T | null> {
  try {
    if (!redisClient.isOpen) return null;
    const data = await redisClient.get(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}

export async function setCachedData(
  key: string,
  data: unknown,
  ttlSeconds: number
): Promise<void> {
  try {
    if (!redisClient.isOpen) return;
    await redisClient.setEx(key, ttlSeconds, JSON.stringify(data));
  } catch {
  }
}

export async function invalidateCache(key: string): Promise<void> {
  try {
    if (!redisClient.isOpen) return;
    await redisClient.del(key);
  } catch {
  }
}

export async function invalidatePattern(pattern: string): Promise<void> {
  try {
    if (!redisClient.isOpen) return;
    let cursor = "0";
    do {
      const result = await redisClient.scan(cursor, {
        MATCH: pattern,
        COUNT: 100,
      });
      cursor = String(result.cursor);
      if (result.keys.length > 0) {
        await redisClient.del(result.keys);
      }
    } while (cursor !== "0");
  } catch {
  }
}

export async function blacklistToken(
  token: string,
  ttlSeconds: number
): Promise<void> {
  try {
    if (!redisClient.isOpen) return;
    await redisClient.setEx(getBlacklistTokenKey(token), ttlSeconds, "1");
  } catch {
  }
}

export async function isTokenBlacklisted(token: string): Promise<boolean> {
  try {
    if (!redisClient.isOpen) return false;
    const result = await redisClient.get(getBlacklistTokenKey(token));
    return result !== null;
  } catch {
    return false;
  }
}
