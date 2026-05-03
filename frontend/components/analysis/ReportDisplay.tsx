'use client';

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Chip,
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
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import PlaceIcon from '@mui/icons-material/Place';
import { AnalysisReport, LegalFinding, FraudFinding } from '@/lib/types';

interface ReportDisplayProps {
  report: AnalysisReport;
}

const getSeverityBg = (severity: string): string => {
  switch (severity) {
    case 'critical': case 'high': return '#fce8e6';
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

/* Expandable finding row */
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
                💡 {suggestion}
              </Typography>
            )}
          </Box>
        </Collapse>
      )}
    </Box>
  );
};

const ReportDisplay: React.FC<ReportDisplayProps> = ({ report }) => {
  const suspiciousFindings = report.fraud_findings.filter(f => f.is_suspicious);
  const nonCompliantFindings = report.legal_findings.filter(f => !f.is_compliant);
  const totalIssues = suspiciousFindings.length + nonCompliantFindings.length;

  // Extract location info
  const state = report.extracted_data?.property_details?.state;
  const district = report.extracted_data?.property_details?.district;
  const location = [district, state].filter(Boolean).join(', ');

  // Separate "missing documents" recommendations from other findings
  const missingDocKeywords = ['obtain', 'get', 'collect', 'encumbrance', 'mutation', 'NOC', '7/12', 'khata', 'patta', 'RTC', 'extract', 'certificate'];
  const missingDocSuggestions: string[] = [];

  for (const f of [...report.fraud_findings, ...report.legal_findings]) {
    const rec = ('recommendation' in f ? f.recommendation : ('remediation_suggestion' in f ? f.remediation_suggestion : null)) as string | null;
    if (rec && missingDocKeywords.some(kw => rec.toLowerCase().includes(kw.toLowerCase()))) {
      if (!missingDocSuggestions.includes(rec)) {
        missingDocSuggestions.push(rec);
      }
    }
  }

  // Area-specific findings (tribal, scheduled, UT, forest, agricultural, etc.)
  const areaKeywords = ['tribal', 'adivasi', 'scheduled', 'schedule v', 'schedule vi', 'forest', 'agricultural', 'ceiling', 'roshni', 'non-resident', 'inner line', 'sixth schedule', 'pesa', 'customary', 'tribunal'];
  const areaFindings: { text: string; severity: string }[] = [];

  for (const f of report.fraud_findings) {
    if (areaKeywords.some(kw => f.description.toLowerCase().includes(kw) || (f.evidence || []).some(e => e.toLowerCase().includes(kw)))) {
      areaFindings.push({ text: f.description, severity: f.severity });
    }
  }
  for (const f of report.legal_findings) {
    if (areaKeywords.some(kw => f.description.toLowerCase().includes(kw) || f.explanation.toLowerCase().includes(kw))) {
      areaFindings.push({ text: f.description, severity: f.severity });
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>

      {/* Advisory header — no score, just status */}
      <Box sx={{
        p: 2.5, borderRadius: '12px',
        bgcolor: totalIssues === 0 ? '#e6f4ea' : totalIssues <= 3 ? '#fffbe6' : '#fce8e6',
        border: `1px solid ${totalIssues === 0 ? '#b7e1cd' : totalIssues <= 3 ? '#fde293' : '#f5c6cb'}`,
      }}>
        <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: '#202124', mb: 0.5 }}>
          {totalIssues === 0
            ? '✓ No major concerns found'
            : totalIssues <= 3
              ? `⚠️ ${totalIssues} area${totalIssues > 1 ? 's' : ''} worth verifying`
              : `⚠️ ${totalIssues} areas flagged for your attention`
          }
        </Typography>
        {location && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
            <PlaceIcon sx={{ fontSize: 14, color: '#5f6368' }} />
            <Typography variant="caption" sx={{ color: '#5f6368' }}>{location}</Typography>
          </Box>
        )}
        <Typography variant="body2" sx={{ color: '#3c4043', lineHeight: 1.7 }}>
          {report.summary}
        </Typography>
      </Box>

      {/* Area-specific alerts (tribal, scheduled, forest, etc.) */}
      {areaFindings.length > 0 && (
        <Box sx={{ p: 2, borderRadius: '12px', bgcolor: '#fff3e0', border: '1px solid #ffe0b2' }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: '#e65100', mb: 1 }}>
            📍 Area-specific concerns for {location || 'this region'}
          </Typography>
          {areaFindings.map((f, i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1, '&:last-child': { mb: 0 } }}>
              <WarningIcon sx={{ fontSize: 14, color: getSeverityTextColor(f.severity), mt: 0.3 }} />
              <Typography variant="body2" sx={{ color: '#3c4043', fontSize: '0.85rem', lineHeight: 1.5 }}>
                {f.text}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      {/* Missing documents to obtain */}
      {missingDocSuggestions.length > 0 && (
        <Box sx={{ p: 2, borderRadius: '12px', bgcolor: '#e8f0fe', border: '1px solid #c2d7fe' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <FolderOpenIcon sx={{ fontSize: 18, color: '#1a73e8' }} />
            <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: '#1a73e8' }}>
              Documents you should obtain
            </Typography>
          </Box>
          {missingDocSuggestions.slice(0, 6).map((s, i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 0.75, '&:last-child': { mb: 0 } }}>
              <Typography variant="body2" sx={{ color: '#174ea6', fontSize: '0.85rem', lineHeight: 1.5 }}>
                • {s}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      {/* What's wrong — Issues found (Fraud / Areas to Verify) */}
      <Accordion
        defaultExpanded={suspiciousFindings.length > 0}
        disableGutters
        elevation={0}
        sx={{ border: '1px solid #e8eaed', borderRadius: '12px !important', '&:before': { display: 'none' } }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2 }}>
          <SecurityIcon sx={{ mr: 1.5, color: '#e37400', fontSize: 20 }} />
          <Typography variant="body1" fontWeight={600} sx={{ color: '#202124' }}>
            What to verify
          </Typography>
          <Chip label={report.fraud_findings.length} size="small" sx={{ ml: 1, height: 20, fontSize: '0.7rem', bgcolor: '#fce8e6', color: '#d93025' }} />
        </AccordionSummary>
        <AccordionDetails sx={{ px: 2, pt: 0, pb: 1 }}>
          {report.fraud_findings.length === 0 ? (
            <Typography variant="body2" sx={{ color: '#80868b' }}>No areas of concern found.</Typography>
          ) : (
            report.fraud_findings.map((f: FraudFinding, i: number) => (
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
            ))
          )}
        </AccordionDetails>
      </Accordion>

      {/* Legal checks */}
      <Accordion
        defaultExpanded={nonCompliantFindings.length > 0}
        disableGutters
        elevation={0}
        sx={{ border: '1px solid #e8eaed', borderRadius: '12px !important', '&:before': { display: 'none' } }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2 }}>
          <GavelIcon sx={{ mr: 1.5, color: '#1a73e8', fontSize: 20 }} />
          <Typography variant="body1" fontWeight={600} sx={{ color: '#202124' }}>
            Legal checks
          </Typography>
          <Chip label={report.legal_findings.length} size="small" sx={{ ml: 1, height: 20, fontSize: '0.7rem', bgcolor: '#e8f0fe', color: '#1a73e8' }} />
        </AccordionSummary>
        <AccordionDetails sx={{ px: 2, pt: 0, pb: 1 }}>
          {report.legal_findings.length === 0 ? (
            <Typography variant="body2" sx={{ color: '#80868b' }}>No legal findings.</Typography>
          ) : (
            report.legal_findings.map((f: LegalFinding, i: number) => (
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
            ))
          )}
        </AccordionDetails>
      </Accordion>

      {/* Disclaimer */}
      <Box sx={{ p: 2, borderRadius: '12px', bgcolor: '#f8f9fa', border: '1px solid #e8eaed' }}>
        <Typography variant="caption" sx={{ color: '#5f6368', lineHeight: 1.6 }}>
          ⚠️ <strong>Disclaimer:</strong> This is an AI-assisted review to help you identify areas worth verifying. It is NOT a legal opinion or certification. Your documents may be perfectly valid. Always consult a qualified property lawyer or visit your local sub-registrar office before making any decisions.
        </Typography>
      </Box>
      <Typography variant="caption" sx={{ color: '#80868b', textAlign: 'right' }}>
        Generated {new Date(report.generated_at).toLocaleString()}
      </Typography>
    </Box>
  );
};

export default ReportDisplay;
