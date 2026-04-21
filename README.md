# Supplier AI System

This project is an AI-driven Supplier Intelligence application with a modular FastAPI backend and a React frontend built with Vite, TypeScript, Tailwind, and React Query.

## Current Stack
- Backend: FastAPI
- Frontend: React + Vite + TypeScript + Tailwind
- Data source: CSV datasets in `data/`
- AI integrations: Gemini and Azure document services

## Features
- Document ingestion for supplier, ESG, and transaction PDFs
- Raw dataset exploration for suppliers, ESG, and transactions
- Overview dashboard with supplier and ESG analytics
- Risk monitoring with top-risk suppliers and due diligence
- Supplier Advisor AI chat experience

## Project Structure
```text
ai-supplier-intelligence-react/
+-- backend/
¦   +-- app/
¦   ¦   +-- core/
¦   ¦   +-- routers/
¦   ¦   +-- schemas/
¦   ¦   +-- services/
¦   +-- ai_agent.py
¦   +-- api.py
¦   +-- data_append.py
¦   +-- document_history.py
¦   +-- document_intelligence.py
¦   +-- due_diligence_agent.py
+-- data/
+-- frontend/
¦   +-- src/
¦   +-- package.json
¦   +-- vite.config.ts
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
- CSV files are still the current persistence layer
- AI and document-processing flows require valid external service credentials
