'use client';

import React, { useState } from 'react';
import { Box, Typography, CircularProgress, Alert } from '@mui/material';

interface DocumentViewerProps {
  gcsPath: string;
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({ gcsPath }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const isPdf = gcsPath.toLowerCase().endsWith('.pdf');
  const isImage = /\.(jpg|jpeg|png|tiff|tif)$/i.test(gcsPath);

  // In production, this would be a signed URL from your backend
  const fileName = gcsPath.split('/').pop() || 'document';

  if (!isPdf && !isImage) {
    return (
      <Alert severity="warning">
        Unsupported document format. Cannot preview this file.
      </Alert>
    );
  }

  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 2 }}>
      {loading && (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
          <CircularProgress size={40} />
          <Typography variant="body2" color="text.secondary">Loading document...</Typography>
        </Box>
      )}

      {error && (
        <Alert severity="info" sx={{ width: '100%' }}>
          Document preview is not available. The document is stored at: <strong>{fileName}</strong>
          <Typography variant="caption" display="block" sx={{ mt: 1 }}>
            To view documents, a signed URL endpoint needs to be configured on the backend.
          </Typography>
        </Alert>
      )}

      {isPdf && !error && (
        <Box
          component="iframe"
          src={gcsPath}
          sx={{ width: '100%', height: '100%', border: 'none', display: loading ? 'none' : 'block' }}
          onLoad={() => setLoading(false)}
          onError={() => { setLoading(false); setError('Failed to load PDF'); }}
          title="Document Preview"
        />
      )}

      {isImage && !error && (
        <Box
          component="img"
          src={gcsPath}
          alt="Document Preview"
          sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: loading ? 'none' : 'block' }}
          onLoad={() => setLoading(false)}
          onError={() => { setLoading(false); setError('Failed to load image'); }}
        />
      )}
    </Box>
  );
};

export default DocumentViewer;
