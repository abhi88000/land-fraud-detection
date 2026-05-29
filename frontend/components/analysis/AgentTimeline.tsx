"use client";

import * as React from 'react';
import { useEffect, useRef } from 'react';
import { Box, Typography } from '@mui/material';
import { AnalysisProgressEvent } from '@/lib/types';

interface AgentTimelineProps {
  events: AnalysisProgressEvent[];
  active: boolean;
}

interface AgentStyle {
  label: string;
  color: string;
  bg: string;
}

const AGENT_STYLES: Record<string, AgentStyle> = {
  Orchestrator: { label: 'Orchestrator', color: '#5f6368', bg: '#f1f3f4' },
  Parser:       { label: 'Parser',       color: '#1a73e8', bg: '#e8f0fe' },
  Legal:        { label: 'Legal',        color: '#1e8e3e', bg: '#e6f4ea' },
  Fraud:        { label: 'Risk',         color: '#d93025', bg: '#fce8e6' },
  Reporter:     { label: 'Reporter',     color: '#b8860b', bg: '#fef7e0' },
};

const DEFAULT_STYLE: AgentStyle = { label: 'System', color: '#5f6368', bg: '#f1f3f4' };

function getAgent(event: AnalysisProgressEvent): AgentStyle {
  const name = (event.data as any)?.agent as string | undefined;
  if (name && AGENT_STYLES[name]) return AGENT_STYLES[name];
  // Fallback by event_type heuristic
  const t = event.event_type || '';
  if (t.includes('pars')) return AGENT_STYLES.Parser;
  if (t.includes('legal')) return AGENT_STYLES.Legal;
  if (t.includes('fraud')) return AGENT_STYLES.Fraud;
  if (t.includes('report')) return AGENT_STYLES.Reporter;
  return DEFAULT_STYLE;
}

export default function AgentTimeline({ events, active }: AgentTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Filter to "thought-style" events: drop the connected/heartbeat noise but keep meaningful steps.
  const visible = events.filter(e =>
    e.event_type !== 'connected' &&
    e.event_type !== 'progress_update' &&
    !!e.message
  );

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [visible.length]);

  return (
    <Box
      sx={{
        borderRadius: '14px',
        bgcolor: '#fafbfc',
        border: '1px solid #e8eaed',
        overflow: 'hidden',
      }}
    >
      {/* Header bar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1.25,
          borderBottom: '1px solid #e8eaed',
          bgcolor: '#fff',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#3c4043', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Agent activity
          </Typography>
          {active && (
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
              <Box
                sx={{
                  width: 6, height: 6, borderRadius: '50%', bgcolor: '#1a73e8',
                  animation: 'pulseDot 1.2s ease-in-out infinite',
                  '@keyframes pulseDot': {
                    '0%, 100%': { opacity: 0.35, transform: 'scale(0.85)' },
                    '50%':       { opacity: 1,    transform: 'scale(1.15)' },
                  },
                }}
              />
              <Typography sx={{ fontSize: '0.7rem', color: '#1a73e8', fontWeight: 500 }}>thinking</Typography>
            </Box>
          )}
        </Box>
        <Typography sx={{ fontSize: '0.7rem', color: '#80868b' }}>
          {visible.length} step{visible.length !== 1 ? 's' : ''}
        </Typography>
      </Box>

      {/* Scroll body */}
      <Box
        ref={scrollRef}
        sx={{
          maxHeight: 320,
          overflowY: 'auto',
          px: 2, py: 1.5,
          scrollBehavior: 'smooth',
          '&::-webkit-scrollbar': { width: 6 },
          '&::-webkit-scrollbar-thumb': { bgcolor: '#dadce0', borderRadius: 3 },
        }}
      >
        {visible.length === 0 ? (
          <Typography sx={{ fontSize: '0.8rem', color: '#80868b', textAlign: 'center', py: 2 }}>
            Waiting for the first signal from the agents…
          </Typography>
        ) : (
          visible.map((event, i) => {
            const agent = getAgent(event);
            const isFailure = event.event_type?.includes('failed');
            const isCompletion = event.event_type === 'analysis_completed';
            return (
              <Box
                key={`${event.timestamp || i}-${i}`}
                sx={{
                  display: 'flex',
                  gap: 1.25,
                  py: 0.9,
                  position: 'relative',
                  animation: 'fadeSlideIn 0.32s ease-out',
                  '@keyframes fadeSlideIn': {
                    '0%':   { opacity: 0, transform: 'translateY(4px)' },
                    '100%': { opacity: 1, transform: 'translateY(0)' },
                  },
                }}
              >
                {/* Vertical line connector */}
                {i < visible.length - 1 && (
                  <Box sx={{
                    position: 'absolute', left: 13, top: 32, bottom: -6,
                    width: 1, bgcolor: '#e8eaed',
                  }} />
                )}
                {/* Avatar bubble */}
                <Box
                  sx={{
                    width: 28, height: 28, borderRadius: '50%',
                    bgcolor: isFailure ? '#fce8e6' : isCompletion ? '#e6f4ea' : agent.bg,
                    color: isFailure ? '#d93025' : isCompletion ? '#1e8e3e' : agent.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    border: `1.5px solid ${isFailure ? '#fce8e6' : isCompletion ? '#e6f4ea' : agent.bg}`,
                    zIndex: 1,
                  }}
                >
                  {(isFailure ? 'X' : isCompletion ? 'OK' : agent.label.charAt(0))}
                </Box>
                {/* Content */}
                <Box sx={{ flex: 1, minWidth: 0, pt: 0.1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, mb: 0.15 }}>
                    <Typography sx={{
                      fontSize: '0.7rem', fontWeight: 600,
                      color: isFailure ? '#d93025' : isCompletion ? '#1e8e3e' : agent.color,
                      letterSpacing: '0.02em',
                    }}>
                      {isFailure ? 'Failure' : isCompletion ? 'Complete' : agent.label}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: '0.8rem', color: '#3c4043', lineHeight: 1.45 }}>
                    {event.message}
                  </Typography>
                </Box>
              </Box>
            );
          })
        )}
      </Box>
    </Box>
  );
}
