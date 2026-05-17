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
          'radial-gradient(900px 500px at 50% -10%, #eaf1ff 0%, transparent 60%), linear-gradient(180deg, #ffffff 0%, #f6f8fc 100%)',
        '@keyframes ls-breathe': {
          '0%, 100%': { transform: 'scale(1)', opacity: 1 },
          '50%': { transform: 'scale(1.04)', opacity: 0.94 },
        },
        '@keyframes ls-halo': {
          '0%, 100%': { opacity: 0.35, transform: 'scale(1)' },
          '50%': { opacity: 0.7, transform: 'scale(1.12)' },
        },
        '@keyframes ls-bar': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        '@keyframes ls-fade': {
          '0%, 100%': { opacity: 0.55 },
          '50%': { opacity: 1 },
        },
      }}
    >
      {/* Logo with soft glow halo (no rotation) */}
      <Box sx={{ position: 'relative', mb: 3.5 }}>
        {/* Soft halo */}
        <Box
          sx={{
            position: 'absolute',
            inset: -18,
            borderRadius: '24px',
            background:
              'radial-gradient(closest-side, rgba(66,133,244,0.35), rgba(123,97,255,0.18) 60%, transparent 75%)',
            filter: 'blur(8px)',
            animation: 'ls-halo 2.4s ease-in-out infinite',
          }}
        />
        <Box
          sx={{
            position: 'relative',
            animation: 'ls-breathe 2.4s ease-in-out infinite',
          }}
        >
          <LandshieldLogo size={56} showGlow />
        </Box>
      </Box>

      {/* Wordmark */}
      <Typography
        sx={{
          fontSize: '1.35rem',
          fontWeight: 700,
          letterSpacing: '-0.5px',
          color: '#202124',
        }}
      >
        Landshield
      </Typography>
      <Typography
        variant="caption"
        sx={{
          color: '#5f6368',
          mt: 0.5,
          fontSize: '0.76rem',
          letterSpacing: '0.4px',
          textTransform: 'uppercase',
          animation: 'ls-fade 1.8s ease-in-out infinite',
        }}
      >
        Securing your land records
      </Typography>

      {/* Slim shimmer bar */}
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
