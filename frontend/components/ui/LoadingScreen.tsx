'use client';

import React from 'react';
import { Box, Typography } from '@mui/material';
import ShieldIcon from '@mui/icons-material/Shield';

const LoadingScreen = () => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        width: '100vw',
        bgcolor: '#f8f9fa',
      }}
    >
      {/* Animated shield spinner */}
      <Box sx={{ position: 'relative', display: 'inline-flex', mb: 3 }}>
        <Box
          sx={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            border: '3px solid #e8f0fe',
            borderTopColor: '#4285F4',
            animation: 'spin 1s linear infinite',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ShieldIcon sx={{ fontSize: 32, color: '#4285F4' }} />
        </Box>
      </Box>
      <Typography variant="h6" sx={{ color: '#202124', fontWeight: 600 }}>
        Landshield
      </Typography>
      <Typography variant="body2" sx={{ color: '#5f6368', mt: 0.5, animation: 'pulse 2s ease-in-out infinite' }}>
        Loading...
      </Typography>
    </Box>
  );
};

export default LoadingScreen;
