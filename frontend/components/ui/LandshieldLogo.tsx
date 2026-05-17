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
          <linearGradient id="ls-shield" x1="6" y1="3" x2="34" y2="37" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1F2A44" />
            <stop offset="100%" stopColor="#2E3F66" />
          </linearGradient>
          <linearGradient id="ls-stroke" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#4285F4" />
            <stop offset="100%" stopColor="#7B61FF" />
          </linearGradient>
        </defs>

        {/* Shield silhouette — clean charcoal-indigo, no garish blue */}
        <path
          d="M20 3.5 L33 7.5 V20 C33 28.2 27.4 33.8 20 36.5 C12.6 33.8 7 28.2 7 20 V7.5 Z"
          fill="url(#ls-shield)"
        />
        {/* Subtle gradient outline */}
        <path
          d="M20 3.5 L33 7.5 V20 C33 28.2 27.4 33.8 20 36.5 C12.6 33.8 7 28.2 7 20 V7.5 Z"
          fill="none"
          stroke="url(#ls-stroke)"
          strokeWidth="1.1"
          strokeLinejoin="round"
        />

        {/* Monogram "L" — clean serif-less, in white */}
        <path
          d="M16.2 13.5 V25.4 H25.2"
          stroke="#ffffff"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        {/* Small green verification dot — corner accent */}
        <circle cx="29" cy="11" r="3.2" fill="#1e8e3e" stroke="#ffffff" strokeWidth="1" />
        <path
          d="M27.6 11 L28.6 12 L30.4 10.1"
          stroke="#ffffff"
          strokeWidth="1.1"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        {animated && (
          <path
            d="M20 3.5 L33 7.5 V20 C33 28.2 27.4 33.8 20 36.5 C12.6 33.8 7 28.2 7 20 V7.5 Z"
            fill="none"
            stroke="url(#ls-stroke)"
            strokeWidth="1.4"
            strokeLinejoin="round"
            opacity="0.6"
          >
            <animate
              attributeName="opacity"
              values="0;0.7;0"
              dur="2.2s"
              repeatCount="indefinite"
            />
          </path>
        )}
      </svg>
    </Box>
  );
};

export default LandshieldLogo;
