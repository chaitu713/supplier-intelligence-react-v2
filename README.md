# Ozone AI 4.0

Responsible Sourcing & Supplier Intelligence

Ozone AI 4.0 is a supplier intelligence application for responsible sourcing, supplier risk management, ESG monitoring, supplier onboarding, auditing, traceability, due diligence, simulation, and AI-assisted review. The app currently uses a React + Vite frontend, a FastAPI backend, and Azure PostgreSQL as the persistence layer.

This README is intended to be a full context document. If it is given to another developer or to ChatGPT, it should explain what the application contains, what each module does, what data is used, and how the current workflows connect.

For a more exhaustive plain-English functional and technical walkthrough, including domain term explanations and a full client demo script, see:

- `docs/Ozone_AI_4_Functional_Technical_Guide.md`

## Current Product Scope

The application supports these major workflows:

- Executive dashboard for leadership-level supplier risk and exposure visibility.
- Analytics workspace for country, commodity, certification, ESG, trend, and supplier ranking analysis.
- Simulator for disruption and what-if scenario modeling.
- Supplier Engagement workspace containing Onboarding, Auditing, and Traceability.
- Continuous ESG Monitoring workspace for supplier monitoring signals, ESG alerts, trend changes, and action routing.
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
- Azure PostgreSQL as current persistence
- Header/JWT-compatible Auth/RBAC guardrails for protected AI and review actions

Current persistence:

- Azure PostgreSQL database configured through `DATABASE_URL`
- The previous CSV datasets have been migrated into PostgreSQL tables and removed from `data/`
- Local evidence uploads under `uploads/onboarding/evidence`
- Local audit evidence uploads under `uploads/auditing/evidence`
- Local traceability evidence uploads under `uploads/traceability/evidence`
- Continuous Monitoring seed data now lives in PostgreSQL tables such as `monitoring_observations`, `monitoring_alerts`, `monitoring_rules`, `monitoring_actions`, `supplier_evidence_refresh`, and `external_esg_signals`
- Traceability sample PDFs under `uploads/traceability/sample_pdfs`
- Test evidence PDFs under `uploads/certificate_test_pdfs`

PostgreSQL setup:

- Schema script: `scripts/postgres_schema.sql`
- Runtime bridge: `backend/app/services/database.py`
- PostgreSQL connection is required through `DATABASE_URL`.
- Environment-to-environment migration runbook: `docs/POSTGRES_ENVIRONMENT_MIGRATION.md`

## Application Navigation

Main frontend routes:

- `/executive-dashboard`
- `/simulator`
- `/analytics`
- `/supplier-engagement`
- `/esg-monitoring`
- `/due-diligence-agent`
- `/advisor-ai`

Navigation standards:

- Main application navigation is handled by the shared app shell.
- Module-level navigation uses full-width segmented buttons with a green active state and no numeric step labels.
- Supplier Engagement keeps Onboarding, Auditing, and Traceability mounted after first render so switching between those modules does not repeatedly cold-load the active workspace.
- Supplier Engagement, Onboarding, Auditing, Traceability, and Simulator use the same full-width inner navigation pattern for consistency.
- File upload controls use a consistent dashed green upload surface with clear title/helper text and hidden native file inputs across Onboarding and Auditing.

Redirects:

- `/` redirects to `/executive-dashboard`
- `/onboarding` redirects to `/supplier-engagement`
- `/overview-dashboard` redirects to `/executive-dashboard`
- `/risk-monitoring` redirects to `/analytics`
- `/due-diligence` redirects to `/due-diligence-agent`

Main shell:

- App brand: `Ozone AI 4.0`
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
  - Visual-first Phase 1 Continuous ESG Monitoring command center with ML anomaly scoring, ESG health visuals, supplier anomaly field, attribute heatmap, alert stream, and supplier focus cards.
- `frontend/src/features/risk-monitoring/pages/DueDiligencePage`
  - Due Diligence Agent page.
- `frontend/src/features/advisor-ai/pages/SupplierAdvisorAIPage`
  - Supplier Advisor AI page.
- `frontend/src/pages/AiReviewQueuePage.tsx`
  - AI review queue page component. The file exists, but it is not currently registered as a frontend route in `frontend/src/App.tsx`.

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
- `backend/app/security/auth.py`
  - Reads the current user for RBAC. In local mode, it returns a development user. When `AUTH_ENABLED=true`, it requires trusted user headers or a trusted bearer JWT.
- `backend/app/security/rbac.py`
  - Defines role checks such as `require_role("reviewer")` and `require_any_role(("reviewer", "compliance_manager"))`.

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
- `GET /api/v1/supplier_performance`

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

Continuous ESG Monitoring:

- `GET /api/v1/esg-monitoring/overview`
  - Returns Phase 1 monitoring KPIs, ESG indicator summaries, ML-ranked supplier watchlist, alert items, health trend buckets, and ML anomaly insight details.
- Planned later when alert lifecycle is persisted: rule execution, alert update, monthly snapshot, and monitoring decision endpoints.

Onboarding:

- `POST /onboarding/upload`
  - Used for both document extraction and final onboarding submission.
  - If a file is supplied without form fields, it processes the document and returns extracted data.
  - If form fields are supplied, it persists the onboarding record into PostgreSQL tables.
- `POST /onboarding/evidence/upload`
  - Uploads certification/evidence documents.
  - Extracts certificate fields.
  - Saves evidence metadata to `supplier_evidence_v2.csv`.
- `POST /onboarding/decision`
  - Generates the AI-assisted onboarding recommendation with deterministic fallback.
- `POST /onboarding/activate`
  - Approves and activates a pending supplier.
- `POST /onboarding/revalidate`
  - Updates an active supplier revalidation outcome.

Auditing:

- `GET /auditing/workspace`
- `POST /auditing/insights`
- `POST /auditing/decision`
- `POST /auditing/decision/apply`
- `POST /auditing/close`
- `POST /auditing/capa`
- `PATCH /auditing/capa`
- `POST /auditing/evidence/upload`
- `POST /auditing/certification-update`
- `POST /auditing/certification-extract`

Traceability:

- `GET /traceability/workspace`
- `POST /traceability/evidence/upload`
- `POST /traceability/evidence/review`
- `POST /traceability/gap-actions`
- `PATCH /traceability/gap-actions/{gap_id}`
- `POST /traceability/decision`

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
- `data/supplier_sites_v2.csv`
  - Traceability site, farm, plot, and processing location records linked to suppliers.
  - Includes coordinates, site type, region, geolocation evidence status, polygon evidence status, and deforestation risk status.
- `data/site_polygons_v2.geojson`
  - GeoJSON polygon footprints linked to supplier sites for the Traceability site and polygon view.
- `data/traceability_lots_v2.csv`
  - Lot and shipment lineage records linked to suppliers, commodities, and sites.
- `data/traceability_events_v2.csv`
  - Chain-of-custody event records for lot movement, processing, dispatch, receipt, and export milestones.
- `data/traceability_gap_actions_v2.csv`
  - Trace-specific gap actions for missing plot data, missing polygon evidence, broken chain links, expired trace evidence, and unsupported origin evidence.
- `data/traceability_gap_action_history_v2.csv`
  - Status history for traceability gap actions.
- `data/traceability_score_history_v2.csv`
  - Score snapshots for traceability score, EUDR readiness, and evidence coverage changes.
- `data/traceability_decisions_v2.csv`
  - Saved trace decision outputs generated by the Traceability decision endpoint.
- `data/due_diligence_cases_v2.csv`
  - Generated due diligence case records with supplier, date, score, decision, status, and summary.
- `data/due_diligence_decisions_v2.csv`
  - Persisted due diligence decision records with rationale and recommended actions.
- `data/due_diligence_case_notes_v2.csv`
  - Placeholder CSV for due diligence reviewer notes and case history.
- `data/ai_audit_events.jsonl`
  - Append-only AI governance event log used by the AI gateway/review flow for auditability.
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

- Valid certification examples for RSPO, Rainforest Alliance, FSC, PEFC, Fairtrade, ISO14001, ISO22000, GMP, and HACCP.
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
- Audit Queue has production-grade queue controls: supplier search, filter chips, compact metric tiles, and click-through from a supplier row directly into Audit Review.
- The active Auditing UI uses a restrained enterprise-console layout with tighter section spacing, table-like queue rows, compact summary cards, clearer status badges, and calmer CAPA/evidence/AI decision panels.
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

Implemented endpoints:

```text
GET /traceability/workspace
POST /traceability/evidence/upload
POST /traceability/evidence/review
POST /traceability/gap-actions
PATCH /traceability/gap-actions/{gap_id}
POST /traceability/decision
```

The Traceability workspace is now an operational client-demo workflow, not only a static interpretation page. It combines supplier hierarchy, commodity footprint, mapped sites, GeoJSON polygon footprints, lot movement records, chain-of-custody events, evidence coverage, open trace actions, traceability score, EUDR readiness, and generated trace decisions.

Frontend tabs:

- `Trace Overview`
  - Shows selected supplier, traceability score, EUDR readiness, evidence coverage, trace decision support, and a client-facing trace decision journey.
- `Supplier / Commodity Trace`
  - Shows supplier chain, trace evidence upload, mapped sites and polygons, lot movement timeline, commodity footprint, certification support, open trace actions, evidence review queue, and trace history.

The old `AI Trace Insights` tab was removed because its summary duplicated the richer decision support now shown in `Trace Overview`.

Traceability workflow for the current demo:

1. Select a supplier, usually `BlueRiver Commodities Ltd` for the gap-resolution walkthrough.
2. Review the trace decision journey in `Trace Overview`.
3. Generate the current trace decision.
4. Open `Supplier / Commodity Trace`.
5. Upload trace evidence to the correct site, lot, event, or gap action.
6. Review the uploaded evidence in the evidence review queue.
7. Close the related trace gap action after the evidence is accepted.
8. Generate the trace decision again and show the change in score, coverage, EUDR readiness, and decision.

Traceability evidence upload supports:

- Farm / Plot Traceability
- Geolocation / Polygon Evidence
- Chain of Custody Evidence
- Shipment / Lot Document
- Deforestation-Free Declaration

Sample PDFs for the demo are stored in:

```text
uploads/traceability/sample_pdfs
```

The recommended BlueRiver demo PDF is:

```text
uploads/traceability/sample_pdfs/02_geolocation_polygon_blueriver.pdf
```

## Continuous ESG Monitoring Module

Continuous ESG Monitoring is now implemented as a Phase 1 ML-assisted visual command center. It is not the old static ESG snapshot dashboard. The current module uses the existing ESG, risk, audit, certification, commodity, alert, and supplier context to create a visual monitoring cockpit.

The frontend route is:

```text
/esg-monitoring
```

The active frontend files are:

- `frontend/src/pages/EsgMonitoringPage.tsx`
- `frontend/src/api/esgMonitoring.ts`
- `frontend/src/features/esg-monitoring/hooks/useEsgMonitoring.ts`

The backend endpoint is:

```text
GET /api/v1/esg-monitoring/overview
```

The backend implementation is:

- `backend/app/routers/esg_monitoring.py`
- `backend/app/services/esg_monitoring_service.py`
- `backend/app/schemas/esg_monitoring.py`

The module answers:

- Which suppliers are deteriorating right now?
- Which suppliers look anomalous compared with peers?
- Which ESG indicators are driving network pressure?
- Which suppliers need monitoring, evidence refresh, audit follow-up, traceability follow-up, due diligence, or escalation?
- Which alerts should reviewers see first?

Implemented frontend visuals:

- ESG health ring
- E/S/G radar chart
- Supplier anomaly scatter/bubble field
- ESG attribute heatmap across all available ESG fields
- Compact AI alert stream
- Selected supplier driver bars
- Visual supplier watchlist cards

Current ML approach:

- Uses `IsolationForest` from scikit-learn.
- Uses an unsupervised Phase 1 anomaly score because there are not yet enough labeled historical deterioration outcomes.
- Includes ESG pillar scores, composite ESG risk, BWS, HRR, land-use risk, alert severity, certification gap, audit non-compliance, commodity exposure, country risk, and all available raw ESG attributes.
- Returns supplier-level `mlAnomalyScore` and `mlConfidence` in the watchlist response.

Current ESG attributes included:

- Environmental: carbon, energy, renewable, water, waste, recycle, pollution, land, deforestation, fines.
- Social: labor, injury, turnover, diversity, child, hours, audit, complaints, wage, satisfaction.
- Governance: corruption, compliance, board, transparency, legal, tax, disclosure, data, policy, reporting.

Backend response includes:

- Monitoring KPIs
- Indicator summaries
- ML-ranked supplier watchlist
- Alerts
- Health trend counts
- ML insight summary and flagged supplier details

Existing CSV data model available for current and future monitoring:

- `data/monitoring_observations_v2.csv`
  - Dated ESG observations per supplier and indicator.
- `data/monitoring_alerts_v2.csv`
  - Generated monitoring alerts with severity, status, trigger, and linked supplier.
- `data/monitoring_rules_v2.csv`
  - Rule definitions, thresholds, enabled state, and recommended route.
- `data/monitoring_actions_v2.csv`
  - Follow-up actions created from monitoring alerts.
- `data/supplier_evidence_refresh_v2.csv`
  - Recurring evidence freshness, stale evidence, and refresh requirements.
- `data/external_esg_signals_v2.csv`
  - Optional demo feed for climate, deforestation, labor, sanctions, or news-style signals.

Current seeded demo suppliers:

- `2001` BlueRiver Commodities Ltd
  - Governance/social pressure and open traceability polygon gaps.
- `2003` TerraSource Foods Co
  - Critical traceability gaps and audit signal.
- `2004` Cedar Grove Exports
  - Critical carbon and working-hours indicators.
- `2005` Golden Acre Ingredients
  - Certification expiry / evidence refresh requirement.
- `2007` Pacific Harvest Partners
  - Certification expiry and deforestation pressure.

Existing data to reuse:

- `data/suppliers_v2.csv`
- `data/esg_environmental_v2.csv`
- `data/esg_social_v2.csv`
- `data/esg_governance_v2.csv`
- `data/alerts_v2.csv`
- `data/audits_v2.csv`
- `data/audit_capa_v2.csv`
- `data/supplier_certifications_v2.csv`
- `data/traceability_gap_actions_v2.csv`
- `data/traceability_decisions_v2.csv`
- `data/due_diligence_cases_v2.csv`

Phase 1 limitations:

- The ML model is unsupervised and intended for demo-grade anomaly prioritization.
- Core ESG files are mostly current-state snapshots, not monthly time-series records.
- True deterioration forecasting still needs monthly snapshots, more dated observations, alert outcomes, and labeled supplier deterioration events.
- Alert lifecycle actions are visualized from the current overview response; persisted alert updates and monitoring decisions are future work.

Recommended next backend additions:

- Monthly supplier monitoring snapshot builder.
- Persisted alert lifecycle and action status updates.
- Monitoring decision endpoint with deterministic fallback.
- Optional guarded AI summary through `backend/app/services/ai_gateway.py`.

Production Azure services to document for later:

- Azure Blob Storage or Azure Data Lake Storage for raw feeds, evidence files, and historical snapshots.
- Azure Functions for scheduled monitoring jobs, evidence expiry checks, rule evaluation, and alert generation.
- Azure Event Grid for reacting to app events and file/status changes.
- Azure Event Hubs if high-volume streaming external ESG events are added.
- Azure Data Explorer for large-scale time-series observations and fast monitoring analytics.
- Azure Monitor and Application Insights for app/job/API observability.
- Azure AI Document Intelligence for extracting monitoring evidence from supplier PDFs.
- Azure OpenAI or configured AI provider through the guarded `ai_gateway`.
- Azure Maps for future geospatial/deforestation visualization.
- Azure PostgreSQL for current application persistence.

Future implementation notes:

```text
Phase 1 is implemented at /esg-monitoring with visual ML monitoring.

Next increments should add:
- Monthly supplier monitoring snapshots.
- Persisted alert lifecycle updates.
- Rule execution from monitoring_rules_v2.csv.
- Monitoring action update endpoints.
- Supplier-level monitoring decision endpoint.
- Guarded AI explanation through backend/app/services/ai_gateway.py only.
```

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
- Full-width green segmented scenario mode navigation consistent with the operational modules.

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

The current implementation now returns a structured investigation package:

- Due diligence case ID
- Supplier profile
- Operational, ESG, and overall risk scores
- Due diligence decision
- Decision rationale
- Investigation checklist
- Risk drivers
- Evidence gaps
- Recommended actions
- Connected audit, certification, traceability, and prior due diligence signals

Generated cases and decisions are persisted to CSV so the demo can show that due diligence is becoming an operational case workflow, not only a text response.

## Supplier Advisor AI

Supplier Advisor AI is the conversational assistant layer.

Endpoints:

- `POST /api/v1/advisor/sessions`
- `GET /api/v1/advisor/sessions/{session_id}`
- `POST /api/v1/advisor/sessions/{session_id}/messages`

The assistant is intended to answer supplier intelligence questions using app data and controlled AI behavior. It now builds Supplier 360 context from risk, audit status, certification health, traceability gaps, and due diligence case decisions where records exist.

Advisor prompt shortcuts now support questions such as:

- Supplier 360 summary for the highest-risk supplier.
- Which suppliers should go to due diligence first and why.
- Open audit, certification, and traceability blockers.
- Recommended decision and next actions for risky suppliers.
- Continuous monitoring investigation priorities for the future ESG/monitoring redesign.

## AI Governance and Review

The app includes AI governance components:

- Prompt policy registry
- Guardrails
- AI gateway
- Output validation
- Rate limiting
- PostgreSQL-backed audit logging
- PostgreSQL-backed review queue
- Trace IDs across AI gateway, audit log, and review queue
- SSE observability endpoints for live AI guardrail/provider events
- Auth/RBAC protection for sensitive AI and reviewer actions

AI review queue endpoints:

- `GET /api/v1/ai-review/queue`
- `POST /api/v1/ai-review/queue/{item_id}`

Low-confidence or guarded outputs can be sent to the review queue.

AI observability endpoints:

- `GET /api/v1/observability/ai-events`
- `GET /api/v1/observability/ai-events/stream`

The event stream shows backend AI lifecycle events such as guardrail pass/block, provider start, provider completion, provider error, review queued, and review resolved.

Trace IDs:

- Every AI gateway call gets a `trace_id`.
- The same `trace_id` is stored in AI audit records.
- Review queue items created from low-confidence AI output also keep the same `trace_id`.
- This lets a reviewer connect one frontend/backend AI action to its audit and review records.

Persistence:

- AI audit events are stored in the PostgreSQL `ai_audit_events` table.
- AI review items are stored in the PostgreSQL `ai_review_queue` table.
- The older JSON/JSONL files are no longer the active guardrail persistence path.

Output validation now covers:

- Audit insights
- Audit decisions
- Onboarding extraction assistance
- Onboarding decisions
- Traceability decisions
- Due diligence AI summaries

Guardrail schema migration:

- Existing PostgreSQL environments can run `python scripts/migrate_guardrails_schema.py`.
- The migration is non-destructive for guardrail tables.
- It creates or upgrades `ai_audit_events` and `ai_review_queue`.
- It adds indexes for `trace_id`, review `status`, and audit feature/status lookup.

Red-team tests:

- `tests/test_ai_red_team_guardrails.py`
- Covers prompt injection, secret leakage, fake evidence, bypass-review attempts, final-approval misuse, output validation bypasses, and legitimate prompts that should still pass.
- Run with:

```bash
python -m pytest tests/test_ai_guardrails.py tests/test_ai_red_team_guardrails.py -q
```

### Auth/RBAC Guardrail

Auth means the backend knows who is calling an endpoint.

RBAC means role-based access control. The backend checks whether the current user has the right role before allowing sensitive actions.

Current roles:

- `ai_user`: can use AI assistant and AI decision-support endpoints.
- `reviewer`: can view and resolve AI review queue items.
- `supplier_operator`: reserved for supplier evidence and data operations.
- `compliance_manager`: can apply important audit, onboarding, and traceability decisions.
- `model_admin`: reserved for AI/provider administration.

Local development behavior:

- By default, `AUTH_ENABLED=false`.
- The backend uses a local development user named `local_developer`.
- This local user has all current roles so the app keeps working during demos and local development.

Strict auth behavior:

- Set `AUTH_ENABLED=true`.
- Then requests must include identity information.
- For local/API testing, pass trusted headers:

```bash
X-User-Id: reviewer-123
X-User-Roles: ai_user,reviewer
```

Example:

```bash
curl http://localhost:8000/api/v1/ai-review/queue \
  -H "X-User-Id: reviewer-123" \
  -H "X-User-Roles: reviewer"
```

For local frontend testing with `AUTH_ENABLED=true`, set these Vite variables before starting the frontend:

```bash
VITE_DEV_USER_ID=reviewer-123
VITE_DEV_USER_ROLES=ai_user,reviewer
```

Protected endpoints now include:

- `POST /api/v1/advisor/sessions`
- `GET /api/v1/advisor/sessions/{session_id}`
- `POST /api/v1/advisor/sessions/{session_id}/messages`
- `POST /auditing/insights`
- `POST /auditing/decision`
- `POST /auditing/decision/apply`
- `POST /auditing/close`
- `POST /onboarding/decision`
- `POST /onboarding/activate`
- `POST /onboarding/revalidate`
- `POST /traceability/decision`
- `POST /traceability/evidence/review`
- `GET /api/v1/ai-review/queue`
- `POST /api/v1/ai-review/queue/{item_id}`
- `GET /api/v1/observability/ai-events`
- `GET /api/v1/observability/ai-events/stream`

Important:

- The AI review endpoint no longer trusts a reviewer ID supplied by the frontend.
- It records the reviewer from the authenticated user instead.
- This prevents one user from approving/rejecting AI review items while pretending to be someone else.

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
- Onboarding checklist evidence extraction.
- Audit evidence extraction.
- Auditing certification extraction.
- Traceability evidence extraction for plot, polygon, chain-of-custody, shipment, and deforestation-free documents.

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

- Azure PostgreSQL is the persistence layer.
- Blob storage integration is planned but not yet wired for production evidence storage.
- The application requires `DATABASE_URL` and does not use a local file-backed database fallback.

Continuous monitoring:

- ESG Monitoring is implemented as a Phase 1 visual ML command center at `/esg-monitoring`.
- The current endpoint is `GET /api/v1/esg-monitoring/overview`.
- The ML model is unsupervised and useful for anomaly prioritization, not supervised deterioration prediction.
- True continuous monitoring still needs scheduled jobs, monthly supplier snapshots, historical ESG observations, persisted alert states, external data ingestion, and event processing.

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

- Traceability now has CSV-backed sites, lots, chain-of-custody events, GeoJSON polygons, evidence uploads, review status, gap actions, score history, EUDR readiness, and saved trace decisions.
- It is suitable for an internal client demo of trace gap resolution, especially the BlueRiver missing polygon walkthrough.

Due Diligence and Advisor AI:

- Due Diligence now returns a structured case-style investigation with decision, rationale, checklist, risk drivers, evidence gaps, and actions.
- Generated due diligence cases and decisions are persisted to CSV.
- Due Diligence AI now uses the shared app AI gateway and prompt registry pattern instead of the removed standalone helper.
- Supplier Advisor AI now uses Supplier 360 context across risk, audits, certifications, traceability gaps, and due diligence decisions.

## Recommended Next Enhancements

Highest priority:

- Add supplier questionnaire / SAQ workflow.
- Add reviewer assignment and decision history when moving from demo to production workflow.
- Create persisted requirement/evidence tables instead of only serialized JSON in `suppliers_v2.csv`.
- Add Blob Storage for evidence documents.
- Continue hardening PostgreSQL schema constraints, indexes, and deployment secrets as the application data model stabilizes.
- Add production map services for full GIS interaction beyond the current embedded GeoJSON polygon renderer.

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

The application is now a functional responsible sourcing and supplier intelligence platform prototype. It includes dashboards, analytics, simulation, onboarding, evidence extraction, operational traceability, ESG monitoring, due diligence, advisor AI, and AI review governance.

The three most advanced operational workflows are now Onboarding, Auditing, and Traceability.

Onboarding workflow:

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
11. Persist supplier, commodity mappings, certifications, evidence, ESG baseline, and traceability fields into PostgreSQL tables.

Auditing workflow:

1. Load the audit queue from persisted audit, supplier, certification, evidence, and CAPA data.
2. Review audit priority, supplier context, audit history, and evidence health.
3. Upload audit evidence or certification evidence where needed.
4. Create and update CAPA actions for audit findings.
5. Generate an AI audit decision.
6. Apply or override the decision.
7. Close the audit only when decision, evidence, and CAPA closure guards allow it.

Traceability workflow:

1. Select a supplier and review the trace journey.
2. Inspect supplier chain, mapped sites, GeoJSON polygons, lots, events, commodity risk, and certification support.
3. Upload trace evidence to the correct site, lot, event, or gap action.
4. Accept or clarify uploaded evidence.
5. Close resolved trace gap actions.
6. Generate the trace decision again and show score, coverage, EUDR readiness, and decision movement.

Due Diligence workflow:

1. Select a high-risk supplier.
2. Run due diligence.
3. Review the generated case ID, supplier profile, risk scores, and recommended decision.
4. Review checklist status, risk drivers, evidence gaps, and recommended actions.
5. Use the result as the escalation bridge from analytics/auditing/traceability into supplier action.

Advisor AI workflow:

1. Open Supplier Advisor AI or the floating advisor.
2. Choose prompts based on the current lens or page.
3. Ask for Supplier 360 summaries, due diligence priorities, audit blockers, traceability gaps, or action recommendations.
4. Use the answer as a plain-English explanation layer over the structured application data.

## Documentation Verification Notes

This documentation was checked against the current application structure on 2026-05-05.

Project Markdown files reviewed:

- `README.md`
- `GUARDRAILS_IMPLEMENTATION.md`
- `docs/Ozone_AI_4_Functional_Technical_Guide.md`

Markdown files under generated/cache/vendor folders, such as `.codex-template-analysis/.pytest_cache/README.md` and `frontend/node_modules/**`, are not application documentation and were not treated as product docs.

What was verified against code:

- Frontend routes in `frontend/src/App.tsx`.
- Backend router registration in `backend/app/main.py`.
- Backend route prefixes and endpoints in `backend/app/routers/*.py`.
- Main frontend API calls in `frontend/src/pages/*` and `frontend/src/api/*`.
- Current CSV and GeoJSON data files in `data/`.
- Current test coverage in `tests/test_ai_guardrails.py`.
- Frontend dependencies and scripts in `frontend/package.json`.
- Backend dependencies in `requirements.txt`.

Important current-state clarifications:

- `frontend/src/pages/AiReviewQueuePage.tsx` exists, and `frontend/src/api/aiReview.ts` exists, but no `/ai-review` route is currently wired in `frontend/src/App.tsx`.
- ESG Monitoring is now a Phase 1 visual ML monitoring command center. The old snapshot dashboard should not be described as the current frontend experience.
- The ESG Monitoring backend endpoint is available at `GET /api/v1/esg-monitoring/overview`.
- Operational Onboarding, Auditing, Traceability, Simulator, Analytics, Due Diligence, and Advisor AI routes are wired into the frontend navigation.
