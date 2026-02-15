import { createClient } from "redis";

const redisOptions: Record<string, any> = {
  socket: {
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
  },
};
if (process.env.REDIS_USERNAME) redisOptions.username = process.env.REDIS_USERNAME;
if (process.env.REDIS_PASSWORD) redisOptions.password = process.env.REDIS_PASSWORD;

const redisClient = createClient(redisOptions);

redisClient.on("error", (err) => {
  console.error("Redis Client Error:", err.message);
});

redisClient.on("connect", () => {
  console.log("Redis connected successfully");
});

export async function connectRedis() {
  try {
    await redisClient.connect();
  } catch (err: any) {
    console.error("Failed to connect to Redis:", err.message);
  }
}

export { redisClient };
