import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// On Windows, `new URL(...).pathname` returns "/C:/Users/..." with a leading
// slash that Next.js rejects, silently disabling the standalone output.
// fileURLToPath gives a proper "C:\Users\..." absolute path.
const __dirname = dirname(fileURLToPath(import.meta.url));
const monorepoRoot = resolve(__dirname, "../../");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Produces apps/web/.next/standalone with a self-contained Node server
  // we ship inside the desktop installer.
  output: "standalone",
  outputFileTracingRoot: monorepoRoot,
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${process.env.API_INTERNAL_URL ?? "http://127.0.0.1:4000"}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
