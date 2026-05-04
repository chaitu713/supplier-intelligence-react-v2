from __future__ import annotations

import json
from typing import Any

from dotenv import load_dotenv

load_dotenv()


def ask_supplier_ai(
    question: str,
    context: dict[str, Any],
    lens: str = "general",
    deterministic_brief: str | None = None,
) -> str:
    prompt = _build_advisor_prompt(
        question=question,
        context=context,
        lens=lens,
        deterministic_brief=deterministic_brief,
    )
    try:
        from backend.app.ai.prompt_registry import get_prompt_policy_block
        from backend.app.services.ai_gateway import AiTextRequest, generate_ai_text
    except ImportError:
        from app.ai.prompt_registry import get_prompt_policy_block
        from app.services.ai_gateway import AiTextRequest, generate_ai_text

    response = generate_ai_text(
        AiTextRequest(
            feature="advisor",
            prompt=prompt,
            user_input=question,
            context=context,
        )
    )
    return response.text


def ask_supplier_agent(question, performance_df):
    context = {}
    try:
        context = {
            "row_count": int(len(performance_df)),
            "columns": list(performance_df.columns)[:40],
        }
    except Exception:
        context = {"row_count": 0, "columns": []}

    prompt = f"""
You are supporting a supplier due diligence review.

{get_prompt_policy_block("due_diligence")}

Grounding context metadata:
{json.dumps(context, indent=2, default=str)}

Supplier review request:
{question}

Rules:
- Stay grounded in the supplied supplier review request.
- Do not invent certifications, audit evidence, ESG metrics, or risk scores.
- Keep the response concise and action-oriented.
- Make clear that the output supports, but does not replace, human review.
"""
    try:
        from backend.app.services.ai_gateway import AiTextRequest, generate_ai_text
    except ImportError:
        from app.services.ai_gateway import AiTextRequest, generate_ai_text

    response = generate_ai_text(
        AiTextRequest(
            feature="due_diligence",
            prompt=prompt,
            user_input=str(question),
            context=context,
        )
    )
    return response.text


def _build_advisor_prompt(
    question: str,
    context: dict[str, Any],
    lens: str,
    deterministic_brief: str | None,
) -> str:
    try:
        from backend.app.ai.prompt_registry import get_prompt_policy_block
    except ImportError:
        from app.ai.prompt_registry import get_prompt_policy_block

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

{get_prompt_policy_block("advisor")}

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
