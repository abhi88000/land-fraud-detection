from abc import ABC, abstractmethod
from typing import Generic, TypeVar, Any
from datetime import datetime
import asyncio

InputType = TypeVar("InputType")
OutputType = TypeVar("OutputType")

class BaseAgent(ABC, Generic[InputType, OutputType]):
    """
    Abstract base class for all LandGuard agents.
    Defines the common interface for agent execution and progress reporting.
    """
    def __init__(self, agent_name: str):
        self.agent_name = agent_name

    @abstractmethod
    async def run(self, input_data: InputType, document_id: str) -> OutputType:
        """
        Executes the agent's specific task.

        Args:
            input_data: The input data for the agent's task.
            document_id: The ID of the document being analyzed.

        Returns:
            The output of the agent's task.
        """
        pass

    async def _update_progress(self, document_id: str, message: str, progress: int, event_type: str, data: Any = None):
        """
        Helper method for agents to update document status in Firestore and send SSE events.
        """
        from app.services import firestore # Imported here to avoid circular dependencies
        from app.utils.sse import send_sse_message
        from app.models.document import DocumentStatus

        # Fire-and-forget — don't block the analysis pipeline
        async def _do_update():
            await firestore.update_document_status_and_progress(document_id, message, progress)
            event_log = {
                "agent": self.agent_name,
                "event_type": event_type,
                "message": message,
                "progress": progress,
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "data": data if data else {}
            }
            await firestore.add_document_event(document_id, event_log)
        asyncio.create_task(_do_update())

        # Send SSE message to connected clients
        await send_sse_message(document_id, event_type, message, progress, data=data)
