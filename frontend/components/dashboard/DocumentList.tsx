'use client';

import React, { useState } from 'react';
import {
  Paper,
  Chip,
  IconButton,
  Typography,
  Tooltip,
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import PlaceIcon from '@mui/icons-material/Place';
import FolderIcon from '@mui/icons-material/Folder';
import LandscapeIcon from '@mui/icons-material/Landscape';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ReplayIcon from '@mui/icons-material/Replay';
import EditIcon from '@mui/icons-material/Edit';
import { Bundle, BundleStatus } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { deleteBundle, analyzeBundle, updateBundle } from '@/lib/api';
import { useAuth } from '@/lib/firebase/auth';

interface DocumentListProps {
  bundles: Bundle[];
  onDelete?: () => void;
  onAnalysisStarted?: () => void;
}

const getStatusConfig = (status: BundleStatus): { label: string; color: string; bg: string } => {
  switch (status) {
    case BundleStatus.COMPLETED:
      return { label: 'Reviewed', color: '#1e8e3e', bg: '#e6f4ea' };
    case BundleStatus.ANALYZING:
      return { label: 'Analyzing...', color: '#e37400', bg: '#fef7e0' };
    case BundleStatus.FAILED:
      return { label: 'Failed', color: '#d93025', bg: '#fce8e6' };
    case BundleStatus.CREATED:
    default:
      return { label: 'Ready', color: '#5f6368', bg: '#f1f3f4' };
  }
};

const DocumentList: React.FC<DocumentListProps> = ({ bundles, onDelete, onAnalysisStarted }) => {
  const router = useRouter();
  const { user } = useAuth();
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [editBundle, setEditBundle] = useState<Bundle | null>(null);
  const [editState, setEditState] = useState('');
  const [editDistrict, setEditDistrict] = useState('');
  const [editLandType, setEditLandType] = useState('');
  const [saving, setSaving] = useState(false);

  const handleAnalyze = async (bundleId: string) => {
    setAnalyzing(bundleId);
    try {
      const token = await user?.getIdToken();
      await analyzeBundle(bundleId, token);
      onAnalysisStarted?.();
      router.push(`/bundles/${bundleId}`);
    } catch (err: any) {
      console.error('Failed to start analysis:', err);
      alert(err.message || 'Failed to start analysis');
    } finally {
      setAnalyzing(null);
    }
  };

  const handleDelete = async (bundleId: string) => {
    if (!confirm('Delete this bundle and all its documents?')) return;
    try {
      const token = await user?.getIdToken();
      await deleteBundle(bundleId, token);
      onDelete?.();
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  const handleRetry = async (bundleId: string) => {
    setAnalyzing(bundleId);
    try {
      const token = await user?.getIdToken();
      await analyzeBundle(bundleId, token);
      onAnalysisStarted?.();
      router.push(`/bundles/${bundleId}`);
    } catch (err: any) {
      console.error('Failed to retry analysis:', err);
      alert(err.message || 'Failed to retry analysis');
    } finally {
      setAnalyzing(null);
    }
  };

  const openEdit = (bundle: Bundle) => {
    setEditBundle(bundle);
    setEditState(bundle.state);
    setEditDistrict(bundle.district);
    setEditLandType(bundle.land_type);
  };

  const handleSaveEdit = async () => {
    if (!editBundle) return;
    setSaving(true);
    try {
      const token = await user?.getIdToken();
      await updateBundle(editBundle.id, editState, editDistrict, editLandType, token);
      setEditBundle(null);
      onDelete?.(); // refresh list
    } catch (err: any) {
      alert(err.message || 'Failed to update bundle');
    } finally {
      setSaving(false);
    }
  };

  if (bundles.length === 0) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 6, textAlign: 'center', borderRadius: '16px',
          border: '1px solid #e8eaed', bgcolor: 'white',
        }}
      >
        <FolderIcon sx={{ fontSize: 48, color: '#dadce0', mb: 2 }} />
        <Typography sx={{ color: '#5f6368', mb: 0.5, fontWeight: 500 }}>
          No document bundles yet
        </Typography>
        <Typography variant="body2" sx={{ color: '#80868b' }}>
          Create a bundle by uploading land documents
        </Typography>
      </Paper>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {bundles.map((bundle) => {
        const statusCfg = getStatusConfig(bundle.status);
        const fileCount = bundle.document_ids?.length || 0;

        return (
          <Paper
            key={bundle.id}
            elevation={0}
            onClick={() => bundle.status === BundleStatus.COMPLETED ? router.push(`/bundles/${bundle.id}`) : undefined}
            sx={{
              p: 2.5, borderRadius: '14px', border: '1px solid #e8eaed', bgcolor: 'white',
              display: 'flex', alignItems: 'center', gap: 2,
              cursor: bundle.status === BundleStatus.COMPLETED ? 'pointer' : 'default',
              transition: 'all 0.15s ease',
              '&:hover': { borderColor: '#d2d5d9', bgcolor: '#fafafa' },
            }}
          >
            {/* Icon */}
            <Box sx={{
              width: 44, height: 44, borderRadius: '12px', bgcolor: '#e8f0fe',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <FolderIcon sx={{ fontSize: 22, color: '#1a73e8' }} />
            </Box>

            {/* Info */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 600, color: '#202124', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {bundle.name || `${bundle.land_type} — ${bundle.district}`}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 0.5, flexWrap: 'wrap' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <PlaceIcon sx={{ fontSize: 12, color: '#80868b' }} />
                  <Typography variant="caption" sx={{ color: '#80868b' }}>
                    {bundle.district}, {bundle.state}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <LandscapeIcon sx={{ fontSize: 12, color: '#80868b' }} />
                  <Typography variant="caption" sx={{ color: '#80868b' }}>
                    {bundle.land_type}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <InsertDriveFileIcon sx={{ fontSize: 12, color: '#80868b' }} />
                  <Typography variant="caption" sx={{ color: '#80868b' }}>
                    {fileCount} file{fileCount !== 1 ? 's' : ''}
                  </Typography>
                </Box>
              </Box>
            </Box>

            {/* Status */}
            <Chip
              label={statusCfg.label}
              size="small"
              sx={{
                fontWeight: 600, fontSize: '0.7rem', height: 24,
                bgcolor: statusCfg.bg, color: statusCfg.color, border: 'none',
              }}
            />

            {/* Actions */}
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              {bundle.status === BundleStatus.CREATED && (
                <Tooltip title="Start Analysis">
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<AutoAwesomeIcon sx={{ fontSize: '16px !important' }} />}
                    onClick={(e) => { e.stopPropagation(); handleAnalyze(bundle.id); }}
                    disabled={analyzing === bundle.id}
                    disableElevation
                    sx={{
                      borderRadius: '100px', textTransform: 'none', fontWeight: 600,
                      fontSize: '0.75rem', px: 2, py: 0.5,
                      bgcolor: '#202124', '&:hover': { bgcolor: '#303134' },
                    }}
                  >
                    {analyzing === bundle.id ? 'Starting...' : 'Analyze'}
                  </Button>
                </Tooltip>
              )}
              {bundle.status === BundleStatus.COMPLETED && (
                <>
                  <Tooltip title="Re-analyze">
                    <IconButton
                      size="small"
                      onClick={(e) => { e.stopPropagation(); handleRetry(bundle.id); }}
                      disabled={analyzing === bundle.id}
                      sx={{ color: '#5f6368', '&:hover': { color: '#1a73e8' } }}
                    >
                      <ReplayIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="View Report">
                    <IconButton
                      size="small"
                      onClick={(e) => { e.stopPropagation(); router.push(`/bundles/${bundle.id}`); }}
                      sx={{ color: '#1a73e8' }}
                    >
                      <ArrowForwardIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </>
              )}
              {bundle.status === BundleStatus.ANALYZING && (
                <Tooltip title="View Progress">
                  <IconButton
                    size="small"
                    onClick={(e) => { e.stopPropagation(); router.push(`/bundles/${bundle.id}`); }}
                    sx={{ color: '#e37400' }}
                  >
                    <ArrowForwardIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              {bundle.status === BundleStatus.FAILED && (
                <Tooltip title="Retry Analysis">
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<ReplayIcon sx={{ fontSize: '16px !important' }} />}
                    onClick={(e) => { e.stopPropagation(); handleRetry(bundle.id); }}
                    disabled={analyzing === bundle.id}
                    disableElevation
                    sx={{
                      borderRadius: '100px', textTransform: 'none', fontWeight: 600,
                      fontSize: '0.75rem', px: 2, py: 0.5,
                      bgcolor: '#d93025', '&:hover': { bgcolor: '#b3261e' },
                    }}
                  >
                    {analyzing === bundle.id ? 'Retrying...' : 'Retry'}
                  </Button>
                </Tooltip>
              )}
              {bundle.status !== BundleStatus.ANALYZING && (
                <Tooltip title="Edit Bundle">
                  <IconButton
                    size="small"
                    onClick={(e) => { e.stopPropagation(); openEdit(bundle); }}
                    sx={{ color: '#5f6368', '&:hover': { color: '#1a73e8' } }}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title="Delete">
                <IconButton
                  size="small"
                  onClick={(e) => { e.stopPropagation(); handleDelete(bundle.id); }}
                  sx={{ color: '#dadce0', '&:hover': { color: '#d93025' } }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Paper>
        );
      })}

      {/* Edit Bundle Dialog */}
      <Dialog open={!!editBundle} onClose={() => setEditBundle(null)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: '16px' } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Edit Bundle</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField label="State" value={editState} onChange={(e) => setEditState(e.target.value)} fullWidth size="small" />
          <TextField label="District" value={editDistrict} onChange={(e) => setEditDistrict(e.target.value)} fullWidth size="small" />
          <Box>
            <Typography variant="caption" sx={{ color: '#5f6368', mb: 0.5, display: 'block' }}>Land Type</Typography>
            <ToggleButtonGroup
              value={editLandType}
              exclusive
              onChange={(_, val) => val && setEditLandType(val)}
              size="small"
              sx={{ '& .MuiToggleButton-root': { textTransform: 'none', borderRadius: '8px !important', px: 2 } }}
            >
              <ToggleButton value="Agricultural">Agricultural</ToggleButton>
              <ToggleButton value="Residential">Residential</ToggleButton>
              <ToggleButton value="Commercial">Commercial</ToggleButton>
              <ToggleButton value="Plantation">Plantation</ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditBundle(null)} sx={{ textTransform: 'none', color: '#5f6368' }}>Cancel</Button>
          <Button onClick={handleSaveEdit} variant="contained" disabled={saving} disableElevation
            sx={{ textTransform: 'none', borderRadius: '100px', bgcolor: '#202124', '&:hover': { bgcolor: '#303134' } }}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DocumentList;
