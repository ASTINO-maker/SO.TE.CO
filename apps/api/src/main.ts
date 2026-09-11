import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { setupSwagger } from "./common/swagger/swagger";

function resolveCorsOrigin() {
  const configuredOrigin = process.env.CORS_ORIGIN ?? process.env.APP_URL ?? "http://localhost:3000";

  if (configuredOrigin === "*") {
    if (process.env.NODE_ENV === "production") {
      throw new Error("CORS_ORIGIN='*' is not allowed in production when credentials are enabled.");
    }
    return true;
  }

  const origins = configuredOrigin
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return origins.length === 1 ? origins[0] : origins;
}

function validateProductionSecurity() {
  if (process.env.NODE_ENV !== "production") return;

  const accessSecret = process.env.JWT_ACCESS_SECRET?.trim() ?? "";
  if (accessSecret.length < 32 || /change-me|replace-with/i.test(accessSecret)) {
    throw new Error("JWT_ACCESS_SECRET must be a strong production secret (at least 32 characters).");
  }

  const ownerPassword = process.env.DEFAULT_OWNER_PASSWORD?.trim() ?? "";
  if (ownerPassword.length < 12 || /change-?me|replace-|example|default/i.test(ownerPassword)) {
    throw new Error("DEFAULT_OWNER_PASSWORD must be replaced before the first production startup.");
  }

  const ownerEmail = process.env.DEFAULT_OWNER_EMAIL?.trim() ?? "";
  if (!ownerEmail || !ownerEmail.includes("@")) {
    throw new Error("DEFAULT_OWNER_EMAIL is required in production.");
  }
}

async function bootstrap() {
  validateProductionSecurity();
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix("api/v1");
  app.enableCors({
    origin: resolveCorsOrigin(),
    credentials: true,
  });
  app.use(helmet());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  if (process.env.NODE_ENV !== "production" || process.env.ENABLE_SWAGGER === "true") {
    setupSwagger(app);
  }

  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port);
}

void bootstrap();
