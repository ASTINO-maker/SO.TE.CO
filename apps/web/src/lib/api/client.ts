import type { ApiError, ListQuery } from "./types";

function resolveApiUrl() {
  const rawValue =
    process.env.NEXT_PUBLIC_API_URL ??
    process.env.API_URL ??
    "http://localhost:4000/api/v1";
  const normalized = rawValue.trim().replace(/\/+$/u, "");

  if (/\/api\/v\d+$/u.test(normalized)) {
    return normalized;
  }

  return `${normalized}/api/v1`;
}

const API_URL = resolveApiUrl();
const SESSION_KEY = "sotec.api.session";

type ApiSession = {
  accessToken: string;
  refreshToken: string;
};

type AuthUser = {
  userId: string;
  tenantId: string;
  branchId: string | null;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  status: string;
  roleCodes: string[];
  roleNames: string[];
  permissions: string[];
  scopes: string[];
  workspaceSetupCompleted: boolean;
  workspaceSetupRequired: boolean;
  requiresPasswordChange: boolean;
};

type AuthPayload = ApiSession & {
  user: AuthUser;
};

let inMemorySession: ApiSession | null = null;
let sessionPromise: Promise<AuthPayload> | null = null;

function toQueryString(query?: ListQuery) {
  if (!query) {
    return "";
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }

  const text = params.toString();
  return text ? `?${text}` : "";
}

function isBrowser() {
  return typeof window !== "undefined";
}

function readStoredSession(): ApiSession | null {
  if (!isBrowser()) {
    return null;
  }

  if (inMemorySession) {
    return inMemorySession;
  }

  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as ApiSession;
    if (parsed.accessToken && parsed.refreshToken) {
      inMemorySession = parsed;
      return parsed;
    }
  } catch {
    window.localStorage.removeItem(SESSION_KEY);
  }

  return null;
}

function storeSession(session: ApiSession | null) {
  inMemorySession = session;

  if (!isBrowser()) {
    return;
  }

  if (!session) {
    window.localStorage.removeItem(SESSION_KEY);
    return;
  }

  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

async function authRequest(
  path: string,
  body: Record<string, unknown>,
): Promise<AuthPayload> {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    throw (await response.json()) as ApiError;
  }

  const payload = (await response.json()) as {
    accessToken: string;
    refreshToken: string;
    user: AuthUser;
  };

  return {
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
    user: payload.user,
  };
}

async function refreshSession(refreshToken: string) {
  return authRequest("/auth/refresh", {
    refreshToken,
  });
}

async function ensureSession() {
  const existing = readStoredSession();
  if (existing) {
    return existing;
  }

  throw createUnauthorizedError("Authentication required");
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const session = await ensureSession();
  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;
  const attempt = async (token: string) =>
    fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init?.headers ?? {}),
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
      },
      cache: "no-store",
    });

  let response = await attempt(session.accessToken);

  if (response.status === 401) {
    try {
      const refreshed = await refreshSession(session.refreshToken);
      storeSession({
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken,
      });
      response = await attempt(refreshed.accessToken);
    } catch {
      storeSession(null);
      throw createUnauthorizedError("Your session has expired. Please sign in again.");
    }
  }

  if (!response.ok) {
    throw (await response.json()) as ApiError;
  }

  return (await response.json()) as T;
}

function createUnauthorizedError(message: string): ApiError {
  return {
    statusCode: 401,
    error: {
      code: "AUTH_REQUIRED",
      message,
    },
    path: "/auth/login",
    method: "POST",
    timestamp: new Date().toISOString(),
  };
}

export const apiClient = {
  get: <T>(path: string, query?: ListQuery) => request<T>(`${path}${toQueryString(query)}`),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  postFormData: <T>(path: string, body: FormData) =>
    request<T>(path, { method: "POST", body, headers: {} }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  login: async (email: string, password: string) => {
    if (!sessionPromise) {
      sessionPromise = authRequest("/auth/login", {
        email,
        password,
      }).finally(() => {
        sessionPromise = null;
      });
    }

    const payload = await sessionPromise;
    storeSession({
      accessToken: payload.accessToken,
      refreshToken: payload.refreshToken,
    });
    return payload.user;
  },
  me: () => request<AuthUser>("/auth/me"),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<AuthUser>("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  bootstrapWorkspace: (payload: {
    companyName: string;
    branchName: string;
    city?: string;
    addressLine1?: string;
    postalCode?: string;
    phone?: string;
    email?: string;
    ownerFirstName: string;
    ownerLastName: string;
  }) =>
    request<AuthUser>("/auth/bootstrap", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  hasSession: () => Boolean(readStoredSession()),
  logout: async () => {
    const session = readStoredSession();
    if (session) {
      try {
        await request<{ success: boolean }>("/auth/logout", {
          method: "POST",
          body: JSON.stringify({ refreshToken: session.refreshToken }),
        });
      } catch {
        // Ignore logout failures and clear the session locally.
      }
    }
    storeSession(null);
  },
  resolveUrl: (path: string) => `${API_URL}${path}`,
  clearSession: () => storeSession(null),
};
