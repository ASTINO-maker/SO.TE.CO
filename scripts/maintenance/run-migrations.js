const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const runtimeRoot = process.cwd();
const migrationsRoot = path.join(runtimeRoot, "packages", "database", "prisma", "migrations");
const databaseUrl = process.env.DATABASE_URL;

function fail(message) {
  console.error(message);
  process.exit(1);
}

function runPsql(args, label) {
  const result = spawnSync("psql", args, {
    env: process.env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    // Required so the client never sees a black console window flash
    // during install / app upgrade migrations.
    windowsHide: true,
  });

  if (result.error) {
    throw new Error(`${label} failed: ${result.error.message}`);
  }

  if (result.status !== 0) {
    const details = (result.stderr || result.stdout || "").trim();
    throw new Error(details ? `${label} failed:\n${details}` : `${label} failed with exit code ${result.status}`);
  }

  return (result.stdout || "").trim();
}

function escapedSqlLiteral(value) {
  return `'${value.replace(/'/g, "''")}'`;
}

function ensureMigrationsTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id" VARCHAR(36) PRIMARY KEY,
      "checksum" VARCHAR(64) NOT NULL,
      "finished_at" TIMESTAMPTZ,
      "migration_name" VARCHAR(255) NOT NULL,
      "logs" TEXT,
      "rolled_back_at" TIMESTAMPTZ,
      "started_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "applied_steps_count" INTEGER NOT NULL DEFAULT 0
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "_prisma_migrations_migration_name_key"
      ON "_prisma_migrations" ("migration_name");
  `;

  runPsql(["--no-psqlrc", "--set", "ON_ERROR_STOP=1", "--quiet", "--dbname", databaseUrl, "-c", sql], "Create migrations table");
}

function readAppliedMigrationNames() {
  const sql =
    'SELECT "migration_name" FROM "_prisma_migrations" WHERE "rolled_back_at" IS NULL AND "finished_at" IS NOT NULL ORDER BY "migration_name";';
  const output = runPsql(["--no-psqlrc", "--quiet", "--tuples-only", "--dbname", databaseUrl, "-c", sql], "Read applied migrations");
  return new Set(
    output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
  );
}

function applyMigration(migrationName, migrationFilePath) {
  const sqlContent = fs.readFileSync(migrationFilePath, "utf8");
  const checksum = crypto.createHash("sha256").update(sqlContent).digest("hex");

  runPsql(
    [
      "--no-psqlrc",
      "--set",
      "ON_ERROR_STOP=1",
      "--single-transaction",
      "--quiet",
      "--dbname",
      databaseUrl,
      "--file",
      migrationFilePath,
    ],
    `Apply migration ${migrationName}`
  );

  const insertSql = `
    INSERT INTO "_prisma_migrations" (
      "id",
      "checksum",
      "finished_at",
      "migration_name",
      "logs",
      "rolled_back_at",
      "started_at",
      "applied_steps_count"
    )
    VALUES (
      ${escapedSqlLiteral(crypto.randomUUID())},
      ${escapedSqlLiteral(checksum)},
      NOW(),
      ${escapedSqlLiteral(migrationName)},
      '',
      NULL,
      NOW(),
      1
    )
    ON CONFLICT ("migration_name") DO NOTHING;
  `;

  runPsql(["--no-psqlrc", "--set", "ON_ERROR_STOP=1", "--quiet", "--dbname", databaseUrl, "-c", insertSql], `Record migration ${migrationName}`);
}

function main() {
  if (!databaseUrl) {
    fail("DATABASE_URL is not set.");
  }

  if (!fs.existsSync(migrationsRoot)) {
    fail(`Missing migrations directory: ${migrationsRoot}`);
  }

  ensureMigrationsTable();
  const appliedMigrations = readAppliedMigrationNames();
  const migrationNames = fs
    .readdirSync(migrationsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  for (const migrationName of migrationNames) {
    const migrationFilePath = path.join(migrationsRoot, migrationName, "migration.sql");
    if (!fs.existsSync(migrationFilePath)) {
      continue;
    }

    if (appliedMigrations.has(migrationName)) {
      console.log(`[Migrations] Skipping ${migrationName}`);
      continue;
    }

    console.log(`[Migrations] Applying ${migrationName}`);
    applyMigration(migrationName, migrationFilePath);
  }

  console.log("[Migrations] Done");
}

try {
  main();
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
