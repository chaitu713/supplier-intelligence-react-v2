from azure.storage.blob import BlobServiceClient
import os

connection_string = os.getenv("BLOB_CONNECTION_STRING")

container_name = "supplier-documents"

blob_service = BlobServiceClient.from_connection_string(connection_string)


def upload_file_to_blob(file_path, blob_name):

    blob_client = blob_service.get_blob_client(
        container=container_name,
        blob=blob_name
    )

    with open(file_path, "rb") as data:
        blob_client.upload_blob(data, overwrite=True)

    blob_url = blob_client.url

    return blob_url