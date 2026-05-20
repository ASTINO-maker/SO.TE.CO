import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import type { Request, Response } from "express";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const payload =
      exception instanceof HttpException ? exception.getResponse() : "Internal server error";

    const normalizedError = this.normalizeError(payload, status);

    response.status(status).json({
      statusCode: status,
      path: request.url,
      method: request.method,
      timestamp: new Date().toISOString(),
      error: normalizedError,
    });
  }

  private normalizeError(payload: unknown, statusCode: number) {
    if (typeof payload === "string") {
      return {
        code: this.defaultCode(statusCode),
        message: payload,
      };
    }

    if (payload && typeof payload === "object") {
      const record = payload as {
        message?: string | string[];
        error?: string;
        code?: string;
      };

      const messages = Array.isArray(record.message)
        ? record.message
        : record.message
          ? [record.message]
          : [];

      return {
        code: record.code ?? this.defaultCode(statusCode),
        message: messages[0] ?? record.error ?? "Request failed",
        details: messages.slice(1).map((message) => ({ message })),
      };
    }

    return {
      code: this.defaultCode(statusCode),
      message: "Internal server error",
    };
  }

  private defaultCode(statusCode: number) {
    return statusCode >= 500 ? "INTERNAL_SERVER_ERROR" : "REQUEST_ERROR";
  }
}
