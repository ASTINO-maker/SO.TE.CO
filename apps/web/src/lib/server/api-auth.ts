export interface ServerAuthUser {
  userId: string;
  tenantId: string;
  branchId: string | null;
  email: string;
  permissions: string[];
}

function resolveInternalApiUrl() {
  const raw = (process.env.API_INTERNAL_URL ?? "http://127.0.0.1:4000").trim().replace(/\/+$/u, "");
  return /\/api\/v\d+$/u.test(raw) ? raw : `${raw}/api/v1`;
}

/**
 * Validates the bearer token against the Nest API and returns the authenticated
 * tenant identity. Next.js document routes use this before touching Prisma so a
 * document id can never bypass tenant isolation.
 */
export async function authenticateServerRequest(request: Request): Promise<ServerAuthUser | null> {
  const authorization = request.headers.get("authorization")?.trim();
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  try {
    const response = await fetch(`${resolveInternalApiUrl()}/auth/me`, {
      method: "GET",
      headers: {
        Authorization: authorization,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const user = (await response.json()) as Partial<ServerAuthUser>;
    if (!user.userId || !user.tenantId || !user.email) {
      return null;
    }

    return {
      userId: user.userId,
      tenantId: user.tenantId,
      branchId: user.branchId ?? null,
      email: user.email,
      permissions: Array.isArray(user.permissions)
        ? user.permissions.filter((permission): permission is string => typeof permission === "string")
        : [],
    };
  } catch (error) {
    console.error("Unable to validate document route session", error);
    return null;
  }
}
