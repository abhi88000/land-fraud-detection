'use client';

import React from 'react';
import { Box } from '@mui/material';

interface LandshieldLogoProps {
  size?: number;
  animated?: boolean;
  showGlow?: boolean;
}

/**
 * Modern Landshield brand mark.
 * Gradient shield with a subtle inner highlight + animated sweep.
 */
const LandshieldLogo: React.FC<LandshieldLogoProps> = ({
  size = 32,
  animated = false,
  showGlow = false,
}) => {
  return (
    <Box
      sx={{
        position: 'relative',
        width: size,
        height: size,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        ...(showGlow && {
          filter: 'drop-shadow(0 4px 14px rgba(66, 133, 244, 0.35))',
        }),
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="ls-grad" x1="6" y1="4" x2="42" y2="46" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#5B8DEF" />
            <stop offset="55%" stopColor="#4285F4" />
            <stop offset="100%" stopColor="#7B61FF" />
          </linearGradient>
          <linearGradient id="ls-shine" x1="14" y1="6" x2="24" y2="24" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Outer shield with rounded corners */}
        <path
          d="M24 3.5L8 9v13c0 9.4 6.7 18 16 22.5 9.3-4.5 16-13.1 16-22.5V9L24 3.5z"
          fill="url(#ls-grad)"
        />

        {/* Inner highlight */}
        <path
          d="M24 3.5L8 9v13c0 9.4 6.7 18 16 22.5 9.3-4.5 16-13.1 16-22.5V9L24 3.5z"
          fill="url(#ls-shine)"
        />

        {/* Subtle inner ring */}
        <path
          d="M24 7L11.5 11.4v10.6c0 7.8 5.4 14.9 12.5 18.6 7.1-3.7 12.5-10.8 12.5-18.6V11.4L24 7z"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="1"
          fill="none"
        />

        {/* Stylised "L" + check monogram */}
        <path
          d="M19 17v12h10"
          stroke="white"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <path
          d="M22.5 24.5l3.2 3.2 6.3-7"
          stroke="#A8FFC8"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        {animated && (
          <>
            {/* Sweeping highlight */}
            <rect x="-20" y="0" width="14" height="48" fill="url(#ls-shine)" opacity="0.65">
              <animate
                attributeName="x"
                from="-20"
                to="60"
                dur="2.6s"
                repeatCount="indefinite"
              />
            </rect>
          </>
        )}
      </svg>
    </Box>
  );
};

export default LandshieldLogo;
