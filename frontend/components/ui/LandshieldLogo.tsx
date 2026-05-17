'use client';

import React from 'react';
import { Box } from '@mui/material';

interface LandshieldLogoProps {
  size?: number;
  animated?: boolean;
  showGlow?: boolean;
}

/**
 * Landshield brand mark — a verified document.
 * Rounded gradient tile holding a stylised document with a corner fold
 * and a check seal, tying the visual to land-paperwork verification.
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
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.28" />
            <stop offset="55%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="ls-paper" x1="0" y1="8" x2="0" y2="34" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#eef3fb" />
          </linearGradient>
        </defs>

        {/* Rounded square tile */}
        <rect x="0" y="0" width="40" height="40" rx="10" fill="url(#ls-tile)" />
        <rect x="0" y="0" width="40" height="40" rx="10" fill="url(#ls-tile-hi)" />

        {/* Document with corner fold */}
        <path
          d="M11.5 9.5 H23 L28.5 15 V29 a2 2 0 0 1 -2 2 H11.5 a2 2 0 0 1 -2 -2 V11.5 a2 2 0 0 1 2 -2 z"
          fill="url(#ls-paper)"
        />
        {/* Folded corner */}
        <path
          d="M23 9.5 V13 a2 2 0 0 0 2 2 H28.5 Z"
          fill="#cdd9ef"
        />
        <path
          d="M23 9.5 V13 a2 2 0 0 0 2 2 H28.5"
          stroke="#9fb4d8"
          strokeWidth="0.6"
          fill="none"
          strokeLinejoin="round"
        />

        {/* Text lines on document */}
        <rect x="12.8" y="19" width="9" height="1.4" rx="0.7" fill="#c7d2e8" />
        <rect x="12.8" y="22.3" width="12" height="1.4" rx="0.7" fill="#c7d2e8" />

        {/* Check seal */}
        <circle cx="24" cy="26" r="5.2" fill="#1e8e3e" />
        <circle cx="24" cy="26" r="5.2" fill="none" stroke="white" strokeWidth="0.7" opacity="0.55" />
        <path
          d="M21.6 26.2 L23.4 28 L26.6 24.4"
          stroke="white"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

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
