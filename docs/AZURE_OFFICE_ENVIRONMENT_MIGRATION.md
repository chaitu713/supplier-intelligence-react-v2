# Azure Office Environment Migration Runbook

Use this when moving this Supplier Risk Intelligence app into a different Azure environment, such as your office tenant/subscription.

This is broader than only changing PostgreSQL. The app needs a backend runtime, PostgreSQL, Blob Storage, AI/document extraction credentials, frontend API configuration, and validation.

## 1. What Must Change

Create new office-environment values for these secrets/settings:

```env
DATABASE_URL=postgresql://USER:PASSWORD@SERVER.postgres.database.azure.com:5432/DB_NAME?sslmode=require
BLOB_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=STORAGE_ACCOUNT;AccountKey=STORAGE_KEY;EndpointSuffix=core.windows.net
BLOB_CONTAINER_NAME=supplier-documents

AI_PROVIDER=azure_openai
AZURE_OPENAI_ENDPOINT=https://YOUR_AZURE_OPENAI_RESOURCE.openai.azure.com/
AZURE_OPENAI_API_KEY=YOUR_AZURE_OPENAI_KEY
AZURE_OPENAI_DEPLOYMENT=YOUR_DEPLOYMENT_NAME
AZURE_OPENAI_API_VERSION=2024-02-01

DOCUMENT_INTELLIGENCE_ENDPOINT=https://YOUR_DOC_INTEL_RESOURCE.cognitiveservices.azure.com/
DOCUMENT_INTELLIGENCE_KEY=YOUR_DOC_INTEL_KEY
```

Optional development auth values:

```env
AUTH_ENABLED=false
DEV_USER_ID=local_developer
DEV_USER_ROLES=ai_user,reviewer,supplier_operator,compliance_manager,model_admin
```

Keep real values out of Git. Put them in local `.env`, Azure App Service Configuration, Container App secrets, Key Vault references, or your office secret manager.

## 2. Azure Resources Needed

Minimum office Azure resources:

| Resource | Purpose |
| --- | --- |
| Azure Database for PostgreSQL | Main application data |
| Azure Storage Account + Blob container | Uploaded onboarding, audit, and traceability evidence |
| Azure OpenAI or chosen AI provider | Advisor, due diligence, audit, traceability AI |
| Azure AI Document Intelligence | PDF/document extraction |
| Backend hosting | App Service, Container Apps, VM, or equivalent |
| Frontend hosting | Static Web Apps, App Service, Storage static website, or equivalent |

Recommended production extras:

| Resource | Purpose |
| --- | --- |
| Key Vault | Secrets and key rotation |
| Application Insights | Backend logs, traces, exceptions |
| Private Endpoint/VNet | Office-only database/storage access |
| Managed Identity | Secretless access where possible |

## 3. Prepare The Target PostgreSQL Database From Scratch

Confirm these details with the office Azure owner:

```text
Postgres server:
Database name:
Username:
Password:
Network access: public firewall or private endpoint/VNet
SSL mode: require
```

Check connectivity before changing the app:

```powershell
python scripts/check_postgres_connection.py --database-url "postgresql://USER:PASSWORD@SERVER.postgres.database.azure.com:5432/DB_NAME?sslmode=require"
```

If this hangs or fails, fix Azure firewall/VNet/private endpoint/DNS first. The backend currently expects PostgreSQL to be reachable when `DATABASE_URL` is configured.

Create the database itself in Azure first. In Azure Portal, use:

```text
Azure Database for PostgreSQL flexible server
Database: supplier_risk or your office-approved database name
```

Then apply the full app schema to the empty database.

Preferred Python-based setup:

```powershell
python scripts/apply_postgres_schema.py --database-url "postgresql://USER:PASSWORD@SERVER.postgres.database.azure.com:5432/DB_NAME?sslmode=require" --yes
```

Alternative with `psql`:

```powershell
psql "postgresql://USER:PASSWORD@SERVER.postgres.database.azure.com:5432/DB_NAME?sslmode=require" -f scripts\postgres_schema.sql
```

Important: `scripts/postgres_schema.sql` contains `DROP TABLE IF EXISTS ... CASCADE`. Only run it on an empty/new database or with explicit approval to replace all tables.

If the target database already has the old evidence schema, add Blob metadata columns instead of recreating all tables:

```sql
ALTER TABLE audit_evidence ADD COLUMN IF NOT EXISTS blob_name TEXT;
ALTER TABLE audit_evidence ADD COLUMN IF NOT EXISTS blob_url TEXT;
ALTER TABLE audit_evidence ADD COLUMN IF NOT EXISTS storage_provider TEXT;

ALTER TABLE supplier_evidence ADD COLUMN IF NOT EXISTS blob_name TEXT;
ALTER TABLE supplier_evidence ADD COLUMN IF NOT EXISTS blob_url TEXT;
ALTER TABLE supplier_evidence ADD COLUMN IF NOT EXISTS storage_provider TEXT;
```

## 4. Seed Or Start Empty

If the office environment has no existing data, the schema setup above is enough to create all tables. The app can then receive data through onboarding, uploads, workflow actions, and any future ingestion/import process.

For a clean empty database, validate that core tables exist:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

Then validate empty baseline counts:

```sql
SELECT COUNT(*) AS suppliers FROM suppliers;
SELECT COUNT(*) AS transactions FROM transactions;
SELECT COUNT(*) AS audits FROM audits;
SELECT COUNT(*) AS supplier_evidence FROM supplier_evidence;
SELECT COUNT(*) AS audit_evidence FROM audit_evidence;
```

Expected for a brand-new office database:

```text
All counts can be 0.
```

If the office team later wants demo/sample data, load it as a separate approved seed-data step. Do not assume dev data should be copied into the office database.

## 5. Prepare Blob Storage

Create a Storage Account and private Blob container:

```text
Container name: supplier-documents
Public access: disabled
```

Set:

```env
BLOB_CONNECTION_STRING=...
BLOB_CONTAINER_NAME=supplier-documents
```

The backend uploads evidence files to Blob when `BLOB_CONNECTION_STRING` is present. It still writes a local copy and stores these metadata fields:

```text
local_path
blob_name
blob_url
storage_provider
```

For production, prefer private Blob access and short-lived SAS download URLs in a future enhancement instead of exposing raw Blob URLs.

## 6. Backend Setup In The Office Environment

On the target machine/container:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Create `.env` or configure equivalent Azure app settings:

```env
DATABASE_URL=...
BLOB_CONNECTION_STRING=...
BLOB_CONTAINER_NAME=supplier-documents
AI_PROVIDER=azure_openai
AZURE_OPENAI_ENDPOINT=...
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_DEPLOYMENT=...
AZURE_OPENAI_API_VERSION=2024-02-01
DOCUMENT_INTELLIGENCE_ENDPOINT=...
DOCUMENT_INTELLIGENCE_KEY=...
```

Start backend locally for validation:

```powershell
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

Or use the helper:

```powershell
.\scripts\start_backend_postgres.ps1 -Port 8000
```

Health checks:

```powershell
Invoke-WebRequest http://127.0.0.1:8000/
Invoke-WebRequest http://127.0.0.1:8000/openapi.json
Invoke-WebRequest http://127.0.0.1:8000/api/v1/suppliers
Invoke-WebRequest http://127.0.0.1:8000/auditing/workspace
Invoke-WebRequest http://127.0.0.1:8000/traceability/workspace
```

## 7. Frontend Setup

Install and build:

```powershell
cd frontend
npm install
npm run build
```

Frontend API configuration:

```env
VITE_API_BASE_URL=https://YOUR_BACKEND_HOST/api/v1
VITE_DEV_USER_ID=local_developer
VITE_DEV_USER_ROLES=ai_user,reviewer,supplier_operator,compliance_manager,model_admin
```

Important current caveat: several frontend pages still call hardcoded local backend URLs such as `http://localhost:8000/auditing/...`, `http://localhost:8000/onboarding/...`, and `http://localhost:8000/traceability/...`.

Before a real office deployment, update those pages to use a shared API base URL instead of hardcoded localhost. Search:

```powershell
Select-String -Path frontend\src\**\* -Pattern "http://localhost:8000"
```

Files currently known to contain hardcoded URLs:

```text
frontend/src/pages/AuditingWorkspaceV2.tsx
frontend/src/pages/OnboardingPage.jsx
frontend/src/pages/TraceabilityWorkspace.tsx
```

## 8. What To Execute In Order

Recommended order for a clean office deployment:

```powershell
# 1. Install backend dependencies
pip install -r requirements.txt

# 2. Check office PostgreSQL connectivity
python scripts/check_postgres_connection.py --database-url "postgresql://USER:PASSWORD@SERVER.postgres.database.azure.com:5432/DB_NAME?sslmode=require"

# 3. Apply schema to new/empty target database
python scripts/apply_postgres_schema.py --database-url "postgresql://USER:PASSWORD@SERVER.postgres.database.azure.com:5432/DB_NAME?sslmode=require" --yes

# 4. Start backend
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000

# 5. Build frontend
cd frontend
npm install
npm run build
```

## 9. Smoke Test Checklist

Backend:

- `/` returns API status.
- `/openapi.json` returns schema.
- `/api/v1/suppliers` returns supplier records.
- `/api/v1/analytics/overview` returns analytics.
- `/auditing/workspace` loads audit queue.
- `/traceability/workspace` loads traceability data.
- `/api/v1/esg-monitoring/overview` loads monitoring dashboard data.
- Upload audit evidence and confirm `audit_evidence.blob_name` / `blob_url` are populated.
- Upload traceability evidence and confirm `supplier_evidence.blob_name` / `blob_url` are populated.

Frontend:

- Executive Dashboard loads.
- Supplier 360 / analytics pages load.
- Onboarding upload flow works.
- Audit workspace loads and can upload evidence.
- Traceability workspace loads and can upload/review evidence.
- Advisor AI returns either a provider response or a controlled fallback/error.

## 10. Rollback

Keep the previous environment values until office validation is complete.

Rollback steps:

1. Restore old `DATABASE_URL`.
2. Restore old Blob settings if needed.
3. Restart backend.
4. Rebuild/redeploy frontend if the API host changed.

Do not delete the old database or storage account until the office environment is stable and signed off.

## 11. Known Migration Risks

- PostgreSQL network rules are the most likely blocker. If the database is private, the backend must run inside the right VNet or have private DNS configured.
- The frontend has hardcoded `localhost:8000` calls in some pages. Fix those before hosting outside your local machine.
- `scripts/postgres_schema.sql` is destructive because it drops tables. Use only on a new/empty database.
- Blob upload depends on `azure-storage-blob` and `BLOB_CONNECTION_STRING`.
- Document extraction depends on Azure AI Document Intelligence credentials.
- AI features depend on the selected `AI_PROVIDER` and its keys/deployments.
