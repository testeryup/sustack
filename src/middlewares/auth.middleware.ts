import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import {prisma} from '../lib/prisma';
import { catchAsync } from "../utils/catchAsync";
import { AppError } from "../utils/appError";

export const protect = catchAsync(async (req: any, res: Response, next: NextFunction) => {
    let token;
    if(req.headers.authorization?.startsWith('Bearer')){
        token = req.headers.authorization.split(' ')[1];
    }
    if(!token){
        return next(new AppError("Cần đăng nhập để truy cập", 401));
    }

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET as string);
    const currentUser = await prisma.user.findUnique({where: {
        id: decoded.id
    }});
    if(!currentUser){
        return next(new AppError("Người dùng không tồn tại", 401));
    }
    req.user = currentUser;
    next();
})