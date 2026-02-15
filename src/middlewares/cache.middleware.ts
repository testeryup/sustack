import type { Request, Response, NextFunction } from "express";
import { getCachedData, setCachedData } from "../services/cache.service";

type KeyGenerator = (req: Request) => string;

export function cache(keyGenerator: KeyGenerator, ttlSeconds: number) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const cacheKey = keyGenerator(req);

    try {
      const cached = await getCachedData<any>(cacheKey);
      if (cached) {
        res.status(200).json(cached);
        return;
      }
    } catch {
      // Cache read failed, proceed to handler
    }

    // Intercept res.json to cache the response
    const originalJson = res.json.bind(res);
    res.json = ((data: any) => {
      if (res.statusCode === 200) {
        setCachedData(cacheKey, data, ttlSeconds);
      }
      return originalJson(data);
    }) as any;

    next();
  };
}
