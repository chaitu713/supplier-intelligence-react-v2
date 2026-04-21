import pandas as pd
from datetime import datetime
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
HISTORY_FILE = PROJECT_ROOT / "data" / "document_history.csv"


def log_document(document_name, doc_type, records_added):

    history = pd.read_csv(HISTORY_FILE)

    new_record = pd.DataFrame([{

        "document_name": document_name,
        "document_type": doc_type,
        "status": "Processed",
        "records_added": records_added,
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    }])

    history = pd.concat([history, new_record], ignore_index=True)

    history.to_csv(HISTORY_FILE, index=False)
