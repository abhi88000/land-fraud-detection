"use client";

import * as React from 'react';
import { Typography, Box, Button, CircularProgress, Alert, Paper, Chip, Skeleton } from '@mui/material';
import { useAuth } from '@/lib/firebase/auth';
import { useEffect, useState } from 'react';
import { Bundle, BundleStatus } from '@/lib/types';
import DocumentList from '@/components/dashboard/DocumentList';
import UploadDocumentDialog from '@/components/dashboard/UploadDocumentDialog';
import { fetchBundles } from '@/lib/api';
import AddIcon from '@mui/icons-material/Add';
import FolderIcon from '@mui/icons-material/Folder';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

export default function DashboardPage() {
  const { user } = useAuth();
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isUploadDialogOpen, setUploadDialogOpen] = useState<boolean>(false);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  useEffect(() => {
    if (user) {
      const loadBundles = async () => {
        setLoading(true);
        setError(null);
        try {
          const token = await user.getIdToken();
          const data = await fetchBundles(token);
          setBundles(data.bundles);
        } catch (err: any) {
          setError(err.message || 'Failed to fetch bundles.');
        } finally {
          setLoading(false);
        }
      };
      loadBundles();
    }
  }, [user, refreshTrigger]);

  const handleUploadSuccess = () => {
    setUploadDialogOpen(false);
    setRefreshTrigger(prev => prev + 1);
  };

  const handleDelete = () => {
    setRefreshTrigger(prev => prev + 1);
  }

  if (!user) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  const completedCount = bundles.filter(b => b.status === BundleStatus.COMPLETED).length;
  const pendingCount = bundles.filter(b => b.status === BundleStatus.CREATED || b.status === BundleStatus.ANALYZING).length;
  const failedCount = bundles.filter(b => b.status === BundleStatus.FAILED).length;
  const totalFiles = bundles.reduce((sum, b) => sum + (b.document_ids?.length || 0), 0);

  const statCards = [
    { label: 'Bundles', value: bundles.length, icon: <FolderIcon sx={{ fontSize: 20 }} />, color: '#1a73e8', bg: '#e8f0fe' },
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
            Your Document Bundles
          </Typography>
          <Typography variant="body2" sx={{ color: '#5f6368', mt: 0.5 }}>
            Each bundle groups documents for one property — analyzed together
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
          New Bundle
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

      {/* Bundle List */}
      {loading && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {[1, 2, 3].map(i => (
            <Skeleton key={i} variant="rounded" height={80} sx={{ borderRadius: '14px' }} animation="wave" />
          ))}
        </Box>
      )}
      {error && (
        <Alert severity="error" sx={{ borderRadius: '12px' }}>
          {error}
        </Alert>
      )}
      {!loading && !error && (
        <DocumentList bundles={bundles} onDelete={handleDelete} onAnalysisStarted={handleDelete} />
      )}

      <UploadDocumentDialog
        open={isUploadDialogOpen}
        onClose={() => setUploadDialogOpen(false)}
        onUploadSuccess={handleUploadSuccess}
      />
    </Box>
  );
}
