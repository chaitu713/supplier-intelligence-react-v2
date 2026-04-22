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

    operational_score = float(supplier_row["operational_risk_score"])
    esg_risk_score = float(supplier_row["esg_risk_score"])
    overall_score = float(supplier_row["overall_risk_score"])

    # -------------------------------
    # CLASSIFY RISKS
    # -------------------------------
    if operational_score >= 60:
        op_risk = "High"
    elif operational_score >= 40:
        op_risk = "Medium"
    else:
        op_risk = "Low"

    if esg_risk_score >= 60:
        esg_risk = "High"
    elif esg_risk_score >= 40:
        esg_risk = "Medium"
    else:
        esg_risk = "Low"

    # -------------------------------
    # COMBINED RISK
    # -------------------------------
    if overall_score >= 75:
        overall = "Critical"
    elif overall_score >= 60:
        overall = "High"
    elif overall_score >= 40:
        overall = "Moderate"
    else:
        overall = "Low"

    # -------------------------------
    # KEY ISSUES (RULE-BASED)
    # -------------------------------
    issues = []

    if supplier_row.get("avg_delay", 0) >= 70:
        issues.append("Delivery performance is inconsistent")

    if supplier_row.get("avg_defect", 0) >= 70:
        issues.append("Quality issues observed")

    if supplier_row.get("audit_non_compliance_mean", 0) >= 70:
        issues.append("Audit findings indicate repeated control failures")

    if supplier_row.get("open_alert_severity", 0) >= 70:
        issues.append("Open alerts show unresolved supplier incidents")

    if supplier_row.get("certification_gap_score", 0) >= 70:
        issues.append("Certification coverage and renewal status are below target")

    if supplier_row.get("commodity_exposure_risk", 0) >= 70:
        issues.append("Commodity exposure increases concentration and traceability risk")

    if supplier_row.get("environmental_risk_score", 0) >= 70:
        issues.append("Environmental indicators are weaker than peer suppliers")

    if supplier_row.get("social_risk_score", 0) >= 70:
        issues.append("Social responsibility indicators suggest elevated workforce risk")

    if supplier_row.get("governance_risk_score", 0) >= 70:
        issues.append("Governance controls appear less mature than peer suppliers")

    if not issues and esg_score is not None and esg_score < 50:
        issues.append("Composite ESG profile remains below target threshold")

    # -------------------------------
    # AI SUMMARY (STRUCTURED)
    # -------------------------------
    prompt = f"""
Supplier: {supplier_name}
Operational Risk: {op_risk} ({operational_score:.1f}/100)
ESG Risk: {esg_risk} ({esg_risk_score:.1f}/100)
Overall Risk: {overall} ({overall_score:.1f}/100)
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
