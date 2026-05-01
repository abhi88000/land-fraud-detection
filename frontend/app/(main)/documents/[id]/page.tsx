"use client";

import * as React from 'react';
import { Box, Typography, CircularProgress, Alert, Grid, Paper, Chip, LinearProgress, Stepper, Step, StepLabel, Button, Divider } from '@mui/material';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/firebase/auth';
import { useEffect, useState, useCallback, useRef } from 'react';
import { fetchDocumentDetails, fetchAnalysisReport } from '@/lib/api';
import { Document, AnalysisReport, DocumentStatus, AnalysisProgressEvent, LegalFinding, FraudFinding } from '@/lib/types';
import DocumentViewer from '@/components/analysis/DocumentViewer';
import ReportDisplay from '@/components/analysis/ReportDisplay';
import { EventSourcePolyfill } from 'event-source-polyfill';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DescriptionIcon from '@mui/icons-material/Description';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';

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
      console.log('SSE Message:', parsedData);
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

    eventSourceRef.current.onerror = (err) => {
      console.error('EventSource failed:', err);
      eventSourceRef.current?.close();
      setError('Failed to connect to analysis stream or stream ended unexpectedly.');
    };

    eventSourceRef.current.onopen = () => {
      console.log('EventSource connected.');
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

  const analysisSteps = ['Parsing Document', 'Legal Check', 'Fraud Detection', 'Generating Report'];

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', gap: 2 }}>
        <CircularProgress size={48} />
        <Typography variant="body1" color="text.secondary">Loading document details...</Typography>
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
    <Box sx={{ py: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 2 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => router.push('/dashboard')} size="small">
          Back
        </Button>
        <DescriptionIcon color="primary" />
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h5" component="h1" fontWeight="bold">
            {document.file_name}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 0.5 }}>
            <Chip
              label={document.status.toUpperCase().replace('_', ' ')}
              size="small"
              color={
                document.status === DocumentStatus.COMPLETED ? 'success' :
                document.status === DocumentStatus.FAILED ? 'error' : 'warning'
              }
              icon={
                document.status === DocumentStatus.COMPLETED ? <CheckCircleIcon /> :
                document.status === DocumentStatus.FAILED ? <ErrorIcon /> : undefined
              }
            />
            <Typography variant="caption" color="text.secondary">
              Uploaded {new Date(document.created_at).toLocaleString()}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Progress Stepper - shown during analysis */}
      {isAnalyzing && (
        <Paper sx={{ p: 3, mb: 3, borderRadius: 2 }}>
          <Stepper activeStep={getActiveStep()} alternativeLabel>
            {analysisSteps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
          <Box sx={{ mt: 2 }}>
            <LinearProgress
              variant="determinate"
              value={analysisProgress}
              sx={{ height: 8, borderRadius: 4 }}
            />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
              {analysisMessage} ({analysisProgress}%)
            </Typography>
          </Box>
        </Paper>
      )}

      <Grid container spacing={3}>
        {/* Left: Document Viewer */}
        <Grid item xs={12} md={analysisReport ? 5 : 7}>
          <Paper sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 2 }}>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              Document Preview
            </Typography>
            <Divider sx={{ mb: 2 }} />
            {document.gcs_path ? (
              <Box sx={{ flexGrow: 1, minHeight: 400, border: '1px solid #e0e0e0', borderRadius: 1, overflow: 'hidden' }}>
                <DocumentViewer gcsPath={document.gcs_path} />
              </Box>
            ) : (
              <Alert severity="info">Document preview not available.</Alert>
            )}
          </Paper>
        </Grid>

        {/* Right: Analysis Results or Progress */}
        <Grid item xs={12} md={analysisReport ? 7 : 5}>
          {/* Live Events during analysis */}
          {isAnalyzing && (
            <Paper sx={{ p: 2, mb: 2, borderRadius: 2 }}>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                Live Progress
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ maxHeight: 300, overflowY: 'auto' }}>
                {liveEvents.length === 0 && (
                  <Typography variant="body2" color="text.secondary">Waiting for analysis events...</Typography>
                )}
                {liveEvents.map((event, index) => (
                  <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Chip
                      label={event.event_type.replace(/_/g, ' ')}
                      size="small"
                      color={event.event_type.includes('failed') ? 'error' : event.event_type.includes('completed') ? 'success' : 'info'}
                      variant="outlined"
                      sx={{ minWidth: 120 }}
                    />
                    <Typography variant="body2" color="text.secondary">{event.message}</Typography>
                  </Box>
                ))}
              </Box>
            </Paper>
          )}

          {/* Analysis Report */}
          {analysisReport && (
            <Paper sx={{ p: 2, borderRadius: 2 }}>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                Analysis Report
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <ReportDisplay report={analysisReport} />
            </Paper>
          )}

          {!analysisReport && document.status === DocumentStatus.COMPLETED && (
            <Alert severity="warning" sx={{ borderRadius: 2 }}>
              Analysis completed but the report could not be loaded.
            </Alert>
          )}

          {!analysisReport && document.status === DocumentStatus.FAILED && (
            <Alert severity="error" sx={{ borderRadius: 2 }}>
              Analysis failed. Please try uploading the document again.
            </Alert>
          )}

          {!analysisReport && !isAnalyzing && document.status !== DocumentStatus.COMPLETED && document.status !== DocumentStatus.FAILED && (
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              Report will be available once analysis is complete.
            </Alert>
          )}
        </Grid>
      </Grid>
    </Box>
  );
}
