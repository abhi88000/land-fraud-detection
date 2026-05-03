from app.agents.core.base import BaseAgent
from app.agents.parser.agent import DocumentParserAgent
from app.agents.legal.agent import LegalRulesAgent
from app.agents.fraud.agent import FraudDetectionAgent
from app.agents.report.agent import ReportGeneratorAgent, ReportInput
from app.models.document import DocumentStatus, Document
from app.services import firestore # Assuming Firestore for document state
from app.services import cache as redis_cache
from app.services import bigquery as bq_service
from app.services import monitoring as metrics
from app.services import pubsub as pubsub_service
from app.services import embeddings as embedding_service
from app.models.analysis import ExtractedData, LegalFinding, FraudFinding, AnalysisReport
import asyncio
import json
import time
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

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
        Uses multi-layer cache: Redis → Firestore → fresh parse.
        Logs analytics to BigQuery and publishes events to Pub/Sub.
        """
        start_time = time.time()
        cache_hit = False

        await self._update_progress(document_id, "Analysis workflow started.", 5, "analysis_started")
        await firestore.update_document_status(document_id, DocumentStatus.IN_PROGRESS)

        try:
            # 1. Fetch document details
            document_entry = await firestore.get_document_entry(document_id)
            if not document_entry:
                raise ValueError(f"Document {document_id} not found in Firestore.")
            document = Document(**document_entry)

            # 2. Document Parsing (multi-layer cache: Redis → Firestore → fresh)
            extracted_data = None

            # Layer 1: Redis cache (fastest)
            redis_cached = await redis_cache.get_cached_ocr(document_id)
            if redis_cached:
                extracted_data = ExtractedData(**redis_cached)
                cache_hit = True
                metrics.record_cache_hit("redis_ocr")
                await self._update_progress(document_id, "Using cached data (Redis).", 25, "document_parsed_cached")
            else:
                # Layer 2: Firestore cache
                cached_data = document_entry.get("cached_extracted_data")
                if cached_data:
                    extracted_data = ExtractedData(**cached_data)
                    cache_hit = True
                    metrics.record_cache_hit("firestore_ocr")
                    # Warm Redis cache for next time
                    await redis_cache.set_cached_ocr(document_id, cached_data)
                    await self._update_progress(document_id, "Using cached data (Firestore).", 25, "document_parsed_cached")
                else:
                    metrics.record_cache_miss("ocr")

            if not extracted_data:
                # Layer 3: Fresh parse via Gemini
                extracted_data = await self.parser_agent.run(document.gcs_path, document_id)
                extracted_dict = json.loads(extracted_data.model_dump_json())
                # Cache in both layers
                try:
                    await asyncio.gather(
                        firestore.update_document_entry(document_id, {"cached_extracted_data": extracted_dict}),
                        redis_cache.set_cached_ocr(document_id, extracted_dict),
                    )
                except Exception as cache_err:
                    logger.warning(f"Failed to cache extracted data for {document_id}: {cache_err}")

            # Override state/district from user input if available (user-provided takes priority)
            if extracted_data.property_details:
                if state_override:
                    extracted_data.property_details.state = state_override
                elif document.state:
                    extracted_data.property_details.state = document.state
                if district_override:
                    extracted_data.property_details.district = district_override
                elif document.district:
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

            # 7. Post-analysis: analytics, embeddings, fraud alerts (non-blocking)
            duration_ms = int((time.time() - start_time) * 1000)
            metrics.record_analysis_latency(duration_ms, cached=cache_hit)

            state = extracted_data.property_details.state if extracted_data.property_details else ""
            district = extracted_data.property_details.district if extracted_data.property_details else ""

            # Fire-and-forget: BigQuery, embeddings, fraud alerts
            asyncio.create_task(self._post_analysis_tasks(
                document_id=document_id,
                user_id=document.user_id if hasattr(document, "user_id") else "",
                file_name=document.file_name if hasattr(document, "file_name") else "",
                state=state,
                district=district,
                extracted_data=extracted_data,
                fraud_findings=fraud_findings,
                legal_findings=legal_findings,
                risk_score=analysis_report.risk_score if hasattr(analysis_report, "risk_score") else 0.0,
                duration_ms=duration_ms,
                cache_hit=cache_hit,
            ))

            return analysis_report

        except Exception as e:
            await firestore.update_document_status(document_id, DocumentStatus.FAILED)
            await self._update_progress(document_id, f"Analysis workflow failed: {e}", 100, "analysis_failed")
            raise

    async def _post_analysis_tasks(
        self,
        document_id: str,
        user_id: str,
        file_name: str,
        state: str,
        district: str,
        extracted_data: ExtractedData,
        fraud_findings,
        legal_findings,
        risk_score: float,
        duration_ms: int,
        cache_hit: bool,
    ):
        """Non-blocking post-analysis: BigQuery logging, embeddings, Pub/Sub fraud alerts."""
        try:
            # Log to BigQuery
            await bq_service.log_analysis_event(
                document_id=document_id,
                user_id=user_id,
                file_name=file_name,
                state=state,
                district=district,
                risk_score=risk_score,
                document_type=extracted_data.document_type if extracted_data else "",
                fraud_count=len(fraud_findings) if fraud_findings else 0,
                legal_issues_count=len(legal_findings) if legal_findings else 0,
                analysis_duration_ms=duration_ms,
                cached=cache_hit,
            )

            # Log individual fraud patterns to BigQuery
            if fraud_findings:
                for finding in fraud_findings:
                    finding_dict = json.loads(finding.model_dump_json()) if hasattr(finding, "model_dump_json") else {}
                    if finding_dict.get("is_suspicious"):
                        metrics.record_fraud_detected(
                            finding_dict.get("severity", "low"),
                            finding_dict.get("fraud_type", "unknown"),
                        )
                        await bq_service.log_fraud_pattern(
                            document_id=document_id,
                            user_id=user_id,
                            fraud_type=finding_dict.get("fraud_type", ""),
                            severity=finding_dict.get("severity", "low"),
                            state=state,
                            district=district,
                            party_names=[p.get("name", "") for p in (extracted_data.party_names or [])],
                            property_survey_numbers=(extracted_data.property_details.survey_numbers if extracted_data.property_details else []) or [],
                            evidence=finding_dict.get("evidence", []),
                        )

                # Publish fraud alert if high risk
                if risk_score >= 60:
                    fraud_dicts = [json.loads(f.model_dump_json()) if hasattr(f, "model_dump_json") else {} for f in fraud_findings]
                    await pubsub_service.publish_fraud_alert(
                        document_id=document_id,
                        user_id=user_id,
                        risk_score=risk_score,
                        fraud_findings=fraud_dicts,
                    )

            # Generate and cache document embedding
            extracted_dict = json.loads(extracted_data.model_dump_json())
            await embedding_service.generate_embedding(document_id, extracted_dict)

        except Exception as e:
            logger.warning(f"Post-analysis tasks failed for {document_id}: {e}")
