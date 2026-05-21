import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Request, Response } from "express";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

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

    // Server-side errors: log structured details + stack and forward to Sentry
    // (or any future error sink) via the captureException hook below. This
    // turns Railway logs into something searchable.
    if (status >= 500) {
      const error =
        exception instanceof Error ? exception : new Error(String(exception ?? "Unknown error"));
      this.logger.error(
        `[${status}] ${request.method} ${request.url} — ${normalizedError.message}`,
        error.stack,
      );
      captureException(error, {
        method: request.method,
        url: request.url,
        status,
        code: normalizedError.code,
      });
    }

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

/**
 * Drop-in hook for Sentry / other error sinks. Replace the body with
 *   Sentry.captureException(error, { extra: context });
 * once @sentry/node is installed and SENTRY_DSN is configured.
 */
function captureException(_error: Error, _context: Record<string, unknown>) {
  // intentionally empty — wire to Sentry by editing this function.
}
