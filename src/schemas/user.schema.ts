import * as z from "zod"; 
 
export const userRegisterSchema = z.object({ 
    body: z.object({
        name: z.string()
            .min(6, "Tên cần ít nhất 6 ký tự")
            .max(25, "Tên dưới 25 ký tự"),
        email: z.email("Email không hợp lệ"),
        password: z.string()
            .min(6, "Mật khẩu phải có từ 6 ký tự")
            .max(25, "Mật khẩu phải có dưới 25 ký tự") 
    })
});

export const userLoginSchema = z.object({ 
    body: z.object({
        email: z.email("Email không hợp lệ"),
        password: z.string()
            .min(6, "Mật khẩu phải có từ 6 ký tự")
            .max(25, "Mật khẩu phải có dưới 25 ký tự") 
    })
});
export type UserRegisterSchema = z.infer<typeof userRegisterSchema>['body'];
export type UserLoginSchema = z.infer<typeof userLoginSchema>['body'];