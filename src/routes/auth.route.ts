import { Router } from "express";
import { validate } from "../middlewares/validate.middleware";
import { userRegisterSchema, userLoginSchema } from "../schemas/user.schema";
import { registerController, loginController, logoutController } from "../controllers/auth.controller";
import { protect } from "../middlewares/auth.middleware";
const router = Router();

router.post(
    '/signup',
    validate(userRegisterSchema),
    registerController
);

router.post('/login',
    validate(userLoginSchema),
    loginController
);

router.post('/logout', protect, logoutController);

export default router;