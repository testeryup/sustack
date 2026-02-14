import jwt from "jsonwebtoken";

export const signToken = (id: number, role: string): string => {
    return jwt.sign(
        { id, role }, 
        process.env.JWT_SECRET as string, 
        {expiresIn: process.env.JWT_EXPIRES_IN as string} as jwt.SignOptions
    );
}

export const verifyToken = (token: string): any => {
    return jwt.verify(token, process.env.JWT_SECRET as string);
}