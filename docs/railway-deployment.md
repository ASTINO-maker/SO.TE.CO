# Railway Deployment

This is the recommended Railway setup for SO.TE.CO ERP.

The repository deploys as:

- one Railway app service for Next.js + NestJS API
- one Railway PostgreSQL service
- one Railway volume mounted at `/app/storage` for uploaded documents

The public app uses one Railway domain. Browser calls to `/api/v1/*` are proxied internally to the NestJS API.

## 1. Push The Repo To GitHub

Push this project to:

```text
https://github.com/ASTINO-maker/SO.TE.CO.git
```

Do not use a GitHub account password for this. GitHub requires a Personal Access Token or GitHub app/CLI authentication.

## 2. Create Railway Project

1. Open Railway.
2. Create a new project.
3. Add a PostgreSQL database service.
4. Add a new service from the GitHub repository.
5. Keep the root directory as `/`.

Railway will use:

```text
railway.toml
Dockerfile
```

## 3. Add App Variables

In the app service variables, add:

```env
NODE_ENV=production
API_PORT=4000
NEXT_PUBLIC_API_URL=/api/v1
API_INTERNAL_URL=http://127.0.0.1:4000
DATABASE_URL=${{Postgres.DATABASE_URL}}
DEFAULT_TENANT_SLUG=sotec
DEFAULT_OWNER_EMAIL=admin@sotec.local
DEFAULT_OWNER_PASSWORD=replace-before-first-login
JWT_ACCESS_SECRET=replace-with-openssl-rand-hex-32
JWT_REFRESH_SECRET=replace-with-another-openssl-rand-hex-32
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL_DAYS=30
STORAGE_DRIVER=local
LOCAL_STORAGE_PATH=/app/storage
```

Generate JWT secrets locally with:

```bash
openssl rand -hex 32
```

Use a strong temporary `DEFAULT_OWNER_PASSWORD`. The owner must change it after first login.

## 4. Add Persistent Storage

In the Railway app service:

1. Add a volume.
2. Mount it at:

```text
/app/storage
```

Without this volume, uploaded documents can disappear on redeploy.

## 5. Deploy

Deploy the app service. The start script runs:

```text
prisma migrate deploy
NestJS API on port 4000
Next.js web on Railway's public PORT
```

Health check:

```text
/api/v1/health
```

## 6. First Login

Open the Railway public domain and log in:

```text
admin@sotec.local
the DEFAULT_OWNER_PASSWORD you set in Railway
```

Then change the password and complete workspace setup.

## 7. Updates

After GitHub is connected to Railway, updates are:

```bash
git push
```

Railway will rebuild and redeploy automatically from GitHub.
