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
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CloseIcon from '@mui/icons-material/Close';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import { uploadDocument } from '@/lib/api';
import { useAuth } from '@/lib/firebase/auth';

const INDIAN_STATES = [
  // States
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  // Union Territories
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
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
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [dragOver, setDragOver] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setFiles(Array.from(event.target.files));
      setError(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) {
      setFiles(Array.from(e.dataTransfer.files));
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    if (!state.trim() || !district.trim()) {
      setError('State and District are required for accurate analysis');
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const token = await user?.getIdToken();
      for (let i = 0; i < files.length; i++) {
        setUploadProgress(`Uploading ${i + 1} of ${files.length}...`);
        await uploadDocument(files[i], token, state, district);
      }
      onUploadSuccess();
      setFiles([]);
      setState('');
      setDistrict('');
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
      PaperProps={{ sx: { borderRadius: '16px', overflow: 'hidden' } }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, pt: 2.5, pb: 1 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', color: '#202124' }}>
          Upload Documents
        </Typography>
        <IconButton onClick={onClose} size="small" sx={{ color: '#5f6368' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <DialogContent sx={{ px: 3, pb: 3 }}>
        {/* Location inputs */}
        <Box sx={{ display: 'flex', gap: 1.5, mb: 2.5 }}>
          <Autocomplete
            freeSolo
            options={INDIAN_STATES}
            value={state}
            onInputChange={(_, val) => setState(val)}
            renderInput={(params) => (
              <TextField {...params} label="State *" size="small" placeholder="e.g. Maharashtra"
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

        {/* Drop zone */}
        <Box
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          sx={{
            border: `2px dashed ${dragOver ? '#1a73e8' : '#dadce0'}`,
            borderRadius: '16px', p: 4, textAlign: 'center',
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
          <label htmlFor="file-input" style={{ cursor: 'pointer' }}>
            {files.length === 0 ? (
              <>
                <CloudUploadIcon sx={{ fontSize: 40, color: '#9aa0a6', mb: 1 }} />
                <Typography sx={{ color: '#3c4043', fontWeight: 500, fontSize: '0.95rem' }}>
                  Drop files here or click to browse
                </Typography>
                <Typography variant="caption" sx={{ color: '#80868b', mt: 0.5, display: 'block' }}>
                  PDF or images · Hindi, English & regional languages
                </Typography>
              </>
            ) : (
              <Box>
                <Typography sx={{ color: '#202124', fontWeight: 600, mb: 1 }}>
                  {files.length} file{files.length > 1 ? 's' : ''} selected
                </Typography>
                {files.map((f, i) => (
                  <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'center', mb: 0.5 }}>
                    <InsertDriveFileIcon sx={{ fontSize: 14, color: '#1a73e8' }} />
                    <Typography variant="caption" sx={{ color: '#5f6368' }}>{f.name}</Typography>
                  </Box>
                ))}
              </Box>
            )}
          </label>
        </Box>

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
            disabled={files.length === 0 || uploading || !state.trim() || !district.trim()}
            disableElevation
            sx={{
              borderRadius: '100px', textTransform: 'none', fontWeight: 600, px: 3,
              bgcolor: '#202124', '&:hover': { bgcolor: '#303134' },
              '&.Mui-disabled': { bgcolor: '#e8eaed', color: '#9aa0a6' },
            }}
          >
            Upload {files.length > 1 ? `${files.length} Files` : 'File'}
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default UploadDocumentDialog;
