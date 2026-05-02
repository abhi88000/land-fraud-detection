'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  LinearProgress,
  TextField,
  Autocomplete,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { uploadDocument } from '@/lib/api';
import { useAuth } from '@/lib/firebase/auth';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Chandigarh', 'Puducherry',
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

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setFiles(Array.from(event.target.files));
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    setUploading(true);
    setError(null);
    try {
      const token = await user?.getIdToken();
      for (let i = 0; i < files.length; i++) {
        setUploadProgress(`Uploading ${i + 1} of ${files.length}: ${files[i].name}`);
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
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Upload Land Documents</DialogTitle>
      <DialogContent>
        {/* State & District */}
        <Box sx={{ display: 'flex', gap: 2, mt: 2, mb: 2 }}>
          <Autocomplete
            freeSolo
            options={INDIAN_STATES}
            value={state}
            onInputChange={(_, val) => setState(val)}
            renderInput={(params) => (
              <TextField {...params} label="State" size="small" placeholder="e.g. Maharashtra" />
            )}
            sx={{ flex: 1 }}
          />
          <TextField
            label="District"
            size="small"
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            placeholder="e.g. Pune"
            sx={{ flex: 1 }}
          />
        </Box>

        <Box
          sx={{
            border: '2px dashed #ccc',
            borderRadius: 2,
            p: 4,
            textAlign: 'center',
            bgcolor: 'background.default',
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
          <label htmlFor="file-input">
            <Box sx={{ cursor: 'pointer' }}>
              <CloudUploadIcon sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
              <Typography variant="h6">
                {files.length > 0
                  ? `${files.length} file(s) selected`
                  : 'Click to select files (multiple allowed)'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Supports PDF and Image files (Hindi, English, etc.)
              </Typography>
              {files.length > 0 && (
                <Box sx={{ mt: 1 }}>
                  {files.map((f, i) => (
                    <Typography key={i} variant="caption" display="block" color="text.secondary">
                      {f.name}
                    </Typography>
                  ))}
                </Box>
              )}
            </Box>
          </label>
        </Box>

        {uploading && (
          <Box sx={{ width: '100%', mt: 3 }}>
            <LinearProgress />
            <Typography variant="body2" sx={{ textAlign: 'center', mt: 1 }}>
              {uploadProgress || 'Uploading...'}
            </Typography>
          </Box>
        )}

        {error && (
          <Typography variant="body2" color="error" sx={{ mt: 2, textAlign: 'center' }}>
            {error}
          </Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 3 }}>
        <Button onClick={onClose} disabled={uploading}>
          Cancel
        </Button>
        <Button
          onClick={handleUpload}
          variant="contained"
          disabled={files.length === 0 || uploading}
        >
          Upload {files.length > 1 ? `${files.length} Files` : 'File'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default UploadDocumentDialog;
    </Dialog>
  );
};

export default UploadDocumentDialog;
