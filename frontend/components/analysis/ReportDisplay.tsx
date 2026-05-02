'use client';

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Chip,
  Divider,
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Collapse,
  IconButton,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import WarningIcon from '@mui/icons-material/Warning';
import GavelIcon from '@mui/icons-material/Gavel';
import SecurityIcon from '@mui/icons-material/Security';
import AssignmentIcon from '@mui/icons-material/Assignment';
import { AnalysisReport, LegalFinding, FraudFinding, VerificationChecklistItem } from '@/lib/types';

interface ReportDisplayProps {
  report: AnalysisReport;
}

const getSeverityColor = (severity: string): 'error' | 'warning' | 'info' | 'success' => {
  switch (severity) {
    case 'critical': return 'error';
    case 'high': return 'error';
    case 'medium': return 'warning';
    case 'low': return 'info';
    default: return 'info';
  }
};

const getSeverityBg = (severity: string): string => {
  switch (severity) {
    case 'critical': return '#fce8e6';
    case 'high': return '#fce8e6';
    case 'medium': return '#fef7e0';
    case 'low': return '#e8f0fe';
    default: return '#f1f3f4';
  }
};

const getSeverityTextColor = (severity: string): string => {
  switch (severity) {
    case 'critical': case 'high': return '#d93025';
    case 'medium': return '#e37400';
    case 'low': return '#1a73e8';
    default: return '#5f6368';
  }
};

const getRiskLabel = (score: number): { label: string; color: 'error' | 'warning' | 'success' } => {
  if (score >= 70) return { label: 'High Risk', color: 'error' };
  if (score >= 40) return { label: 'Medium Risk', color: 'warning' };
  return { label: 'Low Risk', color: 'success' };
};

// Category grouping for findings
const FINDING_CATEGORIES: Record<string, string[]> = {
  'Pricing & Valuation': ['price', 'valuation', 'overpriced', 'undervalued', 'market value', 'circle rate', 'stamp duty', 'consideration'],
  'Identity & Ownership': ['benami', 'identity', 'impersonation', 'ownership', 'title', 'age', 'student', 'occupation'],
  'Document Authenticity': ['forged', 'fabricated', 'tampered', 'signature', 'registration', 'unregistered', 'stamp paper'],
  'Land Use & Restrictions': ['tribal', 'agricultural', 'conversion', 'scheduled tribe', 'government land', 'roshni', 'forest', 'ceiling'],
  'Legal Compliance': ['compliance', 'act', 'section', 'regulation', 'mandatory', 'required', 'violation'],
};

function categorizeFinding(description: string): string {
  const lower = description.toLowerCase();
  for (const [category, keywords] of Object.entries(FINDING_CATEGORIES)) {
    if (keywords.some(kw => lower.includes(kw))) return category;
  }
  return 'Other Findings';
}

/* Expandable finding row — keeps the list compact */
const FindingRow: React.FC<{
  icon: React.ReactNode;
  title: string;
  severity: string;
  detail?: string;
  suggestion?: string;
}> = ({ icon, title, severity, detail, suggestion }) => {
  const [open, setOpen] = useState(false);
  const hasDetail = detail || suggestion;

  return (
    <Box sx={{ borderBottom: '1px solid #f1f3f4', '&:last-child': { borderBottom: 0 } }}>
      <Box
        onClick={() => hasDetail && setOpen(!open)}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1.5, py: 1.5, px: 1,
          cursor: hasDetail ? 'pointer' : 'default',
          '&:hover': hasDetail ? { bgcolor: '#f8f9fa' } : {},
          borderRadius: 1,
        }}
      >
        {icon}
        <Typography variant="body2" sx={{ flex: 1, color: '#202124', fontWeight: 500, fontSize: '0.85rem' }}>
          {title}
        </Typography>
        <Chip
          label={severity}
          size="small"
          sx={{
            fontWeight: 600, fontSize: '0.7rem', height: 22,
            bgcolor: getSeverityBg(severity),
            color: getSeverityTextColor(severity),
            border: 'none',
          }}
        />
        {hasDetail && (
          <IconButton size="small" sx={{ ml: 0.5, p: 0.25 }}>
            {open ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
          </IconButton>
        )}
      </Box>
      {hasDetail && (
        <Collapse in={open}>
          <Box sx={{ pl: 5, pr: 2, pb: 1.5 }}>
            {detail && (
              <Typography variant="body2" sx={{ color: '#5f6368', fontSize: '0.8rem', lineHeight: 1.6 }}>
                {detail}
              </Typography>
            )}
            {suggestion && (
              <Typography variant="body2" sx={{ color: '#1a73e8', fontSize: '0.8rem', mt: 0.5 }}>
                {suggestion}
              </Typography>
            )}
          </Box>
        </Collapse>
      )}
    </Box>
  );
};

const ReportDisplay: React.FC<ReportDisplayProps> = ({ report }) => {
  const riskInfo = getRiskLabel(report.risk_score.overall_score);

  // Group findings by category
  const legalByCategory: Record<string, LegalFinding[]> = {};
  for (const f of report.legal_findings) {
    const cat = categorizeFinding(f.description);
    if (!legalByCategory[cat]) legalByCategory[cat] = [];
    legalByCategory[cat].push(f);
  }
  const fraudByCategory: Record<string, FraudFinding[]> = {};
  for (const f of report.fraud_findings) {
    const cat = categorizeFinding(f.description);
    if (!fraudByCategory[cat]) fraudByCategory[cat] = [];
    fraudByCategory[cat].push(f);
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Risk Score — compact horizontal layout */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 3, p: 3,
        borderRadius: 2, border: '1px solid #e0e0e0', bgcolor: '#fafafa',
      }}>
        <Box sx={{ textAlign: 'center', minWidth: 80 }}>
          <Typography variant="h3" fontWeight={700} color={`${riskInfo.color}.main`} lineHeight={1}>
            {report.risk_score.overall_score}
          </Typography>
          <Typography variant="caption" sx={{ color: '#80868b' }}>/100</Typography>
          <Box sx={{ mt: 0.5 }}>
            <Chip label={riskInfo.label} color={riskInfo.color} size="small" sx={{ fontWeight: 600 }} />
          </Box>
        </Box>

        <Divider orientation="vertical" flexItem />

        {/* Category bars */}
        {report.risk_score.category_scores && Object.keys(report.risk_score.category_scores).length > 0 && (
          <Box sx={{ flex: 1 }}>
            {Object.entries(report.risk_score.category_scores).map(([category, score]) => (
              <Box key={category} sx={{ mb: 0.75 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
                  <Typography variant="caption" sx={{ textTransform: 'capitalize', color: '#5f6368' }}>
                    {category.replace(/_/g, ' ')}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#5f6368', fontWeight: 500 }}>{score}</Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={score}
                  color={getRiskLabel(score).color}
                  sx={{ height: 5, borderRadius: 3 }}
                />
              </Box>
            ))}
          </Box>
        )}
      </Box>

      {/* Summary */}
      <Typography variant="body2" sx={{ color: '#3c4043', lineHeight: 1.7 }}>
        {report.summary}
      </Typography>

      {/* Legal Findings — collapsed by default, compact rows */}
      <Accordion
        defaultExpanded={report.legal_findings.some(f => !f.is_compliant)}
        disableGutters
        elevation={0}
        sx={{ border: '1px solid #e0e0e0', borderRadius: '8px !important', '&:before': { display: 'none' } }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2 }}>
          <GavelIcon sx={{ mr: 1.5, color: '#1a73e8', fontSize: 20 }} />
          <Typography variant="body1" fontWeight={600} sx={{ color: '#202124' }}>
            Legal Findings
          </Typography>
          <Chip label={report.legal_findings.length} size="small" sx={{ ml: 1, height: 20, fontSize: '0.7rem', bgcolor: '#e8f0fe', color: '#1a73e8' }} />
        </AccordionSummary>
        <AccordionDetails sx={{ px: 2, pt: 0, pb: 1 }}>
          {report.legal_findings.length === 0 ? (
            <Typography variant="body2" sx={{ color: '#80868b' }}>No legal findings.</Typography>
          ) : (
            Object.entries(legalByCategory).map(([category, findings]) => (
              <Box key={category} sx={{ mb: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, mt: 1 }}>
                  <Typography variant="caption" fontWeight={600} sx={{ color: '#5f6368', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {category}
                  </Typography>
                  <Chip label={findings.length} size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#f1f3f4' }} />
                </Box>
                {findings.map((f: LegalFinding, i: number) => (
                  <FindingRow
                    key={i}
                    icon={f.is_compliant
                      ? <CheckCircleIcon sx={{ fontSize: 18, color: '#1e8e3e' }} />
                      : <CancelIcon sx={{ fontSize: 18, color: '#d93025' }} />
                    }
                    title={f.description}
                    severity={f.severity}
                    detail={f.explanation}
                    suggestion={f.remediation_suggestion}
                  />
                ))}
              </Box>
            ))
          )}
        </AccordionDetails>
      </Accordion>

      {/* Fraud Findings */}
      <Accordion
        defaultExpanded={report.fraud_findings.some(f => f.is_suspicious)}
        disableGutters
        elevation={0}
        sx={{ border: '1px solid #e0e0e0', borderRadius: '8px !important', '&:before': { display: 'none' } }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2 }}>
          <SecurityIcon sx={{ mr: 1.5, color: '#d93025', fontSize: 20 }} />
          <Typography variant="body1" fontWeight={600} sx={{ color: '#202124' }}>
            Fraud Indicators
          </Typography>
          <Chip label={report.fraud_findings.length} size="small" sx={{ ml: 1, height: 20, fontSize: '0.7rem', bgcolor: '#fce8e6', color: '#d93025' }} />
        </AccordionSummary>
        <AccordionDetails sx={{ px: 2, pt: 0, pb: 1 }}>
          {report.fraud_findings.length === 0 ? (
            <Typography variant="body2" sx={{ color: '#80868b' }}>No fraud indicators found.</Typography>
          ) : (
            Object.entries(fraudByCategory).map(([category, findings]) => (
              <Box key={category} sx={{ mb: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, mt: 1 }}>
                  <Typography variant="caption" fontWeight={600} sx={{ color: '#5f6368', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {category}
                  </Typography>
                  <Chip label={findings.length} size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#f1f3f4' }} />
                </Box>
                {findings.map((f: FraudFinding, i: number) => (
                  <FindingRow
                    key={i}
                    icon={f.is_suspicious
                      ? <WarningIcon sx={{ fontSize: 18, color: '#e37400' }} />
                      : <CheckCircleIcon sx={{ fontSize: 18, color: '#1e8e3e' }} />
                    }
                    title={f.description}
                    severity={f.severity}
                    detail={f.evidence?.length > 0 ? f.evidence.join('; ') : undefined}
                    suggestion={f.recommendation}
                  />
                ))}
              </Box>
            ))
          )}
        </AccordionDetails>
      </Accordion>

      {/* Verification Checklist — simple compact list */}
      <Accordion
        disableGutters
        elevation={0}
        sx={{ border: '1px solid #e0e0e0', borderRadius: '8px !important', '&:before': { display: 'none' } }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2 }}>
          <AssignmentIcon sx={{ mr: 1.5, color: '#1e8e3e', fontSize: 20 }} />
          <Typography variant="body1" fontWeight={600} sx={{ color: '#202124' }}>
            Verification Checklist
          </Typography>
          <Chip label={report.verification_checklist.length} size="small" sx={{ ml: 1, height: 20, fontSize: '0.7rem', bgcolor: '#e6f4ea', color: '#1e8e3e' }} />
        </AccordionSummary>
        <AccordionDetails sx={{ px: 2, pt: 0, pb: 1 }}>
          {report.verification_checklist.length === 0 ? (
            <Typography variant="body2" sx={{ color: '#80868b' }}>No checklist items.</Typography>
          ) : (
            report.verification_checklist.map((item: VerificationChecklistItem, i: number) => (
              <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1, borderBottom: '1px solid #f1f3f4', '&:last-child': { borderBottom: 0 } }}>
                {item.is_checked
                  ? <CheckCircleIcon sx={{ fontSize: 18, color: '#1e8e3e' }} />
                  : <CancelIcon sx={{ fontSize: 18, color: '#dadce0' }} />
                }
                <Box>
                  <Typography variant="body2" sx={{ color: '#202124', fontWeight: 500, fontSize: '0.85rem' }}>{item.item}</Typography>
                  {item.details && (
                    <Typography variant="caption" sx={{ color: '#80868b' }}>{item.details}</Typography>
                  )}
                </Box>
              </Box>
            ))
          )}
        </AccordionDetails>
      </Accordion>

      {/* Footer */}
      <Typography variant="caption" sx={{ color: '#80868b', textAlign: 'right' }}>
        Generated {new Date(report.generated_at).toLocaleString()}
      </Typography>
    </Box>
  );
};

export default ReportDisplay;
