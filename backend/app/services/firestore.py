from google.cloud.firestore_v1 import AsyncClient
from google.cloud.firestore_v1.base_query import FieldFilter
from google.cloud.firestore_v1 import query as firestore_query
from app.core.config import settings
from app.core.errors import LandGuardException, DocumentNotFoundException
from app.models.document import DocumentStatus, Document
from typing import Dict, Any, List, Tuple, Optional
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


def _convert_timestamps(obj):
    """Recursively convert Firestore Timestamp objects to ISO strings."""
    if isinstance(obj, dict):
        return {k: _convert_timestamps(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_convert_timestamps(item) for item in obj]
    elif hasattr(obj, 'isoformat'):
        iso = obj.isoformat()
        # Ensure timezone-naive datetimes get Z suffix for JS compatibility
        if not iso.endswith('Z') and '+' not in iso:
            iso += 'Z'
        return iso
    return obj

class MockFirestoreService:
    def __init__(self):
        logger.info("Initializing Mock Firestore Service")
        self.documents = {}
        self.reports = {}
        self.events = {}

    async def create_document_entry(self, document_id: str, document_data: Dict[str, Any]):
        logger.info(f"[MOCK FIRESTORE] Creating document {document_id}")
        document_data["created_at"] = datetime.utcnow().isoformat() + "Z"
        self.documents[document_id] = document_data

    async def get_document_entry(self, document_id: str) -> Optional[Dict[str, Any]]:
        logger.info(f"[MOCK FIRESTORE] Getting document {document_id}")
        return self.documents.get(document_id)

    async def update_document_entry(self, document_id: str, updates: Dict[str, Any]):
        logger.info(f"[MOCK FIRESTORE] Updating document {document_id}")
        if document_id in self.documents:
            self.documents[document_id].update(updates)

    async def update_document_status(self, document_id: str, status: DocumentStatus):
        await self.update_document_entry(document_id, {"status": status.value})

    async def update_document_status_and_progress(self, document_id: str, message: str, progress: int):
        await self.update_document_entry(document_id, {"progress_message": message, "progress_percentage": progress})

    async def list_documents_for_user(self, user_id: str, page: int = 1, page_size: int = 10, status: Optional[DocumentStatus] = None) -> Tuple[List[Dict[str, Any]], int]:
        logger.info(f"[MOCK FIRESTORE] Listing documents for user {user_id}")
        user_docs = [doc for doc in self.documents.values() if doc.get("user_id") == user_id]
        if status:
            user_docs = [doc for doc in user_docs if doc.get("status") == status.value]
        
        # Sort by created_at descending
        user_docs.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        
        total_count = len(user_docs)
        offset = (page - 1) * page_size
        return user_docs[offset : offset + page_size], total_count

    async def save_analysis_report(self, document_id: str, report_data: Dict[str, Any]):
        logger.info(f"[MOCK FIRESTORE] Saving report for {document_id}")
        self.reports[document_id] = report_data

    async def get_analysis_report(self, document_id: str) -> Optional[Dict[str, Any]]:
        logger.info(f"[MOCK FIRESTORE] Getting report for {document_id}")
        return self.reports.get(document_id)

    async def get_document_events_since(self, document_id: str, since_timestamp: Optional[str] = None) -> List[Dict[str, Any]]:
        doc_events = self.events.get(document_id, [])
        if since_timestamp:
            doc_events = [e for e in doc_events if e.get("timestamp", "") > since_timestamp]
        return doc_events

    async def add_document_event(self, document_id: str, event_data: Dict[str, Any]):
        if document_id not in self.events:
            self.events[document_id] = []
        self.events[document_id].append(event_data)

class FirestoreService:
    def __init__(self):
        try:
            self.db = AsyncClient(project=settings.GCP_PROJECT_ID)
            self.documents_collection = self.db.collection(settings.FIRESTORE_COLLECTION_DOCUMENTS)
            self.reports_collection = self.db.collection(settings.FIRESTORE_COLLECTION_ANALYSIS_REPORTS)
            self.is_mock = False
            logger.info("Firestore AsyncClient initialized successfully.")
        except Exception as e:
            logger.warning(f"Failed to initialize real Firestore, falling back to mock: {e}")
            self.mock = MockFirestoreService()
            self.is_mock = True

    async def create_document_entry(self, document_id: str, document_data: Dict[str, Any]):
        if self.is_mock:
            return await self.mock.create_document_entry(document_id, document_data)
        try:
            await self.documents_collection.document(document_id).set(document_data)
        except Exception as e:
            logger.error(f"Failed to create document entry {document_id} in Firestore: {e}")
            raise LandGuardException(f"Failed to create document entry: {e}")

    async def get_document_entry(self, document_id: str) -> Optional[Dict[str, Any]]:
        if self.is_mock:
            return await self.mock.get_document_entry(document_id)
        try:
            doc_ref = self.documents_collection.document(document_id)
            doc = await doc_ref.get()
            if doc.exists:
                doc_dict = doc.to_dict()
                doc_dict["id"] = doc.id
                return _convert_timestamps(doc_dict)
            return None
        except Exception as e:
            logger.error(f"Failed to get document entry {document_id} from Firestore: {e}")
            raise LandGuardException(f"Failed to retrieve document entry: {e}")

    async def update_document_entry(self, document_id: str, updates: Dict[str, Any]):
        if self.is_mock:
            return await self.mock.update_document_entry(document_id, updates)
        try:
            updates["updated_at"] = datetime.utcnow().isoformat() + "Z"
            await self.documents_collection.document(document_id).update(updates)
        except Exception as e:
            logger.error(f"Failed to update document entry {document_id} in Firestore: {e}")
            raise LandGuardException(f"Failed to update document entry: {e}")

    async def update_document_status(self, document_id: str, status: DocumentStatus):
        await self.update_document_entry(document_id, {"status": status.value})

    async def update_document_status_and_progress(self, document_id: str, message: str, progress: int):
        if self.is_mock:
            return await self.mock.update_document_status_and_progress(document_id, message, progress)
        try:
            updates = {
                "progress_message": message,
                "progress_percentage": progress,
                "updated_at": datetime.utcnow().isoformat() + "Z"
            }
            await self.documents_collection.document(document_id).update(updates)
        except Exception as e:
            logger.error(f"Failed to update document {document_id} progress: {e}")
            raise LandGuardException(f"Failed to update document progress: {e}")

    async def list_documents_for_user(self, user_id: str, page: int = 1, page_size: int = 10, status: Optional[DocumentStatus] = None) -> Tuple[List[Dict[str, Any]], int]:
        if self.is_mock:
            return await self.mock.list_documents_for_user(user_id, page, page_size, status)
        try:
            query = self.documents_collection.where(filter=FieldFilter("user_id", "==", user_id))
            
            # Get all matching docs for count and pagination
            all_docs = []
            async for doc in query.stream():
                doc_dict = doc.to_dict()
                doc_dict["id"] = doc.id
                all_docs.append(_convert_timestamps(doc_dict))
            
            if status:
                all_docs = [d for d in all_docs if d.get("status") == status.value]

            # Sort by created_at descending in memory
            all_docs.sort(key=lambda x: x.get("created_at", ""), reverse=True)

            total_count = len(all_docs)
            offset = (page - 1) * page_size
            paginated_docs = all_docs[offset: offset + page_size]

            return paginated_docs, total_count
        except Exception as e:
            logger.error(f"Failed to list documents for user {user_id}: {e}")
            raise LandGuardException(f"Failed to list documents: {e}")

    async def save_analysis_report(self, document_id: str, report_data: Dict[str, Any]):
        if self.is_mock:
            return await self.mock.save_analysis_report(document_id, report_data)
        try:
            await self.reports_collection.document(document_id).set(report_data)
        except Exception as e:
            logger.error(f"Failed to save analysis report for {document_id}: {e}")
            raise LandGuardException(f"Failed to save analysis report: {e}")

    async def get_analysis_report(self, document_id: str) -> Optional[Dict[str, Any]]:
        if self.is_mock:
            return await self.mock.get_analysis_report(document_id)
        try:
            doc_ref = self.reports_collection.document(document_id)
            doc = await doc_ref.get()
            if doc.exists:
                doc_dict = doc.to_dict()
                return _convert_timestamps(doc_dict)
            return None
        except Exception as e:
            logger.error(f"Failed to get analysis report for {document_id}: {e}")
            raise LandGuardException(f"Failed to retrieve analysis report: {e}")

    async def get_document_events_since(self, document_id: str, since_timestamp: Optional[str] = None) -> List[Dict[str, Any]]:
        if self.is_mock:
            return await self.mock.get_document_events_since(document_id, since_timestamp)
        try:
            events_ref = self.documents_collection.document(document_id).collection("events")
            docs = []
            async for doc in events_ref.stream():
                doc_dict = doc.to_dict()
                docs.append(_convert_timestamps(doc_dict))
            # Sort by timestamp in memory
            docs.sort(key=lambda x: x.get("timestamp", ""))
            if since_timestamp:
                docs = [d for d in docs if d.get("timestamp", "") > since_timestamp]
            return docs
        except Exception as e:
            logger.error(f"Failed to get events for document {document_id}: {e}")
            return []  # Return empty list instead of crashing the SSE stream

    async def add_document_event(self, document_id: str, event_data: Dict[str, Any]):
        if self.is_mock:
            return await self.mock.add_document_event(document_id, event_data)
        try:
            await self.documents_collection.document(document_id).collection("events").add(event_data)
        except Exception as e:
            logger.error(f"Failed to add event for document {document_id}: {e}")

    async def delete_document_entry(self, document_id: str):
        if self.is_mock:
            self.mock.documents.pop(document_id, None)
            self.mock.reports.pop(document_id, None)
            self.mock.events.pop(document_id, None)
            return
        try:
            # Delete events subcollection
            events_ref = self.documents_collection.document(document_id).collection("events")
            async for doc in events_ref.stream():
                await doc.reference.delete()
            # Delete document entry
            await self.documents_collection.document(document_id).delete()
            # Delete analysis report if exists
            await self.reports_collection.document(document_id).delete()
        except Exception as e:
            logger.error(f"Failed to delete document {document_id}: {e}")

firestore = FirestoreService()
