import pytest
from unittest.mock import MagicMock, patch

# PRE-IMPORT MOCKS to avoid crashes during 'from app.main import app'
mock_storage_client = MagicMock()
mock_firestore_client = MagicMock()

# Patching at the module level where they are used during initialization
patchers = [
    patch("google.cloud.storage.Client", return_value=mock_storage_client),
    patch("google.cloud.firestore.Client", return_value=mock_firestore_client),
    patch("firebase_admin.credentials.ApplicationDefault", return_value=MagicMock()),
    patch("firebase_admin.initialize_app", return_value=MagicMock()),
]

for p in patchers:
    p.start()

from typing import AsyncGenerator
from httpx import AsyncClient
from app.main import app
from app.core.security import get_current_user
from app.core.models import User

# Mock user for testing
MOCK_USER = User(uid="test-user-123", email="test@example.com")

async def mocked_get_current_user():
    return MOCK_USER

@pytest.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    # Override dependency to skip Firebase auth in tests
    app.dependency_overrides[get_current_user] = mocked_get_current_user
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac
    # Clear overrides after test
    app.dependency_overrides.clear()
