import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';

const DEFAULT_CODES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'VALIDATION_ERROR',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'UNPROCESSABLE_ENTITY',
  [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    if (status >= 500) this.logger.error(exception);

    const raw = exception instanceof HttpException ? exception.getResponse() : null;
    const obj = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};

    const rawMsg = typeof raw === 'string' ? raw : obj.message;
    const message = Array.isArray(rawMsg)
      ? rawMsg[0]
      : typeof rawMsg === 'string' && rawMsg.trim()
        ? rawMsg
        : status >= 500
          ? 'Internal server error'
          : 'Request failed';
    const errors = Array.isArray(rawMsg) ? rawMsg : undefined;
    const code =
      (typeof obj.code === 'string' && obj.code) ||
      DEFAULT_CODES[status] ||
      (status >= 500 ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_ERROR');

    res.status(status).json({
      statusCode: status,
      code,
      message,
      ...(errors && { errors }),
      path: req.url,
      timestamp: new Date().toISOString(),
    });
  }
}
