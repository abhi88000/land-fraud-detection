'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  Button,
  Box,
  Typography,
  LinearProgress,
  TextField,
  Autocomplete,
  IconButton,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CloseIcon from '@mui/icons-material/Close';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import HomeIcon from '@mui/icons-material/Home';
import AgricultureIcon from '@mui/icons-material/Agriculture';
import StoreIcon from '@mui/icons-material/Store';
import FactoryIcon from '@mui/icons-material/Factory';
import ParkIcon from '@mui/icons-material/Park';
import { createBundle } from '@/lib/api';
import { useAuth } from '@/lib/firebase/auth';

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

interface UploadDocumentDialogProps {
  open: boolean;
  onClose: () => void;
  onUploadSuccess: () => void;
}

const UploadDocumentDialog: React.FC<UploadDocumentDialogProps> = ({
  open,
  onClose,
  onUploadSuccess,
}) => {
  const { user } = useAuth();
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<string>('');
  const [district, setDistrict] = useState<string>('');
  const [landType, setLandType] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [dragOver, setDragOver] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setFiles(prev => [...prev, ...Array.from(event.target.files!)]);
      setError(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) {
      setFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
      setError(null);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const isValid = files.length > 0 && state.trim() && district.trim() && landType;

  const handleUpload = async () => {
    if (!isValid) {
      setError('Please fill State, District, and Land Type');
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const token = await user?.getIdToken();
      setUploadProgress(`Creating bundle with ${files.length} file${files.length > 1 ? 's' : ''}...`);
      await createBundle(files, state, district, landType, token);
      onUploadSuccess();
      setFiles([]);
      setState('');
      setDistrict('');
      setLandType('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to upload document');
    } finally {
      setUploading(false);
      setUploadProgress('');
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{ sx: { borderRadius: '20px', overflow: 'hidden' } }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, pt: 3, pb: 0.5 }}>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: '1.15rem', color: '#202124' }}>
            Create Document Pack
          </Typography>
          <Typography variant="caption" sx={{ color: '#80868b' }}>
            All files in one pack share the same location & land type
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small" sx={{ color: '#5f6368' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <DialogContent sx={{ px: 3, pb: 3 }}>
        {/* Step 1: Location */}
        <Typography variant="caption" sx={{ fontWeight: 600, color: '#5f6368', textTransform: 'uppercase', letterSpacing: 0.5, mb: 1, display: 'block' }}>
          Property Location
        </Typography>
        <Box sx={{ display: 'flex', gap: 1.5, mb: 2.5 }}>
          <Autocomplete
            freeSolo
            options={INDIAN_STATES}
            value={state}
            onInputChange={(_, val) => setState(val)}
            renderInput={(params) => (
              <TextField {...params} label="State / UT *" size="small" placeholder="e.g. Maharashtra"
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }} />
            )}
            sx={{ flex: 1 }}
          />
          <TextField
            label="District *"
            size="small"
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            placeholder="e.g. Pune"
            sx={{ flex: 1, '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
          />
        </Box>

        {/* Step 2: Land Type */}
        <Typography variant="caption" sx={{ fontWeight: 600, color: '#5f6368', textTransform: 'uppercase', letterSpacing: 0.5, mb: 1, display: 'block' }}>
          Type of Land *
        </Typography>
        <ToggleButtonGroup
          value={landType}
          exclusive
          onChange={(_, val) => { if (val) setLandType(val); }}
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

        {/* Step 3: Files */}
        <Typography variant="caption" sx={{ fontWeight: 600, color: '#5f6368', textTransform: 'uppercase', letterSpacing: 0.5, mb: 1, display: 'block' }}>
          Documents
        </Typography>
        <Box
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          sx={{
            border: `2px dashed ${dragOver ? '#1a73e8' : '#dadce0'}`,
            borderRadius: '14px', p: files.length > 0 ? 2 : 3.5, textAlign: 'center',
            bgcolor: dragOver ? '#e8f0fe' : '#fafafa',
            transition: 'all 0.2s ease',
            cursor: 'pointer',
          }}
        >
          <input
            type="file"
            accept=".pdf,image/*"
            multiple
            style={{ display: 'none' }}
            id="file-input"
            onChange={handleFileChange}
            disabled={uploading}
          />
          {files.length === 0 ? (
            <label htmlFor="file-input" style={{ cursor: 'pointer' }}>
              <CloudUploadIcon sx={{ fontSize: 36, color: '#9aa0a6', mb: 0.5 }} />
              <Typography sx={{ color: '#3c4043', fontWeight: 500, fontSize: '0.9rem' }}>
                Drop files here or click to browse
              </Typography>
              <Typography variant="caption" sx={{ color: '#80868b', mt: 0.5, display: 'block' }}>
                PDF or images · Sale deeds, mutation records, encumbrance certificates
              </Typography>
            </label>
          ) : (
            <Box>
              {files.map((f, i) => (
                <Box key={i} sx={{
                  display: 'flex', alignItems: 'center', gap: 1.5, py: 0.75, px: 1,
                  borderRadius: '8px', '&:hover': { bgcolor: '#f1f3f4' },
                }}>
                  <InsertDriveFileIcon sx={{ fontSize: 18, color: '#1a73e8' }} />
                  <Typography variant="body2" sx={{ flex: 1, color: '#202124', fontSize: '0.85rem' }} noWrap>
                    {f.name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#80868b' }}>
                    {(f.size / 1024 / 1024).toFixed(1)} MB
                  </Typography>
                  <IconButton size="small" onClick={() => removeFile(i)} sx={{ p: 0.25 }}>
                    <DeleteOutlineIcon sx={{ fontSize: 16, color: '#d93025' }} />
                  </IconButton>
                </Box>
              ))}
              <label htmlFor="file-input">
                <Button component="span" size="small" sx={{ mt: 1, textTransform: 'none', color: '#1a73e8', fontSize: '0.8rem' }}>
                  + Add more files
                </Button>
              </label>
            </Box>
          )}
        </Box>

        {/* Pack summary chip */}
        {(state || district || landType) && (
          <Box sx={{ display: 'flex', gap: 0.75, mt: 2, flexWrap: 'wrap' }}>
            {state && <Chip label={state} size="small" sx={{ fontSize: '0.75rem', bgcolor: '#e8f0fe', color: '#1a73e8' }} />}
            {district && <Chip label={district} size="small" sx={{ fontSize: '0.75rem', bgcolor: '#e8f0fe', color: '#1a73e8' }} />}
            {landType && <Chip label={landType} size="small" sx={{ fontSize: '0.75rem', bgcolor: '#fff3e0', color: '#e65100' }} />}
            {files.length > 0 && <Chip label={`${files.length} file${files.length > 1 ? 's' : ''}`} size="small" sx={{ fontSize: '0.75rem', bgcolor: '#e6f4ea', color: '#1e8e3e' }} />}
          </Box>
        )}

        {/* Progress */}
        {uploading && (
          <Box sx={{ mt: 2 }}>
            <LinearProgress sx={{ borderRadius: 4, height: 4 }} />
            <Typography variant="caption" sx={{ color: '#5f6368', mt: 0.5, display: 'block', textAlign: 'center' }}>
              {uploadProgress || 'Uploading...'}
            </Typography>
          </Box>
        )}

        {error && (
          <Typography variant="body2" sx={{ color: '#d93025', mt: 2, textAlign: 'center', fontSize: '0.85rem' }}>
            {error}
          </Typography>
        )}

        {/* Actions */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5, mt: 3 }}>
          <Button
            onClick={onClose}
            disabled={uploading}
            sx={{ borderRadius: '100px', textTransform: 'none', color: '#5f6368', px: 3 }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            variant="contained"
            disabled={!isValid || uploading}
            disableElevation
            sx={{
              borderRadius: '100px', textTransform: 'none', fontWeight: 600, px: 3,
              bgcolor: '#202124', '&:hover': { bgcolor: '#303134' },
              '&.Mui-disabled': { bgcolor: '#e8eaed', color: '#9aa0a6' },
            }}
          >
            Upload Pack{files.length > 1 ? ` (${files.length} files)` : ''}
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default UploadDocumentDialog;
