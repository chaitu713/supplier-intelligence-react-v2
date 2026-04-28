# TCS ENVIROZONE AI 4.0

Responsible Sourcing & Supplier Intelligence

TCS ENVIROZONE AI 4.0 is a supplier intelligence platform for responsible sourcing, supplier risk management, ESG monitoring, onboarding, auditing, traceability, due diligence, and scenario simulation. The application uses a FastAPI backend, a React + Vite frontend, and CSV-backed datasets in `data/` as the current persistence layer.

## Platform Summary

The product is organized into dedicated pages instead of one overloaded dashboard. Each page has a clear role:

- `Executive Dashboard`
  - leadership-ready KPI and exposure summary
- `Simulator`
  - what-if and disruption analysis
- `Analytics`
  - deep-dive charts, comparisons, trends, and rankings
- `Supplier Engagement`
  - onboarding, auditing, and traceability workspace
- `ESG Monitoring`
  - dedicated ESG indicator monitoring area
- `Due Diligence Agent`
  - focused supplier-level investigation workflow

There is also a cross-cutting conversational assistant:

- `Supplier Advisor AI`
  - natural-language support layer for supplier intelligence questions

## Technology Stack

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
- Pydantic
- CSV-backed storage in `data/`

### AI Integrations

- Azure Document Intelligence
- Gemini `gemini-3.1-flash-lite-preview`

## Current Navigation

The current navigation order is:

1. `Executive Dashboard`
2. `Simulator`
3. `Analytics`
4. `Supplier Engagement`
5. `ESG Monitoring`
6. `Due Diligence Agent`

The shared application shell uses the `TCS ENVIROZONE AI 4.0` brand header with the subtitle `Responsible Sourcing & Supplier Intelligence`.

## Page-By-Page Implementation

### 1. Executive Dashboard

#### Purpose

The Executive Dashboard is the high-level summary page for leadership users. It is intentionally compact, visual, and decision-oriented. It is not meant to be a detailed analytics workspace.

#### Current Frontend Implementation

The page currently includes:

- KPI cards for:
  - `Total Suppliers`
  - `High Risk Suppliers`
  - `Avg Overall Risk`
  - `Avg Operational Risk`
  - `Avg ESG Risk`
  - `Expiring / Expired Certifications`
- Three risk donuts:
  - `Operational Risk`
  - `ESG Risk`
  - `Overall Risk`
- `Supplier Footprint`
  - world map showing supplier presence by country
  - marker tooltip format:
    - `Country Name: <value>`
    - `Count of Suppliers: <value>`
- `Certification Status`
  - donut chart for:
    - valid
    - expiring soon
    - expired
- `Country Exposure`
  - ranked exposure chart
  - darkest bar at the top
  - lighter bars below
- `Commodity Exposure`
  - ranked exposure chart
  - darkest bar at the top
  - lighter bars below
- `Suppliers under Review`
  - compact watchlist of prioritized suppliers for deeper due diligence

#### Current Backend Implementation

The Executive Dashboard is powered by:

- `GET /api/v1/analytics/executive-dashboard`

The backend aggregation currently prepares:

- executive KPI values
- operational risk mix
- ESG risk mix
- overall risk mix
- supplier geography spread
- certification status counts
- country exposure rankings
- commodity exposure rankings
- suppliers under review

#### What `Suppliers under Review` Means

This label denotes suppliers that have moved beyond general monitoring and into a prioritized follow-up queue. In the application, these are the suppliers that should be investigated more deeply through the `Due Diligence Agent` experience.

In business terms:

- `Suppliers under Review = suppliers prioritized for due diligence follow-up`

#### Design Intent

The Executive Dashboard intentionally avoids:

- large tables
- dense breakdowns
- deep drilldowns
- AI narrative blocks

Those are intentionally placed in `Analytics` or `Due Diligence Agent`.

### 2. Simulator

#### Purpose

The Simulator page is the decision-support and what-if analysis workspace. It is designed to answer questions like:

- what happens if a supplier becomes disrupted?
- how does the network risk profile change?
- which related suppliers get affected?

#### Current Frontend Implementation

The page currently implements:

- centered simulator tabs for:
  - `Supplier Disruption`
  - `Country Disruption`
  - `Commodity Shock`
  - `Operational Deterioration`
  - `Scenario Compare`
- supplier, country, and commodity selectors depending on scenario
- severity selection for disruption-style scenarios:
  - `Moderate`
  - `Severe`
  - `Unavailable`
- operational deterioration sliders for:
  - delay increase
  - defect increase
  - cost variance increase
- loading and error handling for supplier and simulator option lists
- `How This Simulation Works` explainer section

For single-scenario simulation modes, the page currently shows:

- scenario summary banner
- before vs after KPI cards
- `Risk Composition Shift`
- `Impact Delta`
- `Risk Band Movement`
- `Most Affected Suppliers`
- `Affected Supplier Detail`

Scenario-specific visuals currently include:

- `Supplier Disruption`
  - `Impact Scope Split`
- `Country Disruption`
  - `Country Impact Summary`
- `Commodity Shock`
  - `Commodity Impact Summary`
- `Operational Deterioration`
  - `Operational Input Meters`

`Scenario Compare` currently includes:

- `Scenario A` builder
- `Scenario B` builder
- comparison summary banner
- comparison winner panel
- side-by-side scenario result cards
- risk composition comparison
- KPI delta comparison

#### Current Backend Implementation

The Simulator is powered by:

- `GET /api/v1/simulator/options`
- `POST /api/v1/simulator/run`

The backend implementation currently supports:

- `supplier_disruption`
- `country_disruption`
- `commodity_shock`
- `operational_deterioration`

The simulator is built on top of the current live supplier risk frame from the risk model.

#### Current Simulation Output

The backend returns:

- scenario metadata
- before KPIs
- after KPIs
- KPI deltas
- risk band movement summary
- affected supplier list

#### What `Supplier Disruption` Means

This is a deterministic scenario test. The user selects a supplier and a severity level, and the simulator artificially applies disruption pressure to the live network model. It then compares the network state before and after the scenario.

This is not an ML forecast yet.

#### What `Country Disruption` Means

This simulates disruption across one sourcing country. It applies direct pressure to suppliers in the selected country and lighter commodity-linked spillover outside that geography.

#### What `Commodity Shock` Means

This simulates disruption across one commodity. It applies direct pressure to suppliers mapped to the selected commodity and lighter spillover into related countries that host the affected commodity network.

#### What `Operational Deterioration` Means

This simulates worsening operational performance using explicit user-controlled deterioration levers:

- delay increase
- defect increase
- cost variance increase

It can be applied to:

- one supplier
- one country
- one commodity

#### What `Scenario Compare` Means

This mode runs two complete scenarios independently and compares them side by side. It helps answer:

- which scenario is worse?
- which one creates the larger increase in high-risk suppliers?
- which one creates the larger overall risk uplift?

#### What `Spillover` Means

The disruption does not affect only the selected supplier. It also adds smaller pressure to related suppliers through shared exposure. In the current implementation, spillover is applied to:

- suppliers in the same country
- suppliers linked to the same commodities

This models a ripple effect rather than a single isolated supplier shock.

#### Current Severity Logic

`Moderate`

- smaller direct supplier disruption
- light same-country spillover
- light same-commodity spillover

`Severe`

- stronger direct supplier disruption
- larger spillover to related suppliers

`Unavailable`

- near-outage or near-failure scenario
- strongest direct disruption
- strongest spillover pressure

#### Current Simulation Intent

The current Simulator is designed as a controlled, rule-based scenario engine layered on top of the risk model. It is meant to support exploratory disruption analysis and side-by-side decision comparison.

#### Planned Next Simulator Directions

- certification failure
- multi-supplier failure
- alternate supplier / substitution scenarios
- more advanced compare insights

### 3. Analytics

#### Purpose

Analytics is the detailed deep-dive page. It is intentionally more analytical than the Executive Dashboard and is designed for breakdowns, comparisons, trends, and ranked analysis.

It should answer questions like:

- why are suppliers risky?
- which countries or commodities are driving exposure?
- how does risk distribute across the portfolio?
- how do trends change over time?

#### Current Frontend Implementation

##### Filters

The Analytics page currently supports shared filters for:

- country
- commodity
- tier
- risk level

##### Risk Distributions

The page currently includes:

- `Overall Risk Distribution`
- `Operational Risk Distribution`
- `ESG Risk Distribution`

These are rendered using the same histogram-style binned visual pattern previously used in the older Risk Monitoring experience.

##### Country Analysis

The page currently includes:

- `Country Risk Comparison`
- `Country Risk Detail Table`

This section focuses on country-wise risk comparison and supplier concentration. The earlier certification pressure visual was removed from this section.

##### Commodity Analysis

The page currently includes:

- `Commodity Risk Comparison`
- `Deforestation & Volume Context`
- `Commodity Detail Table`

This section gives a more detailed commodity-level analytical view than the Executive Dashboard commodity exposure visual.

##### Supplier Rankings

The page currently includes bar-chart based ranking views for:

- `Top Overall Risk Suppliers`
- `Top Operational Risk Suppliers`
- `Top ESG Risk Suppliers`
- `Lowest Risk Suppliers`

Visual behavior:

- high-risk charts use red gradients
- lowest-risk chart uses green gradients
- for lowest-risk suppliers, the very lowest-risk supplier is the darkest green and the chart gradually becomes lighter
- hover labels include:
  - supplier name
  - score
  - `Top Risk Driver`

##### ESG Pillar Analysis

The page currently includes:

- `ESG Pillars by Country`
- `Top Supplier ESG Pillars`

The current pillar comparison is structured around:

- environmental
- social
- governance

##### Trend Analysis

The page currently includes:

- `Operational Trends`
  - monthly average delay
  - monthly average defect rate
  - monthly average cost variance
- `Country Trend Comparison`
- `Commodity Trend Comparison`

Current trend behavior:

- charts are monthly
- charts are filter-aware
- each trend visual is placed in its own row
- trend visuals have already been polished for more consistent UX

#### Current Backend Implementation

The Analytics page is powered by:

- `GET /api/v1/analytics/risk-distributions`
- `GET /api/v1/analytics/country-analysis`
- `GET /api/v1/analytics/commodity-analysis`
- `GET /api/v1/analytics/supplier-rankings`
- `GET /api/v1/analytics/esg-pillar-analysis`
- `GET /api/v1/analytics/trend-analysis`

The shared filter support currently includes:

- `country`
- `commodity`
- `tier`
- `riskLevel`

#### Design Intent

Analytics intentionally does not duplicate:

- executive KPI cards
- executive risk donuts
- executive geography footprint map
- certification status donut
- executive exposure visuals

Instead, it provides deeper breakdowns and diagnostics behind those summaries.

### 4. Supplier Engagement

#### Purpose

Supplier Engagement is the operational workflow workspace. It is where users perform supplier-facing and supplier-process tasks rather than summary review.

#### Current Frontend Implementation

This page currently contains the supplier engagement workspace with dedicated modules for:

- `AI Assisted Supplier Onboarding`
- `AI Assisted Auditing`
- `AI Assisted Traceability`

#### Design Intent

This page is intentionally different from:

- `Executive Dashboard`
  - summary
- `Analytics`
  - diagnosis

`Supplier Engagement` is where execution and workflow live.

### 5. ESG Monitoring

#### Purpose

ESG Monitoring is a dedicated page for ESG indicator management and continuous ESG health visibility. It exists separately because ESG indicator monitoring should not be buried inside generic analytics forever.

#### Current Frontend Implementation

The page currently exists as a dedicated page shell and is already placed in the main navigation before `Due Diligence Agent`.

The current placeholder structure frames the intended scope:

- indicator view
- watchlists
- trend signals
- ML layer

#### Planned Functional Direction

This page is intended to evolve into a dedicated monitoring module for:

- `BWS`
- `HRR`
- `Land Use`

Target capabilities include:

- indicator-level trend monitoring
- supplier ESG deterioration watchlists
- indicator health summaries
- continuous ESG health tracking
- anomaly detection and deterioration prediction later

### 6. Due Diligence Agent

#### Purpose

Due Diligence Agent is the focused supplier-level investigation experience. It is where users move from dashboard monitoring into deeper supplier review.

#### Current Frontend Implementation

The page currently represents:

- supplier-level due diligence flow
- deeper review destination for flagged suppliers

It ties directly to concepts like:

- `Suppliers under Review`
- supplier follow-up
- deeper investigation rather than dashboard summary

## Supplier Advisor AI

#### Purpose

Supplier Advisor AI is the natural-language assistant layer across the platform.

#### Current Role

It is currently used for:

- Q&A
- summary generation
- guided interpretation

#### Important Limitation

It is not the deterministic alternate supplier recommendation engine by itself. For future alternate sourcing, structured filtering and ranking still need to sit underneath any AI explanation layer.

## Backend Module Breakdown

### `analytics`

Handles:

- executive dashboard aggregation
- distributions
- country breakdowns
- commodity breakdowns
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
- overall risk computation
- risk distributions and top-risk supplier context
- due diligence support data

Key file:

- [backend/app/services/risk_service.py](C:\Users\chait\OneDrive\Desktop\supplier-risk-intelligence-react\backend\app\services\risk_service.py:1)

### `simulator`

Handles:

- supplier disruption scenario execution
- before vs after KPI comparison
- risk band movement
- affected supplier impact calculation

Key files:

- [backend/app/routers/simulator.py](C:\Users\chait\OneDrive\Desktop\supplier-risk-intelligence-react\backend\app\routers\simulator.py:1)
- [backend/app/services/simulator_service.py](C:\Users\chait\OneDrive\Desktop\supplier-risk-intelligence-react\backend\app\services\simulator_service.py:1)
- [backend/app/schemas/simulator.py](C:\Users\chait\OneDrive\Desktop\supplier-risk-intelligence-react\backend\app\schemas\simulator.py:1)

### `dataset`

Handles:

- CSV dataset loading
- normalization
- persistence helpers

Important current note:

- supplier normalization now converts missing `parent_supplier_id` values to real `None` instead of `NaN` so the supplier API can serialize cleanly

Key file:

- [backend/app/services/dataset_service.py](C:\Users\chait\OneDrive\Desktop\supplier-risk-intelligence-react\backend\app\services\dataset_service.py:1)

### `onboarding`

Handles:

- supplier document upload and extraction
- validation
- AI remediation assistance
- supplier persistence into existing datasets

### `auditing`

Handles:

- audit queue
- audit review
- AI audit insights
- certification extraction and update support

### `traceability`

Handles:

- trace overview
- supplier and commodity trace views
- AI trace insights

### `advisor`

Handles:

- conversational supplier AI assistant

## Frontend Module Breakdown

### Shared Layout And Branding

- application shell
- navigation
- header branding

Key file:

- [frontend/src/components/layout/AppShell.tsx](C:\Users\chait\OneDrive\Desktop\supplier-risk-intelligence-react\frontend\src\components\layout\AppShell.tsx:1)

### Executive Dashboard

- [frontend/src/features/executive-dashboard/pages/ExecutiveDashboardPage.tsx](C:\Users\chait\OneDrive\Desktop\supplier-risk-intelligence-react\frontend\src\features\executive-dashboard\pages\ExecutiveDashboardPage.tsx:1)

### Analytics

- [frontend/src/pages/AnalyticsPage.tsx](C:\Users\chait\OneDrive\Desktop\supplier-risk-intelligence-react\frontend\src\pages\AnalyticsPage.tsx:1)

### Simulator

- [frontend/src/pages/SimulatorPage.tsx](C:\Users\chait\OneDrive\Desktop\supplier-risk-intelligence-react\frontend\src\pages\SimulatorPage.tsx:1)
- [frontend/src/api/simulator.ts](C:\Users\chait\OneDrive\Desktop\supplier-risk-intelligence-react\frontend\src\api\simulator.ts:1)
- [frontend/src/features/simulator/hooks/useRunSimulation.ts](C:\Users\chait\OneDrive\Desktop\supplier-risk-intelligence-react\frontend\src\features\simulator\hooks\useRunSimulation.ts:1)

### ESG Monitoring

- [frontend/src/pages/EsgMonitoringPage.tsx](C:\Users\chait\OneDrive\Desktop\supplier-risk-intelligence-react\frontend\src\pages\EsgMonitoringPage.tsx:1)

### Shared Plotting

- [frontend/src/components/common/PlotlyChart.tsx](C:\Users\chait\OneDrive\Desktop\supplier-risk-intelligence-react\frontend\src\components\common\PlotlyChart.tsx:1)

### Shared Visual Styling

The app now uses shared visual surface classes to keep Executive Dashboard and Analytics more consistent.

Key file:

- [frontend/src/styles/globals.css](C:\Users\chait\OneDrive\Desktop\supplier-risk-intelligence-react\frontend\src\styles\globals.css:1)

Important shared styles include:

- `visual-card`
- `visual-card-soft`
- `visual-header`
- `visual-title`
- `visual-description`
- `metric-pill`

## Risk Model

The live application uses the service-backed risk model in:

- [backend/app/services/risk_service.py](C:\Users\chait\OneDrive\Desktop\supplier-risk-intelligence-react\backend\app\services\risk_service.py:1)

The older prototype file:

- [backend/risk_model.py](C:\Users\chait\OneDrive\Desktop\supplier-risk-intelligence-react\backend\risk_model.py:1)

is not the active scoring engine for the current UI/API.

### Current Live Risk Inputs

#### Operational Inputs

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

#### Audit Inputs

- mean non-compliance
- inverse audit score
- recent audit non-compliance
- recent audit score inversion
- audit deterioration against prior audit
- repeat audit pressure

#### Alert Inputs

- open alert count
- weighted alert severity
- unresolved critical alert escalation

#### Certification Inputs

- verified ratio
- pending ratio
- expiry ratio
- certification freshness pressure

#### Supplier And Exposure Inputs

- dependency score
- criticality score
- country risk score
- commodity exposure risk
- deforestation-linked exposure

#### ESG Inputs

- environmental risk score
- social risk score
- governance risk score

### Current Score Structure

The live model produces:

- `operational_risk_score`
- `esg_risk_score`
- `overall_risk_score`

Current overall score behavior includes:

- weighted blend of operational and ESG scores
- dual-pressure uplift
- imbalance uplift for mixed operational / ESG profiles

This allows more realistic cases such as:

- low operational risk + medium ESG risk
- medium operational risk + low ESG risk

instead of forcing simplistic label mapping.

### Current Risk Thresholds

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

### Current Data Updates Already Made

#### Transaction Timeline Extension

`transactions_v2.csv` has been extended to cover:

- `2023-01-01` to `2025-12-31`

This supports monthly trend analysis in Analytics.

#### Risk Distribution Enrichment

The supplier data has been intentionally enriched to produce:

- more realistic low-risk suppliers
- mixed operational vs ESG profiles
- better visual distributions for executive and analytics pages

#### Supplier API Serialization Cleanup

Missing `parent_supplier_id` values are now normalized to `None` instead of `NaN`, which prevents FastAPI response validation failures for the supplier list endpoint.

## AI Assisted Supplier Onboarding

The current onboarding flow supports 4 steps.

### Step 1: Document Upload

Frontend:

- upload supplier document
- preview extracted values
- view validation warnings and errors
- view AI remediation support

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

### Step 3: Commodities And Certifications

Frontend:

- structured commodity selection
- structured certification selection
- issue date, expiry date, and status capture

Backend:

- persists:
  - supplier commodity mappings
  - supplier certification mappings

### Step 4: Review And Submit

Frontend:

- final review
- submission readiness flow

Backend:

- appends new rows into existing `v2` datasets
- creates starter audit row
- creates supplier-linked feature and ESG starter rows

## AI Assisted Auditing

Current auditing workspace tabs:

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

### Supplier Data

- `GET /api/v1/suppliers`

### Analytics

- `GET /api/v1/analytics/executive-dashboard`
- `GET /api/v1/analytics/risk-distributions`
- `GET /api/v1/analytics/country-analysis`
- `GET /api/v1/analytics/commodity-analysis`
- `GET /api/v1/analytics/supplier-rankings`
- `GET /api/v1/analytics/esg-pillar-analysis`
- `GET /api/v1/analytics/trend-analysis`

### Simulator

- `GET /api/v1/simulator/options`
- `POST /api/v1/simulator/run`

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
- `/simulator`
- `/analytics`
- `/supplier-engagement`
- `/esg-monitoring`
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

- the frontend now defaults to `localhost:5173`
- CSV files remain the persistence layer
- Executive Dashboard and Analytics visuals have been aligned more consistently
- Analytics filters are wired into supported backend sections
- the Simulator supplier list depends on the normalized supplier endpoint
- the current Simulator is deterministic and rule-based, not predictive ML
- ESG Monitoring is created as a dedicated page shell and will be expanded next
- full production `vite` build is still blocked in this environment by the existing `esbuild spawn EPERM` issue

## Immediate Next Areas

The next major product directions are:

- expanding `Simulator` beyond supplier disruption
- implementing functional `ESG Monitoring`
- adding more advanced scenario and monitoring logic
