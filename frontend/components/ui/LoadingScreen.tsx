'use client';

import React from 'react';
import { Box, Typography } from '@mui/material';
import LandshieldLogo from './LandshieldLogo';

const LoadingScreen = () => {
  return (
    <Box
      sx={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        background:
          'radial-gradient(1200px 600px at 50% -10%, #eaf1ff 0%, transparent 60%), linear-gradient(180deg, #ffffff 0%, #f6f8fc 100%)',
        '@keyframes ls-spin': {
          to: { transform: 'rotate(360deg)' },
        },
        '@keyframes ls-float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        '@keyframes ls-pulse': {
          '0%, 100%': { opacity: 0.55 },
          '50%': { opacity: 1 },
        },
        '@keyframes ls-bar': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
      }}
    >
      {/* Logo + ring */}
      <Box sx={{ position: 'relative', display: 'inline-flex', mb: 3.5 }}>
        {/* outer rotating gradient ring */}
        <Box
          sx={{
            width: 104,
            height: 104,
            borderRadius: '50%',
            background:
              'conic-gradient(from 0deg, #4285F4, #7B61FF, #4285F4 50%, transparent 50%, transparent 100%)',
            animation: 'ls-spin 1.6s linear infinite',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Box
            sx={{
              width: 92,
              height: 92,
              borderRadius: '50%',
              bgcolor: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 10px 30px rgba(66, 133, 244, 0.18)',
            }}
          >
            <Box sx={{ animation: 'ls-float 3s ease-in-out infinite' }}>
              <LandshieldLogo size={52} animated showGlow />
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Wordmark */}
      <Typography
        sx={{
          fontSize: '1.4rem',
          fontWeight: 700,
          letterSpacing: '-0.5px',
          background: 'linear-gradient(90deg, #1a73e8, #7B61FF)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      >
        Landshield
      </Typography>
      <Typography
        variant="caption"
        sx={{
          color: '#5f6368',
          mt: 0.5,
          fontSize: '0.78rem',
          letterSpacing: '0.5px',
          textTransform: 'uppercase',
          animation: 'ls-pulse 1.8s ease-in-out infinite',
        }}
      >
        Securing your land records
      </Typography>

      {/* Slim progress shimmer */}
      <Box
        sx={{
          mt: 3,
          width: 180,
          height: 3,
          borderRadius: 999,
          bgcolor: '#e6ecf7',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(90deg, transparent, #4285F4, #7B61FF, transparent)',
            animation: 'ls-bar 1.6s ease-in-out infinite',
          }}
        />
      </Box>
    </Box>
  );
};

export default LoadingScreen;
