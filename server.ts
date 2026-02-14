import 'dotenv/config';
import express from 'express';
import app from './src/app';
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('OKKKK');
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

process.on('unhandledRejection', (err: Error) => {
  console.error('Unhandled Rejection at:', err);
  // Application specific logging, throwing an error, or other logic here
});