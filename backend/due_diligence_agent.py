from backend.ai_agent import ask_supplier_agent


def run_due_diligence(supplier_name, performance, esg, suppliers):

    # -------------------------------
    # GET SUPPLIER DATA
    # -------------------------------
    supplier_row = performance[
        performance["supplier_name"] == supplier_name
    ].iloc[0]

    supplier_id = supplier_row["supplier_id"]

    esg_row = esg[esg["supplier_id"] == supplier_id]

    esg_score = None
    if not esg_row.empty:
        esg_score = float(esg_row["esg_score"].values[0])

    risk_score = float(supplier_row["risk_score"])

    # -------------------------------
    # CLASSIFY RISKS
    # -------------------------------
    if risk_score > 8:
        op_risk = "High"
    elif risk_score > 5:
        op_risk = "Medium"
    else:
        op_risk = "Low"

    if esg_score is not None:
        if esg_score < 60:
            esg_risk = "High"
        elif esg_score < 75:
            esg_risk = "Moderate"
        else:
            esg_risk = "Low"
    else:
        esg_risk = "Unknown"

    # -------------------------------
    # COMBINED RISK
    # -------------------------------
    if op_risk == "High" and esg_risk == "High":
        overall = "Critical"
    elif op_risk == "High" or esg_risk == "High":
        overall = "High"
    else:
        overall = "Moderate"

    # -------------------------------
    # KEY ISSUES (RULE-BASED)
    # -------------------------------
    issues = []

    if supplier_row["avg_delay"] > 5:
        issues.append("Delivery performance is inconsistent")

    if supplier_row["avg_defect"] > 0.03:
        issues.append("Quality issues observed")

    if esg_score and esg_score < 60:
        issues.append("Sustainability performance below acceptable threshold")

    # -------------------------------
    # AI SUMMARY (STRUCTURED)
    # -------------------------------
    prompt = f"""
Supplier: {supplier_name}
Operational Risk: {op_risk}
ESG Risk: {esg_risk}
Issues: {issues}
"""

    ai_summary = ask_supplier_agent(prompt, performance)

    # -------------------------------
    # OUTPUT
    # -------------------------------
    return {
        "supplier": supplier_name,
        "op_risk": op_risk,
        "esg_risk": esg_risk,
        "overall": overall,
        "issues": issues,
        "ai_summary": ai_summary
    }