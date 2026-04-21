import pandas as pd
import re
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_ROOT / "data"

############################################################
# DOCUMENT TYPE DETECTION
############################################################

def detect_document_type(text):

    text_lower = text.lower()

    if "supplier name" in text_lower and "certification" in text_lower:
        return "supplier"

    elif "carbon emission" in text_lower and "esg score" in text_lower:
        return "esg"

    elif "transaction id" in text_lower and "order value" in text_lower:
        return "transaction"

    else:
        return "unknown"


############################################################
# SUPPLIER PARSER
############################################################

def parse_supplier_data(text):

    suppliers = []

    records = text.split("Supplier ID:")

    for r in records[1:]:

        supplier_id = re.search(r"\d+", r).group()

        name = re.search(r"Supplier Name:\s*(.*)", r)
        country = re.search(r"Country:\s*(.*)", r)
        category = re.search(r"Category:\s*(.*)", r)
        cert = re.search(r"Certification:\s*(.*)", r)

        suppliers.append({

            "supplier_id": int(supplier_id),

            "supplier_name": name.group(1).strip() if name else "",

            "country": country.group(1).strip() if country else "",

            "category": category.group(1).strip() if category else "",

            "certification": cert.group(1).strip() if cert else ""

        })

    return pd.DataFrame(suppliers)


############################################################
# APPEND SUPPLIERS
############################################################

def append_suppliers(df):

    import pandas as pd

    existing = pd.read_csv(DATA_DIR / "suppliers.csv")

    df = df[~df["supplier_id"].isin(existing["supplier_id"])]

    updated = pd.concat([existing, df], ignore_index=True)

    updated.to_csv(DATA_DIR / "suppliers.csv", index=False)

    return f"{len(df)} New Suppliers Added"


############################################################
# ESG PARSER
############################################################

def parse_esg_data(text):

    esg_records = []

    records = text.split("Supplier ID:")

    for r in records[1:]:

        supplier_id = re.search(r"\d+", r).group()

        carbon = re.search(r"Carbon Emission:\s*(\d+)", r)
        water = re.search(r"Water Usage:\s*(\d+)", r)
        labor = re.search(r"Labor Violations:\s*(\d+)", r)
        score = re.search(r"ESG Score:\s*(\d+)", r)

        esg_records.append({

            "supplier_id": int(supplier_id),

            "carbon_emission": int(carbon.group(1)) if carbon else 0,

            "water_usage": int(water.group(1)) if water else 0,

            "labor_violations": int(labor.group(1)) if labor else 0,

            "esg_score": int(score.group(1)) if score else 0

        })

    return pd.DataFrame(esg_records)


############################################################
# APPEND ESG
############################################################

def append_esg(df):

    import pandas as pd

    existing = pd.read_csv(DATA_DIR / "esg_metrics.csv")

    df = df[~df["supplier_id"].isin(existing["supplier_id"])]

    updated = pd.concat([existing, df], ignore_index=True)

    updated.to_csv(DATA_DIR / "esg_metrics.csv", index=False)

    return f"{len(df)} New ESG Records Added"


############################################################
# TRANSACTION PARSER
############################################################

def parse_transaction_data(text):

    transactions = []

    records = text.split("Transaction ID:")

    for r in records[1:]:

        transaction_id = re.search(r"\d+", r).group()

        supplier = re.search(r"Supplier ID:\s*(\d+)", r)
        value = re.search(r"Order Value:\s*(\d+)", r)
        delay = re.search(r"Delivery Delay:\s*(\d+)", r)
        defect = re.search(r"Defect Rate:\s*(\d+\.?\d*)", r)
        variance = re.search(r"Cost Variance:\s*(-?\d+\.?\d*)", r)

        transactions.append({

            "transaction_id": int(transaction_id),

            "supplier_id": int(supplier.group(1)) if supplier else 0,

            "order_value": int(value.group(1)) if value else 0,

            "delivery_delay_days": int(delay.group(1)) if delay else 0,

            "defect_rate": float(defect.group(1)) if defect else 0,

            "cost_variance": float(variance.group(1)) if variance else 0

        })

    return pd.DataFrame(transactions)


############################################################
# APPEND TRANSACTIONS
############################################################

def append_transactions(df):

    import pandas as pd

    existing = pd.read_csv(DATA_DIR / "transactions.csv")

    df = df[~df["transaction_id"].isin(existing["transaction_id"])]

    updated = pd.concat([existing, df], ignore_index=True)

    updated.to_csv(DATA_DIR / "transactions.csv", index=False)

    return f"{len(df)} New Transactions Added"


############################################################
# MAIN INGESTION PIPELINE
############################################################

def process_extracted_document(text):

    doc_type = detect_document_type(text)

    if doc_type == "supplier":

        df = parse_supplier_data(text)
        count = append_suppliers(df)

        return doc_type, count

    elif doc_type == "esg":

        df = parse_esg_data(text)
        count = append_esg(df)

        return doc_type, count

    elif doc_type == "transaction":

        df = parse_transaction_data(text)
        count = append_transactions(df)

        return doc_type, count

    else:

        return "unknown", 0
