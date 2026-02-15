import express from "express";
import helmet from "helmet";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import swaggerDocument from "./swagger";
import { globalErrorHandler } from "./middlewares/error.middleware";
import authRouter from "./routes/auth.route";
import postRouter from "./routes/post.route";
import mediaRouter from "./routes/media.route";
import { protect } from "./middlewares/auth.middleware";
import { validate } from "./middlewares/validate.middleware";
import { deleteCommentSchema } from "./schemas/comment.schema";
import { deleteComment } from "./controllers/comment.controller";
import { healthCheckController } from "./controllers/health.controller";

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

// Swagger UI
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
  explorer: true,
  customSiteTitle: "Sustack API Docs",
}));

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/posts", postRouter);
app.use("/api/v1/media", mediaRouter);

// Comment delete route (không cần postId nên mount riêng)
app.delete("/api/v1/comments/:commentId", protect, validate(deleteCommentSchema), deleteComment);
app.get('/health', healthCheckController);
app.use(globalErrorHandler);

export default app;