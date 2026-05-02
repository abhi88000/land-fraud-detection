'use client';

import React, { useState, useEffect } from 'react';
import { Box, Typography, Alert } from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';

interface DocumentViewerProps {
  gcsPath: string;
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({ gcsPath }) => {
  const fileName = gcsPath.split('/').pop() || 'document';

  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 3, gap: 2 }}>
      <DescriptionIcon sx={{ fontSize: 64, color: 'primary.main', opacity: 0.6 }} />
      <Typography variant="h6" color="text.secondary" textAlign="center">
        {fileName}
      </Typography>
      <Typography variant="body2" color="text.secondary" textAlign="center">
        Document stored securely in cloud storage.
      </Typography>
    </Box>
  );
};

export default DocumentViewer;
