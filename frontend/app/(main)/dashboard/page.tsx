"use client";

import * as React from 'react';
import { Typography, Box, Button, CircularProgress, Alert, Paper, Chip, Skeleton, InputBase, IconButton } from '@mui/material';
import { useAuth } from '@/lib/firebase/auth';
import { useEffect, useMemo, useState } from 'react';
import { Bundle, BundleStatus } from '@/lib/types';
import DocumentList from '@/components/dashboard/DocumentList';
import UploadDocumentDialog from '@/components/dashboard/UploadDocumentDialog';
import { fetchBundles } from '@/lib/api';
import AddIcon from '@mui/icons-material/Add';
import FolderIcon from '@mui/icons-material/Folder';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import TuneIcon from '@mui/icons-material/Tune';

type FilterKey = 'all' | 'reviewed' | 'pending' | 'failed';

export default function DashboardPage() {
  const { user } = useAuth();
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isUploadDialogOpen, setUploadDialogOpen] = useState<boolean>(false);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [query, setQuery] = useState<string>('');
  const [filter, setFilter] = useState<FilterKey>('all');

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
          console.error('Bundle fetch error:', err);
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

  const statCards: Array<{
    key: FilterKey;
    label: string;
    value: number;
    icon: React.ReactNode;
    color: string;
    bg: string;
    ring: string;
  }> = [
    { key: 'all',      label: 'Total bundles', value: bundles.length, icon: <FolderIcon sx={{ fontSize: 22 }} />,              color: '#1a73e8', bg: 'linear-gradient(135deg,#e8f0fe 0%,#f3e8ff 100%)', ring: 'rgba(26,115,232,0.35)' },
    { key: 'reviewed', label: 'Reviewed',      value: completedCount, icon: <CheckCircleOutlineIcon sx={{ fontSize: 22 }} />, color: '#1e8e3e', bg: 'linear-gradient(135deg,#e6f4ea 0%,#e0f7f1 100%)', ring: 'rgba(30,142,62,0.35)' },
    { key: 'pending',  label: 'In progress',   value: pendingCount,   icon: <HourglassEmptyIcon sx={{ fontSize: 22 }} />,    color: '#e37400', bg: 'linear-gradient(135deg,#fef7e0 0%,#feeed5 100%)', ring: 'rgba(227,116,0,0.35)' },
    { key: 'failed',   label: 'Needs attention', value: failedCount,  icon: <ErrorOutlineIcon sx={{ fontSize: 22 }} />,      color: '#d93025', bg: 'linear-gradient(135deg,#fce8e6 0%,#fde8f1 100%)', ring: 'rgba(217,48,37,0.35)' },
  ];

  const filteredBundles = useMemo(() => {
    let list = bundles;
    if (filter === 'reviewed') list = list.filter(b => b.status === BundleStatus.COMPLETED);
    else if (filter === 'pending') list = list.filter(b => b.status === BundleStatus.CREATED || b.status === BundleStatus.ANALYZING);
    else if (filter === 'failed') list = list.filter(b => b.status === BundleStatus.FAILED);

    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(b =>
        (b.name || '').toLowerCase().includes(q) ||
        (b.district || '').toLowerCase().includes(q) ||
        (b.state || '').toLowerCase().includes(q) ||
        (b.land_type || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [bundles, filter, query]);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'flex-end' }, flexDirection: { xs: 'column', sm: 'row' }, gap: 2, mb: 3.5 }}>
        <Box>
          <Typography sx={{ fontSize: { xs: '1.5rem', md: '1.9rem' }, fontWeight: 500, color: '#202124', letterSpacing: '-0.4px' }}>
            Your bundles
          </Typography>
          <Typography sx={{ color: '#5f6368', mt: 0.5, fontSize: '0.9rem' }}>
            Each bundle groups documents for one property — analyzed together by 6 AI agents.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setUploadDialogOpen(true)}
          disableElevation
          sx={{
            borderRadius: '999px', px: 2.75, py: 1.25,
            textTransform: 'none', fontWeight: 500, fontSize: '0.9rem',
            bgcolor: '#1a73e8', color: 'white',
            boxShadow: '0 1px 2px rgba(60,64,67,0.08), 0 1px 3px rgba(60,64,67,0.12)',
            '&:hover': { bgcolor: '#185abc', boxShadow: '0 1px 3px rgba(60,64,67,0.14), 0 4px 8px rgba(60,64,67,0.16)' },
          }}
        >
          New bundle
        </Button>
      </Box>

      {/* Stats row — Material 3 metric cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 1.5, mb: 3.5 }}>
        {statCards.map((card) => {
          const active = filter === card.key;
          return (
            <Paper
              key={card.label}
              elevation={0}
              onClick={() => setFilter(card.key)}
              role="button"
              tabIndex={0}
              sx={{
                position: 'relative',
                p: 2.25,
                borderRadius: '20px',
                bgcolor: 'white',
                cursor: 'pointer',
                boxShadow: active
                  ? `0 0 0 2px ${card.ring}, 0 1px 2px rgba(60,64,67,0.06)`
                  : '0 0 0 1px rgba(60,64,67,0.10)',
                transition: 'box-shadow .18s, transform .18s',
                '&:hover': {
                  boxShadow: `0 0 0 1px ${card.ring}, 0 1px 3px rgba(60,64,67,0.10), 0 4px 12px rgba(60,64,67,0.08)`,
                  transform: 'translateY(-1px)',
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.25 }}>
                <Box sx={{
                  width: 40, height: 40, borderRadius: '12px',
                  background: card.bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: card.color,
                }}>
                  {card.icon}
                </Box>
                {active && (
                  <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: card.color, mt: 0.75 }} />
                )}
              </Box>
              <Typography sx={{ fontSize: '2rem', fontWeight: 400, color: '#202124', lineHeight: 1.05, letterSpacing: '-1px' }}>
                {card.value}
              </Typography>
              <Typography sx={{ fontSize: '0.78rem', color: '#5f6368', mt: 0.5, fontWeight: 500 }}>
                {card.label}
              </Typography>
            </Paper>
          );
        })}
      </Box>

      {/* Search bar — Material 3 "search pill" */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
        <Paper
          elevation={0}
          sx={{
            display: 'flex', alignItems: 'center', flex: 1,
            px: 1.5, py: 0.5,
            borderRadius: '999px',
            bgcolor: '#f1f3f4',
            transition: 'background-color .15s, box-shadow .15s',
            '&:hover': { bgcolor: '#e8eaed' },
            '&:focus-within': { bgcolor: '#fff', boxShadow: '0 1px 2px rgba(60,64,67,0.08), 0 0 0 1px rgba(26,115,232,0.4)' },
          }}
        >
          <SearchIcon sx={{ fontSize: 20, color: '#5f6368', ml: 0.5 }} />
          <InputBase
            placeholder="Search by name, district, state, or land type"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            sx={{ flex: 1, fontSize: '0.92rem', ml: 1.25, color: '#202124' }}
          />
          {query && (
            <IconButton size="small" onClick={() => setQuery('')} sx={{ color: '#5f6368' }}>
              <CloseIcon sx={{ fontSize: 18 }} />
            </IconButton>
          )}
        </Paper>
        {filter !== 'all' && (
          <Chip
            icon={<TuneIcon sx={{ fontSize: '16px !important' }} />}
            label={statCards.find(c => c.key === filter)?.label || filter}
            onDelete={() => setFilter('all')}
            sx={{
              borderRadius: '999px',
              bgcolor: '#e8f0fe',
              color: '#1a73e8',
              fontWeight: 500,
              fontSize: '0.78rem',
              '& .MuiChip-deleteIcon': { color: '#1a73e8' },
            }}
          />
        )}
      </Box>

      {/* Bundle List */}
      {loading && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          {[1, 2, 3].map(i => (
            <Skeleton key={i} variant="rounded" height={76} sx={{ borderRadius: '16px' }} animation="wave" />
          ))}
        </Box>
      )}
      {error && (
        <Alert severity="error" sx={{ borderRadius: '12px' }}>
          {error}
        </Alert>
      )}
      {!loading && !error && (
        <DocumentList
          bundles={filteredBundles}
          onDelete={handleDelete}
          onAnalysisStarted={handleDelete}
        />
      )}

      <UploadDocumentDialog
        open={isUploadDialogOpen}
        onClose={() => setUploadDialogOpen(false)}
        onUploadSuccess={handleUploadSuccess}
      />
    </Box>
  );
}
