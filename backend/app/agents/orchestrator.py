from app.agents.core.base import BaseAgent
from app.agents.parser.agent import DocumentParserAgent
from app.agents.legal.agent import LegalRulesAgent
from app.agents.fraud.agent import FraudDetectionAgent
from app.agents.report.agent import ReportGeneratorAgent, ReportInput
from app.models.document import DocumentStatus, Document
from app.models.bundle import Bundle, BundleStatus
from app.services import firestore
from app.services import cache as redis_cache
from app.services import bigquery as bq_service
from app.services import monitoring as metrics
from app.services import pubsub as pubsub_service
from app.services import embeddings as embedding_service
from app.models.analysis import ExtractedData, LegalFinding, FraudFinding, AnalysisReport, DocumentSummary
import asyncio
import json
import time
import logging
import traceback
from datetime import datetime, timezone

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
                # Set land_type from document metadata
                if document.land_type:
                    extracted_data.property_details.land_type = document.land_type

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

    async def _update_bundle_progress(self, bundle_id: str, message: str, progress: int, event_type: str, data: dict = None):
        """Update progress for a bundle analysis via Firestore events."""
        event_data = {
            "event_type": event_type,
            "message": message,
            "progress": progress,
            "data": data or {},
            "timestamp": datetime.now(timezone.utc).isoformat() + "Z",
        }
        await firestore.add_bundle_event(bundle_id, event_data)

    async def analyze_bundle(self, bundle_id: str):
        """
        Analyze all documents in a bundle together.
        Parses each doc individually, combines context, runs legal/fraud once, generates combined report.
        """
        await self._update_bundle_progress(bundle_id, "Bundle analysis started.", 5, "analysis_started")
        await firestore.update_bundle_entry(bundle_id, {"status": BundleStatus.ANALYZING.value})

        try:
            # 1. Fetch bundle and its documents
            bundle_data = await firestore.get_bundle_entry(bundle_id)
            if not bundle_data:
                raise ValueError(f"Bundle {bundle_id} not found.")
            bundle = Bundle(**bundle_data)

            docs_data = await firestore.list_documents_for_bundle(bundle_id)
            if not docs_data:
                raise ValueError(f"No documents found in bundle {bundle_id}.")
            documents = [Document(**d) for d in docs_data]

            await self._update_bundle_progress(bundle_id, f"Parsing {len(documents)} documents...", 10, "parsing_started")

            # 2. Parse each document (parallel with caching)
            doc_summaries: list[DocumentSummary] = []
            all_extracted: list[ExtractedData] = []

            async def parse_one(doc: Document, idx: int):
                extracted = None
                # Check cache layers
                cached = await redis_cache.get_cached_ocr(doc.id)
                if cached:
                    extracted = ExtractedData(**cached)
                else:
                    doc_entry = await firestore.get_document_entry(doc.id)
                    if doc_entry and doc_entry.get("cached_extracted_data"):
                        extracted = ExtractedData(**doc_entry["cached_extracted_data"])
                        await redis_cache.set_cached_ocr(doc.id, doc_entry["cached_extracted_data"])

                if not extracted:
                    extracted = await self.parser_agent.run(doc.gcs_path, doc.id)
                    extracted_dict = json.loads(extracted.model_dump_json())
                    try:
                        await asyncio.gather(
                            firestore.update_document_entry(doc.id, {"cached_extracted_data": extracted_dict}),
                            redis_cache.set_cached_ocr(doc.id, extracted_dict),
                        )
                    except Exception:
                        pass

                # Override location from bundle
                if extracted.property_details:
                    extracted.property_details.state = bundle.state
                    extracted.property_details.district = bundle.district
                    extracted.property_details.land_type = bundle.land_type

                return DocumentSummary(
                    document_id=doc.id,
                    file_name=doc.file_name,
                    document_type=extracted.document_type,
                    extracted_data=extracted,
                ), extracted

            parse_tasks = [parse_one(doc, i) for i, doc in enumerate(documents)]
            results = await asyncio.gather(*parse_tasks, return_exceptions=True)

            for r in results:
                if isinstance(r, Exception):
                    logger.warning(f"Failed to parse a document in bundle {bundle_id}: {r}")
                    continue
                summary, extracted = r
                doc_summaries.append(summary)
                all_extracted.append(extracted)

            if not all_extracted:
                raise ValueError("Failed to parse any documents in the bundle.")

            await self._update_bundle_progress(bundle_id, f"Parsed {len(all_extracted)} documents. Running analysis...", 40, "parsing_completed")

            # 3. Combine extracted data into a single context for legal/fraud
            # Use the first doc's extracted data as base, merge parties and details
            combined = all_extracted[0].model_copy(deep=True)
            all_parties = list(combined.party_names)
            all_survey_numbers = list(combined.property_details.survey_numbers) if combined.property_details else []

            for ed in all_extracted[1:]:
                for p in ed.party_names:
                    if not any(ep.name == p.name and ep.role == p.role for ep in all_parties):
                        all_parties.append(p)
                if ed.property_details:
                    for sn in ed.property_details.survey_numbers:
                        if sn not in all_survey_numbers:
                            all_survey_numbers.append(sn)

            combined.party_names = all_parties
            if combined.property_details:
                combined.property_details.survey_numbers = all_survey_numbers
            # Add document types found as context
            doc_types_found = [s.document_type for s in doc_summaries if s.document_type]
            combined.document_type = ", ".join(doc_types_found) if doc_types_found else combined.document_type

            # 4. Run legal and fraud checks in parallel on combined data
            # Use bundle_id as the progress tracking ID
            legal_findings, fraud_findings = await asyncio.gather(
                self.legal_agent.run(combined, bundle_id),
                self.fraud_agent.run(combined, bundle_id),
            )

            await self._update_bundle_progress(bundle_id, "Generating report...", 75, "report_generation_started")

            # 5. Identify missing documents based on state/land_type
            missing_docs = self._identify_missing_documents(doc_types_found, bundle.state, bundle.land_type)

            # 6. Generate report
            report_input = ReportInput(
                document_id=bundle_id,
                extracted_data=combined,
                legal_findings=legal_findings,
                fraud_findings=fraud_findings,
            )
            report = await self.report_agent.run(report_input, bundle_id)

            # Attach bundle-specific fields
            report.documents_analyzed = doc_summaries
            report.missing_documents = missing_docs

            # 7. Save report and update status
            report_dict = json.loads(report.model_dump_json())
            await firestore.save_bundle_report(bundle_id, report_dict)
            await firestore.update_bundle_entry(bundle_id, {"status": BundleStatus.COMPLETED.value})

            # Mark all documents as completed
            for doc in documents:
                await firestore.update_document_status(doc.id, DocumentStatus.COMPLETED)

            await self._update_bundle_progress(bundle_id, "Analysis completed.", 100, "analysis_completed", data=report_dict)
            return report

        except Exception as e:
            logger.error(f"Bundle analysis failed for {bundle_id}: {e}\n{traceback.format_exc()}")
            await firestore.update_bundle_entry(bundle_id, {"status": BundleStatus.FAILED.value})
            await self._update_bundle_progress(bundle_id, f"Analysis failed: {e}", 100, "analysis_failed")
            raise

    def _identify_missing_documents(self, found_types: list[str], state: str, land_type: str) -> list[str]:
        """Identify documents the user should obtain based on what's in the bundle."""
        found_lower = [t.lower() for t in found_types if t]

        # Universal documents every land transaction should have
        essential = {
            "Sale Deed / Conveyance Deed": ["sale deed", "conveyance deed", "deed of sale"],
            "Encumbrance Certificate (EC)": ["encumbrance certificate", "ec"],
            "Property Tax Receipts": ["property tax", "tax receipt"],
            "Title Deed / Chain of Ownership": ["title deed", "title document", "chain of ownership"],
            "Mutation / Khata Transfer Record": ["mutation", "khata", "khata transfer", "mutation register"],
        }

        # Land-type specific
        if land_type and "agricultural" in land_type.lower():
            essential["7/12 Extract / RTC / Patta / Adangal"] = ["7/12", "rtc", "patta", "adangal", "pahani", "record of rights"]
            essential["Non-Agriculturist (NA) Conversion Order (if applicable)"] = ["na order", "conversion order", "non-agriculturist"]
            essential["Land Revenue / Khajana Receipt"] = ["khajana", "land revenue"]
        elif land_type and "commercial" in land_type.lower():
            essential["RERA Registration (if applicable)"] = ["rera"]
            essential["Occupancy Certificate (OC)"] = ["occupancy certificate", "oc"]
            essential["Building Plan Approval"] = ["building plan", "plan approval"]
        elif land_type and "residential" in land_type.lower():
            essential["Occupancy Certificate (OC)"] = ["occupancy certificate", "oc"]
            essential["Building Plan / Layout Approval"] = ["building plan", "layout approval", "plan approval"]
        elif land_type and "plantation" in land_type.lower():
            essential["Plantation Registration Certificate"] = ["plantation registration", "plantation certificate"]
            essential["Forest Clearance (if applicable)"] = ["forest clearance", "forest noc"]

        # State-specific additions
        state_lower = state.lower() if state else ""
        if "karnataka" in state_lower:
            essential["E-Khata Certificate"] = ["e-khata", "ekhata"]
        elif "maharashtra" in state_lower:
            essential["7/12 Extract & 8A Extract"] = ["7/12", "8a extract"]
        elif "tamil nadu" in state_lower:
            essential["Patta / Chitta"] = ["patta", "chitta"]
        elif any(s in state_lower for s in ["jharkhand", "jammu", "kashmir"]):
            essential["Roshni Act Status Check"] = ["roshni"]

        missing = []
        for doc_name, keywords in essential.items():
            if not any(kw in ft for ft in found_lower for kw in keywords):
                missing.append(doc_name)

        return missing
