import { hashPassword, comparePassword } from "../utils/password";
// import type { UserRegisterSchema, UserLoginSchema } from "../schemas/user.schema";
import type { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { prisma } from "../lib/prisma";
import { AppError } from "../utils/appError";
import { signToken, verifyToken } from "../utils/jwt";
import { blacklistToken } from "../services/cache.service";

export const loginController = catchAsync(async (req: any, res: any, next: any) => {
    const {email, password} = req.body;
    const user = await prisma.user.findUnique({
        where: {
            email
        }
    });
   
    if(!user || !(await comparePassword(password, user.password))){
        return next(new AppError("Thông tin đăng nhập không chính xác", 401));
    }
    const token = signToken(user!.id, user!.role);
    const {password: _ , ...userWithoutPassword } = user;
    return res.status(200).json({
        status: "success",
        token,
        data: {
            user: userWithoutPassword
        }
    });
});

export const registerController = catchAsync(
    async (req: Request, res: Response, next: any) => {
        const {email, password, name} = req.body;
        const user = await prisma.user.findFirst({
            where: {
                OR:[
                    {email: email},
                    {name: name}
                ],
            }
        });
        if(user){
            return next(new AppError("Thông tin đã tồn tại trong hệ thống, hãy kiểm tra lại email hoặc tên", 400));
        }
        const hashedPassword = await hashPassword(password);
        await prisma.user.create({
            data:{
                name,
                email,
                password: hashedPassword
            }
        });

        const createdUser = await prisma.user.findUnique({
            where: {
                email
            }
        });
        if(!createdUser){
            return next(new AppError("Đăng ký thất bại", 400));
        }
        const token = signToken(createdUser!.id, createdUser!.role);
        const {password: _ , ...userWithoutPassword } = createdUser;
        return res.status(201).json({
            status: "success",
            token,
            data: {
                user: userWithoutPassword
            }
        });
});

export const logoutController = catchAsync(async (req: any, res: Response, next: any) => {
    let token;
    if (req.headers.authorization?.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }
    if (!token) {
        return next(new AppError("Không tìm thấy token", 401));
    }

    const decoded: any = verifyToken(token);
    // TTL = thời gian còn lại của token (giây)
    const expiry = decoded.exp;
    const now = Math.floor(Date.now() / 1000);
    const ttl = expiry - now;

    if (ttl > 0) {
        await blacklistToken(token, ttl);
    }

    return res.status(200).json({
        status: "success",
        message: "Đăng xuất thành công"
    });
});