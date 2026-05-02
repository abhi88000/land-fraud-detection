from app.agents.core.base import BaseAgent
from app.agents.parser.agent import DocumentParserAgent
from app.agents.legal.agent import LegalRulesAgent
from app.agents.fraud.agent import FraudDetectionAgent
from app.agents.report.agent import ReportGeneratorAgent, ReportInput
from app.models.document import DocumentStatus, Document
from app.services import firestore # Assuming Firestore for document state
from app.models.analysis import ExtractedData, LegalFinding, FraudFinding, AnalysisReport
import asyncio
import json
from datetime import datetime

class OrchestratorAgent(BaseAgent[str, AnalysisReport]):
    """
    The main orchestrator agent that coordinates the document analysis workflow.
    It delegates tasks to specialized sub-agents and manages overall progress.
    """
    def __init__(self):
        super().__init__("OrchestratorAgent")
        self.parser_agent = DocumentParserAgent()
        self.legal_agent = LegalRulesAgent()
        self.fraud_agent = FraudDetectionAgent()
        self.report_agent = ReportGeneratorAgent()

    async def run(self, document_id: str, state_override: str = "", district_override: str = "") -> AnalysisReport:
        """
        Starts the end-to-end analysis workflow for a given document.
        """
        return await self.start_analysis(document_id, state_override, district_override)

    async def start_analysis(self, document_id: str, state_override: str = "", district_override: str = "") -> AnalysisReport:
        """
        Initiates the document analysis workflow.
        Updates document status and triggers sub-agents.
        Uses cached OCR data if available to skip re-parsing.
        """
        await self._update_progress(document_id, "Analysis workflow started.", 5, "analysis_started")
        await firestore.update_document_status(document_id, DocumentStatus.IN_PROGRESS)

        try:
            # 1. Fetch document details
            document_entry = await firestore.get_document_entry(document_id)
            if not document_entry:
                raise ValueError(f"Document {document_id} not found in Firestore.")
            document = Document(**document_entry)

            # 2. Document Parsing (with OCR cache)
            cached_data = document_entry.get("cached_extracted_data")
            if cached_data:
                # Use cached OCR result — skip expensive Gemini call
                extracted_data = ExtractedData(**cached_data)
                await self._update_progress(document_id, "Using cached document data (previously parsed).", 25, "document_parsed_cached")
            else:
                extracted_data = await self.parser_agent.run(document.gcs_path, document_id)
                # Cache the extracted data for future re-analysis
                try:
                    await firestore.update_document_entry(document_id, {
                        "cached_extracted_data": json.loads(extracted_data.model_dump_json())
                    })
                except Exception as cache_err:
                    # Non-fatal: just log if caching fails
                    import logging
                    logging.getLogger(__name__).warning(f"Failed to cache extracted data for {document_id}: {cache_err}")

            # Override state/district from user input if available
            if state_override and extracted_data.property_details:
                extracted_data.property_details.state = state_override
            if district_override and extracted_data.property_details:
                extracted_data.property_details.district = district_override
            # Also use document-level state/district if not overridden
            if not state_override and document.state and extracted_data.property_details:
                if not extracted_data.property_details.state:
                    extracted_data.property_details.state = document.state
            if not district_override and document.district and extracted_data.property_details:
                if not extracted_data.property_details.district:
                    extracted_data.property_details.district = document.district

            # 3. Legal Rules Check and Fraud Detection (run in parallel)
            legal_findings, fraud_findings = await asyncio.gather(
                self.legal_agent.run(extracted_data, document_id),
                self.fraud_agent.run(extracted_data, document_id),
            )

            # 5. Report Generation
            report_input = ReportInput(
                document_id=document_id,
                extracted_data=extracted_data,
                legal_findings=legal_findings,
                fraud_findings=fraud_findings
            )
            analysis_report = await self.report_agent.run(report_input, document_id)

            # 6. Save final report and update document status to COMPLETED
            report_dict = json.loads(analysis_report.model_dump_json())
            await firestore.save_analysis_report(document_id, report_dict)
            await firestore.update_document_status(document_id, DocumentStatus.COMPLETED)
            await self._update_progress(document_id, "Analysis workflow completed successfully.", 100, "analysis_completed", data=report_dict)

            return analysis_report

        except Exception as e:
            await firestore.update_document_status(document_id, DocumentStatus.FAILED)
            await self._update_progress(document_id, f"Analysis workflow failed: {e}", 100, "analysis_failed")
            raise
