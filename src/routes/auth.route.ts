import { Router } from "express";
import { validate } from "../middlewares/validate.middleware";
import { userRegisterSchema, userLoginSchema } from "../schemas/user.schema";
import { registerController, loginController } from "../controllers/auth.controller";
import { protect } from "../middlewares/auth.middleware";
const router = Router();

router.post(
    '/register',
    validate(userRegisterSchema),
    registerController
);

router.post('/login',
    validate(userLoginSchema),
    protect,
    loginController
);

export default router;