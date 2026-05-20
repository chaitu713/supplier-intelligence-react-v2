# Ozone AI 4.0 Technical Documentation

## 1. Technical Overview

Ozone AI 4.0 is implemented as a full-stack web application.

The main layers are:

- React frontend for the user interface.
- FastAPI backend for APIs and business logic.
- Azure PostgreSQL as the current persistence layer.
- Pandas-based services for data loading, joining, scoring, and summaries.
- AI service abstractions, prompt guardrails, and output validation for assistant-style workflows.

```mermaid
flowchart LR
    A["React + TypeScript frontend"] --> B["API client"]
    B --> C["FastAPI backend routers"]
    C --> D["Service layer"]
    D --> E["Azure PostgreSQL database"]
    D --> F["AI guardrails and prompt services"]
    D --> G["Uploaded evidence files"]
```

## 2. Frontend Technology Stack

The frontend is located in `frontend/`.

Important technologies:

| Technology | Usage |
| --- | --- |
| React 18 | Builds UI pages and components |
| TypeScript | Adds typed contracts for frontend APIs and components |
| Vite | Development server and production build tooling |
| React Router | Client-side routing between pages |
| TanStack React Query | API data fetching, loading state, caching, and mutations |
| Plotly / React Plotly | Advanced charts and visualizations |
| Recharts | Dashboard-style charts |
| React Simple Maps | Map visualizations |
| Tailwind CSS / CSS variables | Styling and layout |

Frontend scripts:

```bash
npm run dev
npm run build
npm run preview
```

## 3. Backend Technology Stack

The backend is located in `backend/app/`.

Important technologies from `requirements.txt`:

| Technology | Usage |
| --- | --- |
| FastAPI | REST API framework |
| Uvicorn | ASGI server for running FastAPI |
| Pydantic | Request and response schema validation |
| Pandas | Table loading, joining, grouping, and calculations |
| NumPy | Numerical processing support |
| scikit-learn | Machine learning and scoring utilities |
| OpenAI | AI assistant and generation integration |
| Google GenAI | Additional AI provider dependency |
| Azure AI Form Recognizer | Document extraction support |
| Azure Storage Blob | Evidence document storage for onboarding, audit, and traceability uploads |
| Azure Identity / Azure Core | Azure authentication and SDK support |
| python-dotenv | Local environment configuration |
| pytest | Testing support |

## 4. Application Architecture

### Frontend Layer

The frontend renders pages and calls backend APIs through typed API files in `frontend/src/api/`.

Important frontend files:

| File | Purpose |
| --- | --- |
| `frontend/src/App.tsx` | Defines routes |
| `frontend/src/components/layout/AppShell.tsx` | Shared header, navigation, floating Advisor AI button |
| `frontend/src/api/client.ts` | Shared API request helper |
| `frontend/src/api/analytics.ts` | Analytics and dashboard API functions |
| `frontend/src/api/simulator.ts` | Simulator API functions |
| `frontend/src/api/risk.ts` | Risk and due diligence API functions |
| `frontend/src/api/advisor.ts` | Advisor AI API functions |
| `frontend/src/api/esgMonitoring.ts` | ESG Monitoring API contract |
| `frontend/src/pages/SupplierEngagementPage.tsx` | Parent workspace for onboarding, auditing, traceability |

### Backend Layer

The FastAPI application is created in `backend/app/main.py`.

It registers:

- CORS middleware.
- Exception handlers.
- Health router.
- Dataset router.
- Auditing router.
- Analytics router.
- Advisor router.
- AI review router.
- ESG monitoring router.
- Risk router.
- Simulator router.
- Onboarding router.
- Traceability router.

### Data Layer

The current data store is Azure PostgreSQL, configured through `DATABASE_URL`.

The project previously used one CSV per dataset. Those CSVs have been migrated into PostgreSQL tables and removed from `data/`. A lightweight Pandas compatibility bridge maps legacy CSV path reads/writes to PostgreSQL tables while the service layer is gradually refactored toward direct table access.

## 5. Route Architecture

Frontend routes:

| Route | Component |
| --- | --- |
| `/executive-dashboard` | `ExecutiveDashboardPage` |
| `/simulator` | `SimulatorPage` |
| `/analytics` | `AnalyticsPage` |
| `/supplier-engagement` | `SupplierEngagementPage` |
| `/due-diligence-agent` | `DueDiligencePage` |
| `/advisor-ai` | `SupplierAdvisorAIPage` |

Redirect routes:

| Route | Redirects To |
| --- | --- |
| `/` | `/executive-dashboard` |
| `/onboarding` | `/supplier-engagement` |
| `/overview-dashboard` | `/executive-dashboard` |
| `/risk-monitoring` | `/analytics` |
| `/esg-monitoring` | `/analytics#analytics-esg` |
| `/due-diligence` | `/due-diligence-agent` |

## 6. Backend API Architecture

### Analytics APIs

Base route: `/api/v1/analytics`

Important endpoints:

- `GET /overview`
- `GET /executive-dashboard`
- `GET /country-distribution`
- `GET /country-analysis`
- `GET /commodity-analysis`
- `GET /supplier-rankings`
- `GET /certification-analysis`
- `GET /esg-pillar-analysis`
- `GET /trend-analysis`
- `GET /risk-distributions`
- `GET /esg-distribution`

Technical pattern:

1. Router receives HTTP request.
2. Service loads relevant PostgreSQL tables using Pandas.
3. Service joins supplier, ESG, certification, commodity, and transaction data.
4. Service calculates metrics.
5. Pydantic schema validates response.
6. Frontend renders charts and tables.

### Simulator APIs

Base route: `/api/v1/simulator`

Endpoints:

- `GET /options`
- `POST /run`

Technical pattern:

1. Frontend asks for available suppliers, countries, commodities, and scenario options.
2. User submits scenario.
3. Backend creates a before-and-after risk frame.
4. Service applies scenario-specific risk changes.
5. Service recomputes overall risk.
6. Response includes impact summary, changed suppliers, and deltas.

### Risk and Due Diligence APIs

Base route: `/api/v1/risk`

Endpoints:

- `GET /overview`
- `GET /distribution`
- `GET /segmentation`
- `GET /top-suppliers`
- `POST /due-diligence`

Technical pattern:

1. Build supplier risk frame.
2. Combine transaction metrics, audit metrics, alert metrics, certification metrics, commodity metrics, supplier metrics, ESG metrics, and country risk.
3. Score risk features.
4. Classify suppliers into risk levels.
5. For due diligence, generate supplier-specific drivers, evidence gaps, actions, and checklist.

### Onboarding APIs

Base route: `/onboarding`

Endpoints:

- `POST /upload`
- `POST /evidence/upload`
- `POST /decision`
- `POST /activate`
- `POST /revalidate`

Technical pattern:

1. Upload document or form data.
2. Extract text from document where applicable.
3. Map extracted text to supplier fields.
4. Validate fields.
5. Score ESG baseline.
6. Persist supplier, certification, evidence, ESG, traceability, and audit starter rows into PostgreSQL tables.
7. Use AI assistance where configured, with guardrails and fallback logic.

### Auditing APIs

Base route: `/auditing`

Endpoints:

- `GET /workspace`
- `POST /insights`
- `POST /decision`
- `POST /decision/apply`
- `POST /close`
- `POST /capa`
- `PATCH /capa`
- `POST /evidence/upload`
- `POST /certification-update`
- `POST /certification-extract`

Technical pattern:

1. Load audit workspace data from PostgreSQL.
2. Generate insights or decision recommendation.
3. Persist changes to audit, CAPA, certification, and evidence files.
4. Use document extraction where relevant.

### Traceability APIs

Base route: `/traceability`

Endpoints:

- `GET /workspace`
- `POST /gap-actions`
- `PATCH /gap-actions/{gap_id}`
- `POST /decision`
- `POST /evidence/review`
- `POST /evidence/upload`

Technical pattern:

1. Load suppliers, sites, lots, events, certifications, evidence, and gaps.
2. Build traceability score and EUDR readiness.
3. Manage gap action creation and updates.
4. Review uploaded evidence and apply effects to supplier traceability flags.
5. Persist decisions and score history.

### Advisor AI APIs

Base route: `/api/v1/advisor`

Endpoints:

- `POST /sessions`
- `GET /sessions/{session_id}`
- `POST /sessions/{session_id}/messages`

Technical pattern:

1. Create chat session.
2. Store or retrieve session messages.
3. User sends message with optional page lens and simulator context.
4. Backend builds grounded response using available context and AI guardrails.
5. Response is returned to frontend chat UI.

### AI Review APIs

Base route: `/api/v1/ai-review`

Endpoints:

- `GET /queue`
- `POST /queue/{item_id}`

Technical pattern:

1. Retrieve pending or reviewed AI items.
2. User approves, rejects, or reviews AI item.
3. Decision is persisted through the review service or queue handling logic.

### ESG Monitoring API

Base route: `/api/v1/esg-monitoring`

Endpoint:

- `GET /overview`

Current technical status:

- Backend service exists.
- Frontend API contract exists.
- Frontend page has been removed.
- Executive Dashboard and Analytics consume the ESG Monitoring overview API.
- Current endpoint is an on-demand overview snapshot.

## 7. Data Model Overview

Important PostgreSQL tables:

| File | Technical Role |
| --- | --- |
| `suppliers` | Main supplier master table |
| `transactions` | Transaction history and volume |
| `esg_environmental` | Environmental ESG indicators |
| `esg_social` | Social ESG indicators |
| `esg_governance` | Governance ESG indicators |
| `certifications` | Certification reference list |
| `supplier_certifications` | Supplier certification records |
| `commodities` | Commodity reference list |
| `supplier_commodity_map` | Supplier-to-commodity mappings |
| `audits` | Audit records |
| `audit_capa` | Corrective action records |
| `audit_evidence` | Audit evidence metadata |
| `alerts` | Supplier alert records |
| `supplier_evidence` | Supplier evidence metadata |
| `supplier_features` | Derived or model-ready supplier feature fields |
| `traceability_*` | Traceability sites, lots, events, gaps, decisions, score history |
| `monitoring_*` | Seed data for future monitoring |
| `external_esg_signals` | External ESG signal examples |

## 8. Data Flow Example: Executive Dashboard

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant API
    participant Service
    participant DB

    User->>Frontend: Open Executive Dashboard
    Frontend->>API: GET /api/v1/analytics/executive-dashboard
    API->>Service: get_executive_dashboard()
    Service->>DB: Load suppliers, transactions, ESG, audits, alerts
    DB-->>Service: DataFrames
    Service-->>API: Dashboard response object
    API-->>Frontend: JSON
    Frontend-->>User: KPI cards, charts, supplier attention list
```

## 9. Data Flow Example: Onboarding

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant API
    participant Service
    participant Storage

    User->>Frontend: Upload onboarding document
    Frontend->>API: POST /onboarding/upload
    API->>Service: Extract text and map fields
    Service-->>Frontend: Extracted supplier data
    User->>Frontend: Review and submit supplier
    Frontend->>API: POST /onboarding/upload with form fields
    API->>Service: Validate and persist
    Service->>Storage: Update PostgreSQL tables and evidence metadata
    Service-->>Frontend: Pending supplier created
```

## 10. Feature-to-Technology Mapping

| Feature | Frontend | Backend | Data / Processing |
| --- | --- | --- | --- |
| Executive Dashboard | React, React Query, charts | Analytics router/service | Pandas aggregation across supplier data |
| Analytics | React, Plotly, Recharts, maps | Analytics APIs | Country, commodity, ESG, certification, trend calculations |
| Simulator | React forms and scenario UI | Simulator service | Risk frame recomputation in Pandas |
| Onboarding | Upload UI, form workflow | Onboarding router/service | Document extraction, validation, PostgreSQL persistence |
| Auditing | Workspace UI | Auditing router/service | Audit, CAPA, certification, evidence data |
| Traceability | Workspace UI | Traceability router/service | Sites, lots, events, evidence, score calculations |
| Due Diligence | Supplier investigation UI | Risk service | Risk driver and evidence gap generation |
| Advisor AI | Chat page and overlay | Advisor router/service | AI context, guardrails, session messages |
| AI Review | Queue page component | AI review router | Human review of AI items |
| ESG Monitoring | Embedded in Executive Dashboard and Analytics | ESG monitoring router/service | Internal supplier ESG data, calculated overview, alerts, and ML anomaly scoring |

## 11. AI Architecture

The AI-related code is structured around:

- Prompt registry.
- Guardrails.
- Output validation.
- Deterministic fallback behavior.
- Review queue support.

Important files:

| File | Purpose |
| --- | --- |
| `backend/app/ai/guardrails.py` | Blocks unsafe or unsupported AI requests |
| `backend/app/ai/prompt_registry.py` | Stores prompt policy and feature prompt definitions |
| `backend/app/ai/output_validation.py` | Validates AI-generated structured outputs |
| `data/ai_audit_events.jsonl` | Stores AI audit trail examples |

Important design principle:

AI is advisory. It should not create final procurement, legal, compliance, or audit decisions without human review.

## 12. Current ESG Monitoring Technical Status

### Frontend

Files:

- `frontend/src/api/esgMonitoring.ts`
- `frontend/src/features/esg-monitoring/hooks/useEsgMonitoring.ts`
- `frontend/src/features/executive-dashboard/pages/ExecutiveDashboardPage.tsx`
- `frontend/src/pages/AnalyticsPage.tsx`

Current implementation:

- There is no standalone `EsgMonitoringPage`.
- `/esg-monitoring` redirects to the ESG section inside Analytics.
- Executive Dashboard calls the ESG Monitoring overview API to render a leadership snapshot.
- Analytics calls the ESG Monitoring overview API to render the supplier monitoring queue, alert summary, and ML monitoring context.
- Numeric values shown to users are rounded to two decimals where decimals are displayed.

### Frontend API Contract

The frontend contract defines TypeScript interfaces for:

- `GET /api/v1/esg-monitoring/overview`
- `EsgMonitoringKpi`
- `EsgIndicatorSummary`
- `EsgWatchlistSupplier`
- `EsgAlertItem`
- `EsgHealthTrend`
- `EsgMlInsights`

### Backend

Files:

- `backend/app/routers/esg_monitoring.py`
- `backend/app/services/esg_monitoring_service.py`
- `backend/app/schemas/esg_monitoring.py`

The backend has logic for:

- Monitoring overview.
- Monitoring KPIs.
- ESG indicator summaries.
- Supplier watchlist.
- Alert items.
- ML-style anomaly insights.

The current backend returns an on-demand overview snapshot. It does not yet run scheduled public API ingestion jobs.

## 13. ESG Monitoring Technical Design

This section maps the embedded ML Continuous ESG Monitoring views and the public API extension path.

### 13.1 Embedded Monitoring Surfaces

Implemented technical behavior:

- Executive Dashboard calls `useEsgMonitoringOverview` and renders open alerts, deteriorating suppliers, average ESG health, the first supplier to review, and the highest open alert.
- Analytics calls `useEsgMonitoringOverview` and renders the ESG Monitoring Queue inside the ESG section.
- The old route remains as a redirect for compatibility, but the navigation no longer exposes ESG Monitoring as a standalone page.

### 13.2 Supplier ESG Health Score

Technical implementation:

- Combine environmental, social, and governance risk fields.
- Normalize scores to 0 to 100.
- Invert risk where needed so higher health means better condition.
- Return `esgHealthScore` for watchlist suppliers and `averageEsgHealth` for the KPI strip.
- Store monthly score snapshots in a future table when historical monitoring is added.

Example formula:

```text
ESG health = 100 - weighted ESG risk
weighted ESG risk = environmental * 0.4 + social * 0.35 + governance * 0.25
```

Recommended future data store:

- `supplier_esg_monthly_snapshots`

### 13.3 ML Anomaly Detection

Technical implementation:

- Use scikit-learn IsolationForest when model dependencies and sufficient rows are available.
- Use deterministic fallback scoring when ML fitting is not possible.
- Input features can include ESG risk, alerts, certification gaps, audit non-compliance, evidence age, country risk, commodity risk, and transaction dependency.
- Return `averageAnomalyScore`, `flaggedSuppliers`, top model signals, and flagged supplier details.

Example features:

| Feature | Meaning |
| --- | --- |
| `environmental_risk_score` | Environmental supplier risk |
| `social_risk_score` | Social supplier risk |
| `governance_risk_score` | Governance supplier risk |
| `open_alert_count` | Number of open supplier alerts |
| `evidence_age_days` | Age of latest evidence |
| `expired_certification_count` | Number of expired certifications |
| `audit_non_compliance_count` | Audit issues |
| `country_risk_score` | Country-level risk |
| `commodity_pressure_score` | Commodity-level risk |

Output:

- `ml_anomaly_score`
- `ml_signal_label`
- `top_anomaly_drivers`
- `ml_confidence`

### 13.4 Trend Monitoring

Technical implementation:

- Current overview returns aggregate `healthTrends`.
- Persist monthly snapshots.
- Calculate rolling averages.
- Compare latest score vs previous month or quarter.
- Generate trend labels.

Example labels:

- `Improving`
- `Stable`
- `Deteriorating`
- `New critical signal`

Technical endpoints:

- `GET /api/v1/esg-monitoring/trends`
- `GET /api/v1/esg-monitoring/suppliers/{supplier_id}/history`

These are recommended future endpoints. The current UI uses `GET /overview`.

### 13.5 Alert Stream and Alert Lifecycle

Technical implementation:

- Current overview returns open ESG alert items.
- Add alert status update endpoint.
- Add alert assignment, due date, and notes.

Suggested endpoints:

- `GET /api/v1/esg-monitoring/alerts`
- `PATCH /api/v1/esg-monitoring/alerts/{alert_id}`
- `POST /api/v1/esg-monitoring/alerts/{alert_id}/notes`

Suggested fields:

- `alert_id`
- `supplier_id`
- `indicator`
- `severity`
- `status`
- `owner`
- `due_date`
- `created_at`
- `resolved_at`
- `linked_action_id`

### 13.6 Monitoring Actions

Technical implementation:

- Current overview returns recommended actions attached to alerts and watchlist suppliers.
- Add create/update endpoints.
- Link actions to alerts and suppliers.

Suggested endpoints:

- `POST /api/v1/esg-monitoring/actions`
- `PATCH /api/v1/esg-monitoring/actions/{action_id}`
- `GET /api/v1/esg-monitoring/actions?status=open`

### 13.7 Evidence Refresh Monitoring

Evidence refresh is a recommended extension. It should track stale or missing supplier evidence.

Technical implementation:

- Use `supplier_evidence_v2.csv`.
- Use `supplier_evidence_refresh_v2.csv`.
- Calculate evidence age.
- Derive status:
  - `Current`
  - `Due soon`
  - `Expired`
  - `Missing`

Possible endpoint:

- `GET /api/v1/esg-monitoring/evidence-refresh`

### 13.8 External ESG Signal Ingestion

Public API and external ESG ingestion is a recommended extension. It should include ESG signals from outside the internal data files.

Technical implementation:

Prototype:

- Use `external_esg_signals_v2.csv`.
- Treat each row as signal input.

Production:

- Scheduled ingestion jobs.
- External APIs or file drops.
- Deduplication and entity matching.
- Signal severity classification.
- Source freshness and confidence scoring.
- Supplier linkage by supplier name, country, commodity, region, and site location where available.

Possible components:

- Signal ingestion service.
- Supplier/entity matching service.
- Alert generation service.
- Signal audit log.

Recommended public API categories:

| Category | Example Technical Source Type | Matching Key |
| --- | --- | --- |
| Climate and disaster | Public hazard or disaster feeds | Supplier country, region, site |
| Deforestation and land use | Forest-loss or protected-area feeds | Commodity, country, coordinates |
| News and incidents | Public news/event APIs | Supplier name, country, commodity |
| Macro ESG indicators | Public country ESG datasets | Country |
| Pollution and environment | Air/water/environmental quality feeds | Region or site coordinates |

Suggested normalized table:

```text
external_esg_signals
- signal_id
- source_name
- source_url
- source_category
- observed_at
- ingested_at
- country
- region
- commodity
- supplier_name_match
- latitude
- longitude
- severity
- confidence
- signal_title
- signal_summary
- raw_payload_ref
```

### 13.9 Monthly Snapshot Builder

Functional goal:

Persist supplier ESG state over time.

Technical implementation:

- Create a scheduled job that runs monthly.
- Load current supplier/ESG/evidence/audit/certification data.
- Calculate monitoring features.
- Save snapshot records.

Suggested future table:

```text
supplier_esg_monitoring_snapshots
- snapshot_id
- supplier_id
- snapshot_month
- environmental_risk
- social_risk
- governance_risk
- esg_health_score
- anomaly_score
- open_alert_count
- stale_evidence_count
- certification_gap_count
- trend_label
```

### 13.10 ML Monitoring Pipeline Diagram

```mermaid
flowchart TB
    A["Supplier tables"] --> D["Feature builder"]
    B["ESG tables"] --> D
    C["Audit, alert, certification, evidence tables"] --> D
    E["External ESG signals"] --> D
    D --> F["Feature table"]
    F --> G["Rules and ML scoring"]
    G --> H["Health score"]
    G --> I["Anomaly score"]
    G --> J["Alerts"]
    J --> K["Action tracker"]
    H --> L["Monitoring UI"]
    I --> L
    K --> L
```

## 14. Suggested Future Database Design

The current CSV approach is fine for prototype work. For production, recommended storage would include:

| Area | Recommended Store |
| --- | --- |
| Supplier master data | Relational database |
| Transactions | Database or data warehouse |
| Evidence files | Azure Blob Storage, with local upload fallback for development |
| Evidence metadata | Relational database |
| ESG snapshots | Time-series table or warehouse table |
| External signals | Event store or normalized signal table |
| AI audit logs | Append-only log table |
| Monitoring alerts/actions | Relational workflow tables |

## 15. Non-Functional Considerations

### Security

- Add authentication and role-based access.
- Restrict who can approve suppliers, close audits, and resolve alerts.
- Protect uploaded evidence files.
- Audit all AI-assisted decisions.

### Data Quality

- Validate CSV or database inputs.
- Track missing supplier IDs.
- Standardize country and commodity names.
- Prevent duplicate supplier records.

### Reliability

- Add automated tests for scoring services.
- Add API contract tests.
- Add retry logic for external AI or document extraction services.

### Scalability

- Harden PostgreSQL schema, indexes, and deployment migration practices.
- Cache dashboard aggregations.
- Use background jobs for snapshot generation.
- Use event-driven ingestion for external ESG signals.

### Explainability

- Every score should show drivers.
- Every AI recommendation should list evidence used.
- Every alert should explain why it was generated.

## 16. Build and Verification

Frontend build command:

```bash
cd frontend
npm run build
```

Known build note:

- The build currently completes successfully.
- Vite reports a large chunk warning because the generated JavaScript bundle is over 500 kB.
- This is a performance warning, not a build failure.

Possible future improvement:

- Add route-based code splitting.
- Move heavy chart libraries into lazy-loaded chunks.

## 17. Current Technical Summary

Implemented:

- React app shell and routing.
- Executive dashboard.
- Analytics.
- Simulator.
- Supplier Engagement workspace.
- Onboarding.
- Auditing.
- Traceability.
- Due Diligence Agent.
- ESG Monitoring embedded in Executive Dashboard and Analytics.
- Backend ESG monitoring API.
- ESG monitoring schemas.
- ESG monitoring service logic.
- Supplier Advisor AI.
- AI review backend and page component.
- FastAPI backend with routers and service layer.
- PostgreSQL-backed persistence.
- AI guardrails and validation.

Available for future ESG Monitoring expansion:

- Scheduled external public API ingestion.
- ESG signal event store.
- Monthly supplier ESG snapshots.
- Alert lifecycle update APIs.
- Monitoring action workflow APIs.
