import 'dotenv/config';
import express from 'express';
import app from './src/app';
import { connectRedis } from './src/lib/redis';
import { startTaskRunner } from './src/workers/task-runner';
import { startCronJobs } from './src/services/cron.service';
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('OKKKK');
});

connectRedis().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });

  // Khởi động background jobs
  startTaskRunner();
  startCronJobs();
});

process.on('unhandledRejection', (err: Error) => {
  console.error('Unhandled Rejection at:', err);
  // Application specific logging, throwing an error, or other logic here
});