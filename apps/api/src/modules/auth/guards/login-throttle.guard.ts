import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable, Logger } from "@nestjs/common";
import type { Request } from "express";

interface ThrottleBucket {
  failures: number;
  windowStartedAt: number;
  blockedUntil: number | null;
}

/**
 * In-memory throttle for the /auth/login endpoint. Prevents trivial
 * brute-force attempts by counting failed logins per IP and locking the
 * bucket once the threshold is exceeded.
 *
 * NOTE: this is per-process. For a multi-instance deployment switch to Redis
 * or `@nestjs/throttler` with a shared store.
 */
@Injectable()
export class LoginThrottleGuard implements CanActivate {
  private static readonly WINDOW_MS = 15 * 60 * 1000; // 15 minutes
  private static readonly MAX_FAILURES = 8;
  private static readonly LOCKOUT_MS = 15 * 60 * 1000;
  private static readonly buckets = new Map<string, ThrottleBucket>();
  private static lastSweepAt = 0;

  private readonly logger = new Logger(LoginThrottleGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const key = this.bucketKey(request);
    const now = Date.now();

    LoginThrottleGuard.maybeSweep(now);

    const bucket = LoginThrottleGuard.buckets.get(key);
    if (bucket?.blockedUntil && bucket.blockedUntil > now) {
      const retryAfterSeconds = Math.ceil((bucket.blockedUntil - now) / 1000);
      this.logger.warn(`Login attempt blocked for ${key} (retry in ${retryAfterSeconds}s)`);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: {
            code: "TOO_MANY_LOGIN_ATTEMPTS",
            message: `Trop de tentatives de connexion. Réessayez dans ${retryAfterSeconds} secondes.`,
          },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Hook into the response to record the outcome.
    const response = context.switchToHttp().getResponse();
    const finalize = () => {
      response.removeListener("finish", finalize);
      response.removeListener("close", finalize);
      const statusCode: number = response.statusCode;
      if (statusCode === 401 || statusCode === 400 || statusCode === 403) {
        LoginThrottleGuard.recordFailure(key, now);
      } else if (statusCode >= 200 && statusCode < 300) {
        LoginThrottleGuard.buckets.delete(key);
      }
    };
    response.once("finish", finalize);
    response.once("close", finalize);

    return true;
  }

  private bucketKey(request: Request): string {
    const forwarded = request.headers["x-forwarded-for"];
    const ip =
      typeof forwarded === "string"
        ? forwarded.split(",")[0]?.trim() || request.ip
        : request.ip;
    const body = request.body as { email?: unknown } | undefined;
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    return `${ip ?? "unknown"}::${email}`;
  }

  private static recordFailure(key: string, now: number) {
    const existing = LoginThrottleGuard.buckets.get(key);
    if (!existing || now - existing.windowStartedAt > LoginThrottleGuard.WINDOW_MS) {
      LoginThrottleGuard.buckets.set(key, {
        failures: 1,
        windowStartedAt: now,
        blockedUntil: null,
      });
      return;
    }

    existing.failures += 1;
    if (existing.failures >= LoginThrottleGuard.MAX_FAILURES) {
      existing.blockedUntil = now + LoginThrottleGuard.LOCKOUT_MS;
    }
  }

  private static maybeSweep(now: number) {
    if (now - LoginThrottleGuard.lastSweepAt < LoginThrottleGuard.WINDOW_MS) return;
    LoginThrottleGuard.lastSweepAt = now;
    const expiredKeys: string[] = [];
    for (const [key, bucket] of LoginThrottleGuard.buckets.entries()) {
      const stale = now - bucket.windowStartedAt > LoginThrottleGuard.WINDOW_MS * 2;
      const unblocked = !bucket.blockedUntil || bucket.blockedUntil < now;
      if (stale && unblocked) expiredKeys.push(key);
    }
    for (const key of expiredKeys) LoginThrottleGuard.buckets.delete(key);
  }
}
