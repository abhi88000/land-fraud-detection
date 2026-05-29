from app.agents.core.base import BaseAgent
from app.agents.parser.agent import DocumentParserAgent
from app.agents.legal.agent import LegalRulesAgent
from app.agents.fraud.agent import FraudDetectionAgent
from app.agents.news.agent import RegionalNewsAgent
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
        self.news_agent = RegionalNewsAgent()
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

            # 3. Legal Rules Check, Fraud Detection, and Regional News (run in parallel)
            legal_findings, fraud_findings, regional_news = await asyncio.gather(
                self.legal_agent.run(extracted_data, document_id),
                self.fraud_agent.run(extracted_data, document_id),
                self.news_agent.run(extracted_data, document_id),
            )

            # 5. Report Generation
            report_input = ReportInput(
                document_id=document_id,
                extracted_data=extracted_data,
                legal_findings=legal_findings,
                fraud_findings=fraud_findings
            )
            analysis_report = await self.report_agent.run(report_input, document_id)
            analysis_report.regional_news = regional_news

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
        """Update progress for a bundle analysis via Firestore events (fire-and-forget)."""
        event_data = {
            "event_type": event_type,
            "message": message,
            "progress": progress,
            "data": data or {},
            "timestamp": datetime.now(timezone.utc).isoformat() + "Z",
        }
        # Fire-and-forget — don't block analysis pipeline
        asyncio.create_task(firestore.add_bundle_event(bundle_id, event_data))

    async def _thought(self, bundle_id: str, agent: str, message: str, progress: int):
        """Emit a first-person 'agent thinking' event to the bundle stream."""
        await self._update_bundle_progress(
            bundle_id,
            message,
            progress,
            "agent_thought",
            data={"agent": agent},
        )

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

            await self._thought(
                bundle_id,
                "Orchestrator",
                f"Coordinating review of {len(documents)} document{'s' if len(documents) != 1 else ''} for {bundle.land_type or 'land'} in {bundle.district or 'this district'}, {bundle.state or 'India'}.",
                8,
            )
            await self._update_bundle_progress(bundle_id, f"Parsing {len(documents)} documents...", 10, "parsing_started")
            await self._thought(
                bundle_id,
                "Parser",
                f"Reading {len(documents)} file{'s' if len(documents) != 1 else ''} and extracting parties, survey numbers, dates and registration details.",
                12,
            )

            # 2. Parse each document (parallel with caching)
            doc_summaries: list[DocumentSummary] = []
            all_extracted: list[ExtractedData] = []

            async def parse_one(doc: Document, idx: int):
                extracted = None
                # Check Firestore cache (Redis likely disabled)
                try:
                    doc_entry = await firestore.get_document_entry(doc.id)
                    if doc_entry and doc_entry.get("cached_extracted_data"):
                        extracted = ExtractedData(**doc_entry["cached_extracted_data"])
                        await self._thought(
                            bundle_id,
                            "Parser",
                            f"Loaded '{doc.file_name}' from cache — already parsed earlier.",
                            15 + idx,
                        )
                except Exception:
                    pass

                if not extracted:
                    await self._thought(
                        bundle_id,
                        "Parser",
                        f"Reading '{doc.file_name}'...",
                        15 + idx,
                    )
                    extracted = await self.parser_agent.run(doc.gcs_path, doc.id)
                    # Cache in background — don't block
                    extracted_dict = json.loads(extracted.model_dump_json())
                    asyncio.create_task(
                        firestore.update_document_entry(doc.id, {"cached_extracted_data": extracted_dict})
                    )

                # Emit a finding-style thought summarising what was extracted
                try:
                    party_count = len(extracted.party_names) if extracted.party_names else 0
                    survey_count = (
                        len(extracted.property_details.survey_numbers)
                        if extracted.property_details and extracted.property_details.survey_numbers
                        else 0
                    )
                    summary_bits = []
                    if extracted.document_type:
                        summary_bits.append(f"identified as {extracted.document_type}")
                    if party_count:
                        summary_bits.append(f"{party_count} part{'ies' if party_count != 1 else 'y'}")
                    if survey_count:
                        summary_bits.append(f"{survey_count} survey number{'s' if survey_count != 1 else ''}")
                    if summary_bits:
                        await self._thought(
                            bundle_id,
                            "Parser",
                            f"'{doc.file_name}' — {', '.join(summary_bits)}.",
                            18 + idx,
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
            # Deduplicate while preserving order
            unique_doc_types = list(dict.fromkeys(doc_types_found))
            combined.document_type = ", ".join(unique_doc_types) if unique_doc_types else combined.document_type

            await self._thought(
                bundle_id,
                "Orchestrator",
                f"Combined view: {len(all_parties)} unique part{'ies' if len(all_parties) != 1 else 'y'}, {len(all_survey_numbers)} survey number{'s' if len(all_survey_numbers) != 1 else ''} across {len(all_extracted)} document{'s' if len(all_extracted) != 1 else ''}.",
                42,
            )
            await self._thought(
                bundle_id,
                "Legal",
                f"Cross-checking against {bundle.state or 'state'} land laws for {bundle.land_type or 'this'} property — stamp duty, registration, transfer rules.",
                45,
            )
            survey_hint = ", ".join(all_survey_numbers[:3]) if all_survey_numbers else "the property"
            await self._thought(
                bundle_id,
                "Fraud",
                f"Searching public records and news for indicators on {survey_hint}{'...' if all_survey_numbers else '.'}",
                48,
            )

            # 4. Run legal, fraud, and regional-news checks in parallel on combined data
            # Use bundle_id as the progress tracking ID
            legal_findings, fraud_findings, regional_news = await asyncio.gather(
                self.legal_agent.run(combined, bundle_id),
                self.fraud_agent.run(combined, bundle_id),
                self.news_agent.run(combined, bundle_id),
            )

            # Post-analysis summaries
            legal_issues = sum(1 for f in legal_findings if not f.is_compliant)
            fraud_issues = sum(1 for f in fraud_findings if f.is_suspicious)
            await self._thought(
                bundle_id,
                "Legal",
                f"Done. {legal_issues} potential compliance issue{'s' if legal_issues != 1 else ''} flagged for review." if legal_issues else "Done. No major compliance issues detected.",
                68,
            )
            await self._thought(
                bundle_id,
                "Fraud",
                f"Done. {fraud_issues} suspicious pattern{'s' if fraud_issues != 1 else ''} worth verifying." if fraud_issues else "Done. No suspicious patterns detected in available sources.",
                72,
            )

            await self._update_bundle_progress(bundle_id, "Generating report...", 75, "report_generation_started")
            await self._thought(
                bundle_id,
                "Reporter",
                "Composing your verdict, verification checklist, and missing-documents list.",
                78,
            )

            # 5. Identify missing documents based on state/land_type
            missing_docs = self._identify_missing_documents(doc_types_found, bundle.state, bundle.land_type)

            # 6. Generate report — feed missing_docs in so the score reflects
            # the fact that we couldn't verify supporting evidence.
            report_input = ReportInput(
                document_id=bundle_id,
                extracted_data=combined,
                legal_findings=legal_findings,
                fraud_findings=fraud_findings,
                missing_documents=missing_docs,
            )
            report = await self.report_agent.run(report_input, bundle_id)

            # Attach bundle-specific fields
            report.documents_analyzed = doc_summaries
            report.missing_documents = missing_docs
            report.regional_news = regional_news

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
        # Normalise found types: lowercase + strip + collapse separators so '7/12', '7-12',
        # '7 12', 'V.F. 7/12' all match the same canonical keyword.
        import re
        def _norm(s: str) -> str:
            s = (s or "").lower()
            s = re.sub(r"[\\/\-_.]+", " ", s)
            s = re.sub(r"\s+", " ", s).strip()
            return s
        found_lower = [_norm(t) for t in found_types if t]

        # Universal documents every land transaction should have
        essential = {
            "Sale Deed / Conveyance Deed": ["sale deed", "conveyance deed", "deed of sale"],
            "Encumbrance Certificate (EC)": ["encumbrance certificate", "ec"],
            "Property Tax Receipts": ["property tax", "tax receipt"],
            "Title Deed / Chain of Ownership": ["title deed", "title document", "chain of ownership"],
            "Mutation / Khata Transfer Record": ["mutation", "khata", "khata transfer", "mutation register"],
        }

        # Keyword aliases for 7/12-family records (used in agricultural land + Maharashtra).
        seven_twelve_aliases = [
            "7 12", "712", "satbara", "saatbaara", "saat baara",
            "property extract", "village form 7 12", "village form vii xii",
            "v f 7 12", "vf 7 12", "rtc", "patta", "adangal", "pahani",
            "record of rights", "ror",
        ]

        # Land-type specific
        if land_type and "agricultural" in land_type.lower():
            essential["7/12 Extract / RTC / Patta / Adangal"] = seven_twelve_aliases
            essential["Non-Agriculturist (NA) Conversion Order (if applicable)"] = ["na order", "conversion order", "non agriculturist"]
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
            essential["E-Khata Certificate"] = ["e khata", "ekhata"]
        elif "maharashtra" in state_lower:
            essential["7/12 Extract & 8A Extract"] = seven_twelve_aliases + ["8a extract", "8 a extract"]
        elif "tamil nadu" in state_lower:
            essential["Patta / Chitta"] = ["patta", "chitta"]
        elif any(s in state_lower for s in ["jharkhand", "jammu", "kashmir"]):
            essential["Roshni Act Status Check"] = ["roshni"]

        missing = []
        for doc_name, keywords in essential.items():
            norm_keywords = [_norm(k) for k in keywords]
            if not any(kw in ft for ft in found_lower for kw in norm_keywords):
                missing.append(doc_name)

        return missing
