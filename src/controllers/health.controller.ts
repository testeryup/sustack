import {prisma} from '../lib/prisma';
import { catchAsync } from "../utils/catchAsync";
import {redisClient} from '../lib/redis';
import { boolean } from 'zod';

export const healthCheckController = catchAsync(async (req: any, res: any) => {
    // Kiểm tra kết nối cơ sở dữ liệu
    let databaseConnected = false;

    try {
        await prisma.$queryRaw`SELECT 1`;
        databaseConnected = true;
    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Database connection failed' });
    }
    
    // Kiểm tra kết nối Redis
    let redisConnected = false;
    try {
        await redisClient.ping();
        redisConnected = true;
    } catch (err) {
        return res.status(500).json({ status: 'error', message: 'Redis connection failed' });
    }

    res.status(200).json({
        status: 'success',
        message: 'Server is healthy',
        timestamp: new Date().toISOString(),
        databaseConnected,
        redisConnected
    });
});