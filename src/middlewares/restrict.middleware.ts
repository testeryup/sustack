import type { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/appError";
export const restrictTo = (...roles: string[]) => {
    return (req: any, res: Response, next: NextFunction) => {
        if(!roles.includes(req.user.role)){
            return next(new AppError("Bạn không có quyền truy cập vào tài nguyên này", 403));
        }
        next();
    }
}