# PostgreSQL Environment Migration Runbook

Use this when moving the app from the current Azure PostgreSQL dev database to another Azure PostgreSQL environment, such as your work database.

## Current App Assumption

The backend is PostgreSQL-only. It reads the active database from:

```env
DATABASE_URL=postgresql://USER:PASSWORD@SERVER.postgres.database.azure.com:5432/DB_NAME?sslmode=require
```

Do not change `DATABASE_URL` until the target database has been prepared and validated.

## Recommended Safe Path

1. Confirm target details with your work environment owner.
2. Take a backup/export of the current dev database.
3. Create/prepare the target database.
4. Apply schema to the target database.
5. Copy data from dev PostgreSQL to target PostgreSQL.
6. Validate row counts and key flows.
7. Switch `.env` / deployment secret `DATABASE_URL`.
8. Restart backend.
9. Smoke test the application.
10. Keep the old dev database untouched as rollback.

## 1. Collect Target Database Details

You need:

```text
Target server host:
Target database name:
Target username:
Target password:
Target PostgreSQL version:
Target firewall/private network access:
SSL requirement:
```

Your target connection string should look like:

```env
DATABASE_URL=postgresql://TARGET_USER:TARGET_PASSWORD@TARGET_SERVER.postgres.database.azure.com:5432/TARGET_DB?sslmode=require
```

If the database name contains hyphens, that is fine in the connection string.

## 2. Check Connectivity Before Migration

Do not switch the app yet. Test the target explicitly:

```powershell
python scripts/check_postgres_connection.py --database-url "postgresql://TARGET_USER:TARGET_PASSWORD@TARGET_SERVER.postgres.database.azure.com:5432/TARGET_DB?sslmode=require"
```

If this fails, check:

- Azure firewall allows your client IP or your network path.
- Username/password are correct.
- Database exists.
- SSL mode is required.
- Private endpoint/VNet rules if the work environment is private.

## 3. Backup Current Dev Database

Install PostgreSQL client tools if `pg_dump` is not available.

Run:

```powershell
pg_dump "postgresql://DEV_USER:DEV_PASSWORD@responsible-sourcing-ai-dev.postgres.database.azure.com:5432/responsible-sourcing-db-ai?sslmode=require" --format=custom --file backups\responsible-sourcing-dev.dump
```

Create the `backups` folder first if needed:

```powershell
mkdir backups
```

This produces a restorable dump without modifying either database.

## 4. Apply Schema To Target

If the target database is empty, run the schema in pgAdmin Query Tool:

```text
scripts/postgres_schema.sql
```

Or use `psql`:

```powershell
psql "postgresql://TARGET_USER:TARGET_PASSWORD@TARGET_SERVER.postgres.database.azure.com:5432/TARGET_DB?sslmode=require" -f scripts\postgres_schema.sql
```

If the target database already has tables, do not run a destructive schema script until the work owner confirms it is safe. The current schema script contains `DROP TABLE IF EXISTS ... CASCADE`.

## 5. Copy Data From Dev To Target

Preferred approach for a full environment copy:

```powershell
pg_restore --clean --if-exists --no-owner --dbname "postgresql://TARGET_USER:TARGET_PASSWORD@TARGET_SERVER.postgres.database.azure.com:5432/TARGET_DB?sslmode=require" backups\responsible-sourcing-dev.dump
```

Use this only when it is safe to replace target tables.

If the work target already contains real shared data, do not run `--clean`. Coordinate a table-by-table or migration-script approach instead.

## 6. Validate Target Data

In pgAdmin or `psql`, run quick counts:

```sql
SELECT COUNT(*) FROM "suppliers";
SELECT COUNT(*) FROM "transactions";
SELECT COUNT(*) FROM "audits";
SELECT COUNT(*) FROM "supplier_features";
SELECT COUNT(*) FROM "ai_audit_events";
SELECT COUNT(*) FROM "ai_review_queue";
```

Expected baseline from the current dev dataset:

```text
suppliers: 105
transactions: 7360
audits: 361
supplier_features: 105
```

Counts for audit/review tables may differ if you have used the app after migration.

## 7. Switch The App

Only after validation, update `.env`:

```env
DATABASE_URL=postgresql://TARGET_USER:TARGET_PASSWORD@TARGET_SERVER.postgres.database.azure.com:5432/TARGET_DB?sslmode=require
```

Restart backend:

```powershell
python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

## 8. Smoke Test

Check:

- Executive Dashboard loads.
- Due Diligence supplier dropdown loads.
- Advisor chat can answer.
- Audit workspace loads and can save a low-risk test update.
- Traceability workspace loads.
- ESG Monitoring loads.

## 9. Rollback

If anything fails, restore the previous `.env` `DATABASE_URL` pointing to the dev database and restart the backend.

Keep the dev database running until the target environment is confirmed stable.

## Important Safety Notes

- Never run `DROP TABLE`, `pg_restore --clean`, or the schema script against a shared work database unless the owner confirms it is safe.
- Prefer testing with a separate target database first, not a production/shared database.
- Keep passwords out of Git. Store real connection strings only in `.env`, Azure App Settings, Key Vault, or your deployment secret manager.
- For production deployment, prefer managed identity/Key Vault secret references where available.
