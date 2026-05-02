"use client";

import * as React from 'react';
import { Typography, Box, Button, CircularProgress, Alert, Paper, Chip } from '@mui/material';
import { useAuth } from '@/lib/firebase/auth';
import { useEffect, useState } from 'react';
import { Document, DocumentStatus } from '@/lib/types';
import DocumentList from '@/components/dashboard/DocumentList';
import UploadDocumentDialog from '@/components/dashboard/UploadDocumentDialog';
import { fetchDocuments } from '@/lib/api';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import FolderIcon from '@mui/icons-material/Folder';
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
    { label: 'Total Documents', value: documents.length, icon: <FolderIcon />, color: '#1a73e8', bg: '#e8f0fe' },
    { label: 'Analyzed', value: completedCount, icon: <CheckCircleOutlineIcon />, color: '#1e8e3e', bg: '#e6f4ea' },
    { label: 'Awaiting Analysis', value: pendingCount, icon: <HourglassEmptyIcon />, color: '#e37400', bg: '#fef7e0' },
    { label: 'Failed', value: failedCount, icon: <ErrorOutlineIcon />, color: '#d93025', bg: '#fce8e6' },
  ];

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
        <Box>
          <Typography variant="h5" fontWeight={600} sx={{ color: '#202124' }}>
            Documents
          </Typography>
          <Typography variant="body2" sx={{ color: '#5f6368', mt: 0.5 }}>
            Upload land documents and run AI-powered fraud analysis
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<CloudUploadIcon />}
          onClick={() => setUploadDialogOpen(true)}
          disableElevation
          sx={{
            borderRadius: '20px',
            px: 3,
            py: 1,
            textTransform: 'none',
            fontWeight: 500,
            bgcolor: '#1a73e8',
            '&:hover': { bgcolor: '#1765cc' },
          }}
        >
          Upload Document
        </Button>
      </Box>

      {/* Stats */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2, mb: 4 }}>
        {statCards.map((card) => (
          <Paper
            key={card.label}
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: 2,
              border: '1px solid #e0e0e0',
              display: 'flex',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <Box sx={{
              width: 40, height: 40, borderRadius: '12px',
              bgcolor: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: card.color,
            }}>
              {card.icon}
            </Box>
            <Box>
              <Typography variant="h5" fontWeight={600} sx={{ color: '#202124', lineHeight: 1.2 }}>
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
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
          <CircularProgress size={36} />
        </Box>
      )}
      {error && (
        <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>
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
