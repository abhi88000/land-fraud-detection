"use client";

import * as React from 'react';
import { Typography, Box, Button, CircularProgress, Alert, Paper, Chip, Skeleton } from '@mui/material';
import { useAuth } from '@/lib/firebase/auth';
import { useEffect, useState } from 'react';
import { Document, DocumentStatus } from '@/lib/types';
import DocumentList from '@/components/dashboard/DocumentList';
import UploadDocumentDialog from '@/components/dashboard/UploadDocumentDialog';
import { fetchDocuments } from '@/lib/api';
import AddIcon from '@mui/icons-material/Add';
import DescriptionIcon from '@mui/icons-material/Description';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

export default function DashboardPage() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isUploadDialogOpen, setUploadDialogOpen] = useState<boolean>(false);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  useEffect(() => {
    if (user) {
      const loadDocuments = async () => {
        setLoading(true);
        setError(null);
        try {
          const token = await user.getIdToken();
          const data = await fetchDocuments(token);
          setDocuments(data.documents);
        } catch (err: any) {
          setError(err.message || 'Failed to fetch documents.');
        } finally {
          setLoading(false);
        }
      };
      loadDocuments();
    }
  }, [user, refreshTrigger]);

  const handleUploadSuccess = () => {
    setUploadDialogOpen(false);
    setRefreshTrigger(prev => prev + 1);
  };

  const handleDocumentDelete = () => {
    setRefreshTrigger(prev => prev + 1);
  }

  if (!user) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  const completedCount = documents.filter(d => d.status === DocumentStatus.COMPLETED).length;
  const pendingCount = documents.filter(d =>
    d.status === DocumentStatus.PENDING || d.status === DocumentStatus.UPLOADED || d.status === DocumentStatus.IN_PROGRESS
  ).length;
  const failedCount = documents.filter(d => d.status === DocumentStatus.FAILED).length;

  const statCards = [
    { label: 'Total', value: documents.length, icon: <DescriptionIcon sx={{ fontSize: 20 }} />, color: '#1a73e8', bg: '#e8f0fe' },
    { label: 'Reviewed', value: completedCount, icon: <CheckCircleOutlineIcon sx={{ fontSize: 20 }} />, color: '#1e8e3e', bg: '#e6f4ea' },
    { label: 'Pending', value: pendingCount, icon: <HourglassEmptyIcon sx={{ fontSize: 20 }} />, color: '#e37400', bg: '#fef7e0' },
    { label: 'Failed', value: failedCount, icon: <ErrorOutlineIcon sx={{ fontSize: 20 }} />, color: '#d93025', bg: '#fce8e6' },
  ];

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography sx={{ fontSize: { xs: '1.25rem', md: '1.5rem' }, fontWeight: 700, color: '#202124' }}>
            Your Documents
          </Typography>
          <Typography variant="body2" sx={{ color: '#5f6368', mt: 0.5 }}>
            Upload land documents for AI-assisted review
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setUploadDialogOpen(true)}
          disableElevation
          sx={{
            borderRadius: '100px', px: 3, py: 1.2,
            textTransform: 'none', fontWeight: 600, fontSize: '0.9rem',
            bgcolor: '#202124', color: 'white',
            '&:hover': { bgcolor: '#303134' },
          }}
        >
          Upload
        </Button>
      </Box>

      {/* Stats row */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2, mb: 4 }}>
        {statCards.map((card) => (
          <Paper
            key={card.label}
            elevation={0}
            sx={{
              p: 2, borderRadius: '12px', border: '1px solid #e8eaed', bgcolor: 'white',
              display: 'flex', alignItems: 'center', gap: 1.5,
              transition: 'border-color 0.2s',
              '&:hover': { borderColor: card.color },
            }}
          >
            <Box sx={{
              width: 36, height: 36, borderRadius: '10px',
              bgcolor: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: card.color,
            }}>
              {card.icon}
            </Box>
            <Box>
              <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: '#202124', lineHeight: 1 }}>
                {card.value}
              </Typography>
              <Typography variant="caption" sx={{ color: '#5f6368' }}>
                {card.label}
              </Typography>
            </Box>
          </Paper>
        ))}
      </Box>

      {/* Document List */}
      {loading && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {[1, 2, 3].map(i => (
            <Skeleton key={i} variant="rounded" height={72} sx={{ borderRadius: '12px' }} animation="wave" />
          ))}
        </Box>
      )}
      {error && (
        <Alert severity="error" sx={{ borderRadius: '12px' }}>
          {error}
        </Alert>
      )}
      {!loading && !error && (
        <DocumentList documents={documents} onDelete={handleDocumentDelete} onAnalysisStarted={handleDocumentDelete} />
      )}

      <UploadDocumentDialog
        open={isUploadDialogOpen}
        onClose={() => setUploadDialogOpen(false)}
        onUploadSuccess={handleUploadSuccess}
      />
    </Box>
  );
}
