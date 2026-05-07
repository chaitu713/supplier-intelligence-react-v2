# Ozone AI 4.0 Functional and Technical Guide

Responsible Sourcing & Supplier Intelligence

This guide explains the Ozone AI 4.0 application for a reader who may be technical but new to responsible sourcing, ESG, supplier risk, auditing, traceability, and due diligence. It explains what each module is for, what each major feature means, how the workflows connect, what to show in a client demo, and which backend/data pieces support the experience.

The goal is simple: after reading this document, a technical person should understand not only which files and APIs exist, but also why the application exists and what each screen is trying to prove.

## 1. Product Overview

Ozone AI 4.0 is a supplier intelligence platform. It helps a company understand, monitor, and act on risk across its supplier network.

A supplier network is the group of companies that provide goods, raw materials, ingredients, packaging, services, or finished products to a buying company. In responsible sourcing, a company needs to know whether suppliers are reliable, compliant, ethical, sustainable, and traceable.

The application currently covers these product areas:

- Executive Dashboard: leadership view of supplier risk and exposure.
- Analytics: deeper analysis by country, commodity, certification, ESG pillar, trend, and supplier.
- Simulator: what-if modeling for supplier, country, commodity, and operational disruptions.
- Supplier Engagement: operational workflows for Onboarding, Auditing, and Traceability.
- ESG Monitoring: monitoring of environmental, social, and governance indicators.
- Due Diligence Agent: deeper investigation of risky suppliers.
- Supplier Advisor AI: conversational assistant for asking questions about supplier intelligence.
- AI Governance / Review Infrastructure: backend controls for AI safety, prompt management, validation, logging, and review queue support.

The application is currently a prototype/demo application with real functional workflows and CSV-backed persistence. It is not yet production-grade enterprise infrastructure because it does not use a relational database, object storage, role-based access control, scheduled ingestion jobs, or production GIS map services.

## 2. Important Domain Terms

This section explains common terms used across the application.

### Supplier

A supplier is a company or site that provides goods or services. In this application, suppliers can be raw material producers, aggregators, processors, traders, manufacturers, or direct suppliers.

### Supplier Tier

Supplier tier describes how far a supplier is from the buying company.

- Tier 1: direct supplier to the buying company.
- Tier 2: supplier to a Tier 1 supplier.
- Tier 3: supplier further upstream.

Example: A retailer buys chocolate from a chocolate manufacturer. The manufacturer buys cocoa from a processor. The processor buys cocoa beans from farms. The chocolate manufacturer is Tier 1, the processor may be Tier 2, and farms may be Tier 3 or further upstream.

### Commodity

A commodity is a raw material or input, such as cocoa, palm oil, coffee, rubber, wood, or soya. Commodity risk matters because some commodities are linked to deforestation, labor risk, regulatory controls, or supply disruption.

### ESG

ESG means Environmental, Social, and Governance.

- Environmental: land use, deforestation, carbon, water, waste, renewable energy.
- Social: labor, child risk, wages, working hours, worker safety.
- Governance: compliance, transparency, policies, reporting, certifications.

ESG monitoring helps a company understand whether suppliers are operating responsibly.

### Certification

A certification is third-party evidence that a supplier or site meets a standard. Examples include RSPO, Rainforest Alliance, FSC, PEFC, Fairtrade, ISO14001, ISO22000, GMP, and HACCP.

Certification is useful, but it is not the same as complete traceability or complete compliance. A certificate may be expired, may cover only one site, or may not prove origin-level evidence.

### Evidence

Evidence means a document or record used to support a claim. Examples include certificates, audit reports, chain-of-custody documents, geolocation files, polygon evidence, deforestation-free declarations, and supplier responses.

### EUDR

EUDR means European Union Deforestation Regulation. It requires companies placing certain commodities on the EU market to prove that products are deforestation-free and legally produced. EUDR-relevant commodities in this application include cocoa, coffee, palm oil, rubber, wood, and soya.

### Traceability

Traceability means the ability to trace a product, commodity, lot, or shipment back through the supply chain. In responsible sourcing, traceability often means knowing where a commodity came from, which sites handled it, which lots moved through the chain, and whether evidence supports the claimed origin.

### Chain of Custody

Chain of custody is the documented path of a product or material as it moves between suppliers, sites, processors, warehouses, ports, or buyers. It helps prove that the claimed material is connected to the actual shipment or lot.

### Lot or Batch

A lot or batch is a specific quantity of product produced, processed, or shipped together. Lot-level traceability is stronger than supplier-level traceability because it connects evidence to a specific movement of goods.

### Site, Farm, Plot, and Polygon

A site is a physical location linked to a supplier. It can be a farm, plot, mill, processor, warehouse, or facility.

A polygon is a geospatial boundary around a plot or farm. In EUDR-style traceability, polygon evidence can help prove where commodities came from and whether the area overlaps with deforestation risk.

### CAPA

CAPA means Corrective and Preventive Action. It is an action created to fix an audit finding or compliance problem. Example: if an audit finds missing worker safety records, a CAPA may require the supplier to upload updated records by a due date.

### Due Diligence

Due diligence is deeper investigation before making a business decision. It helps answer whether a supplier should be approved, monitored, escalated, blocked, or remediated.

## 3. Application Architecture

The application has three main layers:

- Frontend: React + Vite application.
- Backend: FastAPI application.
- Data: CSV files in `data/` and uploaded files in `uploads/`.

The frontend provides the user interface. The backend loads CSV datasets, applies business logic, calls document extraction or AI services where configured, and returns structured responses. CSV files are used as temporary persistence for the demo.

Important frontend entry points:

- `frontend/src/App.tsx`: application routes.
- `frontend/src/components/layout/AppShell.tsx`: shared layout and top navigation.
- `frontend/src/pages/SupplierEngagementPage.tsx`: parent page for Onboarding, Auditing, and Traceability.
- `frontend/src/pages/OnboardingPage.jsx`: onboarding workflow.
- `frontend/src/pages/AuditingWorkspaceV2.tsx`: auditing workflow.
- `frontend/src/pages/TraceabilityWorkspace.tsx`: traceability workflow.
- `frontend/src/pages/EsgMonitoringPage.tsx`: Phase 1 visual ML Continuous ESG Monitoring command center.
- `frontend/src/pages/AnalyticsPage.tsx`: analytics.
- `frontend/src/pages/SimulatorPage.tsx`: simulator.
- `frontend/src/features/executive-dashboard/pages/ExecutiveDashboardPage.tsx`: executive dashboard.
- `frontend/src/features/risk-monitoring/pages/DueDiligencePage.tsx`: due diligence agent.
- `frontend/src/features/advisor-ai/pages/SupplierAdvisorAIPage.tsx`: advisor AI.

Important backend areas:

- `backend/app/main.py`: creates FastAPI app and registers routers.
- `backend/app/routers/`: API endpoints.
- `backend/app/services/`: business logic and dataset processing.
- `backend/app/schemas/`: typed request/response models.
- `backend/app/ai/`: AI gateway, prompt registry, guardrails, validation, and audit logging.

Current persistence:

- CSV datasets in `data/`.
- Onboarding evidence in `uploads/onboarding/evidence`.
- Auditing evidence in `uploads/auditing/evidence`.
- Traceability evidence in `uploads/traceability/evidence`.
- Traceability sample PDFs in `uploads/traceability/sample_pdfs`.

## 4. Client Demo Workflow for the Entire Application

This is the recommended full application walkthrough for a client. It tells a story from executive visibility to analysis, simulation, supplier engagement, evidence handling, traceability, monitoring, investigation, and AI assistance.

### Demo Story

The story is:

1. Leadership sees supplier risk at a high level.
2. Analysts investigate why the risk exists.
3. The team simulates potential disruption.
4. Supplier engagement teams act through onboarding, auditing, and traceability.
5. ESG teams monitor indicators and alerts.
6. Due diligence teams investigate high-risk suppliers.
7. Advisor AI helps users ask questions and summarize findings.
8. AI governance infrastructure controls and logs AI usage behind the scenes.

### Recommended Demo Order

1. Executive Dashboard
2. Analytics
3. Simulator
4. Supplier Engagement
5. Onboarding
6. Auditing
7. Traceability
8. ESG Monitoring
9. Due Diligence Agent
10. Supplier Advisor AI
11. AI Governance / Review Infrastructure explanation

## 5. Executive Dashboard

### What This Module Is

The Executive Dashboard is the leadership-level view. It answers: "How risky is our supplier network right now, and where should leaders focus?"

This is not meant for detailed data entry. It is meant for fast executive understanding.

### Who Uses It

- Procurement leadership
- Sustainability leadership
- Risk executives
- Compliance leadership
- Program managers preparing leadership updates

### What It Shows

The dashboard includes:

- KPI cards
- Operational risk mix
- ESG risk mix
- Overall risk mix
- Supplier footprint map
- Certification status donut
- Country exposure chart
- Commodity exposure chart
- Suppliers under review

### What Each Feature Means

KPI cards summarize major health signals, such as supplier count, risk exposure, ESG posture, or review needs.

Operational risk mix shows business continuity risk, such as poor performance, supply instability, or operational exposure.

ESG risk mix shows environmental, social, and governance risk levels.

Overall risk mix combines risk signals into a broader supplier risk picture.

Supplier footprint map shows where suppliers are located. This helps leaders see geographic concentration.

Certification status donut shows how much of the supplier base has valid, expired, missing, or needs-review certifications.

Country exposure chart shows which countries contribute most supplier exposure.

Commodity exposure chart shows which commodities contribute most exposure.

Suppliers under review shows suppliers that require attention.

### Business Value

The dashboard helps leaders decide where to focus resources. It is the starting point before drilling into analytics or operational workflows.

### Backend Endpoint

```text
GET /api/v1/analytics/executive-dashboard
```

### Client Demo Script

Start here and say:

"This is the leadership view. It gives executives one place to understand supplier risk, ESG exposure, country concentration, commodity exposure, and which suppliers need attention."

Then show:

1. KPI cards for the big picture.
2. Risk mix visuals to explain risk composition.
3. Map and exposure charts to show geographic and commodity concentration.
4. Suppliers under review to transition into Analytics or Due Diligence.

## 6. Analytics

### What This Module Is

Analytics is the detailed investigation workspace. It answers: "Why does the risk exist, where is it concentrated, and which suppliers or categories are driving it?"

### Who Uses It

- Supplier risk analysts
- Procurement analysts
- ESG analysts
- Compliance analysts
- Data and reporting teams

### What It Shows

Analytics includes:

- Overview metrics
- Country analysis
- Commodity analysis
- Supplier rankings
- Certification analysis
- ESG pillar analysis
- Trend analysis
- Risk distributions
- ESG distribution
- Filters for geography, commodity, tier, and risk level

### What Each Feature Means

Overview metrics summarize the selected supplier population.

Country analysis shows how risk differs by supplier country.

Commodity analysis shows risk and exposure by commodity.

Supplier rankings show which suppliers have the highest or lowest risk.

Certification analysis shows certification coverage and weaknesses.

ESG pillar analysis separates environmental, social, and governance performance.

Trend analysis shows how indicators change over time.

Risk distributions show how suppliers are distributed across risk bands.

ESG distribution shows how ESG scores are spread across suppliers.

Filters help users focus analysis on a country, commodity, supplier tier, or risk group.

### Business Value

Analytics helps users move from "something is risky" to "this country, commodity, supplier group, or certification gap is causing the risk."

### Backend Endpoints

```text
GET /api/v1/analytics/overview
GET /api/v1/analytics/country-analysis
GET /api/v1/analytics/commodity-analysis
GET /api/v1/analytics/supplier-rankings
GET /api/v1/analytics/certification-analysis
GET /api/v1/analytics/esg-pillar-analysis
GET /api/v1/analytics/trend-analysis
GET /api/v1/analytics/risk-distributions
GET /api/v1/analytics/esg-distribution
```

### Client Demo Script

After Executive Dashboard, say:

"Now we can drill into why the executive risk picture looks the way it does."

Show:

1. Country analysis to explain geographic concentration.
2. Commodity analysis to explain commodity-specific exposure.
3. Supplier rankings to identify suppliers needing action.
4. ESG pillar analysis to explain whether the issue is environmental, social, or governance related.

## 7. Simulator

### What This Module Is

The Simulator models what could happen if a disruption occurs. It answers: "If a supplier, country, commodity, or operational condition worsens, what changes in our risk profile?"

### Who Uses It

- Risk managers
- Procurement planners
- Supply chain resilience teams
- Leadership teams evaluating scenarios

### Simulation Modes

The simulator supports:

- Supplier disruption
- Country disruption
- Commodity shock
- Operational deterioration
- Scenario compare

### What Each Mode Means

Supplier disruption models the impact of a specific supplier failing, pausing, or becoming risky.

Country disruption models geopolitical, regulatory, climate, or logistics disruption in a country.

Commodity shock models supply or price instability for a commodity.

Operational deterioration models a worsening supplier performance situation.

Scenario compare lets users compare two modeled scenarios side by side.

### What It Shows

The simulator shows:

- Before and after KPI changes
- Risk composition shift
- Impact delta
- Risk band movement
- Most affected suppliers
- Affected supplier detail
- Scenario-specific summaries
- Scenario A vs Scenario B comparison

### Business Value

Simulator helps teams prepare instead of react. It can support contingency planning, supplier diversification, and risk mitigation.

### Backend Endpoints

```text
GET /api/v1/simulator/options
POST /api/v1/simulator/run
```

### Client Demo Script

Say:

"Now that we know where risk is concentrated, we can model what happens if a disruption occurs."

Show:

1. Select a scenario mode.
2. Choose supplier, country, commodity, or operational parameters.
3. Run simulation.
4. Explain before/after impact.
5. Show most affected suppliers.
6. Use the Advisor AI handoff if needed to explain the scenario in natural language.

## 8. Supplier Engagement

### What This Module Is

Supplier Engagement is the operational workspace. It moves the application from analysis into action.

It contains:

- Onboarding
- Auditing
- Traceability

### Why It Exists

Executive Dashboard and Analytics help users find risk. Supplier Engagement helps users do something about it.

### Main Business Flow

1. Onboarding creates or updates supplier baseline information.
2. Auditing validates supplier controls and handles corrective actions.
3. Traceability proves or reviews source, site, lot, evidence, and chain visibility.

## 9. Onboarding

### What This Module Is

Onboarding is the workflow for reviewing a supplier before they become fully approved or active.

It answers:

- Who is this supplier?
- What country are they in?
- What commodities do they provide?
- What certifications do they claim?
- Is the supplier EUDR relevant?
- What evidence is required?
- Is the evidence valid?
- What ESG baseline should be assigned?
- Should the supplier be approved, approved with conditions, rejected, or asked for more evidence?

### Who Uses It

- Supplier onboarding teams
- Procurement operations
- ESG compliance teams
- Responsible sourcing teams

### Current Onboarding Tabs

1. Document Upload
2. Commodities & Certifications
3. Supplier Details
4. Review & Submit
5. Active Supplier Revalidation

### Tab 1: Document Upload

The user uploads a supplier onboarding PDF. The backend extracts text and detects supplier name, country, commodities, and certifications.

Document extraction uses Azure Document Intelligence when configured. If Azure is not configured or fails, local PDF extraction is used.

Business meaning:

This reduces manual data entry. A supplier document can be converted into structured onboarding fields.

### Tab 2: Commodities & Certifications

The user confirms commodity and certification mappings.

Supported commodities:

- Palm Oil
- Cocoa
- Coffee
- Rubber
- Wood
- Soya

These are EUDR-relevant commodities in the current application.

Supported certifications:

- RSPO
- Rainforest Alliance
- FSC
- PEFC
- Fairtrade
- ISO14001
- ISO22000
- GMP
- HACCP

If an EUDR-relevant commodity is selected, the frontend automatically marks:

```text
EUDR Relevant: Yes
Traceability Required: Yes
```

Business meaning:

If a supplier provides a commodity linked to deforestation regulation, the application asks for stronger traceability and evidence.

### Certification Evidence Upload

For each selected certification, the user can upload evidence. The system extracts certificate fields such as:

- Certificate name
- Certificate number
- Issuer
- Issue date
- Expiry date
- Scope
- Site or facility
- Commodity

Validation statuses include:

- Verified
- Expired
- Needs Review
- Evidence Received
- Missing Evidence

Business meaning:

This helps distinguish between a supplier claiming certification and actually providing usable certification evidence.

### Evidence Checklist

The onboarding checklist is generated from selected commodities, certifications, evidence status, supplier role, EUDR relevance, and traceability requirements.

Example required evidence for a cocoa supplier:

- Fairtrade certificate evidence
- Plot or farm-level traceability
- Geolocation or polygon evidence
- Deforestation-free declaration
- Labor and child-risk questionnaire

Checklist status values:

- Complete
- Missing
- Requested
- Needs Review
- Expired

Business meaning:

The checklist tells the reviewer what must be collected before the supplier can be responsibly approved.

### Tab 3: Supplier Details

The user captures supplier master data:

- Supplier name
- Country
- Tier
- Parent supplier link
- Size
- Annual revenue
- Status
- Onboarding date

The tab also captures traceability fields:

- Supplier role
- Plot traceability available
- Geolocation evidence available
- Chain-of-custody evidence available
- Deforestation-free declaration available
- Labor questionnaire status
- EUDR relevant
- Traceability required
- Traceability notes

Business meaning:

This creates the supplier baseline that other modules reuse.

### AI-Suggested ESG Baseline

The system suggests ESG baseline scores from supplier country, commodity, certification, and evidence status.

Example ESG baseline categories:

- Land use
- Deforestation
- Labor
- Child risk
- Compliance
- Transparency

Business meaning:

New suppliers often do not have full ESG monitoring history yet. A baseline gives the company a starting risk posture.

### Tab 4: Review & Submit

The review page shows the full supplier onboarding package:

- Core supplier fields
- ESG baseline
- EUDR relevance
- Traceability status
- Evidence checklist
- Certifications
- Evidence gaps
- Business onboarding status
- AI recommendation
- Conditions and blockers

Submitting persists data into CSV datasets.

### Active Supplier Revalidation

This lane is for existing active suppliers. Instead of creating a duplicate supplier, the user updates the revalidation status.

Supported outcomes:

- Revalidation Requested
- Evidence Received
- Needs Review
- Revalidated

Business meaning:

Suppliers must be periodically refreshed. Revalidation handles already-active suppliers.

### AI Onboarding Decision

The AI onboarding decision recommends a business status:

- Draft
- Evidence Requested
- Evidence Under Review
- Ready for Approval
- Approved
- Approved With Conditions
- Rejected

The recommendation considers supplier profile, country, commodity risk, EUDR relevance, evidence checklist, certification validity, ESG baseline, and blockers.

### Backend Endpoints

```text
POST /onboarding/upload
POST /onboarding/evidence/upload
POST /onboarding/decision
POST /onboarding/activate
POST /onboarding/revalidate
```

### Data Written

Onboarding writes to:

- `data/suppliers_v2.csv`
- `data/supplier_commodity_map_v2.csv`
- `data/supplier_certifications_v2.csv`
- `data/supplier_evidence_v2.csv`
- `data/esg_environmental_v2.csv`
- `data/esg_social_v2.csv`
- `data/esg_governance_v2.csv`
- `data/audits_v2.csv`

### Client Demo Script

Say:

"Onboarding turns supplier documents into a structured supplier record, evidence checklist, ESG baseline, and AI-assisted approval decision."

Show:

1. Upload onboarding PDF.
2. Use extracted supplier data.
3. Confirm commodities and certifications.
4. Upload certification evidence.
5. Review checklist and traceability requirements.
6. Show AI decision.
7. Submit supplier.

## 10. Auditing

### What This Module Is

Auditing reviews supplier controls after onboarding. It answers:

- Which audits need attention?
- What issues were found?
- Is evidence available?
- Are CAPA actions open?
- What decision should be made?
- Can the audit be closed?

### Who Uses It

- Audit teams
- Supplier quality teams
- Compliance teams
- Responsible sourcing teams

### Current Capabilities

Auditing includes:

- Backend-driven audit queue
- Supplier context
- Certification context
- Audit history
- Evidence health
- CAPA workflow
- Audit evidence upload
- Certification update and extraction
- AI audit insights
- AI audit decision
- Audit closure guard

### Audit Queue

The audit queue lists audits requiring attention. It can show audit priority, status, supplier, score, findings, evidence state, and CAPA state.

Business meaning:

The queue tells audit teams where to focus first.

### Audit Review

Audit Review shows the selected audit in detail, including supplier context, audit history, certifications, and evidence.

Business meaning:

Reviewers can understand the audit before deciding whether it passes, needs CAPA, or requires escalation.

### CAPA Workflow

CAPA means Corrective and Preventive Action. A CAPA is created when the supplier needs to fix an issue.

Example:

An audit finds missing worker safety records. A CAPA asks the supplier to upload corrected records by a due date.

CAPA status can be updated. When all CAPAs are closed, audit status can roll up.

### Audit Evidence Upload

Supported audit evidence types:

- Audit Report
- Non-Compliance Evidence
- CAPA Proof
- Supplier Response

Evidence is extracted and validated using document extraction.

### AI Audit Decision

The AI audit decision can recommend:

- Pass
- Pass with Conditions
- Corrective Action Required
- Escalate
- Suspend / Block

The decision includes confidence, reasons, required actions, closure blockers, and source.

### Audit Closure Guard

The closure guard prevents closing an audit too early.

Closure can be blocked if:

- Decision is not acceptable for closure.
- Evidence still needs review.
- CAPA actions are still open.
- A clean pass does not have accepted evidence.

Business meaning:

This prevents a reviewer from closing an audit while important issues remain unresolved.

### Backend Endpoints

```text
GET /auditing/workspace
POST /auditing/insights
POST /auditing/decision
POST /auditing/decision/apply
POST /auditing/close
POST /auditing/capa
PATCH /auditing/capa
POST /auditing/evidence/upload
POST /auditing/certification-update
POST /auditing/certification-extract
```

### Data Written

Auditing writes to:

- `data/audits_v2.csv`
- `data/audit_capa_v2.csv`
- `data/audit_evidence_v2.csv`
- `data/supplier_certifications_v2.csv`

Audit evidence files are saved under:

```text
uploads/auditing/evidence
```

### Client Demo Script

Say:

"Auditing helps teams move from finding a problem to assigning corrective action, reviewing evidence, generating a decision, and closing the audit with guardrails."

Show:

1. Open audit queue.
2. Select a supplier audit.
3. Review evidence health and certification context.
4. Create or update CAPA.
5. Upload audit evidence.
6. Generate AI audit decision.
7. Apply decision.
8. Try closure and explain blockers if closure is not allowed.

## 11. Traceability

### What This Module Is

Traceability proves or reviews where commodities came from and whether evidence supports the claim.

It answers:

- Which suppliers are in the chain?
- What commodities are involved?
- Which sites or farms are mapped?
- Are polygons available?
- Which lots or shipments exist?
- What events show chain of custody?
- What evidence is missing?
- What traceability decision should be made?

### Who Uses It

- Responsible sourcing teams
- Traceability teams
- EUDR compliance teams
- Procurement compliance teams
- Sustainability teams

### Current Traceability Tabs

1. Trace Overview
2. Supplier / Commodity Trace

The old AI Trace Insights tab was removed because decision support now exists in Trace Overview.

### Trace Overview

Trace Overview shows:

- Selected supplier
- Traceability score
- EUDR readiness
- Evidence coverage
- Trace decision support
- Trace decision journey
- Comparator supplier

Business meaning:

This page summarizes the supplier's traceability posture for client review.

### Supplier / Commodity Trace

This detailed page shows:

- Supplier trace chain
- Evidence upload
- Site and polygon view
- Lot movement timeline
- Commodity footprint
- Certification-backed trace
- Open trace actions
- Evidence review queue
- Trace history

### Site and Polygon View

Sites represent farms, plots, facilities, processors, or other physical locations.

Polygons are GeoJSON boundaries linked to sites. They help show where a farm or plot is located.

Status colors:

- Green: complete or accepted evidence.
- Amber: needs review.
- Red: high risk or missing evidence.

### Lot Movement Timeline

Lots represent batches or shipments. A lot movement timeline shows how a commodity moved through the chain.

Business meaning:

Lot-level visibility is stronger than supplier-level visibility because it connects evidence to real movement of goods.

### Trace Evidence Upload

Supported trace evidence types:

- Farm / Plot Traceability
- Geolocation / Polygon Evidence
- Chain of Custody Evidence
- Shipment / Lot Document
- Deforestation-Free Declaration

Evidence can be linked to sites, lots, events, or open gap actions.

### Evidence Review Queue

After upload, evidence can be accepted or marked for clarification.

Business meaning:

Uploading a document is not enough. A reviewer must decide whether the evidence supports the trace.

### Trace Gap Actions

Trace gap actions are trace-specific tasks. Examples:

- Missing plot data
- Missing polygon
- Broken chain link
- Expired trace evidence
- Unsupported commodity origin

### Trace Decision

The trace decision endpoint recommends one of several outcomes:

- Trace Complete
- Trace Complete with Conditions
- Evidence Gap
- High-Risk Trace
- Block / Escalate

Business meaning:

The decision tells whether the current trace is acceptable, conditional, incomplete, risky, or should be escalated.

### BlueRiver Demo Workflow

The recommended demo supplier is `BlueRiver Commodities Ltd`.

Demo steps:

1. Select `BlueRiver Commodities Ltd`.
2. Review the trace journey in Trace Overview.
3. Generate the current trace decision.
4. Open Supplier / Commodity Trace.
5. Upload this PDF:

```text
uploads/traceability/sample_pdfs/02_geolocation_polygon_blueriver.pdf
```

6. Select evidence type `Geolocation / Polygon Evidence`.
7. Link it to the BlueRiver site and missing polygon gap.
8. Upload evidence.
9. Accept evidence in the evidence review queue.
10. Close the missing polygon trace action.
11. Generate the trace decision again.
12. Show improvement in score, evidence coverage, EUDR readiness, and decision.

### Backend Endpoints

```text
GET /traceability/workspace
POST /traceability/evidence/upload
POST /traceability/evidence/review
POST /traceability/gap-actions
PATCH /traceability/gap-actions/{gap_id}
POST /traceability/decision
```

### Data Files

Traceability uses:

- `data/supplier_sites_v2.csv`
- `data/site_polygons_v2.geojson`
- `data/traceability_lots_v2.csv`
- `data/traceability_events_v2.csv`
- `data/traceability_gap_actions_v2.csv`
- `data/traceability_gap_action_history_v2.csv`
- `data/traceability_score_history_v2.csv`
- `data/traceability_decisions_v2.csv`

Traceability evidence files are saved under:

```text
uploads/traceability/evidence
```

Sample PDFs are stored under:

```text
uploads/traceability/sample_pdfs
```

## 12. Continuous ESG Monitoring

### Current State

Continuous ESG Monitoring is now implemented as a Phase 1 ML-assisted visual command center at:

```text
/esg-monitoring
```

The old snapshot-style ESG dashboard is no longer the current experience. The active module uses a visual monitoring cockpit with ESG health scoring, radar views, anomaly scoring, supplier bubble/scatter visualization, all-attribute ESG heatmap, alert stream, supplier driver bars, and compact watchlist cards.

The current backend endpoint is:

```text
GET /api/v1/esg-monitoring/overview
```

The implementation files are:

- `frontend/src/pages/EsgMonitoringPage.tsx`
- `frontend/src/api/esgMonitoring.ts`
- `frontend/src/features/esg-monitoring/hooks/useEsgMonitoring.ts`
- `backend/app/routers/esg_monitoring.py`
- `backend/app/services/esg_monitoring_service.py`
- `backend/app/schemas/esg_monitoring.py`

### What This Module Is

Continuous ESG Monitoring tracks supplier ESG health and ML anomaly pressure using the currently available supplier, ESG, risk, audit, certification, commodity, alert, and monitoring context. It answers:

- Which suppliers are deteriorating right now?
- Which suppliers look anomalous compared with their peers?
- Which ESG attributes are driving network pressure?
- Which suppliers should move to monitoring, evidence refresh, audit, traceability review, due diligence, or escalation?
- Which alerts should reviewers see first?

### Who Uses It

- ESG teams
- Sustainability teams
- Responsible sourcing teams
- Supplier risk teams
- Procurement compliance teams
- Audit and due diligence teams

### Business Purpose

Onboarding approves or rejects a supplier at a point in time. Auditing validates controls periodically. Traceability checks source and chain evidence. Due Diligence investigates high-risk suppliers.

Continuous Monitoring sits across all of those workflows. It watches for change after the supplier is already in the system.

Example:

- A supplier was approved during onboarding.
- Six months later, its certification expires.
- A traceability gap remains open.
- A labor indicator deteriorates.
- A monitoring alert should be generated.
- The system should route the supplier to evidence refresh, audit, due diligence, or escalation.

### Implemented Frontend Experience

#### ESG Health Header

The top summary area shows:

- Suppliers monitored
- Average ESG health
- Average ML anomaly score
- Deteriorating suppliers
- Open ESG alerts

It also includes a circular ESG health ring.

#### E/S/G Radar

The radar chart compares Environmental, Social, Governance, and priority indicator pressure. It shows network risk and inverse health in a compact visual form.

#### Supplier Anomaly Field

The supplier anomaly field is the main visual. It plots suppliers with:

- X-axis: ESG health score
- Y-axis: ML anomaly score
- Bubble size: ESG risk pressure
- Color: risk/deterioration state

The user can select a supplier directly from the chart.

#### ESG Attribute Heatmap

The heatmap shows all available ESG attributes, grouped by Environmental, Social, and Governance:

- Environmental: carbon, energy, renewable, water, waste, recycle, pollution, land, deforestation, fines.
- Social: labor, injury, turnover, diversity, child, hours, audit, complaints, wage, satisfaction.
- Governance: corruption, compliance, board, transparency, legal, tax, disclosure, data, policy, reporting.

Each tile shows average risk intensity and the number of high-risk suppliers.

#### AI Alert Stream

The alert stream shows compact visual alert cards with:

- Supplier
- Alert indicator
- Severity
- Visual pressure bar

#### Supplier Focus

Selecting a supplier updates the focus panel. It shows:

- Supplier country and tier
- Primary concern
- ESG risk
- ESG health
- ML anomaly score
- Driver bars for ESG, BWS, HRR, and Land Use

#### Visual Watchlist Cards

The watchlist is card-based instead of table-heavy. Cards show deterioration status and compact driver pips for BWS, HRR, and Land Use.

### Current ML Approach

Phase 1 uses unsupervised ML anomaly detection.

The backend uses:

- `IsolationForest`
- `StandardScaler`
- ESG pillar scores
- composite ESG risk
- BWS, HRR, and land-use risk
- all raw ESG attributes
- alert severity
- certification gap score
- audit non-compliance
- commodity exposure
- country risk

The response includes supplier-level:

- `mlAnomalyScore`
- `mlConfidence`

This is demo-grade ML prioritization, not supervised deterioration forecasting.

### Future Monitoring Depth

True continuous prediction still needs monthly supplier snapshots, more dated ESG observations, persisted alert lifecycle states, external signal ingestion, and labeled deterioration outcomes.

### Implemented CSV Data Model

For the current app style, the first Continuous Monitoring data layer has been added as CSV files.

#### Monitoring Observations

`data/monitoring_observations_v2.csv`

Stores dated ESG observations per supplier and indicator.

Implemented columns:

- observation_id
- supplier_id
- observation_date
- pillar
- indicator
- previous_value
- current_value
- unit
- source
- source_detail
- confidence

#### Monitoring Alerts

`data/monitoring_alerts_v2.csv`

Stores generated alerts.

Implemented columns:

- alert_id
- supplier_id
- rule_id
- alert_date
- pillar
- indicator
- severity
- status
- previous_value
- current_value
- change_value
- trigger_reason
- recommended_route
- linked_action_id

#### Monitoring Rules

`data/monitoring_rules_v2.csv`

Stores rule definitions.

Implemented columns:

- rule_id
- rule_name
- pillar
- indicator
- condition_type
- threshold_value
- severity
- recommended_route
- enabled

#### Monitoring Actions

`data/monitoring_actions_v2.csv`

Stores follow-up actions created from alerts.

Implemented columns:

- action_id
- alert_id
- supplier_id
- action_type
- owner
- due_date
- status
- notes
- linked_module
- linked_record_id

#### Supplier Evidence Refresh

`data/supplier_evidence_refresh_v2.csv`

Tracks stale, expired, or recurring evidence needs.

Implemented columns:

- refresh_id
- supplier_id
- evidence_type
- last_received_date
- refresh_due_date
- freshness_status
- linked_evidence_id
- recommended_action

#### External ESG Signals

`data/external_esg_signals_v2.csv`

Optional demo feed for external ESG events.

Implemented columns:

- signal_id
- supplier_id
- signal_date
- source_type
- source_name
- pillar
- signal_title
- signal_summary
- severity
- confidence

### Seeded Demo Suppliers

The current monitoring seed data uses suppliers that already have meaningful risk context elsewhere in the application:

- `2001` BlueRiver Commodities Ltd
  - Governance corruption-risk signal, social complaint deterioration, and open traceability polygon gaps.
- `2003` TerraSource Foods Co
  - Critical origin plot/traceability gaps and audit signal.
- `2004` Cedar Grove Exports
  - Critical carbon and working-hours indicators.
- `2005` Golden Acre Ingredients
  - Certification expiry and evidence refresh requirement.
- `2007` Pacific Harvest Partners
  - Certification expiry plus deforestation pressure.

This means the current Continuous Monitoring page can show realistic cross-module monitoring scenarios instead of empty placeholder data.

### Existing Data To Reuse

Continuous Monitoring should reuse:

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

This is important because Continuous Monitoring should connect the rest of the application instead of becoming a separate dashboard.

### Current Backend Implementation

Current files:

- `backend/app/services/esg_monitoring_service.py`
- `backend/app/routers/esg_monitoring.py`
- `backend/app/schemas/esg_monitoring.py`

Current endpoint:

```text
GET /api/v1/esg-monitoring/overview
```

Endpoint behavior:

- Returns KPIs, ESG indicator summaries, ML-ranked watchlist, alerts, health trend counts, and ML insight details.
- Includes per-supplier `mlAnomalyScore` and `mlConfidence` in the watchlist.
- Uses current CSV data and on-demand computation rather than persisted monthly snapshots.

Future endpoints:

- Rule run endpoint for monitoring rules.
- Alert status update endpoint.
- Monthly snapshot creation endpoint or scheduled job.
- Supplier monitoring decision endpoint.

### Future AI Design

The current Phase 1 module uses ML anomaly scoring and deterministic text from the monitoring service. If LLM-generated monitoring summaries or decisions are added later, they must follow the same app pattern as Onboarding, Auditing, Traceability, Due Diligence, and Advisor AI.

Rules:

- Do not call LLM providers directly.
- Use `backend/app/services/ai_gateway.py`.
- Add a monitoring prompt definition in `backend/app/ai/prompt_registry.py`.
- Use deterministic rule output first.
- Use guarded LLM only for explanation or reviewer-ready summary.
- If provider fails, return deterministic fallback.

Allowed monitoring decisions:

- Stable
- Watch
- Evidence Required
- Enhanced Monitoring
- Escalate
- Block / Suspend

### Production Azure Services

For the demo, CSV and backend rule logic are enough.

For production, the recommended Azure services are:

- Azure Blob Storage or Azure Data Lake Storage
  - Store evidence files, raw external feeds, snapshots, and source documents.
- Azure Functions
  - Run scheduled jobs for rule evaluation, evidence expiry checks, feed ingestion, and alert generation.
- Azure Event Grid
  - React to app events such as uploaded evidence, certification update, trace gap closure, or new supplier status.
- Azure Event Hubs
  - Use only if high-volume streaming ESG or external event data is needed.
- Azure Data Explorer
  - Store and query large time-series monitoring observations.
- Azure Monitor and Application Insights
  - Monitor the app, APIs, scheduled jobs, failures, and performance.
- Azure AI Document Intelligence
  - Extract evidence content from supplier PDFs.
- Azure OpenAI or configured AI provider
  - Generate summaries only through the guarded app AI gateway.
- Azure Maps
  - Add future geospatial deforestation, site, and region views.
- Azure SQL Database or PostgreSQL
  - Replace CSV persistence when moving to production.

### Client Demo Script

Say:

"Continuous ESG Monitoring watches supplier health after onboarding. The current Phase 1 command center uses ML anomaly scoring across ESG, risk, audit, certification, country, commodity, and alert context to show which suppliers need attention first."

Show:

1. ESG health ring.
2. E/S/G radar chart.
3. Supplier anomaly field.
4. ESG attribute heatmap.
5. AI alert stream.
6. Supplier focus driver bars.
7. Visual supplier watchlist cards.
8. Explain that monthly snapshots and persisted alert lifecycle are the next production step.

### Future Implementation Notes

Phase 1 is already implemented. Future work should extend it rather than rebuilding the page from scratch.

```text
Recommended next increments:
- Add monthly supplier monitoring snapshots.
- Persist alert lifecycle state and action status.
- Run rules from monitoring_rules_v2.csv.
- Add supplier monitoring decisions.
- Add guarded AI explanations through backend/app/services/ai_gateway.py only.
```

## 13. Due Diligence Agent

### What This Module Is

The Due Diligence Agent performs deeper supplier investigation.

It answers:

- Why is this supplier risky?
- What are the main concerns?
- What should the reviewer do next?
- Should the supplier be monitored, escalated, or blocked?
- Which audit, certification, traceability, or evidence signals are creating blockers?

### Who Uses It

- Risk analysts
- Compliance reviewers
- Procurement teams
- ESG due diligence teams

### When To Use It

Use due diligence when a supplier has:

- High risk
- ESG concern
- Certification concern
- Audit concern
- Alert concern
- Watchlist status

### Backend Endpoint

```text
POST /api/v1/risk/due-diligence
```

### Business Value

Due diligence is the bridge between risk detection and business action. It helps reviewers understand the risk narrative and next steps.

### Current Case Workflow

The Due Diligence Agent now returns a structured case-style output. This is more useful than a plain text answer because it gives the reviewer a consistent investigation format.

The output includes:

- Case ID
- Supplier name, country, tier, and status
- Operational, ESG, and overall risk scores
- Recommended due diligence decision
- Decision rationale
- Investigation checklist
- Risk drivers
- Evidence gaps
- Recommended actions
- Connected signals from audits, certifications, traceability gaps, and prior due diligence cases

Current due diligence decisions include:

- Clear
- Clear with Conditions
- Enhanced Monitoring
- Escalate
- Block / Suspend

The backend persists generated due diligence cases and decisions to CSV. This means the demo can show due diligence moving toward an operational case record, not only an AI-generated paragraph.

Due Diligence AI uses the shared application AI gateway and prompt registry pattern. That means it follows the same controlled service approach used by the enhanced onboarding, auditing, traceability, and advisor workflows. If the configured AI provider is unavailable, the service returns a deterministic reviewer summary so the demo remains stable.

### Client Demo Script

Say:

"When a supplier needs deeper review, the Due Diligence Agent summarizes the concern and recommends next steps."

Show:

1. Select or review a risky supplier.
2. Run due diligence.
3. Explain the generated case ID and decision.
4. Review the investigation checklist.
5. Explain the risk drivers and evidence gaps.
6. Show recommended actions.

## 14. Supplier Advisor AI

### What This Module Is

Supplier Advisor AI is the conversational assistant. It allows users to ask questions about supplier risk, analytics, simulator results, ESG monitoring, or supplier context.

### Who Uses It

- Procurement users
- Risk analysts
- ESG teams
- Executives who want summaries
- Technical users validating data

### How It Works

The advisor uses session-based chat endpoints. It can operate with lenses such as executive, analytics, simulator, ESG monitoring, or supplier context.

The advisor now builds Supplier 360 context where records exist. Supplier 360 means a combined view of the supplier across multiple modules:

- Risk score
- Country and tier
- Audit status
- Certification health
- Traceability gaps
- Due diligence decisions

This makes the advisor more useful because it can explain cross-module blockers instead of only answering from generic risk scores.

### Example Questions

Users can ask:

- Which suppliers are highest risk?
- Why did this scenario increase risk?
- Which countries have the highest exposure?
- What should I do about this supplier?
- Summarize the ESG posture of this supplier.
- Explain the traceability gaps for this supplier.
- Give me a Supplier 360 summary for the highest-risk supplier.
- Summarize open audit, certification, and traceability blockers.
- Which suppliers should move to due diligence first and why?

### Backend Endpoints

```text
POST /api/v1/advisor/sessions
GET /api/v1/advisor/sessions/{session_id}
POST /api/v1/advisor/sessions/{session_id}/messages
```

### Client Demo Script

Say:

"Advisor AI gives users a natural language way to ask questions across the supplier intelligence data."

Show:

1. Open Advisor AI.
2. Ask for a Supplier 360 summary.
3. Ask which suppliers should move to due diligence first.
4. Ask about audit, certification, or traceability blockers.
5. Ask a follow-up about a simulator result.
6. Ask for recommended next actions.

## 15. AI Governance / Review Infrastructure

### Important Note

AI Governance / Review is not currently exposed as a main frontend navigation item. It exists as backend and support infrastructure.

Do not describe it as a user-facing module in a client demo unless you are specifically explaining platform controls.

### What Exists

The codebase includes:

- AI gateway
- Prompt registry
- Guardrails
- Output validation
- Rate limiting
- Audit logging
- Review queue endpoints
- `data/ai_audit_events.jsonl`

### Why It Matters

AI governance makes AI usage safer and more auditable. It helps ensure that AI outputs are controlled, logged, validated, and reviewable.

### Review Queue Endpoints

```text
GET /api/v1/ai-review/queue
POST /api/v1/ai-review/queue/{item_id}
```

### Client Demo Positioning

If asked, say:

"The platform has backend AI governance infrastructure for prompt control, validation, audit logging, and review queue support. We are not exposing this as a main frontend module in the current client demo because the focus is on supplier risk workflows."

## 16. Data Files Explained

This section explains the most important CSV and data files in plain language.

### Supplier Master Data

`data/suppliers_v2.csv`

This is the main supplier table. It stores supplier identity, country, tier, status, onboarding state, EUDR flags, traceability fields, supplier role, evidence flags, and notes.

### Commodity Mapping

`data/supplier_commodity_map_v2.csv`

This maps suppliers to commodities. One supplier can have multiple commodities.

### Commodity Reference

`data/commodities_v2.csv`

This stores supported commodities and commodity risk attributes.

### Certification Reference

`data/certifications_v2.csv`

This stores supported certification types.

### Supplier Certifications

`data/supplier_certifications_v2.csv`

This stores supplier-specific certification records, certificate number, issuer, scope, site, evidence id, and validation status.

### Supplier Evidence

`data/supplier_evidence_v2.csv`

This stores uploaded onboarding/certification evidence metadata, extracted fields, validation results, review status, and text preview.

### ESG Data

Files:

- `data/esg_environmental_v2.csv`
- `data/esg_social_v2.csv`
- `data/esg_governance_v2.csv`

These store ESG indicator values by supplier.

### Supplier Features

`data/supplier_features_v2.csv`

This stores risk/scoring features used by analytics and monitoring.

### Audits

`data/audits_v2.csv`

This stores audit records and audit workflow state.

### Audit CAPA

`data/audit_capa_v2.csv`

This stores corrective actions linked to audits.

### Audit Evidence

`data/audit_evidence_v2.csv`

This stores audit evidence uploads and extracted text previews.

### Traceability Sites

`data/supplier_sites_v2.csv`

This stores farms, plots, facilities, and processing locations linked to suppliers.

### Traceability Polygons

`data/site_polygons_v2.geojson`

This stores geospatial polygon footprints for supplier sites.

### Traceability Lots

`data/traceability_lots_v2.csv`

This stores lot and shipment lineage records.

### Traceability Events

`data/traceability_events_v2.csv`

This stores chain-of-custody event records.

### Traceability Gap Actions

`data/traceability_gap_actions_v2.csv`

This stores trace-specific actions that need follow-up.

### Traceability History

Files:

- `data/traceability_gap_action_history_v2.csv`
- `data/traceability_score_history_v2.csv`
- `data/traceability_decisions_v2.csv`

These store action history, score snapshots, and generated trace decisions.

### Due Diligence Cases

`data/due_diligence_cases_v2.csv`

This stores generated due diligence case records. Each case records supplier, date, risk score, decision, status, and summary.

### Due Diligence Decisions

`data/due_diligence_decisions_v2.csv`

This stores the generated due diligence decision, rationale, and recommended actions.

### Due Diligence Notes

`data/due_diligence_case_notes_v2.csv`

This is reserved for reviewer notes and case history as the due diligence workflow becomes more operational.

### Transactions

`data/transactions_v2.csv`

This stores transaction-level data used for dependency, exposure, and analytics.

### Alerts

`data/alerts_v2.csv`

This stores supplier alerts.

### AI Audit Log

`data/ai_audit_events.jsonl`

This stores append-only AI governance events.

## 17. Document Intelligence and Extraction

Document Intelligence means extracting text and fields from uploaded PDF documents.

The application uses Azure Document Intelligence first when configured.

Environment variables:

```text
AZURE_DOC_INTELLIGENCE_ENDPOINT
AZURE_DOC_INTELLIGENCE_KEY
```

Fallback:

```text
pdfplumber
```

Current extraction use cases:

- Supplier onboarding document extraction.
- Certification evidence extraction.
- Onboarding checklist evidence extraction.
- Audit evidence extraction.
- Auditing certification extraction.
- Traceability evidence extraction.

Important limitation:

Extraction works best with structured PDFs containing clear labels. Table-heavy or unusual documents may need improved extraction logic later.

## 18. Current Known Limitations

### Persistence

CSV files are currently the persistence layer. This is acceptable for a demo but not for production scale.

Production would need:

- Relational database
- Object storage for evidence documents
- Migrations
- Backup and recovery
- Access control

### Evidence Storage

Uploaded files are stored locally. Production would need Blob Storage or another object storage service.

### ESG Monitoring

ESG Monitoring is now a Phase 1 visual ML command center. It uses the active `GET /api/v1/esg-monitoring/overview` endpoint, scikit-learn Isolation Forest anomaly scoring, all available ESG attributes, ESG/risk context, and compact visual components. True production continuous monitoring still needs scheduled ingestion, monthly snapshots, persisted alert lifecycle, external feeds, and supervised outcome history.

### GIS and Maps

Traceability currently renders embedded GeoJSON polygons in the frontend. Production GIS would need map services, layers, zooming, polygon editing, and geospatial validation.

### AI

The application has AI gateway and fallback logic. Production AI usage would need stricter evaluation, monitoring, permissioning, and human review processes.

### User Roles

The current demo does not implement full role-based access control. Production would need user roles such as admin, reviewer, supplier manager, auditor, executive, and read-only viewer.

## 19. Recommended Client Demo Narrative

Use this short narrative to connect the whole product:

"Ozone AI 4.0 gives responsible sourcing teams one place to understand supplier risk, investigate why it exists, simulate future disruption, act through onboarding and auditing, prove traceability, monitor ESG signals, run due diligence, and ask AI-assisted questions. The demo uses CSV-backed datasets today, but the workflow demonstrates how a production supplier intelligence platform would connect risk visibility, evidence, decisions, and supplier action."

### Full Demo Click Path

1. Open Executive Dashboard.
2. Explain leadership risk posture.
3. Open Analytics.
4. Drill into country, commodity, ESG, certification, and supplier ranking drivers.
5. Open Simulator.
6. Run a disruption scenario and explain before/after risk.
7. Open Supplier Engagement.
8. Show Onboarding document extraction and evidence checklist.
9. Show Auditing queue, CAPA, evidence, and AI decision.
10. Show Traceability journey, site polygons, trace evidence upload, gap closure, and regenerated trace decision.
11. Open ESG Monitoring.
12. Explain ESG indicators, alerts, watchlist, and ML health signals.
13. Open Due Diligence Agent.
14. Run deeper review for a risky supplier and show the generated decision, checklist, risk drivers, evidence gaps, and actions.
15. Open Supplier Advisor AI.
16. Ask a natural-language question that summarizes Supplier 360 risk, due diligence priorities, audit blockers, traceability gaps, or simulator impact.
17. Explain AI governance infrastructure briefly if asked.

## 20. How To Explain This To ChatGPT Later

If you later upload or paste this document into ChatGPT, ask questions like:

- "Explain the Traceability module in simple terms."
- "What should I say during a client demo?"
- "What is the difference between Auditing and Traceability?"
- "What does EUDR mean in this app?"
- "Which backend endpoints power Onboarding?"
- "What is demo-ready versus production-ready?"
- "Give me a five-minute demo script for the whole product."

Because this document explains both the functional meaning and technical mapping, ChatGPT should be able to answer follow-up questions clearly.

## 21. Documentation Verification Notes

This guide was checked against the current codebase on 2026-05-07 so the functional story and technical mapping match the application as it exists now.

Project Markdown files reviewed:

- `README.md`
- `GUARDRAILS_IMPLEMENTATION.md`
- `docs/Ozone_AI_4_Functional_Technical_Guide.md`

Generated, cache, and vendor Markdown files were not treated as product documentation. Examples include `.codex-template-analysis/.pytest_cache/README.md` and package documentation under `frontend/node_modules/**`.

Application areas verified:

- Frontend routing: `frontend/src/App.tsx`
- Shared shell and navigation: `frontend/src/components/layout/AppShell.tsx`
- Main product pages: Executive Dashboard, Analytics, Simulator, Supplier Engagement, ESG Monitoring, Due Diligence Agent, and Supplier Advisor AI
- Backend app registration: `backend/app/main.py`
- Backend routers: health, datasets, analytics, simulator, risk, advisor, AI review, onboarding, auditing, traceability, and ESG monitoring
- Data files: supplier, ESG, transaction, certification, audit, traceability, monitoring seed, due diligence, alert, and evidence CSV/GeoJSON files in `data/`
- AI governance code: guardrails, prompt registry, AI gateway, output validation, audit log, rate limiter, and review queue
- Test coverage: `tests/test_ai_guardrails.py`

Current-state corrections to remember:

- `frontend/src/pages/AiReviewQueuePage.tsx` exists, but it is not currently exposed through a route in `frontend/src/App.tsx`.
- ESG Monitoring is active as a Phase 1 visual ML monitoring command center.
- `GET /api/v1/esg-monitoring/overview` is the current backend overview endpoint.
- Additional persisted alert, monthly snapshot, and monitoring decision endpoints are future enhancements.

Beginner-friendly mental model:

The app is best understood as a demo platform with working supplier-risk workflows and file-backed persistence. The frontend shows the business workflows, the backend computes and persists the workflow data, the `data/` folder acts like a temporary database, and the AI layer adds guarded explanations and recommendations where configured.
