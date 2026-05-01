"use client";

import * as React from 'react';
import { Typography, Box, Button, CircularProgress, Alert } from '@mui/material';
import { useAuth } from '@/lib/firebase/auth';
import { useEffect, useState } from 'react';
import { Document, DocumentStatus } from '@/lib/types';
import DocumentList from '@/components/dashboard/DocumentList';
import UploadDocumentDialog from '@/components/dashboard/UploadDocumentDialog';
import { fetchDocuments } from '@/lib/api';

export default function DashboardPage() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isUploadDialogOpen, setUploadDialogOpen] = useState<boolean>(false);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0); // State to trigger refresh

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
  }, [user, refreshTrigger]); // Added refreshTrigger to dependency array

  const handleUploadSuccess = () => {
    setUploadDialogOpen(false);
    setRefreshTrigger(prev => prev + 1); // Trigger a refresh of the document list
  };

  const handleDocumentDelete = () => {
    setRefreshTrigger(prev => prev + 1); // Trigger a refresh after deletion
  }

  if (!user) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Welcome, {user.email || user.uid}!
      </Typography>
      <Typography variant="h5" component="h2" gutterBottom sx={{ mt: 4 }}>
        Your Documents
      </Typography>

      <Box sx={{ mb: 3 }}>
        <Button variant="contained" color="primary" onClick={() => setUploadDialogOpen(true)}>
          Upload New Document
        </Button>
      </Box>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      )}
      {error && (
        <Alert severity="error" sx={{ mt: 4 }}>
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
