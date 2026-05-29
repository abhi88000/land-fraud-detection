"use client";

import * as React from 'react';
import { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { AnalysisReport } from '@/lib/types';

interface VerdictRevealProps {
  report: AnalysisReport;
}

function verdictFor(score: number) {
  if (score >= 80) return { label: 'Looks Clear', tone: '#1e8e3e', tint: '#e6f4ea', advice: 'No major concerns surfaced. Verify the highlighted items below before proceeding.' };
  if (score >= 60) return { label: 'Mostly Fine',  tone: '#1a73e8', tint: '#e8f0fe', advice: 'A few things to double-check. Review the findings before signing or paying.' };
  if (score >= 40) return { label: 'Caution',      tone: '#b8860b', tint: '#fef7e0', advice: 'Several items need verification. Consider consulting a property lawyer.' };
  return                  { label: 'High Risk',    tone: '#d93025', tint: '#fce8e6', advice: 'Significant concerns detected. Strongly recommend an in-person lawyer review and sub-registrar visit.' };
}

export default function VerdictReveal({ report }: VerdictRevealProps) {
  const targetScore = Math.max(0, Math.min(100, Math.round(report.risk_score?.overall_score ?? 0)));
  const [displayScore, setDisplayScore] = useState(0);
  const [mounted, setMounted] = useState(false);

  // Count-up animation
  useEffect(() => {
    setMounted(true);
    const duration = 1100; // ms
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayScore(Math.round(eased * targetScore));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [targetScore]);

  const verdict = verdictFor(targetScore);

  // SVG arc geometry
  const size = 168;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  // Show 75% arc (from 7 o'clock to 5 o'clock)
  const arcFraction = 0.78;
  const visibleLen = circumference * arcFraction;
  const dashOffset = visibleLen - (visibleLen * displayScore / 100);

  const legalScore = report.risk_score?.category_scores?.legal_compliance ?? 0;
  const fraudScore = report.risk_score?.category_scores?.fraud_detection ?? 0;
  const completenessScore = report.risk_score?.category_scores?.data_completeness ?? 0;

  const issuesCount =
    (report.legal_findings?.filter(f => !f.is_compliant).length ?? 0) +
    (report.fraud_findings?.filter(f => f.is_suspicious).length ?? 0);

  return (
    <Box
      sx={{
        borderRadius: '20px',
        p: { xs: 3, sm: 4 },
        mb: 3,
        background: `linear-gradient(135deg, ${verdict.tint} 0%, #ffffff 70%)`,
        border: `1px solid ${verdict.tint}`,
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity 0.5s ease, transform 0.5s ease',
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: 'center', gap: { xs: 2, sm: 4 } }}>
        {/* Gauge */}
        <Box sx={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
          <svg width={size} height={size} style={{ transform: 'rotate(130deg)' }}>
            {/* Track */}
            <circle
              cx={cx} cy={cy} r={r}
              stroke="#e8eaed"
              strokeWidth={stroke}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${visibleLen} ${circumference}`}
            />
            {/* Progress */}
            <circle
              cx={cx} cy={cy} r={r}
              stroke={verdict.tone}
              strokeWidth={stroke}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${visibleLen} ${circumference}`}
              strokeDashoffset={dashOffset}
              style={{ transition: 'stroke-dashoffset 0.05s linear' }}
            />
          </svg>
          {/* Center label */}
          <Box sx={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}>
            <Typography sx={{ fontSize: '2.6rem', fontWeight: 700, color: '#202124', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {displayScore}
            </Typography>
            <Typography sx={{ fontSize: '0.65rem', color: '#80868b', mt: 0.5, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Trust Score
            </Typography>
          </Box>
        </Box>

        {/* Right side */}
        <Box sx={{ flex: 1, minWidth: 0, textAlign: { xs: 'center', sm: 'left' } }}>
          <Box sx={{
            display: 'inline-flex', alignItems: 'center', gap: 0.75,
            px: 1.25, py: 0.5, borderRadius: '100px',
            bgcolor: '#fff', border: `1px solid ${verdict.tone}33`,
            mb: 1.25,
          }}>
            <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: verdict.tone }} />
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: verdict.tone, letterSpacing: '0.04em' }}>
              {verdict.label.toUpperCase()}
            </Typography>
          </Box>
          <Typography sx={{ fontSize: '1.05rem', fontWeight: 600, color: '#202124', mb: 0.75, lineHeight: 1.35 }}>
            {issuesCount === 0
              ? 'No major concerns surfaced in this bundle.'
              : `${issuesCount} item${issuesCount !== 1 ? 's' : ''} worth verifying before you proceed.`}
          </Typography>
          <Typography sx={{ fontSize: '0.85rem', color: '#5f6368', lineHeight: 1.55 }}>
            {verdict.advice}
          </Typography>
        </Box>
      </Box>

      {/* Category breakdown */}
      <Box sx={{
        mt: 3, pt: 2.5, borderTop: '1px solid #e8eaed',
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
        gap: 2,
      }}>
        <CategoryBar label="Legal Compliance" value={legalScore} delay={200} />
        <CategoryBar label="Risk indicators"  value={fraudScore} delay={350} />
        <CategoryBar label="Data Completeness" value={completenessScore} delay={500} />
      </Box>
    </Box>
  );
}

function CategoryBar({ label, value, delay }: { label: string; value: number; delay: number }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const id = setTimeout(() => setW(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  const color = value >= 70 ? '#1e8e3e' : value >= 50 ? '#1a73e8' : value >= 30 ? '#b8860b' : '#d93025';

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.6 }}>
        <Typography sx={{ fontSize: '0.72rem', color: '#5f6368', fontWeight: 500 }}>{label}</Typography>
        <Typography sx={{ fontSize: '0.72rem', color: '#3c4043', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{value}</Typography>
      </Box>
      <Box sx={{ height: 6, borderRadius: 3, bgcolor: '#e8eaed', overflow: 'hidden' }}>
        <Box sx={{
          width: `${w}%`, height: '100%', bgcolor: color,
          borderRadius: 3,
          transition: 'width 0.9s cubic-bezier(0.22, 1, 0.36, 1)',
        }} />
      </Box>
    </Box>
  );
}
