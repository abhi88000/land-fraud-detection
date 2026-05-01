from google.cloud import storage
from app.core.config import settings
from app.core.errors import LandGuardException
import asyncio
import logging
import os

logger = logging.getLogger(__name__)

class MockGCSService:
    def __init__(self):
        logger.info("Initializing Mock GCS Service")
        self.bucket_name = settings.GCS_BUCKET_NAME or "mock-bucket"

    async def upload_file(self, destination_blob_name: str, file_content: bytes, content_type: str) -> str:
        logger.info(f"[MOCK GCS] Uploading {destination_blob_name} to {self.bucket_name}")
        return f"gs://{self.bucket_name}/{destination_blob_name}"

    async def download_file_bytes(self, source_blob_name: str) -> bytes:
        logger.info(f"[MOCK GCS] Downloading {source_blob_name}")
        return b"mock file content"

    async def delete_file(self, blob_name: str):
        logger.info(f"[MOCK GCS] Deleting {blob_name}")
        pass

class GCSService:
    def __init__(self):
        self.bucket_name = settings.GCS_BUCKET_NAME
        try:
            self.client = storage.Client(project=settings.GCP_PROJECT_ID)
            self.bucket = self.client.get_bucket(self.bucket_name)
            self.is_mock = False
        except Exception as e:
            logger.warning(f"Failed to initialize real GCS, falling back to mock: {e}")
            self.mock = MockGCSService()
            self.is_mock = True

    async def upload_file(self, destination_blob_name: str, file_content: bytes, content_type: str) -> str:
        if self.is_mock:
            return await self.mock.upload_file(destination_blob_name, file_content, content_type)
        try:
            blob = self.bucket.blob(destination_blob_name)
            await asyncio.to_thread(blob.upload_from_string, file_content, content_type=content_type)
            return f"gs://{self.bucket_name}/{destination_blob_name}"
        except Exception as e:
            logger.error(f"Failed to upload file '{destination_blob_name}' to GCS: {e}")
            raise LandGuardException(f"Failed to upload file to GCS: {e}")

    async def download_file_bytes(self, source_blob_name: str) -> bytes:
        if self.is_mock:
            return await self.mock.download_file_bytes(source_blob_name)
        try:
            # Strip gs:// prefix if present
            if source_blob_name.startswith(f"gs://{self.bucket_name}/"):
                source_blob_name = source_blob_name[len(f"gs://{self.bucket_name}/"):]
            blob = self.bucket.blob(source_blob_name)
            return await asyncio.to_thread(blob.download_as_bytes)
        except Exception as e:
            logger.error(f"Failed to download file '{source_blob_name}' from GCS: {e}")
            raise LandGuardException(f"Failed to download file from GCS: {e}")

    async def delete_file(self, blob_name: str):
        if self.is_mock:
            return await self.mock.delete_file(blob_name)
        try:
            blob = self.bucket.blob(blob_name)
            exists = await asyncio.to_thread(blob.exists)
            if exists:
                await asyncio.to_thread(blob.delete)
        except Exception as e:
            logger.error(f"Failed to delete blob '{blob_name}' from GCS: {e}")
            raise LandGuardException(f"Failed to delete file from GCS: {e}")

gcs = GCSService()
