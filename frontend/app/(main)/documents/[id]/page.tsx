"use client";

import * as React from 'react';
import { Box, Typography, CircularProgress, Alert, Grid, Paper, Chip } from '@mui/material';
import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/firebase/auth';
import { useEffect, useState, useCallback, useRef } from 'react';
import { fetchDocumentDetails, fetchAnalysisReport } from '@/lib/api';
import { Document, AnalysisReport, DocumentStatus, AnalysisProgressEvent, LegalFinding, FraudFinding } from '@/lib/types';
import DocumentViewer from '@/components/analysis/DocumentViewer';
import ReportDisplay from '@/components/analysis/ReportDisplay';
import { EventSourcePolyfill } from 'event-source-polyfill'; // For SSE with custom headers

export default function DocumentAnalysisPage() {
  const { id } = useParams(); // Document ID from the URL
  const documentId = Array.isArray(id) ? id[0] : id;

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

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ ml: 2 }}>Loading document details...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 4 }}>
        <Typography>Error: {error}</Typography>
      </Alert>
    );
  }

  if (!document) {
    return (
      <Alert severity="warning" sx={{ mt: 4 }}>
        <Typography>Document not found.</Typography>
      </Alert>
    );
  }

  return (
    <Box sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Analysis for: {document.file_name}
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h6" gutterBottom>Document Viewer</Typography>
            {document.gcs_path && (
              <Box sx={{ flexGrow: 1, minHeight: 400, border: '1px solid #ccc', mt: 2 }}>
                {/* Note: In a production environment, you would need a signed URL for GCS access */}
                <DocumentViewer gcsPath={document.gcs_path} />
              </Box>
            )}
             {!document.gcs_path && (
              <Alert severity="info">No document found at GCS path.</Alert>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h6" gutterBottom>Analysis Status</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <CircularProgress variant="determinate" value={analysisProgress} size={50} />
              <Typography variant="body1" sx={{ ml: 2 }}>
                {analysisMessage} ({analysisProgress}%)
              </Typography>
            </Box>

            <Typography variant="subtitle1" gutterBottom>Recent Events:</Typography>
            <Box sx={{ maxHeight: 300, overflowY: 'auto', p: 1, border: '1px solid #eee', borderRadius: 1 }}>
              {liveEvents.length === 0 && <Typography variant="body2" color="text.secondary">No events yet.</Typography>}
              {liveEvents.map((event, index) => (
                <Chip
                  key={index}
                  label={`${event.event_type}: ${event.message}`}
                  size="small"
                  color={event.event_type.includes('failed') ? 'error' : 'info'}
                  sx={{ mr: 1, mb: 1 }}
                />
              ))}
            </Box>

            {analysisReport && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="h6" gutterBottom>Analysis Report</Typography>
                <ReportDisplay report={analysisReport} />
              </Box>
            )}
            {!analysisReport && document.status === DocumentStatus.COMPLETED && (
              <Alert severity="warning" sx={{ mt: 3 }}>
                Analysis completed but report could not be loaded.
              </Alert>
            )}
             {!analysisReport && document.status !== DocumentStatus.COMPLETED && (
              <Alert severity="info" sx={{ mt: 3 }}>
                Report will be available once analysis is complete.
              </Alert>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
