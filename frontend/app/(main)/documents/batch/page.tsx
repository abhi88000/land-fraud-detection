"use client";

import * as React from 'react';
import {
  Box, Typography, CircularProgress, Alert, Paper, Chip, LinearProgress,
  Stepper, Step, StepLabel, Button, Divider, Accordion, AccordionSummary,
  AccordionDetails, Collapse, IconButton, Skeleton,
} from '@mui/material';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/firebase/auth';
import { useEffect, useState, useCallback, useRef } from 'react';
import { fetchDocumentDetails, fetchAnalysisReport } from '@/lib/api';
import { Document, AnalysisReport, DocumentStatus, LegalFinding, FraudFinding, VerificationChecklistItem } from '@/lib/types';
import { EventSourcePolyfill } from 'event-source-polyfill';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DescriptionIcon from '@mui/icons-material/Description';
import SecurityIcon from '@mui/icons-material/Security';
import GavelIcon from '@mui/icons-material/Gavel';
import AssignmentIcon from '@mui/icons-material/Assignment';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import WarningIcon from '@mui/icons-material/Warning';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import SummarizeIcon from '@mui/icons-material/Summarize';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';

// ── helpers ──────────────────────────────────────────────
const getSeverityColor = (s: string) => {
  if (s === 'critical' || s === 'high') return 'error' as const;
  if (s === 'medium') return 'warning' as const;
  return 'info' as const;
};
const getSeverityBg = (s: string) => {
  if (s === 'critical' || s === 'high') return '#fce8e6';
  if (s === 'medium') return '#fef7e0';
  return '#e8f0fe';
};
const getSeverityTextColor = (s: string) => {
  if (s === 'critical' || s === 'high') return '#d93025';
  if (s === 'medium') return '#e37400';
  return '#1a73e8';
};
const getRiskLabel = (score: number) => {
  if (score >= 70) return { label: 'High Risk', color: 'error' as const };
  if (score >= 40) return { label: 'Medium Risk', color: 'warning' as const };
  return { label: 'Low Risk', color: 'success' as const };
};

// Category grouping for findings
const FRAUD_CATEGORIES: Record<string, string[]> = {
  'Pricing & Valuation': ['price', 'valuation', 'overpriced', 'undervalued', 'market value', 'circle rate', 'stamp duty', 'consideration'],
  'Identity & Ownership': ['benami', 'identity', 'impersonation', 'ownership', 'title', 'age', 'student', 'occupation'],
  'Document Authenticity': ['forged', 'fabricated', 'tampered', 'signature', 'registration', 'unregistered', 'stamp paper'],
  'Land Use & Restrictions': ['tribal', 'agricultural', 'conversion', 'scheduled tribe', 'government land', 'roshni', 'forest', 'ceiling'],
  'Legal Compliance': ['compliance', 'act', 'section', 'regulation', 'mandatory', 'required', 'violation'],
};

function categorizeFinding(description: string): string {
  const lower = description.toLowerCase();
  for (const [category, keywords] of Object.entries(FRAUD_CATEGORIES)) {
    if (keywords.some(kw => lower.includes(kw))) return category;
  }
  return 'Other Findings';
}

// ── Finding Row (reusable) ───────────────────────────────
const FindingRow: React.FC<{
  icon: React.ReactNode;
  title: string;
  severity: string;
  detail?: string;
  suggestion?: string;
  docName?: string;
}> = ({ icon, title, severity, detail, suggestion, docName }) => {
  const [open, setOpen] = useState(false);
  const hasDetail = detail || suggestion;
  return (
    <Box sx={{ borderBottom: '1px solid #f1f3f4', '&:last-child': { borderBottom: 0 } }}>
      <Box
        onClick={() => hasDetail && setOpen(!open)}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1.5, py: 1.5, px: 1,
          cursor: hasDetail ? 'pointer' : 'default',
          '&:hover': hasDetail ? { bgcolor: '#f8f9fa' } : {}, borderRadius: 1,
        }}
      >
        {icon}
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" sx={{ color: '#202124', fontWeight: 500, fontSize: '0.85rem' }}>
            {title}
          </Typography>
          {docName && (
            <Typography variant="caption" sx={{ color: '#80868b' }}>
              {docName}
            </Typography>
          )}
        </Box>
        <Chip
          label={severity}
          size="small"
          sx={{ fontWeight: 600, fontSize: '0.7rem', height: 22, bgcolor: getSeverityBg(severity), color: getSeverityTextColor(severity), border: 'none' }}
        />
        {hasDetail && (
          <IconButton size="small" sx={{ ml: 0.5, p: 0.25 }}>
            {open ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
          </IconButton>
        )}
      </Box>
      {hasDetail && (
        <Collapse in={open}>
          <Box sx={{ pl: 5, pr: 2, pb: 1.5 }}>
            {detail && <Typography variant="body2" sx={{ color: '#5f6368', fontSize: '0.8rem', lineHeight: 1.6 }}>{detail}</Typography>}
            {suggestion && <Typography variant="body2" sx={{ color: '#1a73e8', fontSize: '0.8rem', mt: 0.5 }}>{suggestion}</Typography>}
          </Box>
        </Collapse>
      )}
    </Box>
  );
};

// ── Doc progress card ────────────────────────────────────
interface DocState {
  doc: Document | null;
  report: AnalysisReport | null;
  progress: number;
  message: string;
  done: boolean;
  failed: boolean;
}

export default function BatchAnalysisPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const ids = (searchParams.get('ids') || '').split(',').filter(Boolean);

  const [docStates, setDocStates] = useState<Record<string, DocState>>({});
  const [loading, setLoading] = useState(true);
  const eventSourcesRef = useRef<Record<string, EventSourcePolyfill>>({});

  const updateDocState = useCallback((id: string, patch: Partial<DocState>) => {
    setDocStates(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }, []);

  // Load all documents and start streams
  useEffect(() => {
    if (!user || ids.length === 0) return;

    const init = async () => {
      const token = await user.getIdToken();
      const initial: Record<string, DocState> = {};

      // Fetch all doc details in parallel
      const results = await Promise.allSettled(
        ids.map(async (id) => {
          const { document } = await fetchDocumentDetails(id, token);
          return { id, document };
        })
      );

      for (const r of results) {
        if (r.status === 'fulfilled') {
          const { id, document } = r.value;
          initial[id] = { doc: document, report: null, progress: 0, message: 'Waiting...', done: false, failed: false };
        }
      }
      setDocStates(initial);
      setLoading(false);

      // For each doc, either fetch report or start SSE stream
      for (const id of ids) {
        const state = initial[id];
        if (!state?.doc) continue;

        if (state.doc.status === DocumentStatus.COMPLETED) {
          try {
            const { report } = await fetchAnalysisReport(id, token);
            updateDocState(id, { report, progress: 100, message: 'Completed', done: true });
          } catch { updateDocState(id, { progress: 100, message: 'Report load failed', done: true, failed: true }); }
        } else if (state.doc.status === DocumentStatus.FAILED) {
          updateDocState(id, { progress: 100, message: 'Failed', done: true, failed: true });
        } else {
          // Start SSE stream
          const sseUrl = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/analysis/stream/${id}`;
          const es = new EventSourcePolyfill(sseUrl, { headers: { Authorization: `Bearer ${token}` } });
          eventSourcesRef.current[id] = es;

          es.onmessage = (event: MessageEvent) => {
            const parsed = JSON.parse(event.data);
            updateDocState(id, { progress: parsed.progress, message: parsed.message });
            if (parsed.event_type === 'analysis_completed') {
              updateDocState(id, { report: parsed.data.report, progress: 100, message: 'Completed', done: true });
              es.close();
            } else if (parsed.event_type === 'analysis_failed') {
              updateDocState(id, { progress: 100, message: parsed.message, done: true, failed: true });
              es.close();
            }
          };
          es.onerror = () => {
            es.close();
            // Fallback: try fetching report
            user.getIdToken().then(t =>
              fetchAnalysisReport(id, t).then(res => {
                if (res?.report) updateDocState(id, { report: res.report, progress: 100, message: 'Completed', done: true });
                else updateDocState(id, { progress: 100, message: 'Stream ended', done: true, failed: true });
              }).catch(() => updateDocState(id, { progress: 100, message: 'Stream error', done: true, failed: true }))
            );
          };
        }
      }
    };
    init();

    return () => {
      Object.values(eventSourcesRef.current).forEach(es => es.close());
    };
  }, [user]);

  // ── Aggregate data ──────────────────────────────────────
  const allDone = Object.values(docStates).every(s => s.done);
  const reports = Object.values(docStates).filter(s => s.report).map(s => s.report!);
  const overallProgress = ids.length > 0
    ? Math.round(Object.values(docStates).reduce((sum, s) => sum + s.progress, 0) / ids.length)
    : 0;

  // Combined risk score
  const avgRisk = reports.length > 0
    ? Math.round(reports.reduce((s, r) => s + r.risk_score.overall_score, 0) / reports.length)
    : 0;
  const maxRisk = reports.length > 0
    ? Math.max(...reports.map(r => r.risk_score.overall_score))
    : 0;

  // Aggregate findings by category
  const allLegalFindings: { finding: LegalFinding; docName: string }[] = [];
  const allFraudFindings: { finding: FraudFinding; docName: string }[] = [];
  const allChecklist: { item: VerificationChecklistItem; docName: string }[] = [];

  for (const s of Object.values(docStates)) {
    if (!s.report || !s.doc) continue;
    const name = s.doc.file_name;
    for (const f of s.report.legal_findings) allLegalFindings.push({ finding: f, docName: name });
    for (const f of s.report.fraud_findings) allFraudFindings.push({ finding: f, docName: name });
    for (const c of s.report.verification_checklist) allChecklist.push({ item: c, docName: name });
  }

  // Group fraud findings by category
  const fraudByCategory: Record<string, { finding: FraudFinding; docName: string }[]> = {};
  for (const f of allFraudFindings) {
    const cat = categorizeFinding(f.finding.description);
    if (!fraudByCategory[cat]) fraudByCategory[cat] = [];
    fraudByCategory[cat].push(f);
  }

  // Group legal findings by category
  const legalByCategory: Record<string, { finding: LegalFinding; docName: string }[]> = {};
  for (const f of allLegalFindings) {
    const cat = categorizeFinding(f.finding.description);
    if (!legalByCategory[cat]) legalByCategory[cat] = [];
    legalByCategory[cat].push(f);
  }

  // Combined category scores
  const combinedCategoryScores: Record<string, number> = {};
  for (const r of reports) {
    if (r.risk_score.category_scores) {
      for (const [cat, score] of Object.entries(r.risk_score.category_scores)) {
        combinedCategoryScores[cat] = Math.max(combinedCategoryScores[cat] || 0, score);
      }
    }
  }

  const riskInfo = getRiskLabel(maxRisk);

  if (ids.length === 0) {
    return (
      <Box sx={{ py: 4 }}>
        <Alert severity="warning">No documents selected for analysis.</Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => router.push('/dashboard')} sx={{ mt: 2 }}>Back to Dashboard</Button>
      </Box>
    );
  }

  return (
    <Box sx={{ py: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 1.5 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push('/dashboard')}
          size="small"
          sx={{ color: '#5f6368', textTransform: 'none', fontWeight: 500 }}
        >
          Dashboard
        </Button>
        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
        <SummarizeIcon sx={{ color: '#4285f4', fontSize: 22 }} />
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h6" fontWeight={600} sx={{ color: '#202124' }}>
            Batch Analysis — {ids.length} Documents
          </Typography>
          <Typography variant="caption" sx={{ color: '#80868b' }}>
            Collective fraud analysis report
          </Typography>
        </Box>
        {allDone && (
          <Chip
            label={reports.length === ids.length ? 'All Analyzed' : `${reports.length}/${ids.length} Analyzed`}
            size="small"
            color={reports.length === ids.length ? 'success' : 'warning'}
            sx={{ fontWeight: 500 }}
          />
        )}
      </Box>

      {/* Per-document progress cards */}
      {!allDone && (
        <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 2, border: '1px solid #e0e0e0' }}>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 2, color: '#202124' }}>
            Analysis Progress
          </Typography>
          <LinearProgress
            variant="determinate"
            value={overallProgress}
            sx={{ height: 6, borderRadius: 3, mb: 2 }}
          />
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {ids.map(id => {
              const s = docStates[id];
              if (!s) return (
                <Skeleton key={id} variant="rectangular" height={48} sx={{ borderRadius: 1 }} animation="wave" />
              );
              return (
                <Box key={id} sx={{
                  display: 'flex', alignItems: 'center', gap: 2, p: 1.5,
                  borderRadius: 1, bgcolor: s.done ? (s.failed ? '#fce8e6' : '#e6f4ea') : '#f8f9fa',
                  border: '1px solid', borderColor: s.done ? (s.failed ? '#f5c6cb' : '#b7e1cd') : '#e0e0e0',
                  transition: 'all 0.3s ease',
                }}>
                  <InsertDriveFileIcon sx={{ color: s.done ? (s.failed ? '#d93025' : '#1e8e3e') : '#4285f4', fontSize: 20 }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={500} noWrap sx={{ color: '#202124' }}>
                      {s.doc?.file_name || id}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#80868b' }}>
                      {s.message}
                    </Typography>
                  </Box>
                  {!s.done && (
                    <Box sx={{ width: 100 }}>
                      <LinearProgress variant="determinate" value={s.progress} sx={{ height: 4, borderRadius: 2 }} />
                    </Box>
                  )}
                  {s.done && !s.failed && <CheckCircleIcon sx={{ color: '#1e8e3e', fontSize: 20 }} />}
                  {s.done && s.failed && <CancelIcon sx={{ color: '#d93025', fontSize: 20 }} />}
                </Box>
              );
            })}
          </Box>
        </Paper>
      )}

      {/* Loading state */}
      {loading && (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8, gap: 2 }}>
          <Box sx={{ position: 'relative', display: 'inline-flex' }}>
            <CircularProgress size={64} thickness={3} />
            <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <SecurityIcon sx={{ color: '#4285f4', fontSize: 28 }} />
            </Box>
          </Box>
          <Typography variant="body1" sx={{ color: '#5f6368' }}>Loading documents...</Typography>
        </Box>
      )}

      {/* ── Combined Report (shows once at least one report is ready) ── */}
      {reports.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, animation: 'fadeSlideUp 0.5s ease' }}>

          {/* Combined Risk Score */}
          <Paper elevation={0} sx={{ p: 3, borderRadius: 2, border: '1px solid #e0e0e0' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <Box sx={{ textAlign: 'center', minWidth: 100 }}>
                <Typography variant="caption" sx={{ color: '#80868b', fontWeight: 500 }}>HIGHEST RISK</Typography>
                <Typography variant="h2" fontWeight={700} color={`${riskInfo.color}.main`} lineHeight={1}>
                  {maxRisk}
                </Typography>
                <Typography variant="caption" sx={{ color: '#80868b' }}>/100</Typography>
                <Box sx={{ mt: 0.5 }}>
                  <Chip label={riskInfo.label} color={riskInfo.color} size="small" sx={{ fontWeight: 600 }} />
                </Box>
              </Box>

              <Divider orientation="vertical" flexItem />

              <Box sx={{ flex: 1 }}>
                <Box sx={{ display: 'flex', gap: 3, mb: 2, flexWrap: 'wrap' }}>
                  <Box>
                    <Typography variant="caption" sx={{ color: '#80868b' }}>Documents</Typography>
                    <Typography variant="h6" fontWeight={600} sx={{ color: '#202124' }}>{ids.length}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: '#80868b' }}>Avg Risk</Typography>
                    <Typography variant="h6" fontWeight={600} sx={{ color: '#202124' }}>{avgRisk}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: '#80868b' }}>Issues Found</Typography>
                    <Typography variant="h6" fontWeight={600} sx={{ color: '#d93025' }}>
                      {allLegalFindings.filter(f => !f.finding.is_compliant).length + allFraudFindings.filter(f => f.finding.is_suspicious).length}
                    </Typography>
                  </Box>
                </Box>

                {/* Category bars */}
                {Object.keys(combinedCategoryScores).length > 0 && (
                  <Box>
                    {Object.entries(combinedCategoryScores).map(([cat, score]) => (
                      <Box key={cat} sx={{ mb: 0.75 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
                          <Typography variant="caption" sx={{ textTransform: 'capitalize', color: '#5f6368' }}>
                            {cat.replace(/_/g, ' ')}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#5f6368', fontWeight: 500 }}>{score}</Typography>
                        </Box>
                        <LinearProgress variant="determinate" value={score} color={getRiskLabel(score).color} sx={{ height: 5, borderRadius: 3 }} />
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>
            </Box>
          </Paper>

          {/* Per-document risk cards */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: `repeat(${Math.min(ids.length, 3)}, 1fr)` }, gap: 2 }}>
            {Object.values(docStates).filter(s => s.report && s.doc).map(s => {
              const r = s.report!;
              const ri = getRiskLabel(r.risk_score.overall_score);
              return (
                <Paper key={s.doc!.id} elevation={0} sx={{
                  p: 2, borderRadius: 2, border: '1px solid #e0e0e0',
                  cursor: 'pointer', transition: 'all 0.2s',
                  '&:hover': { borderColor: '#4285f4', boxShadow: '0 2px 12px rgba(66,133,244,0.15)' },
                }}
                  onClick={() => router.push(`/documents/${s.doc!.id}`)}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <DescriptionIcon sx={{ fontSize: 18, color: '#4285f4' }} />
                    <Typography variant="body2" fontWeight={500} noWrap sx={{ flex: 1, color: '#202124' }}>
                      {s.doc!.file_name}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="h4" fontWeight={700} color={`${ri.color}.main`}>{r.risk_score.overall_score}</Typography>
                    <Chip label={ri.label} color={ri.color} size="small" sx={{ fontWeight: 600, fontSize: '0.7rem' }} />
                  </Box>
                  <Typography variant="caption" sx={{ color: '#80868b' }}>
                    {r.legal_findings.filter(f => !f.is_compliant).length} legal issues · {r.fraud_findings.filter(f => f.is_suspicious).length} fraud flags
                  </Typography>
                </Paper>
              );
            })}
          </Box>

          {/* Combined Summary */}
          {reports.length > 0 && (
            <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, border: '1px solid #e0e0e0', bgcolor: '#f8f9fa' }}>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1, color: '#202124' }}>
                Combined Summary
              </Typography>
              {reports.map((r, i) => (
                <Typography key={i} variant="body2" sx={{ color: '#3c4043', lineHeight: 1.7, mb: 1 }}>
                  {r.summary}
                </Typography>
              ))}
            </Paper>
          )}

          {/* Fraud Findings by Category */}
          <Accordion
            defaultExpanded
            disableGutters elevation={0}
            sx={{ border: '1px solid #e0e0e0', borderRadius: '8px !important', '&:before': { display: 'none' } }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2 }}>
              <SecurityIcon sx={{ mr: 1.5, color: '#d93025', fontSize: 20 }} />
              <Typography variant="body1" fontWeight={600}>Fraud Indicators</Typography>
              <Chip label={allFraudFindings.length} size="small" sx={{ ml: 1, height: 20, fontSize: '0.7rem', bgcolor: '#fce8e6', color: '#d93025' }} />
            </AccordionSummary>
            <AccordionDetails sx={{ px: 2, pt: 0, pb: 1 }}>
              {Object.keys(fraudByCategory).length === 0 ? (
                <Typography variant="body2" sx={{ color: '#80868b' }}>No fraud indicators found.</Typography>
              ) : (
                Object.entries(fraudByCategory).map(([category, findings]) => (
                  <Box key={category} sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, mt: 1 }}>
                      <Typography variant="caption" fontWeight={600} sx={{ color: '#5f6368', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {category}
                      </Typography>
                      <Chip label={findings.length} size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#f1f3f4' }} />
                    </Box>
                    {findings.map((f, i) => (
                      <FindingRow
                        key={i}
                        icon={f.finding.is_suspicious
                          ? <WarningIcon sx={{ fontSize: 18, color: '#e37400' }} />
                          : <CheckCircleIcon sx={{ fontSize: 18, color: '#1e8e3e' }} />
                        }
                        title={f.finding.description}
                        severity={f.finding.severity}
                        detail={f.finding.evidence?.length > 0 ? f.finding.evidence.join('; ') : undefined}
                        suggestion={f.finding.recommendation || undefined}
                        docName={ids.length > 1 ? f.docName : undefined}
                      />
                    ))}
                  </Box>
                ))
              )}
            </AccordionDetails>
          </Accordion>

          {/* Legal Findings by Category */}
          <Accordion
            defaultExpanded={allLegalFindings.some(f => !f.finding.is_compliant)}
            disableGutters elevation={0}
            sx={{ border: '1px solid #e0e0e0', borderRadius: '8px !important', '&:before': { display: 'none' } }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2 }}>
              <GavelIcon sx={{ mr: 1.5, color: '#1a73e8', fontSize: 20 }} />
              <Typography variant="body1" fontWeight={600}>Legal Findings</Typography>
              <Chip label={allLegalFindings.length} size="small" sx={{ ml: 1, height: 20, fontSize: '0.7rem', bgcolor: '#e8f0fe', color: '#1a73e8' }} />
            </AccordionSummary>
            <AccordionDetails sx={{ px: 2, pt: 0, pb: 1 }}>
              {Object.keys(legalByCategory).length === 0 ? (
                <Typography variant="body2" sx={{ color: '#80868b' }}>No legal findings.</Typography>
              ) : (
                Object.entries(legalByCategory).map(([category, findings]) => (
                  <Box key={category} sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, mt: 1 }}>
                      <Typography variant="caption" fontWeight={600} sx={{ color: '#5f6368', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {category}
                      </Typography>
                      <Chip label={findings.length} size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#f1f3f4' }} />
                    </Box>
                    {findings.map((f, i) => (
                      <FindingRow
                        key={i}
                        icon={f.finding.is_compliant
                          ? <CheckCircleIcon sx={{ fontSize: 18, color: '#1e8e3e' }} />
                          : <CancelIcon sx={{ fontSize: 18, color: '#d93025' }} />
                        }
                        title={f.finding.description}
                        severity={f.finding.severity}
                        detail={f.finding.explanation}
                        suggestion={f.finding.remediation_suggestion || undefined}
                        docName={ids.length > 1 ? f.docName : undefined}
                      />
                    ))}
                  </Box>
                ))
              )}
            </AccordionDetails>
          </Accordion>

          {/* Verification Checklist */}
          <Accordion
            disableGutters elevation={0}
            sx={{ border: '1px solid #e0e0e0', borderRadius: '8px !important', '&:before': { display: 'none' } }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2 }}>
              <AssignmentIcon sx={{ mr: 1.5, color: '#1e8e3e', fontSize: 20 }} />
              <Typography variant="body1" fontWeight={600}>Verification Checklist</Typography>
              <Chip label={allChecklist.length} size="small" sx={{ ml: 1, height: 20, fontSize: '0.7rem', bgcolor: '#e6f4ea', color: '#1e8e3e' }} />
            </AccordionSummary>
            <AccordionDetails sx={{ px: 2, pt: 0, pb: 1 }}>
              {allChecklist.length === 0 ? (
                <Typography variant="body2" sx={{ color: '#80868b' }}>No checklist items.</Typography>
              ) : (
                allChecklist.map((c, i) => (
                  <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1, borderBottom: '1px solid #f1f3f4', '&:last-child': { borderBottom: 0 } }}>
                    {c.item.is_checked
                      ? <CheckCircleIcon sx={{ fontSize: 18, color: '#1e8e3e' }} />
                      : <CancelIcon sx={{ fontSize: 18, color: '#dadce0' }} />
                    }
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" sx={{ color: '#202124', fontWeight: 500, fontSize: '0.85rem' }}>{c.item.item}</Typography>
                      {c.item.details && <Typography variant="caption" sx={{ color: '#80868b' }}>{c.item.details}</Typography>}
                    </Box>
                    {ids.length > 1 && (
                      <Typography variant="caption" sx={{ color: '#80868b' }}>{c.docName}</Typography>
                    )}
                  </Box>
                ))
              )}
            </AccordionDetails>
          </Accordion>
        </Box>
      )}
    </Box>
  );
}
