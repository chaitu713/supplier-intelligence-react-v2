from __future__ import annotations

import json
import os
from typing import Any

from dotenv import load_dotenv
from google import genai

load_dotenv()
API_KEY = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=API_KEY) if API_KEY else None


def ask_supplier_ai(
    question: str,
    context: dict[str, Any],
    lens: str = "general",
    deterministic_brief: str | None = None,
) -> str:
    if client is None:
        raise RuntimeError("GEMINI_API_KEY is not configured")

    prompt = _build_advisor_prompt(
        question=question,
        context=context,
        lens=lens,
        deterministic_brief=deterministic_brief,
    )
    response = client.models.generate_content(
        model="gemini-3.1-flash-lite-preview",
        contents=prompt,
    )
    return response.text or ""


def ask_supplier_agent(question, performance_df):
    raise NotImplementedError("Due diligence agent is handled separately.")


def _build_advisor_prompt(
    question: str,
    context: dict[str, Any],
    lens: str,
    deterministic_brief: str | None,
) -> str:
    lens_instructions = {
        "general": "Answer like a supplier intelligence advisor who synthesizes risk, ESG, geography, and sourcing posture.",
        "executive": "Answer for leadership with concise risk posture explanations and implications.",
        "analytics": "Answer like an analyst, focusing on drivers, distributions, comparisons, and evidence.",
        "simulator": "Explain what changed in the scenario, why the deltas occurred, and which supplier groups were affected.",
        "due_diligence": "Focus on follow-up actions, review priorities, and supplier-level concerns.",
        "esg_monitoring": "Focus on ESG pillar pressure, deteriorating indicators, and monitoring implications.",
    }
    serialized_context = json.dumps(context, indent=2, default=str)
    instruction = lens_instructions.get(lens, lens_instructions["general"])

    return f"""
You are Supplier Advisor AI inside a responsible sourcing and supplier intelligence application.

Active lens:
{lens}

Lens instruction:
{instruction}

Grounding context:
{serialized_context}

Deterministic brief:
{deterministic_brief or "None provided."}

User question:
{question}

Rules:
- Answer only from the supplied grounding context.
- Use the deterministic brief as your primary answer structure, then refine it into a more natural response.
- If the simulator context is present, use it directly instead of speaking generically.
- Mention specific suppliers, countries, commodities, or KPI deltas when they are present in the context.
- Keep the reply concise, structured, and decision-useful.
- Use short headings when helpful.
- Do not invent entities or metrics not present in the context.
- If the question asks for unavailable detail, say what is available instead.
"""
