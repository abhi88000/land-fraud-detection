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
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { uploadDocument } from '@/lib/api';
import { Document } from '@/lib/types';
import { useAuth } from '@/lib/firebase/auth';

interface UploadDocumentDialogProps {
  open: boolean;
  onClose: () => void;
  onUploadSuccess: (newDoc: Document) => void;
}

const UploadDocumentDialog: React.FC<UploadDocumentDialogProps> = ({
  open,
  onClose,
  onUploadSuccess,
}) => {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setFile(event.target.files[0]);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const token = await user?.getIdToken();
      const newDoc = await uploadDocument(file, token);
      onUploadSuccess(newDoc);
      setFile(null);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Upload Land Document</DialogTitle>
      <DialogContent>
        <Box
          sx={{
            border: '2px dashed #ccc',
            borderRadius: 2,
            p: 4,
            textAlign: 'center',
            mt: 2,
            bgcolor: 'background.default',
          }}
        >
          <input
            type="file"
            accept=".pdf,image/*"
            style={{ display: 'none' }}
            id="file-input"
            onChange={handleFileChange}
            disabled={uploading}
          />
          <label htmlFor="file-input">
            <Box sx={{ cursor: 'pointer' }}>
              <CloudUploadIcon sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
              <Typography variant="h6">
                {file ? file.name : 'Click to select or drag and drop'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Supports PDF and Image files (Hindi, English, etc.)
              </Typography>
            </Box>
          </label>
        </Box>

        {uploading && (
          <Box sx={{ width: '100%', mt: 3 }}>
            <LinearProgress />
            <Typography variant="body2" sx={{ textAlign: 'center', mt: 1 }}>
              Uploading and initializing analysis...
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
          disabled={!file || uploading}
        >
          Upload & Analyze
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default UploadDocumentDialog;
