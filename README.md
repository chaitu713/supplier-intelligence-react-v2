# TCS ENVIROZONE AI 4.0

Responsible Sourcing & Supplier Intelligence

TCS ENVIROZONE AI 4.0 is a supplier intelligence application for responsible sourcing, supplier risk management, ESG monitoring, supplier onboarding, auditing, traceability, due diligence, simulation, and AI-assisted review. The app currently uses a React + Vite frontend, a FastAPI backend, and CSV-backed datasets in `data/` as the temporary persistence layer.

This README is intended to be a full context document. If it is given to another developer or to ChatGPT, it should explain what the application contains, what each module does, what data is used, and how the current workflows connect.

## Current Product Scope

The application supports these major workflows:

- Executive dashboard for leadership-level supplier risk and exposure visibility.
- Analytics workspace for country, commodity, certification, ESG, trend, and supplier ranking analysis.
- Simulator for disruption and what-if scenario modeling.
- Supplier Engagement workspace containing Onboarding, Auditing, and Traceability.
- ESG Monitoring page for indicator-level environmental, social, and governance monitoring.
- Due Diligence Agent for supplier-level investigation.
- Supplier Advisor AI for conversational supplier intelligence.
- AI review queue for low-confidence or guarded AI outputs.

## Technology Stack

Frontend:

- React 18
- TypeScript
- Vite
- React Router
- Plotly / React Plotly
- Recharts
- React Simple Maps
- Tailwind CSS support

Backend:

- FastAPI
- Pandas
- Pydantic
- scikit-learn
- Azure Document Intelligence SDK
- OpenAI / AI gateway abstractions
- CSV files as current persistence

Current persistence:

- CSV files in `data/`
- Local evidence uploads under `uploads/onboarding/evidence`
- Test evidence PDFs under `uploads/certificate_test_pdfs`

## Application Navigation

Main frontend routes:

- `/executive-dashboard`
- `/simulator`
- `/analytics`
- `/supplier-engagement`
- `/esg-monitoring`
- `/due-diligence-agent`
- `/advisor-ai`

Redirects:

- `/` redirects to `/executive-dashboard`
- `/onboarding` redirects to `/supplier-engagement`
- `/overview-dashboard` redirects to `/executive-dashboard`
- `/risk-monitoring` redirects to `/analytics`
- `/due-diligence` redirects to `/due-diligence-agent`

Main shell:

- App brand: `TCS ENVIROZONE AI 4.0`
- Subtitle: `Responsible Sourcing & Supplier Intelligence`

## Frontend Structure

Important frontend files:

- `frontend/src/App.tsx`
  - Defines the application routes.
- `frontend/src/components/layout/AppShell`
  - Shared shell/navigation layout.
- `frontend/src/features/executive-dashboard/pages/ExecutiveDashboardPage`
  - Executive dashboard page.
- `frontend/src/pages/AnalyticsPage.tsx`
  - Detailed analytics page.
- `frontend/src/pages/SimulatorPage.tsx`
  - Scenario simulator page.
- `frontend/src/pages/SupplierEngagementPage.tsx`
  - Parent workspace for onboarding, auditing, and traceability.
- `frontend/src/pages/OnboardingPage.jsx`
  - AI-assisted supplier onboarding module.
- `frontend/src/pages/AuditingWorkspaceV2.tsx`
  - Auditing workspace used by Supplier Engagement.
- `frontend/src/pages/TraceabilityWorkspace.tsx`
  - Traceability workspace.
- `frontend/src/pages/EsgMonitoringPage.tsx`
  - ESG monitoring page.
- `frontend/src/features/risk-monitoring/pages/DueDiligencePage`
  - Due Diligence Agent page.
- `frontend/src/features/advisor-ai/pages/SupplierAdvisorAIPage`
  - Supplier Advisor AI page.
- `frontend/src/pages/AiReviewQueuePage.tsx`
  - AI review queue page.

## Backend Structure

Important backend files:

- `backend/app/main.py`
  - Creates the FastAPI app, configures CORS, registers exception handlers, and includes routers.
- `backend/app/routers/*.py`
  - API route definitions.
- `backend/app/services/*.py`
  - Business logic and data processing.
- `backend/app/schemas/*.py`
  - Pydantic response/request schemas.
- `backend/app/ai/*`
  - AI guardrails, prompt registry, output validation, and related AI policy support.

Registered backend routers:

- `health_router`
- `datasets_router`
- `auditing_router`
- `analytics_router`
- `advisor_router`
- `ai_review_router`
- `esg_monitoring_router`
- `risk_router`
- `simulator_router`
- `onboarding_router`
- `traceability_router`

## Main Backend APIs

Health and datasets:

- `GET /`
- `GET /suppliers`
- `GET /api/v1/suppliers`
- `GET /esg`
- `GET /api/v1/esg`
- `GET /transactions`
- `GET /api/v1/transactions`
- `GET /supplier_performance`

Analytics:

- `GET /api/v1/analytics/overview`
- `GET /api/v1/analytics/executive-dashboard`
- `GET /api/v1/analytics/country-distribution`
- `GET /api/v1/analytics/country-analysis`
- `GET /api/v1/analytics/commodity-analysis`
- `GET /api/v1/analytics/supplier-rankings`
- `GET /api/v1/analytics/certification-analysis`
- `GET /api/v1/analytics/esg-pillar-analysis`
- `GET /api/v1/analytics/trend-analysis`
- `GET /api/v1/analytics/risk-distributions`
- `GET /api/v1/analytics/esg-distribution`

Simulator:

- `GET /api/v1/simulator/options`
- `POST /api/v1/simulator/run`

Risk and due diligence:

- `GET /api/v1/risk/overview`
- `GET /api/v1/risk/distribution`
- `GET /api/v1/risk/segmentation`
- `GET /api/v1/risk/top-suppliers`
- `POST /api/v1/risk/due-diligence`

ESG Monitoring:

- `GET /api/v1/esg-monitoring/overview`

Onboarding:

- `POST /onboarding/upload`
  - Used for both document extraction and final onboarding submission.
  - If a file is supplied without form fields, it processes the document and returns extracted data.
  - If form fields are supplied, it persists the onboarding record into CSV datasets.
- `POST /onboarding/evidence/upload`
  - Uploads certification/evidence documents.
  - Extracts certificate fields.
  - Saves evidence metadata to `supplier_evidence_v2.csv`.

Auditing:

- `GET /auditing/workspace`
- `POST /auditing/insights`
- `POST /auditing/certification-update`
- `POST /auditing/certification-extract`

Traceability:

- `GET /traceability/workspace`

Advisor AI:

- `POST /api/v1/advisor/sessions`
- `GET /api/v1/advisor/sessions/{session_id}`
- `POST /api/v1/advisor/sessions/{session_id}/messages`

AI Review:

- `GET /api/v1/ai-review/queue`
- `POST /api/v1/ai-review/queue/{item_id}`

## Data Files

Current CSV-backed datasets:

- `data/suppliers_v2.csv`
  - Supplier master data.
  - Includes supplier identity, country, tier, size, revenue, onboarding status, ESG onboarding fields, EUDR flags, traceability flags, supplier role, traceability evidence flags, labor questionnaire status, traceability notes, and serialized onboarding requirements.
- `data/supplier_commodity_map_v2.csv`
  - Many-to-many mapping between suppliers and commodities.
- `data/supplier_certifications_v2.csv`
  - Supplier certification records.
  - Includes certificate number, issuing body, scope/site, evidence id, and validation status.
- `data/supplier_evidence_v2.csv`
  - Uploaded evidence metadata.
  - Tracks local path, extracted certificate fields, validation result, notes, review status, and text preview.
- `data/commodities_v2.csv`
  - Commodity reference data.
- `data/certifications_v2.csv`
  - Certification reference data.
- `data/esg_environmental_v2.csv`
  - Environmental ESG indicators per supplier.
- `data/esg_social_v2.csv`
  - Social ESG indicators per supplier.
- `data/esg_governance_v2.csv`
  - Governance ESG indicators per supplier.
- `data/supplier_features_v2.csv`
  - Supplier risk/feature table used by analytics and scoring.
- `data/audits_v2.csv`
  - Audit findings and audit-related supplier records.
  - Columns now include core audit fields plus persisted workflow state:
    `audit_priority`, `audit_status`, `audit_decision`, `decision_notes`, `decision_date`, `capa_required`, `capa_due_date`, and `capa_status`.
- `data/audit_capa_v2.csv`
  - CSV-backed corrective action plan records linked to audits.
  - Columns: `capa_id`, `audit_id`, `supplier_id`, `issue`, `severity`, `owner`, `description`, `due_date`, `status`, `evidence_required`, `supplier_response`, `evidence_notes`, `created_date`, `closed_date`.
- `data/audit_evidence_v2.csv`
  - CSV-backed audit evidence records.
  - Stores audit report, non-compliance evidence, CAPA proof, and supplier response uploads.
  - Columns: `audit_evidence_id`, `audit_id`, `supplier_id`, `linked_capa_id`, `evidence_type`, `file_name`, `local_path`, `upload_date`, `document_status`, `validation_status`, `validation_notes`, `extracted_text_preview`.
- `data/alerts_v2.csv`
  - Supplier alerts.
- `data/transactions_v2.csv`
  - Transaction-level data used for dependency, exposure, and analytics.

## Supplier Engagement Workspace

The Supplier Engagement page groups three operational modules:

- Onboarding
- Auditing
- Traceability

The goal is to make supplier engagement operational rather than just analytical. Onboarding creates the supplier baseline, Auditing validates and updates findings, and Traceability provides chain visibility.

## Onboarding Module

The Onboarding module is implemented in `frontend/src/pages/OnboardingPage.jsx` and `backend/app/services/onboarding_service.py`.

Business rule:

- Full onboarding evidence collection is intended for suppliers with `status = Pending`.
- Newly submitted onboarding records default to `Pending`, not `Active`.
- Submitting onboarding saves the pending supplier record, certification mappings, evidence links, ESG baseline rows, and starter audit row.
- The separate `Approve & Activate` action converts the persisted supplier from `Pending` to `Active`, sets `approval_status = Approved`, stamps the approval date, and marks evidence as `Verified`.
- `Active` suppliers are treated as already onboarded and should be handled later through ESG Monitoring, periodic evidence refresh, certificate expiry review, or supplier revalidation.
- `Inactive` or suspended suppliers should not be moved through normal onboarding without a separate requalification path.

The active supplier revalidation lane lets the user select an existing `Active` supplier and update the refresh outcome without creating a duplicate onboarding record. Supported outcomes are:

- `Revalidation Requested`, which sets evidence status to `Evidence Requested`
- `Evidence Received`, which sets evidence status to `Evidence Received`
- `Needs Review`, which sets evidence status to `Needs Review` and stores blockers/notes
- `Revalidated`, which sets evidence status to `Verified`, stamps the revalidation date, and keeps the supplier `Active`

Current onboarding tabs:

1. Document Upload
2. Commodities & Certifications
3. Supplier Details
4. Review & Submit
5. Active Supplier Revalidation

### Onboarding Tab 1: Document Upload

The user uploads a supplier onboarding PDF.

The backend extracts text using:

- Azure Document Intelligence if configured
- `pdfplumber` fallback if Azure Document Intelligence is not configured or fails

The current document extractor detects:

- Supplier name
- Country
- Commodities
- Certifications

Example extracted PDF text:

```text
BlueRiver Cocoa Exports
Supplier Summary
Country: Brazil
Primary sourcing commodities: Cocoa
Responsible sourcing certifications: Fairtrade
Ready for onboarding review.
```

Expected extracted result:

```text
Supplier Name: BlueRiver Cocoa Exports
Country: Brazil
Commodities: Cocoa
Certifications: Fairtrade
```

After extraction, the user clicks `Use Extracted Data`.

### Onboarding Tab 2: Commodities & Certifications

The user confirms commodity mappings and certification mappings.

Supported commodities:

- Palm Oil
- Cocoa
- Coffee
- Rubber
- Wood
- Soya

EUDR-relevant commodities:

- Palm Oil
- Cocoa
- Coffee
- Rubber
- Wood
- Soya

If any EUDR-relevant commodity is extracted or selected, the frontend automatically sets:

```text
EUDR Relevant: Yes
Traceability Required: Yes
```

The module supports multiple commodities for one supplier. If a supplier has `Cocoa, Palm Oil, Coffee`, the ESG baseline and evidence checklist combine the requirements for all selected commodities.

Supported certification options:

- RSPO
- Rainforest Alliance
- FSC
- PEFC
- Fairtrade
- ISO14001
- ISO22000
- GMP
- HACCP

### Certification Evidence Upload

Each selected certification becomes an evidence card. The card contains:

- Certification name
- Evidence validation status
- Upload evidence button
- Certificate number
- Issuing body
- Issue date
- Expiry date
- Review status
- Scope / site
- Validation notes

Evidence upload endpoint:

```text
POST /onboarding/evidence/upload
```

The evidence extractor reads:

- Certificate Name
- Certificate Number
- Issued By / Issuer / Certification Body
- Issue Date
- Expiry Date
- Scope
- Site / Facility
- Commodity

If both `Scope:` and `Site:` appear in the PDF, the backend combines them into one frontend field:

```text
Scope value; Site: Site value
```

Evidence validation statuses:

- `Verified`
- `Expired`
- `Needs Review`
- `Evidence Received`
- `Missing Evidence`

Validation logic currently checks:

- Whether selected certification name appears in the document text.
- Whether certificate number was detected.
- Whether expiry date was detected.
- Whether expiry date is already expired.

### Evidence Test PDFs

Current onboarding test PDFs are stored in three focused folders:

```text
uploads/onboarding_test_pdfs
uploads/certificate_test_pdfs
uploads/checklist_test_pdfs
```

`uploads/onboarding_test_pdfs` contains source documents for Tab 1:

- Positive single-commodity suppliers.
- Positive multi-commodity and multi-certification suppliers.
- Aggregator scenario where chain-of-custody evidence is expected.
- Warning case with no certification declared.
- Negative extraction cases for missing country, missing commodity, and unsupported country.
- Noisy OCR-style positive sample.

`uploads/certificate_test_pdfs` contains certification card evidence:

- Valid certification examples for RSPO, Rainforest Alliance, FSC, PEFC, Fairtrade, ISO14001, ISO22000, and HACCP.
- Expired certificate test.
- Mismatched certificate upload test.
- Missing expiry date test.

`uploads/checklist_test_pdfs` contains checklist evidence:

- Complete examples for plot traceability, geolocation/polygon, deforestation declaration, labor questionnaire, chain of custody, and complete EUDR pack summary.
- Needs-review examples for missing geolocation, expired declaration, labor findings, missing lot linkage, missing supplier reference, missing cutoff date, and missing child-risk response.

### Evidence Checklist

The Onboarding module now generates an automatic evidence checklist from:

- Selected commodities
- Selected certifications
- Uploaded evidence validation state
- Supplier role
- EUDR relevance
- Traceability requirements

Example for `Cocoa + Brazil + Fairtrade`:

```text
Required evidence:
- Fairtrade certificate evidence
- Plot or farm-level traceability
- Geolocation or polygon evidence
- Deforestation-free declaration
- Labor and child-risk questionnaire
```

Each checklist item includes:

- Type
- Title
- Reason
- Status
- Whether it is required

Checklist status values include:

- `Complete`
- `Missing`
- `Requested`
- `Needs Review`
- `Expired`

Checklist uploads are validated by evidence type:

- Plot/farm traceability checks for farm or plot identifiers, supplier/farmer reference, and commodity reference.
- Geolocation/polygon evidence checks for GPS coordinates, polygon/GEOJSON terms, and farm/plot linkage.
- Deforestation-free declarations check for deforestation-free wording, cutoff/declaration date, and commodity or sourcing scope.
- Labor/child-risk questionnaires check for labor content, child-risk responses, and completion/attestation signals.
- Chain-of-custody evidence checks for custody wording, lot/batch/transaction identifiers, and source linkage.

Documents with gap signals such as `missing`, `expired`, `open findings`, `needs review`, or `corrective action` are marked `Needs Review`.

The checklist is serialized and submitted as `onboarding_requirements_json`, then stored in `suppliers_v2.csv`.

### Onboarding Tab 3: Supplier Details

The Supplier Details tab captures the supplier master record and onboarding defaults.

Supplier master fields:

- Supplier name
- Country
- Tier
- Linked parent supplier where applicable
- Size
- Annual revenue
- Status
- Onboarding date

Supplier tier logic:

- Tier 1 suppliers are direct suppliers.
- Tier 2 or Tier 3 suppliers require a linked upstream/downstream supplier mapping.
- The UI ranks linked supplier options by tier and commodity overlap where data is available.

Traceability requirement fields:

- Supplier role
  - Producer
  - Aggregator
  - Processor
  - Trader
  - Manufacturer
- Plot traceability available
- Geolocation evidence available
- Chain-of-custody evidence available
- Deforestation-free declaration available
- Labor questionnaire status
- EUDR relevant
- Traceability required
- Traceability notes

These traceability fields are persisted into `suppliers_v2.csv` and are intended to be reused later by the Traceability and ESG Monitoring modules.

ESG baseline fields:

- ESG baseline date
- Site / sourcing region
- System evidence status, shown read-only and updated automatically

### AI-Suggested ESG Baseline

Users no longer manually invent ESG scores from scratch.

The app auto-generates ESG baseline scores from:

- Country
- Commodities
- Certifications
- System evidence status

The frontend and backend both implement aligned baseline logic.

Baseline score scale:

```text
0-30   Low risk / better condition
31-60  Medium risk
61-100 High risk / stronger monitoring need
```

Current ESG baseline fields:

Environmental:

- Carbon
- Water
- Renewable
- Waste
- Land use
- Deforestation

Social:

- Labor
- Child risk
- Working hours
- Wage

Governance:

- Compliance
- Transparency
- Policy
- Reporting

Example for:

```text
Supplier: BlueRiver Cocoa Exports
Country: Brazil
Commodity: Cocoa
Certification: Fairtrade
```

Suggested scores:

```text
Land: 71
Deforestation: 77
Labor: 44
Child risk: 48
Compliance: 46
Transparency: 60
Overall baseline: 52/100
```

Reasoning:

- Cocoa is EUDR relevant.
- Brazil starts with elevated land-use monitoring sensitivity.
- Cocoa requires social due diligence around labor and child-risk.
- Fairtrade reduces some initial social and governance risk pending evidence verification.
- Scores remain conservative until evidence is verified.

Evidence can update the baseline:

- Verified evidence lowers governance uncertainty.
- Expired or needs-review evidence raises governance and disclosure risk.

### Onboarding Tab 4: Review & Submit

The Review tab shows:

- Core supplier fields
- ESG baseline date
- Evidence status, read-only from the system lifecycle
- EUDR relevance
- Traceability requirement status
- Supplier role
- Evidence checklist completion
- Site / region
- Commodity mappings
- Certification mappings
- ESG baseline sample
- Evidence gaps
- Certification review table
- Business onboarding status
- System-recommended onboarding status
- Conditions / next actions
- Blockers detected

Submission persists data to:

- `suppliers_v2.csv`
- `supplier_commodity_map_v2.csv`
- `supplier_certifications_v2.csv`
- `supplier_evidence_v2.csv`
- `esg_environmental_v2.csv`
- `esg_social_v2.csv`
- `esg_governance_v2.csv`
- `audits_v2.csv`

### AI Onboarding Decision Engine

Onboarding now includes an AI-assisted decision layer for customer demos. This means onboarding does not end at data capture; it ends with an AI recommendation, reasoning, next actions, and a business status that the user can confirm or override.

Business statuses:

- `Draft`
- `Evidence Requested`
- `Evidence Under Review`
- `Ready for Approval`
- `Approved`
- `Approved With Conditions`
- `Rejected`

Decision fields shown in the demo UI:

- AI recommendation
- AI confidence
- AI reasoning
- AI next actions
- Business status
- Conditions / next actions
- Blockers detected

The AI decision engine recommends a business status automatically from structured onboarding data:

- `Ready for Approval` when all required evidence checklist items are complete.
- `Evidence Under Review` when uploaded evidence is expired or needs review.
- `Evidence Requested` when required evidence is still missing.
- `Draft` when no required evidence trigger exists yet.

The recommendation considers supplier profile, country, commodity risk, EUDR relevance, traceability fields, evidence checklist completion, certification validity, ESG baseline score, and detected blockers.

The user can apply the AI recommendation or manually override the business status. This is designed for demos where the platform shows how AI-assisted onboarding decisions would work without requiring actual reviewer accounts, role assignment, or decision history.

Current LLM approach:

- The application already has an AI gateway that can call Gemini, OpenAI, or Azure OpenAI.
- For the current demo, Gemini is the first-priority LLM path.
- Default provider behavior is `AI_PROVIDER=gemini`.
- Configure `GEMINI_API_KEY` and optionally `GEMINI_MODEL`.
- The app asks the LLM first for AI-assisted onboarding decisions.
- Deterministic recommendations are used only if the LLM call fails, is blocked, or is not configured.
- The deterministic fallback keeps the demo reliable while the LLM remains the preferred decision/reasoning layer.

## Auditing Module

The Auditing module supports supplier audit intelligence and certification handling.

Current capabilities include:

- Backend-driven audit workspace payload from CSV.
- Frontend audit queue, selected audit, supplier context, certification context, audit history, evidence health, and metrics are loaded from `GET /auditing/workspace`.
- The older hardcoded frontend audit queue has been removed from the active `AuditingWorkspaceV2.tsx` implementation.
- `audits_v2.csv` now persists audit workflow state instead of only deriving status in memory.
- Persistent audit fields include priority, status, decision, decision date, decision notes, CAPA required, CAPA due date, and CAPA status.
- CAPA / Corrective Action Plan workflow is now implemented with CSV-backed CAPA records.
- CAPA creation and status updates roll up into `audits_v2.csv` fields: `capa_required`, `capa_status`, `capa_due_date`, and `audit_status`.
- AI Audit Decision workflow is implemented separately from general audit insights.
- The audit decision engine sends a compact selected-audit context to the LLM: selected audit, supplier summary, recent audit history, certifications, evidence summary, and CAPA actions.
- If LLM generation fails or returns invalid JSON, deterministic fallback recommends a decision from the same context.
- Audit evidence upload is implemented for audit reports, non-compliance evidence, CAPA proof, and supplier responses.
- Audit evidence uses Document Intelligence-first extraction through the shared document extraction service and then local extraction fallback.
- Audit evidence is validated using evidence-type signals and contributes to the audit evidence summary.
- Audit insight generation.
- Certification update workflow.
- Certification extraction workflow.
- Integration with audit datasets.

Important backend endpoints:

- `GET /auditing/workspace`
  - Returns audit queue, selected audit context, supplier context, audit history, certification context, evidence summary, and queue metrics.
  - Optional query parameter: `audit_id`.
  - Queue priority/status use persisted audit workflow fields when present.
  - For older rows, priority/status can still be derived from audit score, non-compliance count, expired certifications, needs-review evidence, and EUDR relevance.
- `POST /auditing/insights`
  - Generates LLM-first audit insights for a selected audit, with deterministic fallback.
- `POST /auditing/decision`
  - Generates a structured audit decision recommendation.
  - Allowed recommendations: `Pass`, `Pass with Conditions`, `Corrective Action Required`, `Escalate`, `Suspend / Block`.
  - Returns confidence, reasons, required actions, closure blockers, and source (`llm` or `deterministic_fallback`).
- `POST /auditing/decision/apply`
  - Applies the selected AI/business decision into `audits_v2.csv`.
  - Updates `audit_decision`, `decision_notes`, `decision_date`, and `audit_status`.
- `POST /auditing/close`
  - Final audit closure guard.
  - Blocks clean closure if the audit decision is not `Pass` or `Pass with Conditions`.
  - Blocks closure if evidence still needs review.
  - Blocks closure if any CAPA action is still open.
  - Clean `Pass` closure also requires at least one accepted audit/supplier evidence record.
- `POST /auditing/capa`
  - Creates a corrective action for an audit.
  - Required fields: `audit_id`, `issue`, `severity`, `owner`, `due_date`.
  - Optional fields: `description`, `evidence_required`.
- `PATCH /auditing/capa`
  - Updates CAPA status and optional supplier/evidence notes.
  - When all CAPA actions for an audit are closed, audit rollup changes to `CAPA closed`.
- `POST /auditing/evidence/upload`
  - Uploads evidence against an audit.
  - Form fields: `audit_id`, `evidence_type`, optional `linked_capa_id`, and `file`.
  - Supported evidence types in the UI: `Audit Report`, `Non-Compliance Evidence`, `CAPA Proof`, `Supplier Response`.
  - Saves files under `uploads/auditing/evidence` and metadata in `audit_evidence_v2.csv`.
- `POST /auditing/certification-update`
  - Updates a supplier certification row in `supplier_certifications_v2.csv`.
- `POST /auditing/certification-extract`
  - Extracts certification details from an uploaded PDF using the same Document Intelligence-first extraction flow used by onboarding.

Auditing is intended to validate supplier controls after onboarding and update supplier certification or audit status.

## Traceability Module

The Traceability workspace is available through Supplier Engagement.

Current endpoint:

```text
GET /traceability/workspace
```

The traceability workspace provides supplier chain context and supports linked supplier selection in onboarding.

The Onboarding module now captures traceability fields that should later feed this workspace:

- Supplier role
- Plot traceability availability
- Geolocation evidence availability
- Chain-of-custody evidence availability
- Deforestation-free declaration availability
- Traceability notes

## ESG Monitoring Module

The ESG Monitoring page is implemented in:

- `frontend/src/pages/EsgMonitoringPage.tsx`
- `backend/app/services/esg_monitoring_service.py`
- `backend/app/routers/esg_monitoring.py`
- `backend/app/schemas/esg_monitoring.py`

Main endpoint:

```text
GET /api/v1/esg-monitoring/overview
```

The page provides:

- ESG KPI strip
- Indicator Management tabs:
  - Environmental
  - Social
  - Governance
- Compliance and assurance signals separated from core environmental/social/governance indicators
- ESG Alert Feed
- Supplier ESG Watchlist
- ML ESG Health Signals panel

Environmental indicators include:

- Carbon
- Water
- Renewable
- Waste
- Land use
- Deforestation

Social indicators include:

- Labor
- Child risk
- Working hours
- Wage

Governance indicators include:

- Compliance
- Transparency
- Policy
- Reporting

The ESG Monitoring backend includes an ML-style scoring layer using:

- `IsolationForest`
- `StandardScaler`
- ESG indicators
- supplier risk features
- audit signals
- alert signals
- certification signals
- country and commodity context

Important note:

- The current ESG Monitoring implementation is an on-demand monitoring snapshot.
- It is not yet true continuous monitoring.
- True continuous monitoring would require scheduled ingestion, persisted dated observations, alert history, streaming/event jobs, and recurring external data refresh.

## Executive Dashboard

The Executive Dashboard is a leadership-level view for supplier risk and exposure.

It includes:

- KPI cards
- Operational risk mix
- ESG risk mix
- Overall risk mix
- Supplier footprint map
- Certification status donut
- Country exposure chart
- Commodity exposure chart
- Suppliers under review

Main endpoint:

```text
GET /api/v1/analytics/executive-dashboard
```

## Analytics Module

The Analytics page provides detailed supplier intelligence.

It includes:

- Overview metrics
- Country analysis
- Commodity analysis
- Supplier rankings
- Certification analysis
- ESG pillar analysis
- Trend analysis
- Risk distributions
- ESG distribution

Main endpoints:

- `GET /api/v1/analytics/overview`
- `GET /api/v1/analytics/country-analysis`
- `GET /api/v1/analytics/commodity-analysis`
- `GET /api/v1/analytics/supplier-rankings`
- `GET /api/v1/analytics/certification-analysis`
- `GET /api/v1/analytics/esg-pillar-analysis`
- `GET /api/v1/analytics/trend-analysis`
- `GET /api/v1/analytics/risk-distributions`
- `GET /api/v1/analytics/esg-distribution`

## Simulator Module

The Simulator supports what-if and disruption scenario modeling.

Current simulation modes:

- Supplier disruption
- Country disruption
- Commodity shock
- Operational deterioration
- Scenario compare

Main endpoints:

- `GET /api/v1/simulator/options`
- `POST /api/v1/simulator/run`

The simulator shows:

- Before and after KPI changes
- Risk composition shift
- Impact delta
- Risk band movement
- Most affected suppliers
- Affected supplier detail
- Scenario-specific summaries
- Scenario A vs Scenario B comparison

## Due Diligence Agent

The Due Diligence Agent is a supplier-level investigation workflow.

Main endpoint:

```text
POST /api/v1/risk/due-diligence
```

It is used when suppliers require deeper review based on:

- High risk
- ESG concern
- Certification concern
- Audit concern
- Alert concern
- Executive Dashboard watchlist status

The current business direction is to evolve this into a Supplier ESG & Due Diligence Agent, with EUDR-first capability and continuous compliance intelligence.

## Supplier Advisor AI

Supplier Advisor AI is the conversational assistant layer.

Endpoints:

- `POST /api/v1/advisor/sessions`
- `GET /api/v1/advisor/sessions/{session_id}`
- `POST /api/v1/advisor/sessions/{session_id}/messages`

The assistant is intended to answer supplier intelligence questions using app data and controlled AI behavior.

## AI Governance and Review

The app includes AI governance components:

- Prompt policy registry
- Guardrails
- AI gateway
- Output validation
- Rate limiting
- Audit logging
- Review queue

AI review queue endpoints:

- `GET /api/v1/ai-review/queue`
- `POST /api/v1/ai-review/queue/{item_id}`

Low-confidence or guarded outputs can be sent to the review queue.

## Document Intelligence

The application uses Azure Document Intelligence as the first-priority document extraction path when configured.

Environment variables:

- `AZURE_DOC_INTELLIGENCE_ENDPOINT`
- `AZURE_DOC_INTELLIGENCE_KEY`

Fallback:

- `pdfplumber` for local PDF text extraction only if Azure Document Intelligence is unavailable or fails.

Current document extraction use cases:

- Supplier onboarding document extraction.
- Certification evidence extraction.
- Auditing certification extraction.

## Local Development

Backend:

```bash
uvicorn backend.app.main:app --reload
```

Frontend:

```bash
cd frontend
npm run dev
```

Frontend build:

```bash
cd frontend
npm run build
```

## Current Verification Performed

Recent checks performed during implementation:

- Backend import check passed with:

```bash
python -B -c "import backend.app.routers.onboarding_router; import backend.app.services.onboarding_service; print('imports ok')"
```

- Frontend production build passed with:

```bash
cd frontend
npm run build
```

## Current Known Limitations

Persistence:

- CSV files are still the persistence layer.
- Blob storage integration is planned but not yet wired for production evidence storage.
- A relational database is planned later when the application shape stabilizes.

Continuous monitoring:

- ESG Monitoring is currently snapshot-based.
- True continuous monitoring still needs scheduled jobs, historical ESG observations, persisted alert states, external data ingestion, and event processing.

Document extraction:

- Extraction works best with structured PDFs containing clear labels.
- Synonyms and table-heavy evidence extraction should be improved.
- Commodity detection currently relies on supported commodity names appearing in extracted text.

ML:

- ESG Monitoring includes an ML-style anomaly/scoring layer.
- It is not yet trained on a large historical production dataset.
- More dated observations and outcome labels are needed for stronger supervised models.

Onboarding decision:

- The module now has a system recommendation, business status, conditions / next actions, and blockers detected.
- Reviewer assignment, decision history, and role-based access are intentionally future production enhancements, not part of the demo UI.

Traceability:

- Onboarding now captures traceability requirements.
- Traceability still needs deeper document linking, plot/polygon evidence handling, and chain-of-custody validation.

## Recommended Next Enhancements

Highest priority:

- Add supplier questionnaire / SAQ workflow.
- Add reviewer assignment and decision history when moving from demo to production workflow.
- Create persisted requirement/evidence tables instead of only serialized JSON in `suppliers_v2.csv`.
- Connect onboarding traceability fields directly into the Traceability workspace.
- Add Blob Storage for evidence documents.
- Add database persistence after the application data model stabilizes.

Medium priority:

- Improve extraction for table-based certificates.
- Add commodity synonyms:
  - soybean -> Soya
  - timber -> Wood
  - crude palm -> Palm Oil
- Add confidence per extracted field.
- Add external ESG/compliance feeds.
- Add scheduled ESG monitoring jobs.
- Add model evaluation datasets and ML training history.

## Summary

The application is now a functional responsible sourcing and supplier intelligence platform prototype. It includes dashboards, analytics, simulation, onboarding, evidence extraction, traceability preparation, ESG monitoring, due diligence, advisor AI, and AI review governance.

The most advanced current workflow is Onboarding:

1. Upload supplier PDF.
2. Extract supplier, country, commodities, and certifications.
3. Auto-detect EUDR relevance and traceability requirement.
4. Upload certification evidence.
5. Extract certificate metadata.
6. Validate evidence.
7. Generate commodity/certification/traceability evidence checklist.
8. Capture traceability requirements.
9. Generate AI-suggested ESG baseline scores.
10. Review and submit supplier.
11. Persist supplier, commodity mappings, certifications, evidence, ESG baseline, and traceability fields into CSV datasets.
