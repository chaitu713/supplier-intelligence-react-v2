from azure.ai.formrecognizer import DocumentAnalysisClient
from azure.core.credentials import AzureKeyCredential

import os

endpoint = os.getenv("DOCUMENT_INTELLIGENCE_ENDPOINT")
key = os.getenv("DOCUMENT_INTELLIGENCE_KEY")

client = DocumentAnalysisClient(endpoint, AzureKeyCredential(key))


def extract_document(blob_url):

    poller = client.begin_analyze_document_from_url(
        "prebuilt-document",
        document_url=blob_url
    )

    result = poller.result()

    extracted_text = ""

    for page in result.pages:
        for line in page.lines:
            extracted_text += line.content + "\n"

    return extracted_text