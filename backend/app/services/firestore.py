from google.cloud.firestore_v1 import AsyncClient
from google.cloud.firestore_v1.base_query import FieldFilter
from google.cloud.firestore_v1 import query as firestore_query
from google.api_core.exceptions import NotFound
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
        self.bundles = {}
        self.bundle_reports = {}
        self.bundle_events = {}

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

    # --- Bundle mock methods ---
    async def create_bundle_entry(self, bundle_id: str, data: Dict[str, Any]):
        data["created_at"] = datetime.utcnow().isoformat() + "Z"
        self.bundles[bundle_id] = data

    async def get_bundle_entry(self, bundle_id: str) -> Optional[Dict[str, Any]]:
        return self.bundles.get(bundle_id)

    async def update_bundle_entry(self, bundle_id: str, updates: Dict[str, Any]):
        if bundle_id in self.bundles:
            self.bundles[bundle_id].update(updates)

    async def list_bundles_for_user(self, user_id: str) -> List[Dict[str, Any]]:
        user_bundles = [b for b in self.bundles.values() if b.get("user_id") == user_id]
        user_bundles.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        return user_bundles

    async def delete_bundle_entry(self, bundle_id: str):
        self.bundles.pop(bundle_id, None)
        self.bundle_reports.pop(bundle_id, None)
        self.bundle_events.pop(bundle_id, None)

    async def save_bundle_report(self, bundle_id: str, report_data: Dict[str, Any]):
        self.bundle_reports[bundle_id] = report_data

    async def get_bundle_report(self, bundle_id: str) -> Optional[Dict[str, Any]]:
        return self.bundle_reports.get(bundle_id)

    async def list_documents_for_bundle(self, bundle_id: str) -> List[Dict[str, Any]]:
        return [d for d in self.documents.values() if d.get("bundle_id") == bundle_id]

    async def add_bundle_event(self, bundle_id: str, event_data: Dict[str, Any]):
        if bundle_id not in self.bundle_events:
            self.bundle_events[bundle_id] = []
        self.bundle_events[bundle_id].append(event_data)

    async def get_bundle_events_since(self, bundle_id: str, since_timestamp: Optional[str] = None) -> List[Dict[str, Any]]:
        events = self.bundle_events.get(bundle_id, [])
        if since_timestamp:
            events = [e for e in events if e.get("timestamp", "") > since_timestamp]
        return events


class FirestoreService:
    def __init__(self):
        try:
            self.db = AsyncClient(project=settings.GCP_PROJECT_ID)
            self.documents_collection = self.db.collection(settings.FIRESTORE_COLLECTION_DOCUMENTS)
            self.reports_collection = self.db.collection(settings.FIRESTORE_COLLECTION_ANALYSIS_REPORTS)
            self.bundles_collection = self.db.collection("bundles")
            self.bundle_reports_collection = self.db.collection("bundle_reports")
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
        except NotFound:
            # Document was deleted (e.g., user cancelled/deleted mid-analysis). Treat as benign.
            logger.info(f"Skipping progress update for deleted document {document_id}")
        except Exception as e:
            logger.error(f"Failed to update document {document_id} progress: {e}")

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
            # Batch-delete events subcollection (up to a hard cap to keep the request snappy)
            events_ref = self.documents_collection.document(document_id).collection("events")
            await self._purge_subcollection(events_ref, max_docs=2000)
            # Delete document entry and any analysis report. Ignore NotFound (already gone).
            try:
                await self.documents_collection.document(document_id).delete()
            except NotFound:
                pass
            try:
                await self.reports_collection.document(document_id).delete()
            except NotFound:
                pass
        except Exception as e:
            logger.error(f"Failed to delete document {document_id}: {e}")

    async def _purge_subcollection(self, coll_ref, max_docs: int = 2000, batch_size: int = 400):
        """Delete every document in a subcollection in chunked batches. Best-effort."""
        deleted = 0
        while deleted < max_docs:
            batch = self.db.batch()
            count = 0
            # `limit` keeps each pass bounded; we re-query each iteration so newly
            # added events (from a still-running agent) get cleaned up too.
            async for doc in coll_ref.limit(batch_size).stream():
                batch.delete(doc.reference)
                count += 1
            if count == 0:
                return
            try:
                await batch.commit()
            except NotFound:
                return
            deleted += count
            if count < batch_size:
                return

    # --- Bundle methods ---

    async def create_bundle_entry(self, bundle_id: str, data: Dict[str, Any]):
        if self.is_mock:
            return await self.mock.create_bundle_entry(bundle_id, data)
        try:
            await self.bundles_collection.document(bundle_id).set(data)
        except Exception as e:
            logger.error(f"Failed to create bundle {bundle_id}: {e}")
            raise LandGuardException(f"Failed to create bundle: {e}")

    async def get_bundle_entry(self, bundle_id: str) -> Optional[Dict[str, Any]]:
        if self.is_mock:
            return await self.mock.get_bundle_entry(bundle_id)
        try:
            doc = await self.bundles_collection.document(bundle_id).get()
            if doc.exists:
                d = doc.to_dict()
                d["id"] = doc.id
                return _convert_timestamps(d)
            return None
        except Exception as e:
            logger.error(f"Failed to get bundle {bundle_id}: {e}")
            raise LandGuardException(f"Failed to get bundle: {e}")

    async def update_bundle_entry(self, bundle_id: str, updates: Dict[str, Any]):
        if self.is_mock:
            return await self.mock.update_bundle_entry(bundle_id, updates)
        try:
            updates["updated_at"] = datetime.utcnow().isoformat() + "Z"
            await self.bundles_collection.document(bundle_id).update(updates)
        except Exception as e:
            logger.error(f"Failed to update bundle {bundle_id}: {e}")
            raise LandGuardException(f"Failed to update bundle: {e}")

    async def list_bundles_for_user(self, user_id: str) -> List[Dict[str, Any]]:
        if self.is_mock:
            return await self.mock.list_bundles_for_user(user_id)
        try:
            query = self.bundles_collection.where(filter=FieldFilter("user_id", "==", user_id))
            bundles = []
            async for doc in query.stream():
                d = doc.to_dict()
                d["id"] = doc.id
                bundles.append(_convert_timestamps(d))
            bundles.sort(key=lambda x: x.get("created_at", ""), reverse=True)
            return bundles
        except Exception as e:
            logger.error(f"Failed to list bundles for user {user_id}: {e}")
            raise LandGuardException(f"Failed to list bundles: {e}")

    async def delete_bundle_entry(self, bundle_id: str):
        if self.is_mock:
            return await self.mock.delete_bundle_entry(bundle_id)
        try:
            events_ref = self.bundles_collection.document(bundle_id).collection("events")
            await self._purge_subcollection(events_ref, max_docs=2000)
            try:
                await self.bundles_collection.document(bundle_id).delete()
            except NotFound:
                pass
            try:
                await self.bundle_reports_collection.document(bundle_id).delete()
            except NotFound:
                pass
        except Exception as e:
            logger.error(f"Failed to delete bundle {bundle_id}: {e}")

    async def save_bundle_report(self, bundle_id: str, report_data: Dict[str, Any]):
        if self.is_mock:
            return await self.mock.save_bundle_report(bundle_id, report_data)
        try:
            await self.bundle_reports_collection.document(bundle_id).set(report_data)
        except Exception as e:
            logger.error(f"Failed to save bundle report {bundle_id}: {e}")
            raise LandGuardException(f"Failed to save bundle report: {e}")

    async def get_bundle_report(self, bundle_id: str) -> Optional[Dict[str, Any]]:
        if self.is_mock:
            return await self.mock.get_bundle_report(bundle_id)
        try:
            doc = await self.bundle_reports_collection.document(bundle_id).get()
            if doc.exists:
                return _convert_timestamps(doc.to_dict())
            return None
        except Exception as e:
            logger.error(f"Failed to get bundle report {bundle_id}: {e}")
            raise LandGuardException(f"Failed to get bundle report: {e}")

    async def list_documents_for_bundle(self, bundle_id: str) -> List[Dict[str, Any]]:
        if self.is_mock:
            return await self.mock.list_documents_for_bundle(bundle_id)
        try:
            query = self.documents_collection.where(filter=FieldFilter("bundle_id", "==", bundle_id))
            docs = []
            async for doc in query.stream():
                d = doc.to_dict()
                d["id"] = doc.id
                docs.append(_convert_timestamps(d))
            return docs
        except Exception as e:
            logger.error(f"Failed to list documents for bundle {bundle_id}: {e}")
            return []

    async def add_bundle_event(self, bundle_id: str, event_data: Dict[str, Any]):
        if self.is_mock:
            return await self.mock.add_bundle_event(bundle_id, event_data)
        try:
            await self.bundles_collection.document(bundle_id).collection("events").add(event_data)
        except Exception as e:
            logger.error(f"Failed to add bundle event {bundle_id}: {e}")

    async def get_bundle_events_since(self, bundle_id: str, since_timestamp: Optional[str] = None) -> List[Dict[str, Any]]:
        if self.is_mock:
            return await self.mock.get_bundle_events_since(bundle_id, since_timestamp)
        try:
            events_ref = self.bundles_collection.document(bundle_id).collection("events")
            docs = []
            async for doc in events_ref.stream():
                d = doc.to_dict()
                docs.append(_convert_timestamps(d))
            docs.sort(key=lambda x: x.get("timestamp", ""))
            if since_timestamp:
                docs = [d for d in docs if d.get("timestamp", "") > since_timestamp]
            return docs
        except Exception as e:
            logger.error(f"Failed to get bundle events {bundle_id}: {e}")
            return []

firestore = FirestoreService()
