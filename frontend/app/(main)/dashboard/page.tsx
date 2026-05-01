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
import DescriptionIcon from '@mui/icons-material/Description';

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
  const pendingCount = documents.filter(d => d.status === DocumentStatus.PENDING || d.status === DocumentStatus.IN_PROGRESS).length;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" component="h1" fontWeight="bold">
            Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Welcome back, {user.email || user.uid}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<CloudUploadIcon />}
          onClick={() => setUploadDialogOpen(true)}
          sx={{ borderRadius: 2, px: 3 }}
        >
          Upload Document
        </Button>
      </Box>

      {/* Stats Cards */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Paper sx={{ p: 2, flex: 1, minWidth: 150, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
          <DescriptionIcon color="primary" />
          <Box>
            <Typography variant="h5" fontWeight="bold">{documents.length}</Typography>
            <Typography variant="caption" color="text.secondary">Total Documents</Typography>
          </Box>
        </Paper>
        <Paper sx={{ p: 2, flex: 1, minWidth: 150, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Chip label="Done" color="success" size="small" />
          <Box>
            <Typography variant="h5" fontWeight="bold">{completedCount}</Typography>
            <Typography variant="caption" color="text.secondary">Analyzed</Typography>
          </Box>
        </Paper>
        <Paper sx={{ p: 2, flex: 1, minWidth: 150, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Chip label="Pending" color="warning" size="small" />
          <Box>
            <Typography variant="h5" fontWeight="bold">{pendingCount}</Typography>
            <Typography variant="caption" color="text.secondary">In Progress</Typography>
          </Box>
        </Paper>
      </Box>

      {/* Document List */}
      <Typography variant="h6" fontWeight="bold" gutterBottom>
        Your Documents
      </Typography>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      )}
      {error && (
        <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>
          {error}
        </Alert>
      )}
      {!loading && !error && (
        <DocumentList documents={documents} onDelete={handleDocumentDelete} />
      )}

      <UploadDocumentDialog
        open={isUploadDialogOpen}
        onClose={() => setUploadDialogOpen(false)}
        onUploadSuccess={handleUploadSuccess}
      />
    </Box>
  );
}
