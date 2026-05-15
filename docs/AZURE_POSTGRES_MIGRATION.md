# Azure PostgreSQL Migration

This app now uses a database adapter that defaults to the existing SQLite file and switches to Azure PostgreSQL when `DATABASE_URL` is set.

## 1. Install Dependencies

```powershell
pip install -r requirements.txt
```

## 2. Create Azure PostgreSQL

Create an Azure Database for PostgreSQL Flexible Server, then create a database for the app.

Use an app-specific user where possible, and ensure the backend host or your local IP is allowed by Azure networking/firewall rules.

## 3. Configure The App

Add this to `.env`:

```env
DATABASE_URL=postgresql://APP_USER:APP_PASSWORD@YOUR_SERVER.postgres.database.azure.com:5432/supplier_risk?sslmode=require
```

If `DATABASE_URL` is absent, the app keeps using `data/ozone_ai.sqlite3`.

## 4. Migrate Data

Run a replace migration the first time:

```powershell
python scripts/migrate_sqlite_to_postgres.py --replace
```

The script reads `data/ozone_ai.sqlite3`, creates PostgreSQL tables, copies rows, and prints source/target row counts.

To pass the target URL explicitly:

```powershell
python scripts/migrate_sqlite_to_postgres.py --replace --database-url "postgresql://APP_USER:APP_PASSWORD@YOUR_SERVER.postgres.database.azure.com:5432/supplier_risk?sslmode=require"
```

## 5. Start The Backend

```powershell
uvicorn backend.app.main:app --reload
```

## 6. Validate

Check these app areas after migration:

- supplier list and supplier 360 views
- analytics dashboards
- auditing updates and evidence writes
- onboarding writes
- traceability actions and decisions
- AI audit event logging
- AI review queue add/list/resolve

## Notes

- The adapter is in `backend/app/services/database.py`.
- `backend/app/services/sqlite_data.py` remains as a compatibility shim for existing imports.
- PostgreSQL mode requires `psycopg`, installed through `requirements.txt`.
- Azure PostgreSQL connections should include `sslmode=require`.
