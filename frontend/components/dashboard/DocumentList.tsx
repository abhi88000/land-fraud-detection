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
  DialogContent,
  TextField,
  Autocomplete,
  ToggleButton,
  ToggleButtonGroup,
  CircularProgress,
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
import CloseIcon from '@mui/icons-material/Close';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import HomeIcon from '@mui/icons-material/Home';
import AgricultureIcon from '@mui/icons-material/Agriculture';
import StoreIcon from '@mui/icons-material/Store';
import FactoryIcon from '@mui/icons-material/Factory';
import ParkIcon from '@mui/icons-material/Park';
import { Bundle, BundleStatus } from '@/lib/types';
import { useRouter } from 'next/navigation';
import {
  deleteBundle,
  analyzeBundle,
  updateBundle,
  fetchBundleDetails,
  addFilesToBundle,
  removeFileFromBundle,
} from '@/lib/api';
import { useAuth } from '@/lib/firebase/auth';

interface DocumentListProps {
  bundles: Bundle[];
  onDelete?: () => void;
  onAnalysisStarted?: () => void;
}

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];

const LAND_TYPES = [
  { value: 'Residential', label: 'Residential', icon: <HomeIcon sx={{ fontSize: 18 }} /> },
  { value: 'Agricultural', label: 'Agricultural', icon: <AgricultureIcon sx={{ fontSize: 18 }} /> },
  { value: 'Commercial', label: 'Commercial', icon: <StoreIcon sx={{ fontSize: 18 }} /> },
  { value: 'Industrial', label: 'Industrial', icon: <FactoryIcon sx={{ fontSize: 18 }} /> },
  { value: 'Plantation', label: 'Plantation', icon: <ParkIcon sx={{ fontSize: 18 }} /> },
];

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

  // Edit dialog state
  const [editBundle, setEditBundle] = useState<Bundle | null>(null);
  const [editState, setEditState] = useState('');
  const [editDistrict, setEditDistrict] = useState('');
  const [editLandType, setEditLandType] = useState('');
  const [editDocs, setEditDocs] = useState<any[]>([]);
  const [editLoading, setEditLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [busyDocId, setBusyDocId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

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
    } catch (err: any) {
      console.error('Failed to delete:', err);
      alert(err?.message || 'Failed to delete bundle');
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

  const openEdit = async (bundle: Bundle) => {
    setEditBundle(bundle);
    setEditState(bundle.state);
    setEditDistrict(bundle.district);
    setEditLandType(bundle.land_type);
    setEditDocs([]);
    setEditError(null);
    setEditLoading(true);
    try {
      const token = await user?.getIdToken();
      const details = await fetchBundleDetails(bundle.id, token);
      setEditDocs(details.documents || []);
    } catch (err: any) {
      setEditError(err?.message || 'Failed to load bundle documents');
    } finally {
      setEditLoading(false);
    }
  };

  const closeEdit = () => {
    setEditBundle(null);
    setEditError(null);
    setEditDocs([]);
    setBusyDocId(null);
  };

  const handleAddFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editBundle || !e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);
    e.target.value = '';
    setAdding(true);
    setEditError(null);
    try {
      const token = await user?.getIdToken();
      await addFilesToBundle(editBundle.id, files, token);
      const details = await fetchBundleDetails(editBundle.id, token);
      setEditDocs(details.documents || []);
    } catch (err: any) {
      setEditError(err?.message || 'Failed to add files');
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveDoc = async (docId: string) => {
    if (!editBundle) return;
    if (editDocs.length <= 1) {
      setEditError('A bundle must contain at least one document.');
      return;
    }
    if (!confirm('Remove this document from the bundle?')) return;
    setBusyDocId(docId);
    setEditError(null);
    try {
      const token = await user?.getIdToken();
      await removeFileFromBundle(editBundle.id, docId, token);
      setEditDocs(prev => prev.filter(d => d.id !== docId));
    } catch (err: any) {
      setEditError(err?.message || 'Failed to remove document');
    } finally {
      setBusyDocId(null);
    }
  };

  const handleSaveEdit = async () => {
    if (!editBundle) return;
    setSaving(true);
    setEditError(null);
    try {
      const token = await user?.getIdToken();
      await updateBundle(editBundle.id, editState, editDistrict, editLandType, token);
      closeEdit();
      onDelete?.(); // refresh list
    } catch (err: any) {
      setEditError(err.message || 'Failed to update bundle');
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
                {bundle.name || `${bundle.land_type} â€” ${bundle.district}`}
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
              {bundle.status !== BundleStatus.ANALYZING && (
                <Tooltip title="Delete Bundle">
                  <IconButton
                    size="small"
                    onClick={(e) => { e.stopPropagation(); handleDelete(bundle.id); }}
                    sx={{ color: '#9aa0a6', '&:hover': { color: '#d93025', bgcolor: '#fce8e6' } }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          </Paper>
        );
      })}

      {/* Edit Bundle Dialog â€” metadata + documents */}
      <Dialog
        open={!!editBundle}
        onClose={closeEdit}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: '20px', overflow: 'hidden', maxWidth: 640 } }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, pt: 3, pb: 0.5 }}>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: '1.15rem', color: '#202124' }}>
              Edit Bundle
            </Typography>
            <Typography variant="caption" sx={{ color: '#80868b' }}>
              Update property details or add / remove documents. Bundle will need re-analysis after changes.
            </Typography>
          </Box>
          <IconButton onClick={closeEdit} size="small" sx={{ color: '#5f6368' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        <DialogContent sx={{ px: 3, pb: 3 }}>
          {/* Location */}
          <Typography variant="caption" sx={{ fontWeight: 600, color: '#5f6368', textTransform: 'uppercase', letterSpacing: 0.5, mb: 1, display: 'block' }}>
            Property Location
          </Typography>
          <Box sx={{ display: 'flex', gap: 1.5, mb: 2.5 }}>
            <Autocomplete
              freeSolo
              options={INDIAN_STATES}
              value={editState}
              onInputChange={(_, val) => setEditState(val)}
              renderInput={(params) => (
                <TextField {...params} label="State / UT *" size="small"
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} />
              )}
              sx={{ flex: 1 }}
            />
            <TextField
              label="District *"
              size="small"
              value={editDistrict}
              onChange={(e) => setEditDistrict(e.target.value)}
              sx={{ flex: 1, '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
            />
          </Box>

          {/* Land type */}
          <Typography variant="caption" sx={{ fontWeight: 600, color: '#5f6368', textTransform: 'uppercase', letterSpacing: 0.5, mb: 1, display: 'block' }}>
            Type of Land *
          </Typography>
          <ToggleButtonGroup
            value={editLandType}
            exclusive
            onChange={(_, val) => { if (val) setEditLandType(val); }}
            sx={{ display: 'flex', gap: 1, mb: 2.5, flexWrap: 'wrap', '& .MuiToggleButton-root': { border: 'none' } }}
          >
            {LAND_TYPES.map(lt => (
              <ToggleButton
                key={lt.value}
                value={lt.value}
                sx={{
                  flex: 1, minWidth: 90, borderRadius: '10px !important', textTransform: 'none',
                  py: 1, px: 1.5, gap: 0.75, fontSize: '0.8rem', fontWeight: 500,
                  border: '1.5px solid #e8eaed !important',
                  color: '#5f6368',
                  '&.Mui-selected': {
                    bgcolor: '#e8f0fe', color: '#1a73e8', borderColor: '#1a73e8 !important',
                    '&:hover': { bgcolor: '#d2e3fc' },
                  },
                }}
              >
                {lt.icon}
                {lt.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          {/* Documents */}
          <Typography variant="caption" sx={{ fontWeight: 600, color: '#5f6368', textTransform: 'uppercase', letterSpacing: 0.5, mb: 1, display: 'block' }}>
            Documents ({editDocs.length})
          </Typography>
          <Box sx={{
            border: '1.5px dashed #dadce0',
            borderRadius: '14px',
            p: 1.25,
            bgcolor: '#fafafa',
            mb: 1,
            minHeight: 100,
          }}>
            {editLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={20} />
              </Box>
            ) : editDocs.length === 0 ? (
              <Typography variant="caption" sx={{ color: '#80868b', display: 'block', textAlign: 'center', py: 3 }}>
                No documents in this bundle yet.
              </Typography>
            ) : (
              editDocs.map((d) => (
                <Box
                  key={d.id}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1.25,
                    py: 0.6, px: 1, borderRadius: '8px',
                    '&:hover': { bgcolor: '#f1f3f4' },
                  }}
                >
                  <InsertDriveFileIcon sx={{ fontSize: 18, color: '#1a73e8', flexShrink: 0 }} />
                  <Typography variant="body2" sx={{ flex: 1, minWidth: 0, color: '#202124', fontSize: '0.85rem' }} noWrap title={d.file_name}>
                    {d.file_name}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => handleRemoveDoc(d.id)}
                    disabled={busyDocId === d.id || editDocs.length <= 1}
                    sx={{ p: 0.25, flexShrink: 0 }}
                  >
                    {busyDocId === d.id
                      ? <CircularProgress size={14} />
                      : <DeleteOutlineIcon sx={{ fontSize: 16, color: editDocs.length <= 1 ? '#dadce0' : '#d93025' }} />}
                  </IconButton>
                </Box>
              ))
            )}
            <Box sx={{ borderTop: editDocs.length > 0 ? '1px solid #ececec' : 'none', mt: editDocs.length > 0 ? 0.75 : 0, pt: 0.5 }}>
              <input
                type="file"
                accept=".pdf,image/*"
                multiple
                style={{ display: 'none' }}
                id="edit-file-input"
                onChange={handleAddFiles}
                disabled={adding}
              />
              <label htmlFor="edit-file-input">
                <Button
                  component="span"
                  size="small"
                  disabled={adding}
                  startIcon={adding ? <CircularProgress size={14} /> : <CloudUploadIcon sx={{ fontSize: 16 }} />}
                  sx={{ textTransform: 'none', color: '#1a73e8', fontSize: '0.8rem', fontWeight: 500 }}
                >
                  {adding ? 'Adding...' : 'Add more files'}
                </Button>
              </label>
            </Box>
          </Box>

          {editError && (
            <Typography variant="body2" sx={{ color: '#d93025', mt: 1, fontSize: '0.8rem' }}>
              {editError}
            </Typography>
          )}

          {/* Actions */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, mt: 3 }}>
            <Button
              onClick={closeEdit}
              disabled={saving}
              sx={{ borderRadius: '100px', textTransform: 'none', color: '#5f6368', px: 3 }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              variant="contained"
              disabled={saving || editLoading}
              disableElevation
              sx={{
                borderRadius: '100px', textTransform: 'none', fontWeight: 600, px: 3,
                bgcolor: '#202124', '&:hover': { bgcolor: '#303134' },
                '&.Mui-disabled': { bgcolor: '#e8eaed', color: '#9aa0a6' },
              }}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default DocumentList;
