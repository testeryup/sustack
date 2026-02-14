import express from "express";
import helmet from "helmet";
import cors from "cors";
import { globalErrorHandler } from "./middlewares/error.middleware";
import authRouter from "./routes/auth.route";
import postRouter from "./routes/post.route";
import mediaRouter from "./routes/media.route";

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/posts", postRouter);
app.use("/api/v1/media", mediaRouter);

app.use(globalErrorHandler);

export default app;