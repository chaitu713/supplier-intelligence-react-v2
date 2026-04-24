# Supplier AI System

This project is an AI-driven Supplier Intelligence application with a FastAPI backend and a React frontend. The current implementation is centered around a multi-step AI Assisted Supplier Onboarding module built on top of the existing `v2` CSV datasets, with supporting dashboard, risk, and advisor views.

## Current Stack
- Backend: FastAPI
- Frontend: React + Vite + TypeScript + Tailwind
- Data source: CSV datasets in `data/`
- AI integrations:
  - Azure Document Intelligence for document OCR/extraction
  - Gemini using `gemini-3.1-flash-lite-preview` for onboarding assist and advisor flows

## Active Application Modules
- AI Assisted Supplier Onboarding
- AI Assisted Auditing
- Overview Dashboard
- Risk Monitoring
- Due Diligence
- Supplier Advisor AI

## Routing
The frontend now uses Supplier Onboarding as the default entry flow.

- `/` redirects to `/onboarding`
- `/onboarding` is the primary intake module
- `/supplier-engagement` now hosts the shared Supplier Engagement workspace
- wildcard routes also redirect to `/onboarding`

## AI Assisted Auditing
Auditing now lives inside the Supplier Engagement workspace as a separate sub-module. The first auditing step is intentionally audit-centric and does not require any new uploads.

### Tab 1: Audit Queue
Frontend:
- Supplier Engagement now includes a dedicated `Auditing` module tab
- The auditing workspace includes 3 internal tabs:
  - `Audit Queue`
  - `Audit Review`
  - `AI Audit Insights`
- `Audit Queue` is the first implemented step
- Queue cards/rows show:
  - supplier name
  - supplier country
  - supplier ID
  - audit type
  - audit date
  - audit score
  - non-compliance count
  - audit status
- Queue filter chips currently support:
  - `All`
  - `High priority`
  - `Open review`
  - `External`
- The selected audit is tracked in UI and will be reused by the next two auditing tabs
- No supplier PDF, image, or certification upload is required for this first auditing version

Backend / data basis:
- This first auditing step is currently read-only and grounded in existing `v2` datasets
- The queue is built from the existing shape of:
  - `data/audits_v2.csv`
  - `data/suppliers_v2.csv`
  - `data/supplier_certifications_v2.csv`
- No new tables are introduced
- No new upload endpoint is required for the first auditing slice
- This keeps Auditing truthful to the current data model while later tabs add review and AI interpretation layers

### Tab 2: Audit Review
Frontend:
- `Audit Review` now opens the currently selected audit from the queue
- The review workspace shows:
  - selected audit summary
  - supplier context
  - certification context
  - supplier-level audit history
- Selected audit summary includes:
  - audit ID
  - supplier ID
  - audit type
  - audit date
  - score
  - non-compliance count
  - country
  - priority
- Supplier context is intentionally lightweight and includes:
  - supplier name
  - tier
  - size
  - annual revenue
  - supplier status
  - latest audit type
- Certification context is shown as audit support context only and includes:
  - certification name
  - certification status
  - expiry date
  - derived expiry state
- Supplier audit history is shown as a chronological list so the current audit can be compared with prior records

Backend / data basis:
- This step remains read-only and uses existing `v2` data structure
- The review experience is grounded in:
  - `data/audits_v2.csv`
  - `data/suppliers_v2.csv`
  - `data/supplier_certifications_v2.csv`
  - `data/certifications_v2.csv`
- No upload flow is introduced
- No new persistence layer is introduced
- This keeps Audit Review focused on human review of current audit records before the AI insights layer is added

Derived certification expiry state:
- The auditing module now derives certificate health against the current runtime date
- Derivation rules:
  - `expiry_date` before today => `Expired`
  - `expiry_date` within 30 days from today => `Expiring soon`
  - `expiry_date` after that with raw status `Pending` => `Pending`
  - `expiry_date` after that with non-pending status => `Valid`
- This derived state is shown in Audit Review and is also passed into AI Audit Insights

### Tab 3: AI Audit Insights
Frontend:
- `AI Audit Insights` now interprets the currently selected audit from the queue/review flow
- When the tab opens, the frontend calls `POST /auditing/insights` for the selected audit ID
- The tab presents:
  - audit health
  - history trend
  - certification health
  - suggested decision
- The summary layer includes:
  - AI-style audit summary
  - key concerns
  - reviewer focus areas
  - suggested next actions
  - decision support
- The current implementation is intentionally grounded and explainable rather than pretending to be autonomous auditing

Backend / data basis:
- This step is now backed by a dedicated auditing endpoint:
  - `POST /auditing/insights`
- The insight layer is derived from:
  - selected row from `data/audits_v2.csv`
  - supplier-level audit history from `data/audits_v2.csv`
  - supplier context from `data/suppliers_v2.csv`
  - certification context from `data/supplier_certifications_v2.csv`
  - certification names from `data/certifications_v2.csv`
- Gemini using `gemini-3.1-flash-lite-preview` is used to generate structured audit insights
- The backend asks Gemini for:
  - summary
  - key concerns
  - reviewer focus
  - next actions
  - suggested decision
  - confidence
- If Gemini is unavailable or returns unusable output, the backend falls back to grounded deterministic audit insights so the tab still works
- No upload flow is introduced
- No new tables are introduced
- This gives the auditing module a truthful AI-assisted review layer without over-claiming autonomous auditing

## AI Assisted Traceability
Traceability now lives inside the Supplier Engagement workspace as a separate sub-module. The current implementation is intentionally focused on supplier-to-commodity-to-country visibility and certification-backed trace confidence using the existing `v2` mappings.

### Tab 1: Trace Overview
Frontend:
- The traceability workspace includes 3 internal tabs:
  - `Trace Overview`
  - `Supplier / Commodity Trace`
  - `AI Trace Insights`
- `Trace Overview` is built as a supplier and commodity coverage workspace
- Overview cards show:
  - suppliers mapped
  - commodity families
  - high-risk suppliers
  - trace gaps
- Filter chips currently support:
  - `All suppliers`
  - `High-risk commodities`
  - `Gaps to review`
- Supplier cards summarize:
  - supplier name
  - country
  - mapped commodity count
  - certification count
  - commodity names
- A commodity coverage section shows supplier spread, country spread, and commodity risk level

Backend / data basis:
- This step is currently read-only and grounded in:
  - `data/suppliers_v2.csv`
  - `data/supplier_commodity_map_v2.csv`
  - `data/commodities_v2.csv`
  - `data/supplier_certifications_v2.csv`
- Traceability is now backed by:
  - `GET /traceability/workspace`
- The frontend uses this endpoint to load the broader mapped supplier set instead of staying limited to the initial small sample
- In Traceability, `risk_level` is now derived from `deforestation_risk_score` instead of trusting the raw commodity label directly:
  - `>= 0.66` => `High`
  - `0.33 to < 0.66` => `Medium`
  - `< 0.33` => `Low`
- No upload flow is introduced
- No new persistence layer is introduced

### Tab 2: Supplier / Commodity Trace
Frontend:
- `Supplier / Commodity Trace` shows a selected supplier trace view
- The review workspace includes:
  - selected supplier summary
  - country anchor
  - commodity footprint
  - certification-backed trace context
  - trace confidence summary
- Commodity footprint includes:
  - commodity name
  - volume
  - deforestation risk score
  - commodity risk level
- Certification-backed trace shows whether trace support is:
  - `Expired`
  - `Pending`
  - `Valid`

Backend / data basis:
- This step remains read-only and is grounded in:
  - `data/suppliers_v2.csv`
  - `data/supplier_commodity_map_v2.csv`
  - `data/commodities_v2.csv`
  - `data/supplier_certifications_v2.csv`
  - `data/certifications_v2.csv`
- The current trace view is intentionally supplier-level and commodity-level; it does not claim batch-level or site-level lineage

### Tab 3: AI Trace Insights
Frontend:
- `AI Trace Insights` interprets the selected supplier trace picture
- The tab presents:
  - trace confidence
  - expired support count
  - pending support count
  - suggested decision
- The insight layer includes:
  - trace summary
  - key trace concerns
  - practical next actions
  - decision support

Backend / data basis:
- This first version is a grounded traceability interpretation layer built from current mappings already available in the frontend
- The insight layer is based on:
  - supplier-country context
  - supplier-to-commodity mappings
  - commodity risk levels
  - certification-backed trace support
- No upload flow is introduced
- No new tables are introduced
- This keeps the module truthful as supplier traceability intelligence rather than over-claiming deep chain-of-custody verification

## AI Assisted Supplier Onboarding
The onboarding experience lives at `/onboarding` and currently supports 4 steps using the existing `v2` data model.

### Step 1: Document Upload
Frontend:
- Supplier document upload input
- Upload and extraction trigger
- Extracted value preview for supplier name, country, commodities, and certifications
- Validation summary with errors and warnings
- AI remediation assist panel when warnings/errors exist
- AI country guidance now includes both:
  - a direct suggested country when confidence is strong enough
  - a ranked `possible countries` list when the country is ambiguous
- Raw extracted text preview
- Handoff action into the next onboarding tab

Backend:
- `POST /onboarding/upload` accepts either a file upload or a structured form submission
- `backend/app/services/onboarding_service.py` uses Azure Document Intelligence when credentials are available
- The onboarding service also supports the existing `.env` naming currently used in the project:
  - `DOCUMENT_INTELLIGENCE_ENDPOINT`
  - `DOCUMENT_INTELLIGENCE_KEY`
- If Azure extraction is unavailable or fails, the service falls back to local PDF text extraction using `pdfplumber`
- Extracted text is mapped into `supplier_name`, `country`, `commodities`, and `certifications`
- The rule-based country matcher supports:
  - India
  - Indonesia
  - Brazil
  - USA
  - China
  - Vietnam
  - Germany
  - Thailand
  - Malaysia
  - Singapore
  - Philippines
  - Mexico
  - Netherlands
  - France
  - UK
- Validation checks ensure supplier name, country, and at least one commodity are present
- When warnings or errors exist, Gemini is used to generate onboarding remediation guidance

### Step 2: Supplier Details
Frontend:
- Editable supplier fields for `supplier_name`, `country`, `tier`, `size`, `annual_revenue`, `onboarding_date`, and `status`
- Defaults seeded from extracted document values where available
- Readiness card showing required-field completion
- Navigation into the commodity and certification mapping step

Backend:
- The onboarding API accepts `tier`, `size`, `annual_revenue`, `onboarding_date`, and `status`
- These values are appended into `data/suppliers_v2.csv` together with the new supplier record
- The backend also generates starter `dependency_score` and `criticality_score` values using dataset averages so downstream modules have complete supplier rows

### Step 3: Commodities and Certifications
Frontend:
- Structured commodity selection based on `data/commodities_v2.csv`
- Commodity risk context with risk level and deforestation risk score
- Structured certification selection based on `data/certifications_v2.csv`
- Certification rows for `issue_date`, `expiry_date`, and `status`
- Mapping readiness summary before final review

Backend:
- Final submission sends selected commodity names, certification names, and certification row metadata to the onboarding endpoint
- `backend/app/services/onboarding_service.py` maps those names to IDs using existing master tables
- Commodity mappings are appended into `data/supplier_commodity_map_v2.csv`
- Certification mappings are appended into `data/supplier_certifications_v2.csv` with persisted `issue_date`, `expiry_date`, and `status`

### Step 4: Review and Submit
Frontend:
- Final summary of supplier details
- Review of selected commodities and certifications
- Submission readiness checklist
- Certification row review panel
- AI validation guidance panel when issues remain
- Submit action with success state and created supplier ID

Backend:
- Valid submissions append a new supplier record into `data/suppliers_v2.csv`
- Commodity mappings are appended into `data/supplier_commodity_map_v2.csv`
- Certification mappings are appended into `data/supplier_certifications_v2.csv`
- A starter audit row is appended into `data/audits_v2.csv` so newly onboarded suppliers can enter the auditing queue immediately
- Starter supplier-linked rows are appended into:
  - `data/supplier_features_v2.csv`
  - `data/esg_environmental_v2.csv`
  - `data/esg_social_v2.csv`
  - `data/esg_governance_v2.csv`
- The response returns a confirmation message and the new supplier ID

## AI Assist For Warnings And Errors
The onboarding module includes an AI remediation layer powered by Gemini `gemini-3.1-flash-lite-preview`.

### What triggers the AI assist
The AI assist runs when onboarding validation returns warnings or errors, for example:
- missing country
- missing commodity
- no certification detected
- partial or noisy extraction output
- country text that is ambiguous or present only through indirect context

### What the AI assist does
Backend:
- builds a remediation prompt using:
  - extracted supplier fields
  - validation errors and warnings
  - raw extracted text
  - supported countries, commodities, and certifications
- asks Gemini to return strict JSON guidance
- normalizes the result into:
  - `summary`
  - `canProceed`
  - `suggestedFields`
    - `supplier_name`
    - `country`
    - `possibleCountries`
    - `commodities`
    - `certifications`
  - `actions`
  - `confidence`
- if country cannot be stated confidently, Gemini can return up to 3 ranked `possibleCountries`

Frontend:
- shows an `AI remediation assist` panel in the upload/validation area
- shows suggested values for:
  - supplier name
  - country
  - possible countries
  - commodities
  - certifications
- shows suggested next actions in plain language
- shows confidence so the user understands whether the guidance is strong or tentative
- shows `AI validation guidance` again in the final review tab when relevant

### What AI is doing versus the rule-based layer
Rule-based extraction:
- first non-empty line becomes supplier name
- country is matched from a supported country list
- commodities are detected by keyword matching
- certifications are detected by keyword matching

Gemini assist:
- interprets noisy or incomplete extracted text
- suggests likely structured values from the supported onboarding vocabulary
- can return a ranked list of possible countries when the exact country is uncertain
- explains how the user can resolve warnings/errors
- improves the remediation UX without replacing the deterministic base extraction layer

## Data Flow
```mermaid
flowchart TD
    A["Onboarding UI\n4-step flow"] --> B["POST /onboarding/upload"]
    B --> C["Onboarding service\nvalidate + normalize payload"]
    C --> D["Text extraction\nAzure Document Intelligence or pdfplumber fallback"]
    D --> E["Rule-based field mapping\nsupplier, country, commodities, certifications"]
    E --> F["Validation\nerrors and warnings"]
    F --> G["Gemini remediation assist\nwhen issues exist"]
    G --> H["Frontend guidance panels"]
    C --> I["suppliers_v2.csv\nmaster supplier row"]
    C --> J["supplier_commodity_map_v2.csv\ncommodity mappings"]
    C --> K["supplier_certifications_v2.csv\ncertification mappings"]
    C --> L["supplier_features_v2.csv\nstarter analytics row"]
    C --> M["esg_environmental_v2.csv\nstarter ESG row"]
    C --> N["esg_social_v2.csv\nstarter ESG row"]
    C --> O["esg_governance_v2.csv\nstarter ESG row"]
    I --> P["Risk, ESG, and downstream views use the new supplier_id"]
    J --> P
    K --> P
    L --> P
    M --> P
    N --> P
    O --> P
```

### Data Flow Summary
1. The onboarding UI collects supplier details, commodity mappings, and certification metadata.
2. The frontend submits one payload to `POST /onboarding/upload`.
3. The backend extracts document text with Azure Document Intelligence or local PDF fallback.
4. The onboarding service runs deterministic field mapping and validation.
5. If issues exist, Gemini generates structured remediation guidance.
6. A new `supplier_id` is created from the existing supplier master table.
7. The same `supplier_id` is reused while appending rows into all related existing `v2` tables.
8. Downstream dashboards and risk/ESG modules can then reference the new supplier consistently.

## Current Onboarding Persistence Scope
The current onboarding implementation writes only to existing `v2` CSV tables. No new tables are created.

Persisted now from onboarding:
- `data/suppliers_v2.csv`
  - `supplier_name`
  - `country`
  - `tier`
  - `size`
  - `annual_revenue`
  - `onboarding_date`
  - `status`
  - generated `dependency_score`
  - generated `criticality_score`
- `data/supplier_commodity_map_v2.csv`
- `data/supplier_certifications_v2.csv`
- `data/audits_v2.csv`
- `data/supplier_features_v2.csv`
- `data/esg_environmental_v2.csv`
- `data/esg_social_v2.csv`
- `data/esg_governance_v2.csv`

Captured in frontend and persisted in backend for certifications:
- certification name
- issue date
- expiry date
- status

Not appended during onboarding by design:
- `data/alerts_v2.csv`
- transaction datasets

Those are better produced by later auditing, monitoring, and operations workflows rather than supplier intake itself.

Starter audit behavior for newly onboarded suppliers:
- Onboarding now creates one `Initial` audit row in `data/audits_v2.csv`
- The row is not identical for every supplier
- Shared base fields:
  - `supplier_id` = newly created supplier ID
  - `audit_date` = onboarding date
  - `type` = `Initial`
- Derived starter values:
  - `score` is adjusted from a conservative baseline using onboarding context such as:
    - certification count
    - commodity count
    - tier
    - size
  - `non_compliance` is also lightly derived from onboarding context instead of being constant for every supplier
- This starter row is meant to place the supplier into the auditing queue immediately, not to represent a completed audit

## Project Structure
```text
supplier-risk-intelligence-react/
+-- backend/
|   +-- app/
|   |   +-- core/
|   |   +-- routers/
|   |   +-- schemas/
|   |   +-- services/
+-- data/
+-- frontend/
|   +-- src/
|   +-- package.json
+-- uploads/
+-- requirements.txt
+-- README.md
```

## Local Setup

1. Install Python dependencies
```bash
pip install -r requirements.txt
```

2. Install frontend dependencies
```bash
cd frontend
npm install
```

3. Configure environment variables in `.env`
- `BLOB_CONNECTION_STRING`
- `DOCUMENT_INTELLIGENCE_ENDPOINT`
- `DOCUMENT_INTELLIGENCE_KEY`
- `GEMINI_API_KEY`
- `AZURE_DOC_INTELLIGENCE_ENDPOINT`
- `AZURE_DOC_INTELLIGENCE_KEY`

## Run Locally

Start the backend from the repository root:
```bash
python -m uvicorn backend.api:app --reload
```

In a second terminal, start the React frontend:
```bash
cd frontend
npm run dev
```

Open:
- React app: `http://localhost:5173`
- FastAPI docs: `http://localhost:8000/docs`

## Notes
- The React app expects the backend at `http://localhost:8000`
- Supplier Onboarding is now the default entry module
- CSV files are still the current persistence layer
- AI Assisted Onboarding appends new suppliers across the relevant existing `v2` supplier, mapping, features, and ESG tables
- The onboarding service supports both Azure extraction and local PDF fallback for testing
- Full frontend production build verification is currently blocked in this environment by a Vite/esbuild `spawn EPERM` error
