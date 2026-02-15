import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/appError';

const sendErrorDev = (err: any, res: Response) => {
  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack,
  });
};

// Production
const sendErrorProd = (err: any, res: Response) => {
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  } else {
    console.error('ERROR', err);
    res.status(500).json({
      status: 'error',
      message: 'Lỗi không xác định. Vui lòng thử lại sau.',
    });
  }
};

export const globalErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
  } else {
    let error = { ...err, message: err.message };

    if (err.code === 'P2002') {
      const field = err.meta?.target;
      error = new AppError(`Dữ liệu ${field} đã tồn tại trong hệ thống.`, 400);
    }
    
    if (err.code === 'P2025') {
      error = new AppError('Không tìm thấy bản ghi yêu cầu.', 404);
    }

    if (err.code === 'P2003') {
      const field = err.meta?.field_name;
      error = new AppError(`Dữ liệu tham chiếu ${field} không tồn tại.`, 400);
    }

    sendErrorProd(error, res);
  }
};