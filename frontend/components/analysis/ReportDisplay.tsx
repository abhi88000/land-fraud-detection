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
  Divider,
  Paper,
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
import PersonIcon from '@mui/icons-material/Person';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import DescriptionIcon from '@mui/icons-material/Description';
import LandscapeIcon from '@mui/icons-material/Landscape';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
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
        <Typography variant="body2" sx={{ flex: 1, color: '#202124', fontWeight: 500, fontSize: '0.85rem', lineHeight: 1.5 }}>
          {title}
        </Typography>
        <Chip label={severity} size="small" sx={{
          fontWeight: 600, fontSize: '0.65rem', height: 20,
          bgcolor: getSeverityBg(severity), color: getSeverityTextColor(severity), border: 'none',
        }} />
        {hasDetail && (
          <IconButton size="small" sx={{ ml: 0.25, p: 0.25 }}>
            {open ? <KeyboardArrowUpIcon sx={{ fontSize: 18 }} /> : <KeyboardArrowDownIcon sx={{ fontSize: 18 }} />}
          </IconButton>
        )}
      </Box>
      {hasDetail && (
        <Collapse in={open}>
          <Box sx={{ pl: 5, pr: 2, pb: 1.5 }}>
            {detail && <Typography variant="body2" sx={{ color: '#5f6368', fontSize: '0.8rem', lineHeight: 1.7 }}>{detail}</Typography>}
            {suggestion && <Typography variant="body2" sx={{ color: '#1a73e8', fontSize: '0.8rem', mt: 0.75, fontWeight: 500 }}>💡 {suggestion}</Typography>}
          </Box>
        </Collapse>
      )}
    </Box>
  );
};

/* Small info pill for extracted data */
const InfoPill: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.75, px: 1.5, borderRadius: '10px', bgcolor: '#f8f9fa', minWidth: 0 }}>
    {icon}
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" sx={{ color: '#80868b', fontSize: '0.65rem', display: 'block', lineHeight: 1 }}>{label}</Typography>
      <Typography variant="body2" sx={{ color: '#202124', fontWeight: 500, fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</Typography>
    </Box>
  </Box>
);

const ReportDisplay: React.FC<ReportDisplayProps> = ({ report }) => {
  const suspiciousFindings = report.fraud_findings.filter(f => f.is_suspicious);
  const nonCompliantFindings = report.legal_findings.filter(f => !f.is_compliant);
  const compliantFindings = report.legal_findings.filter(f => f.is_compliant);
  const safeFindings = report.fraud_findings.filter(f => !f.is_suspicious);
  const totalIssues = suspiciousFindings.length + nonCompliantFindings.length;
  const totalOk = compliantFindings.length + safeFindings.length;

  const ed = report.extracted_data;
  const state = ed?.property_details?.state;
  const district = ed?.property_details?.district;
  const landType = ed?.property_details?.land_type;
  const location = [district, state].filter(Boolean).join(', ');

  // Collect missing doc suggestions
  const missingDocKeywords = ['obtain', 'get', 'collect', 'encumbrance', 'mutation', 'NOC', '7/12', 'khata', 'patta', 'RTC', 'extract', 'certificate'];
  const missingDocSuggestions: string[] = [];
  for (const f of [...report.fraud_findings, ...report.legal_findings]) {
    const rec = ('recommendation' in f ? f.recommendation : ('remediation_suggestion' in f ? f.remediation_suggestion : null)) as string | null;
    if (rec && missingDocKeywords.some(kw => rec.toLowerCase().includes(kw.toLowerCase()))) {
      if (!missingDocSuggestions.includes(rec)) missingDocSuggestions.push(rec);
    }
  }

  // Area-specific findings
  const areaKeywords = ['tribal', 'adivasi', 'scheduled', 'schedule v', 'schedule vi', 'forest', 'agricultural', 'ceiling', 'roshni', 'non-resident', 'inner line', 'sixth schedule', 'pesa', 'customary', 'tribunal', 'plantation'];
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

  // Status color
  const statusColor = totalIssues === 0 ? '#1e8e3e' : totalIssues <= 3 ? '#e37400' : '#d93025';
  const statusBg = totalIssues === 0 ? '#e6f4ea' : totalIssues <= 3 ? '#fffbe6' : '#fce8e6';
  const statusBorder = totalIssues === 0 ? '#b7e1cd' : totalIssues <= 3 ? '#fde293' : '#f5c6cb';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

      {/* ═══ Hero Status Banner ═══ */}
      <Box sx={{
        p: 3, borderRadius: '16px', bgcolor: statusBg, border: `1px solid ${statusBorder}`,
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Decorative gradient */}
        <Box sx={{
          position: 'absolute', top: 0, right: 0, width: 200, height: '100%',
          background: `linear-gradient(135deg, transparent 50%, ${statusColor}08 100%)`,
        }} />

        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, position: 'relative' }}>
          {/* Status indicator */}
          <Box sx={{
            width: 48, height: 48, borderRadius: '14px', bgcolor: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)', flexShrink: 0,
          }}>
            {totalIssues === 0
              ? <CheckCircleIcon sx={{ fontSize: 28, color: '#1e8e3e' }} />
              : <WarningIcon sx={{ fontSize: 28, color: statusColor }} />
            }
          </Box>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', color: '#202124', mb: 0.25 }}>
              {totalIssues === 0
                ? 'No major concerns found'
                : `${totalIssues} area${totalIssues > 1 ? 's' : ''} need${totalIssues === 1 ? 's' : ''} your attention`
              }
            </Typography>

            {/* Quick stats pills */}
            <Box sx={{ display: 'flex', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
              {totalIssues > 0 && (
                <Chip icon={<WarningIcon sx={{ fontSize: '14px !important' }} />} label={`${totalIssues} to verify`} size="small"
                  sx={{ height: 22, fontSize: '0.7rem', fontWeight: 600, bgcolor: '#fff', color: statusColor, border: `1px solid ${statusBorder}` }} />
              )}
              {totalOk > 0 && (
                <Chip icon={<CheckCircleIcon sx={{ fontSize: '14px !important' }} />} label={`${totalOk} passed`} size="small"
                  sx={{ height: 22, fontSize: '0.7rem', fontWeight: 600, bgcolor: '#fff', color: '#1e8e3e', border: '1px solid #b7e1cd' }} />
              )}
            </Box>

            <Typography variant="body2" sx={{ color: '#3c4043', lineHeight: 1.7, fontSize: '0.85rem' }}>
              {report.summary}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* ═══ Document Details Card ═══ */}
      {ed && (
        <Paper elevation={0} sx={{ p: 2, borderRadius: '14px', border: '1px solid #e8eaed' }}>
          <Typography variant="caption" sx={{ fontWeight: 600, color: '#5f6368', textTransform: 'uppercase', letterSpacing: 0.5, mb: 1.5, display: 'block' }}>
            Extracted Information
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {ed.document_type && <InfoPill icon={<DescriptionIcon sx={{ fontSize: 16, color: '#1a73e8' }} />} label="Document" value={ed.document_type} />}
            {location && <InfoPill icon={<PlaceIcon sx={{ fontSize: 16, color: '#e37400' }} />} label="Location" value={location} />}
            {landType && <InfoPill icon={<LandscapeIcon sx={{ fontSize: 16, color: '#1e8e3e' }} />} label="Land Type" value={landType} />}
            {ed.property_details?.area && (
              <InfoPill icon={<LandscapeIcon sx={{ fontSize: 16, color: '#9334e6' }} />} label="Area" value={`${ed.property_details.area} ${ed.property_details.unit || ''}`} />
            )}
            {ed.stamp_duty_amount && <InfoPill icon={<InfoOutlinedIcon sx={{ fontSize: 16, color: '#e37400' }} />} label="Stamp Duty" value={ed.stamp_duty_amount} />}
            {ed.dates?.registration_date && <InfoPill icon={<CalendarTodayIcon sx={{ fontSize: 16, color: '#5f6368' }} />} label="Registration" value={ed.dates.registration_date} />}
          </Box>

          {/* Parties */}
          {ed.party_names?.length > 0 && (
            <Box sx={{ mt: 1.5, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {ed.party_names.map((p, i) => (
                <Chip key={i} icon={<PersonIcon sx={{ fontSize: '14px !important' }} />}
                  label={`${p.name} (${p.role})`} size="small"
                  sx={{ fontSize: '0.75rem', bgcolor: '#f8f9fa', color: '#3c4043', border: '1px solid #e8eaed' }} />
              ))}
            </Box>
          )}
        </Paper>
      )}

      {/* ═══ Area-Specific Alerts ═══ */}
      {areaFindings.length > 0 && (
        <Paper elevation={0} sx={{ p: 2, borderRadius: '14px', bgcolor: '#fff3e0', border: '1px solid #ffe0b2' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <Box sx={{ width: 28, height: 28, borderRadius: '8px', bgcolor: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PlaceIcon sx={{ fontSize: 16, color: '#e65100' }} />
            </Box>
            <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: '#e65100' }}>
              Area-specific concerns — {location || 'this region'}
            </Typography>
          </Box>
          {areaFindings.map((f, i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1, '&:last-child': { mb: 0 } }}>
              <WarningIcon sx={{ fontSize: 14, color: getSeverityTextColor(f.severity), mt: 0.3 }} />
              <Typography variant="body2" sx={{ color: '#3c4043', fontSize: '0.82rem', lineHeight: 1.5 }}>{f.text}</Typography>
            </Box>
          ))}
        </Paper>
      )}

      {/* ═══ Missing Documents ═══ */}
      {missingDocSuggestions.length > 0 && (
        <Paper elevation={0} sx={{ p: 2, borderRadius: '14px', bgcolor: '#e8f0fe', border: '1px solid #c2d7fe' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <Box sx={{ width: 28, height: 28, borderRadius: '8px', bgcolor: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FolderOpenIcon sx={{ fontSize: 16, color: '#1a73e8' }} />
            </Box>
            <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: '#1a73e8' }}>
              Documents you should obtain
            </Typography>
          </Box>
          {missingDocSuggestions.slice(0, 6).map((s, i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 0.75, '&:last-child': { mb: 0 } }}>
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#1a73e8', mt: 0.75, flexShrink: 0 }} />
              <Typography variant="body2" sx={{ color: '#174ea6', fontSize: '0.82rem', lineHeight: 1.5 }}>{s}</Typography>
            </Box>
          ))}
        </Paper>
      )}

      {/* ═══ What to Verify (Fraud) ═══ */}
      <Accordion
        defaultExpanded={suspiciousFindings.length > 0}
        disableGutters elevation={0}
        sx={{ border: '1px solid #e8eaed', borderRadius: '14px !important', '&:before': { display: 'none' }, overflow: 'hidden' }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2, py: 0.5 }}>
          <Box sx={{ width: 28, height: 28, borderRadius: '8px', bgcolor: '#fef7e0', display: 'flex', alignItems: 'center', justifyContent: 'center', mr: 1.5 }}>
            <SecurityIcon sx={{ fontSize: 16, color: '#e37400' }} />
          </Box>
          <Typography fontWeight={600} sx={{ color: '#202124', flex: 1 }}>What to verify</Typography>
          {suspiciousFindings.length > 0 && (
            <Chip label={`${suspiciousFindings.length} issue${suspiciousFindings.length > 1 ? 's' : ''}`} size="small"
              sx={{ height: 20, fontSize: '0.65rem', fontWeight: 600, bgcolor: '#fce8e6', color: '#d93025' }} />
          )}
        </AccordionSummary>
        <AccordionDetails sx={{ px: 2, pt: 0, pb: 1 }}>
          {report.fraud_findings.length === 0 ? (
            <Typography variant="body2" sx={{ color: '#80868b', py: 1 }}>No areas of concern found.</Typography>
          ) : (
            report.fraud_findings.map((f: FraudFinding, i: number) => (
              <FindingRow key={i}
                icon={f.is_suspicious ? <WarningIcon sx={{ fontSize: 18, color: '#e37400' }} /> : <CheckCircleIcon sx={{ fontSize: 18, color: '#1e8e3e' }} />}
                title={f.description} severity={f.severity}
                detail={f.evidence?.length > 0 ? f.evidence.join('; ') : undefined}
                suggestion={f.recommendation}
              />
            ))
          )}
        </AccordionDetails>
      </Accordion>

      {/* ═══ Legal Checks ═══ */}
      <Accordion
        defaultExpanded={nonCompliantFindings.length > 0}
        disableGutters elevation={0}
        sx={{ border: '1px solid #e8eaed', borderRadius: '14px !important', '&:before': { display: 'none' }, overflow: 'hidden' }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2, py: 0.5 }}>
          <Box sx={{ width: 28, height: 28, borderRadius: '8px', bgcolor: '#e8f0fe', display: 'flex', alignItems: 'center', justifyContent: 'center', mr: 1.5 }}>
            <GavelIcon sx={{ fontSize: 16, color: '#1a73e8' }} />
          </Box>
          <Typography fontWeight={600} sx={{ color: '#202124', flex: 1 }}>Legal checks</Typography>
          {nonCompliantFindings.length > 0 && (
            <Chip label={`${nonCompliantFindings.length} issue${nonCompliantFindings.length > 1 ? 's' : ''}`} size="small"
              sx={{ height: 20, fontSize: '0.65rem', fontWeight: 600, bgcolor: '#fce8e6', color: '#d93025' }} />
          )}
        </AccordionSummary>
        <AccordionDetails sx={{ px: 2, pt: 0, pb: 1 }}>
          {report.legal_findings.length === 0 ? (
            <Typography variant="body2" sx={{ color: '#80868b', py: 1 }}>No legal findings.</Typography>
          ) : (
            report.legal_findings.map((f: LegalFinding, i: number) => (
              <FindingRow key={i}
                icon={f.is_compliant ? <CheckCircleIcon sx={{ fontSize: 18, color: '#1e8e3e' }} /> : <CancelIcon sx={{ fontSize: 18, color: '#d93025' }} />}
                title={f.description} severity={f.severity}
                detail={f.explanation} suggestion={f.remediation_suggestion}
              />
            ))
          )}
        </AccordionDetails>
      </Accordion>

      {/* ═══ Disclaimer ═══ */}
      <Box sx={{ p: 2, borderRadius: '14px', bgcolor: '#f8f9fa', border: '1px solid #e8eaed' }}>
        <Typography variant="caption" sx={{ color: '#5f6368', lineHeight: 1.6 }}>
          <strong>Disclaimer:</strong> This is an AI-assisted review to help you identify areas worth verifying. It is NOT a legal opinion or certification. Your documents may be perfectly valid. Always consult a qualified property lawyer or visit your local sub-registrar office before making any decisions.
        </Typography>
      </Box>
      <Typography variant="caption" sx={{ color: '#80868b', textAlign: 'right' }}>
        Generated {new Date(report.generated_at).toLocaleString()}
      </Typography>
    </Box>
  );
};

export default ReportDisplay;
