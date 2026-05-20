# Hosted Web Deployment

This is the online deployment path for the SO.TE.CO ERP. It keeps the existing web app and API, runs them behind one HTTPS domain, and stores client data in persistent Docker volumes.

## What Runs Online

- `web`: Next.js frontend
- `api`: NestJS API
- `postgres`: production PostgreSQL database
- `caddy`: HTTPS reverse proxy with automatic certificates
- `app_storage`: uploaded documents

The public site uses one domain:

```text
https://erp.example.com
```

Browser API requests go through:

```text
https://erp.example.com/api/v1
```

## Server Requirements

Use a small VPS to start:

- Ubuntu 22.04 or 24.04
- 2 CPU / 4 GB RAM minimum
- Docker and Docker Compose plugin installed
- DNS `A` record pointing the domain to the server IP
- ports `80` and `443` open

## First Deploy

On the server:

```bash
git clone <your-repo-url> sotec-erp
cd sotec-erp
cp .env.web.example .env.web
```

Edit `.env.web`:

- set `APP_DOMAIN` to the real domain, for example `erp.sotec.tn`
- set `APP_URL` and `CORS_ORIGIN` to `https://<same-domain>`
- replace `POSTGRES_PASSWORD`
- replace `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`
- replace `DEFAULT_OWNER_PASSWORD` before the first login

Generate secrets with:

```bash
openssl rand -hex 32
```

Then start the hosted app:

```bash
docker compose --env-file .env.web -f docker-compose.web.yml up -d --build
```

Check the API:

```bash
curl https://erp.example.com/api/v1/health
```

## Updating The Online Version

When you make a code change:

```bash
git pull
docker compose --env-file .env.web -f docker-compose.web.yml up -d --build
```

The API container runs pending Prisma migrations before it starts, so database structure updates are applied during deployment.

## Useful Commands

View running services:

```bash
docker compose --env-file .env.web -f docker-compose.web.yml ps
```

View logs:

```bash
docker compose --env-file .env.web -f docker-compose.web.yml logs -f
```

Restart:

```bash
docker compose --env-file .env.web -f docker-compose.web.yml restart
```

Stop:

```bash
docker compose --env-file .env.web -f docker-compose.web.yml down
```

## Backups

Back up these Docker volumes:

- `sotec-erp_postgres_data`
- `sotec-erp_app_storage`

Create a manual backup:

```bash
pnpm web:backup
```

This writes a timestamped folder under `backups/web/` with:

- `database.sql`
- `storage.tar.gz`
- `env.web.copy`

Schedule this daily and copy the backup folder to external storage. Do not deploy the client online without a tested restore process.
