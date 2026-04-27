# TCS ENVIROZONE AI 4.0

Responsible Sourcing & Supplier Intelligence

This project is a supplier intelligence platform built with a FastAPI backend and a React + Vite frontend. It is designed around responsible sourcing, supplier risk monitoring, ESG visibility, onboarding, auditing, traceability, and AI-assisted due diligence.

The current product structure is page-based and separates:
- leadership summaries
- deep analytics
- workflow modules
- AI-assisted review experiences

## Stack

### Frontend
- React
- TypeScript
- Vite
- Tailwind CSS
- Plotly
- `react-simple-maps`

### Backend
- FastAPI
- Pandas
- CSV-backed persistence in `data/`

### AI integrations
- Azure Document Intelligence
- Gemini `gemini-3.1-flash-lite-preview`

## Application Pages

The app is now organized into these primary pages:
- `Executive Dashboard`
- `Simulator`
- `Analytics`
- `Supplier Engagement`
- `Due Diligence Agent`

There is also an AI assistant surface:
- `Supplier Advisor AI`

## Current Navigation Intent

- `Executive Dashboard`
  - leadership summary
  - high-level KPIs
  - compact risk and exposure visuals
- `Analytics`
  - detailed charts
  - distributions
  - comparisons
  - supplier rankings
  - trends
- `Supplier Engagement`
  - onboarding
  - auditing
  - traceability
- `Due Diligence Agent`
  - focused supplier investigation
- `Simulator`
  - reserved for scenario and what-if workflows

## Page-By-Page Implementation

### 1. Executive Dashboard

Purpose:
- high-level leadership view
- summary-first
- visual and fast to scan

Current frontend implementation:
- page header with platform branding
- KPI cards
  - total suppliers
  - high risk suppliers
  - average overall risk
  - average operational risk
  - average ESG risk
  - expiring / expired certifications
- three risk donuts
  - `Operational Risk`
  - `ESG Risk`
  - `Overall Risk`
- `Supplier Footprint`
  - world map with supplier spread by country
  - tooltip shows:
    - `Country Name`
    - `Count of Suppliers`
- `Certification Status`
  - donut visual for valid / expiring soon / expired
- `Commodity Exposure`
  - concentration chart with ranked gradient styling
- `Country Exposure`
  - concentration chart with ranked gradient styling
- `Suppliers under Review`
  - compact executive watchlist cards

Current backend implementation:
- dedicated executive aggregation endpoint:
  - `GET /api/v1/analytics/executive-dashboard`
- backend aggregation prepares:
  - executive KPIs
  - overall risk mix
  - operational risk mix
  - ESG risk mix
  - certification health
  - geographic exposure
  - commodity exposure
  - suppliers under review

Notes:
- no AI summary is shown on this page
- no heavy analytical breakdowns are shown here by design

### 2. Analytics

Purpose:
- detailed analytical breakdowns
- non-executive deep dive
- no duplication of Executive Dashboard summary visuals

Current frontend implementation:

#### Filters
- country
- commodity
- tier
- risk level

#### Risk Distributions
- `Overall Risk Distribution`
- `Operational Risk Distribution`
- `ESG Risk Distribution`
- rendered using histogram-style binned visuals

#### Country Analysis
- `Country Risk Comparison`
- `Country Risk Detail Table`
- certification pressure visual removed from this page

#### Commodity Analysis
- `Commodity Risk Comparison`
- `Deforestation & Volume Context`
- `Commodity Detail Table`

#### Supplier Rankings
- `Top Overall Risk Suppliers`
- `Top Operational Risk Suppliers`
- `Top ESG Risk Suppliers`
- `Lowest Risk Suppliers`
- all rendered as gradient bar charts
- high-risk charts use red gradients
- low-risk chart uses green gradient
- hover includes `Top Risk Driver`

#### ESG Pillar Analysis
- `ESG Pillars by Country`
- `Top Supplier ESG Pillars`
- compares:
  - environmental
  - social
  - governance

#### Trend Analysis
- `Operational Trends`
  - average delay
  - average defect rate
  - average cost variance
- `Country Trend Comparison`
- `Commodity Trend Comparison`
- trend visuals are monthly and filter-aware

Current backend implementation:
- `GET /api/v1/analytics/risk-distributions`
- `GET /api/v1/analytics/country-analysis`
- `GET /api/v1/analytics/commodity-analysis`
- `GET /api/v1/analytics/supplier-rankings`
- `GET /api/v1/analytics/esg-pillar-analysis`
- `GET /api/v1/analytics/trend-analysis`

Current analytics filter support:
- `country`
- `commodity`
- `tier`
- `riskLevel`

### 3. Supplier Engagement

Purpose:
- operational supplier workspace
- workflow-heavy modules live here

Current modules inside Supplier Engagement:
- `AI Assisted Supplier Onboarding`
- `AI Assisted Auditing`
- `AI Assisted Traceability`

This page is intentionally different from the Executive Dashboard:
- Executive Dashboard = summary
- Supplier Engagement = action/workspace

### 4. Due Diligence Agent

Purpose:
- focused supplier investigation page
- deeper follow-up for flagged suppliers

Current implementation:
- supplier-level review flow
- ties conceptually to the `Suppliers under Review` watchlist
- used as the deeper investigation destination instead of the dashboard itself becoming verbose

### 5. Simulator

Purpose:
- future what-if and scenario modeling page

Current status:
- page scaffold exists
- functional simulator logic is not yet implemented

Planned direction:
- disruption scenarios
- supplier substitution scenarios
- geography impact analysis
- before/after network comparison

## Supplier Advisor AI

Purpose:
- conversational analysis layer
- natural-language support for supplier questions

Current role:
- Q&A
- summary generation
- guided interpretation

Important limitation:
- it is not the deterministic recommendation engine for alternate supplier sourcing
- structured retrieval and ranking still need to sit underneath that future capability

## Backend Modules

### `analytics`

Handles:
- executive dashboard aggregation
- distributions
- country and commodity breakdowns
- supplier rankings
- ESG pillar analysis
- trend analysis

Key files:
- [backend/app/routers/analytics.py](C:\Users\chait\OneDrive\Desktop\supplier-risk-intelligence-react\backend\app\routers\analytics.py:1)
- [backend/app/services/analytics_service.py](C:\Users\chait\OneDrive\Desktop\supplier-risk-intelligence-react\backend\app\services\analytics_service.py:1)
- [backend/app/schemas/analytics.py](C:\Users\chait\OneDrive\Desktop\supplier-risk-intelligence-react\backend\app\schemas\analytics.py:1)

### `risk`

Handles:
- supplier risk scoring
- risk overview
- top risk suppliers
- due diligence support

Key file:
- [backend/app/services/risk_service.py](C:\Users\chait\OneDrive\Desktop\supplier-risk-intelligence-react\backend\app\services\risk_service.py:1)

### `onboarding`

Handles:
- supplier document upload and extraction
- field validation
- AI remediation assist
- supplier persistence into existing datasets

### `auditing`

Handles:
- audit queue
- audit review
- AI audit insights
- certification extraction/update from audit review

### `traceability`

Handles:
- trace overview
- supplier / commodity trace view
- AI trace insights

### `advisor`

Handles:
- conversational supplier AI assistant

## Frontend Modules

### Shared layout and shell
- app shell
- navigation
- brand header

Key file:
- [frontend/src/components/layout/AppShell.tsx](C:\Users\chait\OneDrive\Desktop\supplier-risk-intelligence-react\frontend\src\components\layout\AppShell.tsx:1)

### Executive Dashboard
- [frontend/src/features/executive-dashboard/pages/ExecutiveDashboardPage.tsx](C:\Users\chait\OneDrive\Desktop\supplier-risk-intelligence-react\frontend\src\features\executive-dashboard\pages\ExecutiveDashboardPage.tsx:1)

### Analytics
- [frontend/src/pages/AnalyticsPage.tsx](C:\Users\chait\OneDrive\Desktop\supplier-risk-intelligence-react\frontend\src\pages\AnalyticsPage.tsx:1)

### Shared plotting
- [frontend/src/components/common/PlotlyChart.tsx](C:\Users\chait\OneDrive\Desktop\supplier-risk-intelligence-react\frontend\src\components\common\PlotlyChart.tsx:1)

### Shared visual styling
- [frontend/src/styles/globals.css](C:\Users\chait\OneDrive\Desktop\supplier-risk-intelligence-react\frontend\src\styles\globals.css:1)

## Risk Model

The live application uses the service-backed risk model in:
- [backend/app/services/risk_service.py](C:\Users\chait\OneDrive\Desktop\supplier-risk-intelligence-react\backend\app\services\risk_service.py:1)

The older prototype file:
- [backend/risk_model.py](C:\Users\chait\OneDrive\Desktop\supplier-risk-intelligence-react\backend\risk_model.py:1)

is not the active scoring engine for the current UI/API.

### What the live risk logic includes

#### Operational inputs
- average delivery delay
- delay volatility
- average defect rate
- defect volatility
- average absolute cost variance
- recent delay pressure
- recent defect pressure
- delay worsening trend
- defect worsening trend
- repeat delay incidents
- repeat defect incidents

#### Audit inputs
- mean non-compliance
- inverse audit score
- recent audit non-compliance
- recent audit score inversion
- audit deterioration against prior audit
- repeat audit pressure

#### Alert inputs
- open alert count
- weighted alert severity
- unresolved critical alert escalation

#### Certification inputs
- verified ratio
- pending ratio
- expiry ratio
- certification freshness pressure

#### Supplier and exposure inputs
- dependency score
- criticality score
- country risk score
- commodity exposure risk
- deforestation-linked exposure

#### ESG inputs
- environmental risk score
- social risk score
- governance risk score

### Score structure

- `operational_risk_score`
- `esg_risk_score`
- `overall_risk_score`

Current overall score behavior:
- weighted blend of operational + ESG
- dual-pressure uplift
- imbalance uplift for mixed-risk profiles

### Risk thresholds
- `High` >= `60`
- `Medium` >= `40` and < `60`
- `Low` < `40`

## Dataset And Persistence

The project is currently CSV-backed.

Important current datasets include:
- `data/suppliers_v2.csv`
- `data/transactions_v2.csv`
- `data/audits_v2.csv`
- `data/alerts_v2.csv`
- `data/commodities_v2.csv`
- `data/supplier_commodity_map_v2.csv`
- `data/certifications_v2.csv`
- `data/supplier_certifications_v2.csv`
- `data/supplier_features_v2.csv`
- `data/esg_environmental_v2.csv`
- `data/esg_social_v2.csv`
- `data/esg_governance_v2.csv`

### Current data updates already made

#### Transaction timeline extension
`transactions_v2.csv` has been extended to cover:
- `2023-01-01` to `2025-12-31`

This supports monthly trend analysis in Analytics.

#### Risk distribution enrichment
The supplier data has been enriched to produce more realistic:
- low-risk suppliers
- mixed operational / ESG profiles
- more meaningful executive and analytics visuals

## AI Assisted Supplier Onboarding

Current onboarding flow supports 4 steps:

### Step 1: Document Upload
Frontend:
- upload supplier document
- preview extracted values
- view validation warnings/errors
- view AI remediation assistance

Backend:
- `POST /onboarding/upload`
- Azure Document Intelligence when configured
- `pdfplumber` fallback
- rule-based extraction
- Gemini remediation guidance when needed

### Step 2: Supplier Details
Frontend:
- editable supplier master fields
- tier-aware supplier linking

Backend:
- persists supplier fields into `suppliers_v2.csv`
- derives starter dependency and criticality values

### Step 3: Commodities and Certifications
Frontend:
- structured commodity selection
- structured certification selection
- issue/expiry/status capture

Backend:
- persists:
  - supplier commodity mappings
  - supplier certification mappings

### Step 4: Review and Submit
Frontend:
- final review
- submission readiness

Backend:
- appends new rows into existing `v2` tables
- creates starter audit row
- creates supplier-linked feature and ESG starter rows

## AI Assisted Auditing

Current auditing tabs:
- `Audit Queue`
- `Audit Review`
- `AI Audit Insights`

### Audit Queue
- queue built from existing audit and supplier datasets
- filter chips
- selected audit state for downstream tabs

### Audit Review
- selected audit summary
- supplier context
- certification context
- supplier audit history
- certificate update flow
- certificate extraction flow

Current backend endpoints:
- `POST /auditing/certification-extract`
- `POST /auditing/certification-update`

### AI Audit Insights
- AI-generated structured audit interpretation
- Gemini-backed with deterministic fallback

Current backend endpoint:
- `POST /auditing/insights`

## AI Assisted Traceability

Current traceability tabs:
- `Trace Overview`
- `Supplier / Commodity Trace`
- `AI Trace Insights`

### Trace Overview
- mapped suppliers
- mapped commodities
- high-risk supplier count
- trace gaps

### Supplier / Commodity Trace
- supplier summary
- commodity footprint
- country anchor
- certification-backed trace context

### AI Trace Insights
- trace interpretation layer
- concerns
- suggested actions
- decision support

Current backend endpoint:
- `GET /traceability/workspace`

## API Summary

### Analytics
- `GET /api/v1/analytics/executive-dashboard`
- `GET /api/v1/analytics/risk-distributions`
- `GET /api/v1/analytics/country-analysis`
- `GET /api/v1/analytics/commodity-analysis`
- `GET /api/v1/analytics/supplier-rankings`
- `GET /api/v1/analytics/esg-pillar-analysis`
- `GET /api/v1/analytics/trend-analysis`

### Onboarding
- `POST /onboarding/upload`

### Auditing
- `POST /auditing/certification-extract`
- `POST /auditing/certification-update`
- `POST /auditing/insights`

### Traceability
- `GET /traceability/workspace`

## Routing

Current routing intent:
- `/` redirects to `/executive-dashboard`
- `/executive-dashboard`
- `/analytics`
- `/simulator`
- `/supplier-engagement`
- `/due-diligence-agent`

## Local Setup

### 1. Install backend dependencies
```bash
pip install -r requirements.txt
```

### 2. Install frontend dependencies
```bash
cd frontend
npm install
```

### 3. Configure `.env`
Common environment values used by the project:
- `DOCUMENT_INTELLIGENCE_ENDPOINT`
- `DOCUMENT_INTELLIGENCE_KEY`
- `AZURE_DOC_INTELLIGENCE_ENDPOINT`
- `AZURE_DOC_INTELLIGENCE_KEY`
- `GEMINI_API_KEY`
- `BLOB_CONNECTION_STRING`

## Run Locally

### Backend
```bash
python -m uvicorn backend.api:app --reload
```

### Frontend
```bash
cd frontend
npm run dev
```

### Local URLs
- frontend: [http://localhost:5173](http://localhost:5173)
- backend docs: [http://localhost:8000/docs](http://localhost:8000/docs)

## Current Notes

- the app now defaults to `localhost:5173`
- CSV files remain the persistence layer
- Analytics filters are already wired into the backend for supported sections
- Executive Dashboard and Analytics visuals have been aligned to a more consistent design system
- full production `vite` build is still blocked in this environment by the existing `esbuild spawn EPERM` issue

## Next Planned Area

The next major page to implement is:
- `Simulator`

Planned focus:
- what-if modeling
- disruption scenarios
- supplier substitution scenarios
- before/after network impact
