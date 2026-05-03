"use client";

import * as React from 'react';
import {
  Box, Typography, CircularProgress, Alert, Paper, Chip, LinearProgress,
  Button, Divider, Collapse, IconButton, Skeleton,
} from '@mui/material';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/firebase/auth';
import { useEffect, useState, useCallback, useRef } from 'react';
import { fetchDocumentDetails, fetchAnalysisReport } from '@/lib/api';
import { Document, AnalysisReport, DocumentStatus, LegalFinding, FraudFinding } from '@/lib/types';
import { EventSourcePolyfill } from 'event-source-polyfill';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DescriptionIcon from '@mui/icons-material/Description';
import SecurityIcon from '@mui/icons-material/Security';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import WarningIcon from '@mui/icons-material/Warning';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import PlaceIcon from '@mui/icons-material/Place';

// ── helpers ──────────────────────────────────────────────
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
  if (score >= 70) return { label: 'Needs Attention', color: 'error' as const };
  if (score >= 40) return { label: 'Worth Checking', color: 'warning' as const };
  return { label: 'Looks Good', color: 'success' as const };
};

/** Only return critical/high findings that the user should really know about */
function getKeyHighlights(report: AnalysisReport): { text: string; severity: string; type: 'legal' | 'fraud' }[] {
  const highlights: { text: string; severity: string; type: 'legal' | 'fraud' }[] = [];

  for (const f of report.fraud_findings) {
    if (f.is_suspicious && (f.severity === 'critical' || f.severity === 'high')) {
      highlights.push({ text: f.description, severity: f.severity, type: 'fraud' });
    }
  }
  for (const f of report.legal_findings) {
    if (!f.is_compliant && (f.severity === 'critical' || f.severity === 'high')) {
      highlights.push({ text: f.description, severity: f.severity, type: 'legal' });
    }
  }
  return highlights;
}

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

  const avgRisk = reports.length > 0
    ? Math.round(reports.reduce((s, r) => s + r.risk_score.overall_score, 0) / reports.length)
    : 0;

  // Collect all critical/high items across all docs
  const allHighlights: { text: string; severity: string; docName: string }[] = [];
  for (const s of Object.values(docStates)) {
    if (!s.report || !s.doc) continue;
    for (const h of getKeyHighlights(s.report)) {
      allHighlights.push({ ...h, docName: s.doc.file_name });
    }
  }

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
      </Box>

      <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: '#202124', mb: 0.5 }}>
        Review Summary
      </Typography>
      <Typography variant="body2" sx={{ color: '#5f6368', mb: 3 }}>
        {ids.length} document{ids.length > 1 ? 's' : ''} reviewed · Average score: {avgRisk}/100
      </Typography>

      {/* Progress (while analyzing) */}
      {!allDone && (
        <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: '12px', border: '1px solid #e8eaed' }}>
          <LinearProgress variant="determinate" value={overallProgress} sx={{ height: 4, borderRadius: 3, mb: 2 }} />
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {ids.map(id => {
              const s = docStates[id];
              if (!s) return <Skeleton key={id} variant="rounded" height={40} sx={{ borderRadius: '10px' }} animation="wave" />;
              return (
                <Box key={id} sx={{
                  display: 'flex', alignItems: 'center', gap: 2, p: 1.5, borderRadius: '10px',
                  bgcolor: s.done ? (s.failed ? '#fce8e6' : '#e6f4ea') : '#fafafa',
                }}>
                  <InsertDriveFileIcon sx={{ color: s.done ? (s.failed ? '#d93025' : '#1e8e3e') : '#1a73e8', fontSize: 18 }} />
                  <Typography variant="body2" fontWeight={500} noWrap sx={{ flex: 1, color: '#202124' }}>
                    {s.doc?.file_name || id}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#80868b' }}>{s.message}</Typography>
                  {!s.done && <LinearProgress variant="determinate" value={s.progress} sx={{ width: 80, height: 3, borderRadius: 2 }} />}
                  {s.done && !s.failed && <CheckCircleIcon sx={{ color: '#1e8e3e', fontSize: 18 }} />}
                  {s.done && s.failed && <CancelIcon sx={{ color: '#d93025', fontSize: 18 }} />}
                </Box>
              );
            })}
          </Box>
        </Paper>
      )}

      {/* Loading */}
      {loading && (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8, gap: 2 }}>
          <CircularProgress size={48} thickness={3} />
          <Typography variant="body2" sx={{ color: '#5f6368' }}>Loading documents...</Typography>
        </Box>
      )}

      {/* ── Results ── */}
      {reports.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>

          {/* Key Highlights — only critical/high items */}
          {allHighlights.length > 0 && (
            <Paper elevation={0} sx={{ p: 2.5, borderRadius: '12px', border: '1px solid #e8eaed', bgcolor: '#fffbe6' }}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: '#202124', mb: 1.5 }}>
                ⚠️ Key things to verify
              </Typography>
              {allHighlights.slice(0, 8).map((h, i) => (
                <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1.5, '&:last-child': { mb: 0 } }}>
                  <WarningIcon sx={{ fontSize: 16, color: getSeverityTextColor(h.severity), mt: 0.3, flexShrink: 0 }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ color: '#202124', fontSize: '0.85rem', lineHeight: 1.5 }}>
                      {h.text}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#80868b' }}>{h.docName}</Typography>
                  </Box>
                  <Chip label={h.severity} size="small" sx={{
                    fontWeight: 600, fontSize: '0.65rem', height: 20,
                    bgcolor: getSeverityBg(h.severity), color: getSeverityTextColor(h.severity), border: 'none', flexShrink: 0,
                  }} />
                </Box>
              ))}
              {allHighlights.length > 8 && (
                <Typography variant="caption" sx={{ color: '#80868b', mt: 1, display: 'block' }}>
                  +{allHighlights.length - 8} more — click individual documents below for details
                </Typography>
              )}
            </Paper>
          )}

          {allHighlights.length === 0 && (
            <Paper elevation={0} sx={{ p: 2.5, borderRadius: '12px', border: '1px solid #e8eaed', bgcolor: '#e6f4ea' }}>
              <Typography variant="body2" sx={{ color: '#1e8e3e', fontWeight: 500 }}>
                ✓ No critical issues found. Your documents look mostly in order — click each one below for the full review.
              </Typography>
            </Paper>
          )}

          {/* Per-document cards */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {Object.values(docStates).filter(s => s.report && s.doc).map(s => {
              const r = s.report!;
              const ri = getRiskLabel(r.risk_score.overall_score);
              const highlights = getKeyHighlights(r);
              const fraudCount = r.fraud_findings.filter(f => f.is_suspicious).length;
              const legalCount = r.legal_findings.filter(f => !f.is_compliant).length;

              return (
                <Paper
                  key={s.doc!.id}
                  elevation={0}
                  onClick={() => router.push(`/documents/${s.doc!.id}`)}
                  sx={{
                    p: 2.5, borderRadius: '12px', border: '1px solid #e8eaed',
                    cursor: 'pointer', transition: 'all 0.15s',
                    '&:hover': { borderColor: '#d2d5d9', bgcolor: '#fafafa' },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    {/* Icon */}
                    <Box sx={{
                      width: 44, height: 44, borderRadius: '12px', bgcolor: '#e8f0fe',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <DescriptionIcon sx={{ fontSize: 22, color: '#1a73e8' }} />
                    </Box>

                    {/* Name + meta */}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 600, color: '#202124', fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.doc!.file_name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#80868b' }}>
                        {legalCount + fraudCount} area{legalCount + fraudCount !== 1 ? 's' : ''} to verify
                      </Typography>
                    </Box>

                    {/* Score */}
                    <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                      <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: `${ri.color}.main`, lineHeight: 1 }}>
                        {r.risk_score.overall_score}
                      </Typography>
                      <Chip label={ri.label} color={ri.color} size="small" sx={{ fontWeight: 600, fontSize: '0.65rem', height: 20, mt: 0.5 }} />
                    </Box>
                  </Box>

                  {/* Inline highlights for this doc (max 2) */}
                  {highlights.length > 0 && (
                    <Box sx={{ mt: 1.5, pl: 7 }}>
                      {highlights.slice(0, 2).map((h, i) => (
                        <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <WarningIcon sx={{ fontSize: 13, color: getSeverityTextColor(h.severity) }} />
                          <Typography variant="caption" sx={{ color: '#5f6368', lineHeight: 1.4 }}>
                            {h.text.length > 100 ? h.text.slice(0, 100) + '...' : h.text}
                          </Typography>
                        </Box>
                      ))}
                      {highlights.length > 2 && (
                        <Typography variant="caption" sx={{ color: '#1a73e8', fontWeight: 500 }}>
                          +{highlights.length - 2} more — tap to view full report
                        </Typography>
                      )}
                    </Box>
                  )}
                </Paper>
              );
            })}
          </Box>

          {/* Disclaimer */}
          <Box sx={{ p: 2, borderRadius: '12px', bgcolor: '#f8f9fa', border: '1px solid #e8eaed' }}>
            <Typography variant="caption" sx={{ color: '#5f6368', lineHeight: 1.6 }}>
              ⚠️ <strong>Disclaimer:</strong> This is an AI-assisted review to highlight areas worth verifying. It is NOT a legal opinion. Your documents may be perfectly valid. Always consult a qualified property lawyer or visit your local sub-registrar office.
            </Typography>
          </Box>
        </Box>
      )}
    </Box>
  );
}
