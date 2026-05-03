"use client";

import * as React from 'react';
import { Box, Typography, Paper, Grid, CircularProgress, LinearProgress, Chip } from '@mui/material';
import { useAuth } from '@/lib/firebase/auth';
import { useEffect, useState } from 'react';
import { fetchDocuments, fetchAnalysisReport } from '@/lib/api';
import { Document, DocumentStatus, AnalysisReport } from '@/lib/types';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import SecurityIcon from '@mui/icons-material/Security';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import InsightsIcon from '@mui/icons-material/Insights';
import GavelIcon from '@mui/icons-material/Gavel';

// Risk gauge component
function RiskGauge({ score, size = 140 }: { score: number; size?: number }) {
  const getColor = (s: number) => {
    if (s >= 70) return '#d93025';
    if (s >= 40) return '#e37400';
    return '#1e8e3e';
  };
  const getLabel = (s: number) => {
    if (s >= 70) return 'High Risk';
    if (s >= 40) return 'Medium';
    return 'Low Risk';
  };
  const color = getColor(score);
  const circumference = 2 * Math.PI * 54;
  const progress = (score / 100) * circumference * 0.75; // 270 degree arc

  return (
    <Box sx={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size} height={size} viewBox="0 0 120 120">
        {/* Background arc */}
        <circle
          cx="60" cy="60" r="54"
          fill="none"
          stroke="#f1f3f4"
          strokeWidth="8"
          strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`}
          strokeDashoffset={0}
          transform="rotate(135 60 60)"
          strokeLinecap="round"
        />
        {/* Progress arc */}
        <circle
          cx="60" cy="60" r="54"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={`${progress} ${circumference}`}
          strokeDashoffset={0}
          transform="rotate(135 60 60)"
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1s ease' }}
        />
      </svg>
      <Box sx={{ position: 'absolute', textAlign: 'center' }}>
        <Typography variant="h4" fontWeight={700} sx={{ color, lineHeight: 1 }}>{score}</Typography>
        <Typography variant="caption" sx={{ color: '#5f6368' }}>{getLabel(score)}</Typography>
      </Box>
    </Box>
  );
}

// Bar chart component for fraud types
function FraudTypeChart({ data }: { data: { type: string; count: number; color: string }[] }) {
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {data.map((item) => (
        <Box key={item.type}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="body2" sx={{ color: '#3c4043', fontWeight: 500, textTransform: 'capitalize' }}>
              {item.type.replace(/_/g, ' ')}
            </Typography>
            <Typography variant="body2" sx={{ color: '#5f6368' }}>{item.count}</Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={(item.count / max) * 100}
            sx={{
              height: 8,
              borderRadius: 4,
              bgcolor: '#f1f3f4',
              '& .MuiLinearProgress-bar': { bgcolor: item.color, borderRadius: 4 },
            }}
          />
        </Box>
      ))}
    </Box>
  );
}

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [reports, setReports] = useState<AnalysisReport[]>([]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      try {
        const token = await user.getIdToken();
        const docsRes = await fetchDocuments(token);
        setDocuments(docsRes.documents);

        // Fetch reports for completed documents
        const completed = docsRes.documents.filter(d => d.status === DocumentStatus.COMPLETED);
        const reportPromises = completed.slice(0, 20).map(d =>
          fetchAnalysisReport(d.id, token).then(r => r.report).catch(() => null)
        );
        const fetchedReports = await Promise.all(reportPromises);
        setReports(fetchedReports.filter(Boolean) as AnalysisReport[]);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  // Compute analytics
  const totalDocs = documents.length;
  const analyzedDocs = documents.filter(d => d.status === DocumentStatus.COMPLETED).length;
  const avgRiskScore = reports.length > 0
    ? Math.round(reports.reduce((sum, r) => sum + (r.risk_score?.overall_score || 0), 0) / reports.length)
    : 0;
  const highRiskCount = reports.filter(r => (r.risk_score?.overall_score || 0) >= 70).length;
  const mediumRiskCount = reports.filter(r => {
    const s = r.risk_score?.overall_score || 0;
    return s >= 40 && s < 70;
  }).length;
  const lowRiskCount = reports.filter(r => (r.risk_score?.overall_score || 0) < 40).length;

  // Fraud type aggregation
  const fraudCounts: Record<string, number> = {};
  reports.forEach(r => {
    (r.fraud_findings || []).forEach(f => {
      if (f.is_suspicious) {
        fraudCounts[f.fraud_type] = (fraudCounts[f.fraud_type] || 0) + 1;
      }
    });
  });
  const fraudColors = ['#d93025', '#e37400', '#1a73e8', '#1e8e3e', '#9334e6', '#e91e63'];
  const fraudChartData = Object.entries(fraudCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([type, count], i) => ({ type, count, color: fraudColors[i % fraudColors.length] }));

  // Legal compliance rate
  const totalLegalChecks = reports.reduce((s, r) => s + (r.legal_findings?.length || 0), 0);
  const compliantChecks = reports.reduce((s, r) => s + (r.legal_findings?.filter(f => f.is_compliant).length || 0), 0);
  const complianceRate = totalLegalChecks > 0 ? Math.round((compliantChecks / totalLegalChecks) * 100) : 100;

  // Recent analyses
  const recentAnalyses = reports
    .map(r => ({
      id: r.document_id,
      score: r.risk_score?.overall_score || 0,
      date: r.generated_at,
      fraudCount: r.fraud_findings?.filter(f => f.is_suspicious).length || 0,
    }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  const statCards = [
    { label: 'Documents Analyzed', value: analyzedDocs, total: totalDocs, icon: <InsightsIcon />, color: '#1a73e8', bg: '#e8f0fe' },
    { label: 'High Risk Detected', value: highRiskCount, icon: <WarningAmberIcon />, color: '#d93025', bg: '#fce8e6' },
    { label: 'Legal Compliance', value: `${complianceRate}%`, icon: <GavelIcon />, color: '#1e8e3e', bg: '#e6f4ea' },
    { label: 'Fraud Types Found', value: Object.keys(fraudCounts).length, icon: <SecurityIcon />, color: '#e37400', bg: '#fef7e0' },
  ];

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" fontWeight={600} sx={{ color: '#202124' }}>
          Analytics & Insights
        </Typography>
        <Typography variant="body2" sx={{ color: '#5f6368', mt: 0.5 }}>
          Fraud detection patterns and analysis trends across your documents
        </Typography>
      </Box>

      {/* Stat Cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2, mb: 4 }}>
        {statCards.map((card, idx) => (
          <Paper
            key={card.label}
            elevation={0}
            sx={{
              p: 2.5, borderRadius: 2, border: '1px solid #e0e0e0',
              display: 'flex', alignItems: 'center', gap: 2,
              transition: 'all 0.2s',
              '&:hover': { borderColor: card.color, boxShadow: `0 4px 12px ${card.color}20` },
            }}
          >
            <Box sx={{
              width: 40, height: 40, borderRadius: '12px', bgcolor: card.bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: card.color,
            }}>
              {card.icon}
            </Box>
            <Box>
              <Typography variant="h5" fontWeight={600} sx={{ color: '#202124', lineHeight: 1.2 }}>
                {card.value}
              </Typography>
              <Typography variant="caption" sx={{ color: '#5f6368' }}>{card.label}</Typography>
            </Box>
          </Paper>
        ))}
      </Box>

      {/* Main Charts Row */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 3, mb: 4 }}>
        {/* Risk Score Overview */}
        <Paper elevation={0} sx={{ p: 3, borderRadius: 2, border: '1px solid #e0e0e0' }}>
          <Typography variant="subtitle1" fontWeight={600} sx={{ color: '#202124', mb: 2 }}>
            Average Risk Score
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <RiskGauge score={avgRiskScore} />
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-around', mt: 2 }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h6" fontWeight={600} color="#1e8e3e">{lowRiskCount}</Typography>
              <Typography variant="caption" sx={{ color: '#5f6368' }}>Low</Typography>
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h6" fontWeight={600} color="#e37400">{mediumRiskCount}</Typography>
              <Typography variant="caption" sx={{ color: '#5f6368' }}>Medium</Typography>
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h6" fontWeight={600} color="#d93025">{highRiskCount}</Typography>
              <Typography variant="caption" sx={{ color: '#5f6368' }}>High</Typography>
            </Box>
          </Box>
        </Paper>

        {/* Fraud Types Distribution */}
        <Paper elevation={0} sx={{ p: 3, borderRadius: 2, border: '1px solid #e0e0e0' }}>
          <Typography variant="subtitle1" fontWeight={600} sx={{ color: '#202124', mb: 2 }}>
            Fraud Types Detected
          </Typography>
          {fraudChartData.length > 0 ? (
            <FraudTypeChart data={fraudChartData} />
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 180 }}>
              <CheckCircleIcon sx={{ fontSize: 48, color: '#1e8e3e', mb: 1 }} />
              <Typography variant="body2" sx={{ color: '#5f6368' }}>No fraud detected yet</Typography>
            </Box>
          )}
        </Paper>

        {/* Risk Distribution */}
        <Paper elevation={0} sx={{ p: 3, borderRadius: 2, border: '1px solid #e0e0e0' }}>
          <Typography variant="subtitle1" fontWeight={600} sx={{ color: '#202124', mb: 2 }}>
            Risk Distribution
          </Typography>
          {reports.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {[
                { label: 'Low Risk (0-39)', count: lowRiskCount, color: '#1e8e3e', pct: (lowRiskCount / reports.length) * 100 },
                { label: 'Medium Risk (40-69)', count: mediumRiskCount, color: '#e37400', pct: (mediumRiskCount / reports.length) * 100 },
                { label: 'High Risk (70-100)', count: highRiskCount, color: '#d93025', pct: (highRiskCount / reports.length) * 100 },
              ].map(item => (
                <Box key={item.label}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2" sx={{ color: '#3c4043' }}>{item.label}</Typography>
                    <Typography variant="body2" fontWeight={500} sx={{ color: item.color }}>{item.count} ({Math.round(item.pct)}%)</Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={item.pct}
                    sx={{ height: 10, borderRadius: 5, bgcolor: '#f1f3f4', '& .MuiLinearProgress-bar': { bgcolor: item.color, borderRadius: 5 } }}
                  />
                </Box>
              ))}
            </Box>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 180 }}>
              <Typography variant="body2" sx={{ color: '#5f6368' }}>Analyze documents to see distribution</Typography>
            </Box>
          )}
        </Paper>
      </Box>

      {/* Recent Analyses Table */}
      <Paper elevation={0} sx={{ p: 3, borderRadius: 2, border: '1px solid #e0e0e0' }}>
        <Typography variant="subtitle1" fontWeight={600} sx={{ color: '#202124', mb: 2 }}>
          Recent Analyses
        </Typography>
        {recentAnalyses.length > 0 ? (
          <Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 1, px: 1, py: 1, bgcolor: '#f8f9fa', borderRadius: 1, mb: 1 }}>
              <Typography variant="caption" fontWeight={600} sx={{ color: '#5f6368' }}>DOCUMENT</Typography>
              <Typography variant="caption" fontWeight={600} sx={{ color: '#5f6368' }}>RISK SCORE</Typography>
              <Typography variant="caption" fontWeight={600} sx={{ color: '#5f6368' }}>FRAUD FLAGS</Typography>
              <Typography variant="caption" fontWeight={600} sx={{ color: '#5f6368' }}>DATE</Typography>
            </Box>
            {recentAnalyses.map((a) => {
              const doc = documents.find(d => d.id === a.id);
              const riskColor = a.score >= 70 ? '#d93025' : a.score >= 40 ? '#e37400' : '#1e8e3e';
              return (
                <Box key={a.id} sx={{
                  display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 1,
                  px: 1, py: 1.5, borderBottom: '1px solid #f1f3f4', alignItems: 'center',
                  '&:hover': { bgcolor: '#f8f9fa' }, cursor: 'pointer', borderRadius: 1,
                }}>
                  <Typography variant="body2" noWrap sx={{ color: '#202124' }}>
                    {doc?.file_name || a.id.slice(0, 8)}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: riskColor }} />
                    <Typography variant="body2" fontWeight={600} sx={{ color: riskColor }}>{a.score}</Typography>
                  </Box>
                  <Typography variant="body2" sx={{ color: a.fraudCount > 0 ? '#d93025' : '#5f6368' }}>
                    {a.fraudCount > 0 ? `${a.fraudCount} found` : 'None'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#5f6368' }}>
                    {a.date ? new Date(a.date).toLocaleDateString() : '-'}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        ) : (
          <Typography variant="body2" sx={{ color: '#5f6368', textAlign: 'center', py: 4 }}>
            No analyses completed yet. Upload and analyze documents to see insights here.
          </Typography>
        )}
      </Paper>
    </Box>
  );
}
