"use client";

import * as React from 'react';
import { Box, Typography, CircularProgress, Alert, Paper, Chip, LinearProgress, Button, Divider } from '@mui/material';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/firebase/auth';
import { useEffect, useState, useCallback, useRef } from 'react';
import { fetchDocumentDetails, fetchAnalysisReport } from '@/lib/api';
import { Document, AnalysisReport, DocumentStatus, AnalysisProgressEvent } from '@/lib/types';
import ReportDisplay from '@/components/analysis/ReportDisplay';
import { EventSourcePolyfill } from 'event-source-polyfill';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DescriptionIcon from '@mui/icons-material/Description';
import LandshieldLogo from '@/components/ui/LandshieldLogo';

export default function DocumentAnalysisPage() {
  const { id } = useParams();
  const documentId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();

  const { user } = useAuth();
  const [document, setDocument] = useState<Document | null>(null);
  const [analysisReport, setAnalysisReport] = useState<AnalysisReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState<number>(0);
  const [analysisMessage, setAnalysisMessage] = useState<string>('Initializing analysis...');
  const [liveEvents, setLiveEvents] = useState<AnalysisProgressEvent[]>([]);

  const eventSourceRef = useRef<EventSourcePolyfill | null>(null);

  const startAnalysisStream = useCallback(async (token: string) => {
    if (!documentId) return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const sseUrl = `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/analysis/stream/${documentId}`;
    eventSourceRef.current = new EventSourcePolyfill(sseUrl, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    eventSourceRef.current.onmessage = (event: MessageEvent) => {
      const parsedData: AnalysisProgressEvent = JSON.parse(event.data);
      setLiveEvents(prev => [...prev, parsedData]);
      setAnalysisProgress(parsedData.progress);
      setAnalysisMessage(parsedData.message);

      if (parsedData.event_type === 'analysis_completed') {
        setAnalysisReport(parsedData.data.report as AnalysisReport);
        eventSourceRef.current?.close();
      } else if (parsedData.event_type === 'analysis_failed') {
        setError(parsedData.message);
        eventSourceRef.current?.close();
      }
    };

    eventSourceRef.current.onerror = () => {
      eventSourceRef.current?.close();
      // Fallback: try fetching report directly (stream may have dropped after completion)
      user?.getIdToken().then((t) => {
        fetchAnalysisReport(documentId!, t).then((res) => {
          if (res?.report) {
            setAnalysisReport(res.report);
            setAnalysisProgress(100);
            setAnalysisMessage('Analysis completed.');
          } else {
            setError('Failed to connect to analysis stream or stream ended unexpectedly.');
          }
        }).catch(() => {
          setError('Failed to connect to analysis stream or stream ended unexpectedly.');
        });
      }).catch(() => {
        setError('Failed to connect to analysis stream or stream ended unexpectedly.');
      });
    };

    eventSourceRef.current.onopen = () => {
      // connected
    };

  }, [documentId]);

  useEffect(() => {
    if (!user || !documentId) return;

    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = await user.getIdToken();
        const docDetails = await fetchDocumentDetails(documentId, token);
        setDocument(docDetails.document);

        if (docDetails.document.status === DocumentStatus.COMPLETED) {
          const report = await fetchAnalysisReport(documentId, token);
          setAnalysisReport(report.report);
          setAnalysisProgress(100);
          setAnalysisMessage('Analysis completed.');
        } else if (docDetails.document.status === DocumentStatus.FAILED) {
          setError('Analysis failed for this document.');
          setAnalysisProgress(100);
          setAnalysisMessage('Analysis failed.');
        } else {
          // Analysis is PENDING or IN_PROGRESS, start streaming
          startAnalysisStream(token);
        }
      } catch (err: any) {
        console.error('Error loading document or starting stream:', err);
        setError(err.message || 'Failed to load document details or start analysis.');
      } finally {
        setLoading(false);
      }
    };

    loadData();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [user, documentId, startAnalysisStream]);

  const getActiveStep = () => {
    if (analysisProgress >= 100) return 4;
    if (analysisProgress >= 75) return 3;
    if (analysisProgress >= 40) return 2;
    if (analysisProgress >= 15) return 1;
    return 0;
  };

  const analysisSteps = ['Parsing Document', 'Legal Check', 'Risk Review', 'Generating Report'];

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', gap: 2 }}>
        <Box sx={{ position: 'relative', display: 'inline-flex' }}>
          <Box
            sx={{
              position: 'absolute',
              inset: -14,
              borderRadius: '20px',
              background:
                'radial-gradient(closest-side, rgba(66,133,244,0.30), rgba(123,97,255,0.16) 60%, transparent 75%)',
              filter: 'blur(6px)',
              '@keyframes doc-halo': {
                '0%, 100%': { opacity: 0.4, transform: 'scale(1)' },
                '50%': { opacity: 0.8, transform: 'scale(1.1)' },
              },
              animation: 'doc-halo 2.2s ease-in-out infinite',
            }}
          />
          <Box
            sx={{
              position: 'relative',
              '@keyframes doc-breathe': {
                '0%, 100%': { transform: 'scale(1)' },
                '50%': { transform: 'scale(1.04)' },
              },
              animation: 'doc-breathe 2.2s ease-in-out infinite',
            }}
          >
            <LandshieldLogo size={44} showGlow />
          </Box>
        </Box>
        <Typography variant="body2" sx={{ color: '#5f6368', mt: 1, animation: 'pulse 2s ease-in-out infinite' }}>
          Loading document details…
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ mt: 4 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => router.push('/dashboard')} sx={{ mb: 2 }}>
          Back to Dashboard
        </Button>
        <Alert severity="error">
          <Typography>{error}</Typography>
        </Alert>
      </Box>
    );
  }

  if (!document) {
    return (
      <Box sx={{ mt: 4 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => router.push('/dashboard')} sx={{ mb: 2 }}>
          Back to Dashboard
        </Button>
        <Alert severity="warning">Document not found.</Alert>
      </Box>
    );
  }

  const isAnalyzing = !analysisReport && document.status !== DocumentStatus.COMPLETED && document.status !== DocumentStatus.FAILED;

  return (
    <Box sx={{ py: 3, px: { xs: 2, md: 4 }, maxWidth: 1180, width: '100%', mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 1.5 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push('/dashboard')}
          size="small"
          sx={{ color: '#5f6368', textTransform: 'none', fontWeight: 500, borderRadius: '100px' }}
        >
          Dashboard
        </Button>
        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
        <Box sx={{ width: 36, height: 36, borderRadius: '10px', bgcolor: '#e8f0fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <DescriptionIcon sx={{ color: '#1a73e8', fontSize: 20 }} />
        </Box>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 600, fontSize: '1rem', color: '#202124', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {document.file_name}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Typography variant="caption" sx={{ color: '#80868b' }}>
              {new Date(document.created_at).toLocaleString()}
            </Typography>
            {document.state && (
              <Chip label={document.state} size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: '#f1f3f4', color: '#5f6368' }} />
            )}
            {document.land_type && (
              <Chip label={document.land_type} size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: '#fff3e0', color: '#e65100' }} />
            )}
          </Box>
        </Box>
        <Chip
          label={
            document.status === DocumentStatus.COMPLETED ? 'Analyzed' :
            document.status === DocumentStatus.FAILED ? 'Failed' :
            document.status === DocumentStatus.IN_PROGRESS ? 'Analyzing...' : 'Pending'
          }
          size="small"
          sx={{
            fontWeight: 600, fontSize: '0.7rem', height: 24, borderRadius: '100px',
            bgcolor: document.status === DocumentStatus.COMPLETED ? '#e6f4ea' :
              document.status === DocumentStatus.FAILED ? '#fce8e6' : '#fef7e0',
            color: document.status === DocumentStatus.COMPLETED ? '#1e8e3e' :
              document.status === DocumentStatus.FAILED ? '#d93025' : '#e37400',
          }}
        />
      </Box>

      {/* Progress — shown during analysis */}
      {isAnalyzing && (
        <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: '16px', border: '1px solid #e8eaed' }}>
          {/* Step indicators */}
          <Box sx={{ display: 'flex', gap: 0.5, mb: 2 }}>
            {analysisSteps.map((label, i) => {
              const active = getActiveStep();
              const done = i < active;
              const current = i === active;
              return (
                <Box key={label} sx={{ flex: 1, textAlign: 'center' }}>
                  <Box sx={{
                    height: 4, borderRadius: 2, mb: 0.75,
                    bgcolor: done ? '#1e8e3e' : current ? '#1a73e8' : '#e8eaed',
                    transition: 'background-color 0.4s ease',
                  }} />
                  <Typography variant="caption" sx={{
                    fontSize: '0.65rem', fontWeight: current ? 700 : 400,
                    color: done ? '#1e8e3e' : current ? '#1a73e8' : '#80868b',
                  }}>
                    {label}
                  </Typography>
                </Box>
              );
            })}
          </Box>

          <Typography variant="body2" sx={{ color: '#3c4043', textAlign: 'center', fontWeight: 500 }}>
            {analysisMessage}
          </Typography>

          {/* Live events */}
          {liveEvents.length > 0 && (
            <Box sx={{ mt: 2, maxHeight: 160, overflowY: 'auto', p: 1.5, borderRadius: '10px', bgcolor: '#f8f9fa' }}>
              {liveEvents.slice(-6).map((event, index) => (
                <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, '&:last-child': { mb: 0 } }}>
                  <Box sx={{
                    width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                    bgcolor: event.event_type.includes('failed') ? '#d93025' : event.event_type.includes('completed') ? '#1e8e3e' : '#1a73e8',
                  }} />
                  <Typography variant="caption" sx={{ color: '#5f6368', fontSize: '0.75rem' }}>{event.message}</Typography>
                </Box>
              ))}
            </Box>
          )}
        </Paper>
      )}

      {/* Analysis Report */}
      {analysisReport && <ReportDisplay report={analysisReport} />}

      {!analysisReport && document.status === DocumentStatus.COMPLETED && (
        <Alert severity="warning" sx={{ borderRadius: '14px' }}>
          Analysis completed but the report could not be loaded.
        </Alert>
      )}

      {!analysisReport && document.status === DocumentStatus.FAILED && (
        <Alert severity="error" sx={{ borderRadius: '14px' }}>
          Analysis failed. Please try uploading the document again.
        </Alert>
      )}

      {!analysisReport && !isAnalyzing && document.status !== DocumentStatus.COMPLETED && document.status !== DocumentStatus.FAILED && (
        <Alert severity="info" sx={{ borderRadius: '14px' }}>
          Report will be available once analysis is complete.
        </Alert>
      )}
    </Box>
  );
}
