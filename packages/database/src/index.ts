import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

function hydrateEnvFromRoot() {
  if (process.env.DATABASE_URL) {
    return;
  }

  const envPath = path.resolve(__dirname, "../../../.env");

  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, "utf8");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

hydrateEnvFromRoot();

declare global {
  // eslint-disable-next-line no-var
  var __sotecPrisma__: PrismaClient | undefined;
}

export const prisma =
  globalThis.__sotecPrisma__ ??
  new PrismaClient({
    log: ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__sotecPrisma__ = prisma;
}

export * from "@prisma/client";
export * from "./seed-rbac";
export * from "./seed-demo";
