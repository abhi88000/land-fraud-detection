'use client';

import React from 'react';
import { Box } from '@mui/material';

interface LandshieldLogoProps {
  size?: number;
  animated?: boolean;
  showGlow?: boolean;
}

/**
 * Landshield brand mark — clean rounded-square tile with a bold checkmark.
 * Modern fintech/productivity style (Linear / Stripe / Vercel inspired).
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
          filter: 'drop-shadow(0 6px 16px rgba(66,133,244,0.28))',
        }),
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="ls-tile" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#5B8DEF" />
            <stop offset="55%" stopColor="#4285F4" />
            <stop offset="100%" stopColor="#6A4FE0" />
          </linearGradient>
          <linearGradient id="ls-tile-hi" x1="0" y1="0" x2="0" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.30" />
            <stop offset="55%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Rounded square tile */}
        <rect x="0" y="0" width="40" height="40" rx="10" fill="url(#ls-tile)" />
        {/* Top highlight */}
        <rect x="0" y="0" width="40" height="40" rx="10" fill="url(#ls-tile-hi)" />

        {/* Bold checkmark */}
        <path
          d="M11 20.5 L17.2 26.5 L29 14.5"
          stroke="white"
          strokeWidth="3.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        {/* Optional subtle pulse */}
        {animated && (
          <rect
            x="0"
            y="0"
            width="40"
            height="40"
            rx="10"
            fill="none"
            stroke="rgba(255,255,255,0.35)"
            strokeWidth="1"
          >
            <animate
              attributeName="opacity"
              values="0;0.6;0"
              dur="2.2s"
              repeatCount="indefinite"
            />
          </rect>
        )}
      </svg>
    </Box>
  );
};

export default LandshieldLogo;
