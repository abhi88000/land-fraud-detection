'use client';

import React from 'react';
import {
  Box,
  Typography,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
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

const getRiskLabel = (score: number): { label: string; color: 'error' | 'warning' | 'success' } => {
  if (score >= 70) return { label: 'High Risk', color: 'error' };
  if (score >= 40) return { label: 'Medium Risk', color: 'warning' };
  return { label: 'Low Risk', color: 'success' };
};

const ReportDisplay: React.FC<ReportDisplayProps> = ({ report }) => {
  const riskInfo = getRiskLabel(report.risk_score.overall_score);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Risk Score */}
      <Box sx={{ textAlign: 'center', p: 2, borderRadius: 2, bgcolor: 'background.default' }}>
        <Typography variant="h3" fontWeight="bold" color={`${riskInfo.color}.main`}>
          {report.risk_score.overall_score}
        </Typography>
        <Typography variant="body2" color="text.secondary">/100</Typography>
        <Chip label={riskInfo.label} color={riskInfo.color} sx={{ mt: 1 }} />

        {/* Category Scores */}
        {report.risk_score.category_scores && Object.keys(report.risk_score.category_scores).length > 0 && (
          <Box sx={{ mt: 2, textAlign: 'left' }}>
            {Object.entries(report.risk_score.category_scores).map(([category, score]) => (
              <Box key={category} sx={{ mb: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="caption" sx={{ textTransform: 'capitalize' }}>
                    {category.replace(/_/g, ' ')}
                  </Typography>
                  <Typography variant="caption">{score}/100</Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={score}
                  color={getRiskLabel(score).color}
                  sx={{ height: 6, borderRadius: 3 }}
                />
              </Box>
            ))}
          </Box>
        )}
      </Box>

      {/* Summary */}
      <Box>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>Summary</Typography>
        <Typography variant="body2">{report.summary}</Typography>
      </Box>

      <Divider />

      {/* Legal Findings */}
      <Accordion defaultExpanded={report.legal_findings.some(f => !f.is_compliant)}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <GavelIcon sx={{ mr: 1, color: 'primary.main' }} />
          <Typography variant="subtitle1">
            Legal Findings ({report.legal_findings.length})
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          {report.legal_findings.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No legal findings.</Typography>
          ) : (
            <List dense disablePadding>
              {report.legal_findings.map((finding: LegalFinding, idx: number) => (
                <ListItem key={idx} sx={{ alignItems: 'flex-start', pl: 0 }}>
                  <ListItemIcon sx={{ minWidth: 36, mt: 0.5 }}>
                    {finding.is_compliant ? (
                      <CheckCircleIcon color="success" fontSize="small" />
                    ) : (
                      <CancelIcon color="error" fontSize="small" />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" fontWeight="medium">{finding.description}</Typography>
                        <Chip label={finding.severity} size="small" color={getSeverityColor(finding.severity)} variant="outlined" />
                      </Box>
                    }
                    secondary={
                      <>
                        <Typography variant="caption" display="block">{finding.explanation}</Typography>
                        {finding.remediation_suggestion && (
                          <Typography variant="caption" color="primary" display="block" sx={{ mt: 0.5 }}>
                            Suggestion: {finding.remediation_suggestion}
                          </Typography>
                        )}
                      </>
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
        </AccordionDetails>
      </Accordion>

      {/* Fraud Findings */}
      <Accordion defaultExpanded={report.fraud_findings.some(f => f.is_suspicious)}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <SecurityIcon sx={{ mr: 1, color: 'error.main' }} />
          <Typography variant="subtitle1">
            Fraud Findings ({report.fraud_findings.length})
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          {report.fraud_findings.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No fraud indicators found.</Typography>
          ) : (
            <List dense disablePadding>
              {report.fraud_findings.map((finding: FraudFinding, idx: number) => (
                <ListItem key={idx} sx={{ alignItems: 'flex-start', pl: 0 }}>
                  <ListItemIcon sx={{ minWidth: 36, mt: 0.5 }}>
                    {finding.is_suspicious ? (
                      <WarningIcon color="error" fontSize="small" />
                    ) : (
                      <CheckCircleIcon color="success" fontSize="small" />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" fontWeight="medium">{finding.description}</Typography>
                        <Chip label={finding.severity} size="small" color={getSeverityColor(finding.severity)} variant="outlined" />
                      </Box>
                    }
                    secondary={
                      <>
                        {finding.evidence.length > 0 && (
                          <Typography variant="caption" display="block">
                            Evidence: {finding.evidence.join('; ')}
                          </Typography>
                        )}
                        {finding.recommendation && (
                          <Typography variant="caption" color="primary" display="block" sx={{ mt: 0.5 }}>
                            Recommendation: {finding.recommendation}
                          </Typography>
                        )}
                      </>
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
        </AccordionDetails>
      </Accordion>

      {/* Verification Checklist */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <AssignmentIcon sx={{ mr: 1, color: 'secondary.main' }} />
          <Typography variant="subtitle1">
            Verification Checklist ({report.verification_checklist.length})
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          {report.verification_checklist.length === 0 ? (
            <Typography variant="body2" color="text.secondary">No checklist items.</Typography>
          ) : (
            <List dense disablePadding>
              {report.verification_checklist.map((item: VerificationChecklistItem, idx: number) => (
                <ListItem key={idx} sx={{ pl: 0 }}>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    {item.is_checked ? (
                      <CheckCircleIcon color="success" fontSize="small" />
                    ) : (
                      <CancelIcon color="disabled" fontSize="small" />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.item}
                    secondary={item.details}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </AccordionDetails>
      </Accordion>

      {/* Generated At */}
      <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'right' }}>
        Report generated: {new Date(report.generated_at).toLocaleString()}
      </Typography>
    </Box>
  );
};

export default ReportDisplay;
