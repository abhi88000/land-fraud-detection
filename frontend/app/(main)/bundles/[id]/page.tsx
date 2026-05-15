"use client";

import * as React from 'react';
import { Box, Typography, Alert, Paper, Chip, Button, Divider } from '@mui/material';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/firebase/auth';
import { useEffect, useState, useCallback, useRef } from 'react';
import { fetchBundleDetails, fetchBundleReport } from '@/lib/api';
import { Bundle, BundleStatus, AnalysisReport, AnalysisProgressEvent } from '@/lib/types';
import ReportDisplay from '@/components/analysis/ReportDisplay';
import AgentTimeline from '@/components/analysis/AgentTimeline';
import VerdictReveal from '@/components/analysis/VerdictReveal';
import { EventSourcePolyfill } from 'event-source-polyfill';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FolderIcon from '@mui/icons-material/Folder';
import PlaceIcon from '@mui/icons-material/Place';
import LandscapeIcon from '@mui/icons-material/Landscape';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';

export default function BundleDetailPage() {
  const { id } = useParams();
  const bundleId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();
  const { user } = useAuth();

  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisMessage, setAnalysisMessage] = useState('Initializing...');
  const [liveEvents, setLiveEvents] = useState<AnalysisProgressEvent[]>([]);

  const eventSourceRef = useRef<EventSourcePolyfill | null>(null);

  const startStream = useCallback(async (token: string) => {
    if (!bundleId) return;
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const sseUrl = `/proxy/v1/bundles/${bundleId}/stream`;
    eventSourceRef.current = new EventSourcePolyfill(sseUrl, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    eventSourceRef.current.onmessage = (event: MessageEvent) => {
      const data: AnalysisProgressEvent = JSON.parse(event.data);
      setLiveEvents(prev => [...prev, data]);
      setAnalysisProgress(data.progress);
      setAnalysisMessage(data.message);

      if (data.event_type === 'analysis_completed') {
        setReport(data.data?.report as AnalysisReport);
        eventSourceRef.current?.close();
      } else if (data.event_type === 'analysis_failed') {
        setError(data.message);
        eventSourceRef.current?.close();
      }
    };

    eventSourceRef.current.onerror = () => {
      eventSourceRef.current?.close();
      // Fallback: try fetching report directly
      user?.getIdToken().then(t => {
        fetchBundleReport(bundleId!, t).then(res => {
          if (res?.report) {
            setReport(res.report);
            setAnalysisProgress(100);
            setAnalysisMessage('Analysis completed.');
          }
        }).catch(() => {});
      }).catch(() => {});
    };
  }, [bundleId, user]);

  useEffect(() => {
    if (!user || !bundleId) return;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = await user.getIdToken();
        const details = await fetchBundleDetails(bundleId, token);
        setBundle(details.bundle);
        setDocuments(details.documents || []);

        if (details.bundle.status === BundleStatus.COMPLETED) {
          const reportRes = await fetchBundleReport(bundleId, token);
          setReport(reportRes.report);
          setAnalysisProgress(100);
          setAnalysisMessage('Analysis completed.');
        } else if (details.bundle.status === BundleStatus.FAILED) {
          setError('Analysis failed for this bundle.');
          setAnalysisProgress(100);
        } else if (details.bundle.status === BundleStatus.ANALYZING) {
          startStream(token);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load bundle.');
      } finally {
        setLoading(false);
      }
    };

    load();
    return () => { eventSourceRef.current?.close(); };
  }, [user, bundleId, startStream]);

  const analysisSteps = ['Parsing Documents', 'Legal Check', 'Fraud Detection', 'Generating Report'];
  const getActiveStep = () => {
    if (analysisProgress >= 100) return 4;
    if (analysisProgress >= 75) return 3;
    if (analysisProgress >= 40) return 2;
    if (analysisProgress >= 15) return 1;
    return 0;
  };

  const isAnalyzing = !report && bundle?.status === BundleStatus.ANALYZING;

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', gap: 2 }}>
        <Box sx={{
          width: 64, height: 64, borderRadius: '50%',
          border: '3px solid #e8f0fe', borderTopColor: '#4285F4',
          animation: 'spin 1s linear infinite',
        }} />
        <Typography variant="body1" sx={{ color: '#5f6368' }}>Loading bundle...</Typography>
      </Box>
    );
  }

  if (error && !bundle) {
    return (
      <Box sx={{ mt: 4 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => router.push('/dashboard')} sx={{ mb: 2 }}>Dashboard</Button>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!bundle) {
    return (
      <Box sx={{ mt: 4 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => router.push('/dashboard')} sx={{ mb: 2 }}>Dashboard</Button>
        <Alert severity="warning">Bundle not found.</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ py: 3, maxWidth: 800, mx: 'auto' }}>
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
          <FolderIcon sx={{ color: '#1a73e8', fontSize: 20 }} />
        </Box>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 600, fontSize: '1rem', color: '#202124', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {bundle.name || `${bundle.land_type} — ${bundle.district}`}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <Chip icon={<PlaceIcon sx={{ fontSize: '12px !important' }} />} label={`${bundle.district}, ${bundle.state}`} size="small"
              sx={{ height: 18, fontSize: '0.6rem', bgcolor: '#f1f3f4', color: '#5f6368' }} />
            <Chip icon={<LandscapeIcon sx={{ fontSize: '12px !important' }} />} label={bundle.land_type} size="small"
              sx={{ height: 18, fontSize: '0.6rem', bgcolor: '#fff3e0', color: '#e65100' }} />
            <Chip icon={<InsertDriveFileIcon sx={{ fontSize: '12px !important' }} />} label={`${bundle.document_ids?.length || 0} files`} size="small"
              sx={{ height: 18, fontSize: '0.6rem', bgcolor: '#e6f4ea', color: '#1e8e3e' }} />
          </Box>
        </Box>
        <Chip
          label={
            bundle.status === BundleStatus.COMPLETED ? 'Reviewed' :
            bundle.status === BundleStatus.FAILED ? 'Failed' :
            bundle.status === BundleStatus.ANALYZING ? 'Analyzing...' : 'Ready'
          }
          size="small"
          sx={{
            fontWeight: 600, fontSize: '0.7rem', height: 24, borderRadius: '100px',
            bgcolor: bundle.status === BundleStatus.COMPLETED ? '#e6f4ea' :
              bundle.status === BundleStatus.FAILED ? '#fce8e6' : '#fef7e0',
            color: bundle.status === BundleStatus.COMPLETED ? '#1e8e3e' :
              bundle.status === BundleStatus.FAILED ? '#d93025' : '#e37400',
          }}
        />
      </Box>

      {/* Progress — during analysis */}
      {isAnalyzing && (
        <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: '16px', border: '1px solid #e8eaed' }}>
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

          <Typography variant="body2" sx={{ color: '#3c4043', textAlign: 'center', fontWeight: 500, mb: 2 }}>
            {analysisMessage}
          </Typography>

          <AgentTimeline events={liveEvents} active={isAnalyzing} />
        </Paper>
      )}

      {/* Report */}
      {report && (
        <>
          <VerdictReveal report={report} />
          <ReportDisplay report={report} />
        </>
      )}

      {!report && bundle.status === BundleStatus.COMPLETED && (
        <Alert severity="warning" sx={{ borderRadius: '14px' }}>Analysis completed but the report could not be loaded.</Alert>
      )}
      {!report && bundle.status === BundleStatus.FAILED && (
        <Alert severity="error" sx={{ borderRadius: '14px' }}>Analysis failed. Please try creating a new bundle.</Alert>
      )}
      {!report && bundle.status === BundleStatus.CREATED && (
        <Paper elevation={0} sx={{ p: 4, borderRadius: '16px', border: '1px solid #e8eaed', textAlign: 'center' }}>
          <FolderIcon sx={{ fontSize: 48, color: '#dadce0', mb: 1 }} />
          <Typography sx={{ color: '#5f6368', fontWeight: 500, mb: 0.5 }}>Bundle ready for analysis</Typography>
          <Typography variant="body2" sx={{ color: '#80868b', mb: 2 }}>
            {bundle.document_ids?.length || 0} documents will be analyzed together
          </Typography>
          <Typography variant="caption" sx={{ color: '#80868b' }}>
            Go back to the dashboard and click &quot;Analyze&quot; to start.
          </Typography>
        </Paper>
      )}
    </Box>
  );
}
