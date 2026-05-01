import pytest
from unittest.mock import patch, AsyncMock
from app.models.document import DocumentStatus

@pytest.mark.asyncio
async def test_list_documents(client):
    # Mock return value for firestore.list_documents_for_user
    mock_docs = [
        {
            "id": "doc_1",
            "user_id": "test-user-123",
            "file_name": "test1.pdf",
            "gcs_path": "gs://bucket/test1.pdf",
            "content_type": "application/pdf",
            "status": "completed",
            "created_at": "2023-10-27T10:00:00Z",
            "updated_at": "2023-10-27T10:00:00Z",
        }
    ]
    
    with patch("app.api.v1.endpoints.documents.firestore.list_documents_for_user", new_callable=AsyncMock) as mock_list:
        mock_list.return_value = (mock_docs, 1)
        
        response = await client.get("/api/v1/documents/")
        
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert len(data["documents"]) == 1
        assert data["documents"][0]["id"] == "doc_1"
        assert data["documents"][0]["file_name"] == "test1.pdf"

@pytest.mark.asyncio
async def test_get_document_details_success(client):
    mock_doc = {
        "id": "doc_1",
        "user_id": "test-user-123",
        "file_name": "test1.pdf",
        "gcs_path": "gs://bucket/test1.pdf",
        "content_type": "application/pdf",
        "status": "completed",
        "created_at": "2023-10-27T10:00:00Z",
        "updated_at": "2023-10-27T10:00:00Z",
    }
    
    with patch("app.api.v1.endpoints.documents.firestore.get_document_entry", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_doc
        
        response = await client.get("/api/v1/documents/doc_1")
        
        assert response.status_code == 200
        assert response.json()["document"]["id"] == "doc_1"

@pytest.mark.asyncio
async def test_get_document_details_unauthorized(client):
    mock_doc = {
        "id": "doc_1",
        "user_id": "other-user", # Different from MOCK_USER.uid
        "file_name": "test1.pdf",
        "gcs_path": "gs://bucket/test1.pdf",
        "content_type": "application/pdf",
        "status": "completed",
        "created_at": "2023-10-27T10:00:00Z",
        "updated_at": "2023-10-27T10:00:00Z",
    }
    
    with patch("app.api.v1.endpoints.documents.firestore.get_document_entry", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_doc
        
        response = await client.get("/api/v1/documents/doc_1")
        
        assert response.status_code == 403
