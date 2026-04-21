from google import genai
import os
from dotenv import load_dotenv
import pandas as pd

# Load env
load_dotenv()
API_KEY = os.getenv("GEMINI_API_KEY")

# Gemini client
client = genai.Client(api_key=API_KEY)


# =====================================================
# 🤖 COPILOT (EXPLORATORY AI)
# =====================================================
def ask_supplier_ai(question, performance_df):

    try:
        context_data = performance_df.sort_values(
            "risk_score", ascending=False
        )[[
            "supplier_name",
            "country",
            "category",
            "avg_delay",
            "avg_defect",
            "avg_cost_variance",
            "risk_score"
        ]].head(50)

        data_text = context_data.to_string(index=False)

        prompt = f"""
You are a senior procurement analyst helping a user explore supplier data.

Dataset:
{data_text}

User Question:
{question}

Instructions:
- Provide a clear and insightful response using meaningful headings
- Use bullet points where appropriate
- Do NOT use fixed sections like "Key Insights", "Risk Alerts", "Recommendations"

Guidelines:
- Focus on patterns, risks, and meaningful observations
- Highlight anything important the user might miss
- Avoid repeating raw data
- Keep response concise and readable
- Do NOT mention exact numeric values
- Do NOT guess or infer numbers from the dataset

Tone:
- Professional and analytical
- Insight-driven, not robotic
"""

        response = client.models.generate_content(
            model="gemini-3.1-flash-lite-preview",
            contents=prompt
        )

        return response.text

    except Exception as e:
        return f"Error generating AI response: {str(e)}"


# =====================================================
# 🧠 DUE DILIGENCE AGENT (STRUCTURED AI)
# =====================================================
def ask_supplier_agent(question, performance_df):

    try:
        context_data = performance_df.sort_values(
            "risk_score", ascending=False
        )[[
            "supplier_name",
            "country",
            "category",
            "avg_delay",
            "avg_defect",
            "avg_cost_variance",
            "risk_score"
        ]].head(30)

        data_text = context_data.to_string(index=False)

        prompt = f"""
You are a senior procurement risk analyst.

Dataset:
{data_text}

Task:
{question}

Instructions:
- Respond in EXACTLY 3 sections:
  Key Insights
  Risk Alerts
  Recommendations

- Use bullet points ONLY (no numbering)
- Each bullet must be a single complete sentence
- Keep output concise and structured
- Maximum 6–7 bullets total

Guidelines:
- Focus on operational risk (delay, defect, cost)
- Include ESG perspective where relevant
- Highlight critical supplier concerns
- Provide actionable recommendations
- Avoid long paragraphs

Tone:
- Executive
- Crisp
- Decision-focused
"""

        response = client.models.generate_content(
            model="gemini-3.1-flash-lite-preview",
            contents=prompt
        )

        return response.text

    except Exception as e:
        return f"Error generating AI response: {str(e)}"