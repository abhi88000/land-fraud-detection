'use client';

import React, { useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Chip,
  Collapse,
  IconButton,
  Paper,
  Tabs,
  Tab,
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import DescriptionIcon from '@mui/icons-material/Description';
import PlaceIcon from '@mui/icons-material/Place';
import LandscapeIcon from '@mui/icons-material/Landscape';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import StraightenIcon from '@mui/icons-material/Straighten';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { AnalysisReport, LegalFinding, FraudFinding, Party } from '@/lib/types';

type Severity = 'critical' | 'high' | 'medium' | 'low';

interface UnifiedFinding {
  id: string;
  source: 'legal' | 'fraud';
  severity: Severity;
  title: string;
  body: string;
  recommendation: string | null;
  evidence: string[];
}

const SEV_ORDER: Severity[] = ['critical', 'high', 'medium', 'low'];

const SEV_STYLES: Record<Severity, { label: string; tone: string; tint: string; soft: string }> = {
  critical: { label: 'Critical', tone: '#b71c1c', tint: '#fce8e6', soft: '#fef1f0' },
  high:     { label: 'High',     tone: '#d93025', tint: '#fce8e6', soft: '#fef1f0' },
  medium:   { label: 'Medium',   tone: '#b8860b', tint: '#fef7e0', soft: '#fdf8e6' },
  low:      { label: 'Low',      tone: '#1a73e8', tint: '#e8f0fe', soft: '#f0f5ff' },
};

const sevOf = (s: string | undefined): Severity =>
  (s && (['critical','high','medium','low'] as Severity[]).includes(s as Severity)) ? (s as Severity) : 'low';

/** Format area, avoiding "15 Kanals 10 Marlas Kanals, Marlas"-style duplication. */
function formatArea(area?: string, unit?: string): string | null {
  const a = (area || '').trim();
  const u = (unit || '').trim();
  if (!a && !u) return null;
  if (!a) return u;
  if (!u) return a;
  // If unit substrings already appear in the area text, drop the unit
  const lowerA = a.toLowerCase();
  const unitParts = u.split(/[,/]/).map(p => p.trim().toLowerCase()).filter(Boolean);
  const allPresent = unitParts.every(p => p && lowerA.includes(p));
  if (allPresent) return a;
  return `${a} ${u}`;
}

function normaliseRole(role: string): 'seller' | 'buyer' | 'witness' | 'other' {
  const r = (role || '').toLowerCase();
  if (r.includes('sell') || r.includes('vend') && !r.includes('vendee')) return 'seller';
  if (r.includes('vendor')) return 'seller';
  if (r.includes('buy') || r.includes('vendee') || r.includes('purchas')) return 'buyer';
  if (r.includes('witness')) return 'witness';
  return 'other';
}

interface ReportDisplayProps {
  report: AnalysisReport;
}

const ReportDisplay: React.FC<ReportDisplayProps> = ({ report }) => {
  const ed = report.extracted_data;

  // Build a unified, deduped findings list ─────────────────────────────────
  const findings: UnifiedFinding[] = useMemo(() => {
    const out: UnifiedFinding[] = [];
    const seen = new Set<string>();

    for (const f of (report.legal_findings || []) as LegalFinding[]) {
      if (f.is_compliant) continue;
      const key = (f.description || '').trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push({
        id: `l-${f.rule_id || out.length}`,
        source: 'legal',
        severity: sevOf(f.severity),
        title: f.description || f.rule_id || 'Legal concern',
        body: f.explanation || '',
        recommendation: f.remediation_suggestion,
        evidence: [],
      });
    }
    for (const f of (report.fraud_findings || []) as FraudFinding[]) {
      if (!f.is_suspicious) continue;
      const key = (f.description || '').trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push({
        id: `f-${f.fraud_type || out.length}`,
        source: 'fraud',
        severity: sevOf(f.severity),
        title: f.description || f.fraud_type || 'Risk indicator',
        body: '',
        recommendation: f.recommendation,
        evidence: f.evidence || [],
      });
    }
    // Sort by severity priority
    out.sort((a, b) => SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity));
    return out;
  }, [report]);

  const partiesByRole = useMemo(() => {
    const groups: Record<'seller' | 'buyer' | 'witness' | 'other', Party[]> = {
      seller: [], buyer: [], witness: [], other: [],
    };
    for (const p of (ed?.party_names || [])) groups[normaliseRole(p.role)].push(p);
    return groups;
  }, [ed?.party_names]);

  const partySummary = useMemo(() => {
    const parts: string[] = [];
    if (partiesByRole.seller.length)  parts.push(`${partiesByRole.seller.length} seller${partiesByRole.seller.length !== 1 ? 's' : ''}`);
    if (partiesByRole.buyer.length)   parts.push(`${partiesByRole.buyer.length} buyer${partiesByRole.buyer.length !== 1 ? 's' : ''}`);
    if (partiesByRole.witness.length) parts.push(`${partiesByRole.witness.length} witness${partiesByRole.witness.length !== 1 ? 'es' : ''}`);
    if (partiesByRole.other.length)   parts.push(`${partiesByRole.other.length} other`);
    return parts.join(' • ');
  }, [partiesByRole]);

  const docs = report.documents_analyzed || [];
  const missing = report.missing_documents || [];
  const checklist = report.verification_checklist || [];

  const [tab, setTab] = useState(0);
  const [sevFilter, setSevFilter] = useState<Severity | 'all'>('all');

  const filteredFindings = sevFilter === 'all'
    ? findings
    : findings.filter(f => f.severity === sevFilter);

  const sevCounts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of findings) sevCounts[f.severity]++;

  const location = [ed?.property_details?.district, ed?.property_details?.state].filter(Boolean).join(', ');
  const areaText = formatArea(ed?.property_details?.area, ed?.property_details?.unit);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* ─── Property facts card ─── */}
      {ed && (
        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            borderRadius: '16px',
            bgcolor: '#fff',
            boxShadow: '0 1px 2px rgba(60,64,67,0.06), 0 0 0 1px rgba(60,64,67,0.06)',
          }}
        >
          <Typography sx={{
            fontSize: '0.68rem', fontWeight: 600, color: '#5f6368',
            textTransform: 'uppercase', letterSpacing: '0.06em', mb: 1.5,
          }}>
            Property at a glance
          </Typography>
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)', md: 'repeat(6, 1fr)' },
            gap: 1.5,
          }}>
            <Fact icon={<DescriptionIcon sx={{ fontSize: 16 }} />} label="Document" value={ed.document_type || '—'} />
            <Fact icon={<PlaceIcon       sx={{ fontSize: 16 }} />} label="Location" value={location || '—'} />
            <Fact icon={<LandscapeIcon   sx={{ fontSize: 16 }} />} label="Land type" value={ed.property_details?.land_type || '—'} />
            <Fact icon={<StraightenIcon  sx={{ fontSize: 16 }} />} label="Area" value={areaText || '—'} />
            <Fact icon={<ReceiptLongIcon sx={{ fontSize: 16 }} />} label="Stamp duty" value={ed.stamp_duty_amount || '—'} />
            <Fact icon={<CalendarTodayIcon sx={{ fontSize: 16 }} />} label="Registration" value={ed.dates?.registration_date || '—'} />
          </Box>
          {partySummary && (
            <Box sx={{ mt: 1.75, pt: 1.5, borderTop: '1px solid #f1f3f4', display: 'flex', alignItems: 'center', gap: 1.25 }}>
              <Typography sx={{ fontSize: '0.72rem', color: '#5f6368', fontWeight: 500 }}>Parties</Typography>
              <Typography sx={{ fontSize: '0.8rem', color: '#202124', fontWeight: 500 }}>
                {(ed.party_names?.length || 0)} total
              </Typography>
              <Typography sx={{ fontSize: '0.78rem', color: '#80868b' }}>· {partySummary}</Typography>
            </Box>
          )}
        </Paper>
      )}

      {/* ─── Tabs ─── */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: '16px',
          overflow: 'hidden',
          bgcolor: '#fff',
          boxShadow: '0 1px 2px rgba(60,64,67,0.06), 0 0 0 1px rgba(60,64,67,0.06)',
        }}
      >
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{
            px: 1.5, minHeight: 44, borderBottom: '1px solid #f1f3f4',
            '& .MuiTab-root': {
              textTransform: 'none', fontWeight: 500, fontSize: '0.82rem',
              minHeight: 44, color: '#5f6368', px: 1.5,
            },
            '& .Mui-selected': { color: '#1a73e8 !important', fontWeight: 600 },
            '& .MuiTabs-indicator': { height: 2, bgcolor: '#1a73e8' },
          }}
        >
          <Tab label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              Findings
              {findings.length > 0 && (
                <Box sx={{ px: 0.75, py: 0.05, fontSize: '0.65rem', fontWeight: 700, borderRadius: '999px', bgcolor: '#fce8e6', color: '#d93025' }}>
                  {findings.length}
                </Box>
              )}
            </Box>
          } />
          <Tab label={`Documents (${docs.length + missing.length})`} />
          <Tab label={`Checklist (${checklist.length})`} />
          <Tab label="Parties" />
        </Tabs>

        <Box sx={{ p: 2 }}>
          {/* ─── Findings ─── */}
          {tab === 0 && (
            <Box>
              {findings.length === 0 ? (
                <EmptyState text="No major concerns surfaced. Always cross-check with your local sub-registrar before proceeding." />
              ) : (
                <>
                  {/* Severity filter chips */}
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1.5 }}>
                    <FilterChip label={`All ${findings.length}`} active={sevFilter === 'all'} onClick={() => setSevFilter('all')} />
                    {SEV_ORDER.map(s => sevCounts[s] > 0 && (
                      <FilterChip key={s}
                        label={`${SEV_STYLES[s].label} ${sevCounts[s]}`}
                        active={sevFilter === s}
                        tone={SEV_STYLES[s].tone}
                        tint={SEV_STYLES[s].tint}
                        onClick={() => setSevFilter(s)}
                      />
                    ))}
                  </Box>

                  {/* Cards */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {filteredFindings.map(f => <FindingCard key={f.id} f={f} />)}
                  </Box>
                </>
              )}
            </Box>
          )}

          {/* ─── Documents ─── */}
          {tab === 1 && (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
              <DocsBlock title={`Analyzed (${docs.length})`} tone="#1e8e3e" tint="#e6f4ea">
                {docs.length === 0 ? (
                  <Muted>No documents analyzed.</Muted>
                ) : (
                  docs.map((d, i) => (
                    <DocRow key={i} present file={d.file_name} subtitle={d.document_type ? `Detected as ${d.document_type}` : undefined} />
                  ))
                )}
              </DocsBlock>
              <DocsBlock title={`Recommended to obtain (${missing.length})`} tone="#b8860b" tint="#fef7e0">
                {missing.length === 0 ? (
                  <Muted>Nothing else flagged. You appear to have the essentials.</Muted>
                ) : (
                  missing.map((m, i) => <DocRow key={i} file={m} />)
                )}
              </DocsBlock>
            </Box>
          )}

          {/* ─── Checklist ─── */}
          {tab === 2 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {checklist.length === 0 ? (
                <Muted>No checklist available.</Muted>
              ) : (
                checklist.map((c, i) => <ChecklistRow key={i} item={c} />)
              )}
            </Box>
          )}

          {/* ─── Parties ─── */}
          {tab === 3 && (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
              <PartyColumn title="Sellers"   accent="#d93025" people={partiesByRole.seller} />
              <PartyColumn title="Buyers"    accent="#1e8e3e" people={partiesByRole.buyer} />
              <PartyColumn title="Witnesses" accent="#5f6368" people={partiesByRole.witness} />
              {partiesByRole.other.length > 0 && (
                <PartyColumn title="Other parties" accent="#5f6368" people={partiesByRole.other} />
              )}
            </Box>
          )}
        </Box>
      </Paper>

      {/* ─── Disclaimer banner ─── */}
      <Box
        sx={{
          display: 'flex',
          alignItems: { xs: 'flex-start', sm: 'center' },
          flexDirection: { xs: 'column', sm: 'row' },
          gap: { xs: 1, sm: 1.75 },
          px: 2,
          py: 1.5,
          borderRadius: '14px',
          background:
            'linear-gradient(135deg, rgba(232,240,254,0.7) 0%, rgba(243,232,255,0.55) 100%)',
          boxShadow: '0 0 0 1px rgba(26,115,232,0.10)',
        }}
      >
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: '10px',
            bgcolor: 'rgba(26,115,232,0.12)',
            color: '#1a73e8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <InfoOutlinedIcon sx={{ fontSize: 18 }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: '0.82rem',
              fontWeight: 600,
              color: '#202124',
              lineHeight: 1.4,
              mb: 0.2,
            }}
          >
            AI-assisted review · Not a legal opinion
          </Typography>
          <Typography
            sx={{
              fontSize: '0.76rem',
              color: '#5f6368',
              lineHeight: 1.5,
            }}
          >
            This summary highlights areas worth verifying. Always consult a qualified property
            lawyer or your local sub-registrar before making any decision.
          </Typography>
        </Box>
        {(() => {
          const raw = report.generated_at;
          if (!raw) return null;
          const d = new Date(raw as any);
          if (isNaN(d.getTime())) return null;
          const formatted = d.toLocaleString(undefined, {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });
          return (
            <Typography
              sx={{
                fontSize: '0.7rem',
                color: '#5f6368',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                pl: { xs: 0, sm: 1 },
                pt: { xs: 0.5, sm: 0 },
                borderLeft: { xs: 'none', sm: '1px solid rgba(95,99,104,0.18)' },
                ml: { xs: 0, sm: 0.5 },
              }}
              title={d.toString()}
            >
              Generated<br />
              <Box component="span" sx={{ color: '#202124', fontWeight: 600 }}>{formatted}</Box>
            </Typography>
          );
        })()}
      </Box>
    </Box>
  );
};

export default ReportDisplay;

/* ─────────────────────── Sub-components ─────────────────────── */

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25, color: '#5f6368' }}>
        {icon}
        <Typography sx={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
          {label}
        </Typography>
      </Box>
      <Typography sx={{
        fontSize: '0.85rem', color: '#202124', fontWeight: 500,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {value}
      </Typography>
    </Box>
  );
}

function FilterChip({ label, active, onClick, tone, tint }: { label: string; active: boolean; onClick: () => void; tone?: string; tint?: string }) {
  const t = tone || '#1a73e8';
  const bg = tint || '#e8f0fe';
  return (
    <Box
      onClick={onClick}
      sx={{
        px: 1.25, py: 0.4, borderRadius: '100px', cursor: 'pointer',
        fontSize: '0.72rem', fontWeight: 600,
        border: `1px solid ${active ? t : '#e8eaed'}`,
        bgcolor: active ? bg : '#fff',
        color: active ? t : '#5f6368',
        userSelect: 'none',
        transition: 'all 0.18s ease',
        '&:hover': { borderColor: t, color: t },
      }}
    >
      {label}
    </Box>
  );
}

function FindingCard({ f }: { f: UnifiedFinding }) {
  const [open, setOpen] = useState(false);
  const s = SEV_STYLES[f.severity];
  const hasBody = !!(f.body || f.recommendation || (f.evidence && f.evidence.length));
  const isCritical = f.severity === 'critical';

  return (
    <Box
      sx={{
        borderRadius: '12px',
        bgcolor: isCritical ? '#fff5f5' : '#fff',
        overflow: 'hidden',
        boxShadow: isCritical
          ? '0 0 0 1.5px #d93025, 0 2px 8px rgba(217,48,37,0.12)'
          : '0 0 0 1px rgba(60,64,67,0.07)',
        transition: 'box-shadow 0.2s ease, transform 0.2s ease',
        '&:hover': {
          boxShadow: isCritical
            ? '0 0 0 1.5px #d93025, 0 4px 14px rgba(217,48,37,0.18)'
            : '0 1px 3px rgba(60,64,67,0.10), 0 0 0 1px rgba(60,64,67,0.10)',
        },
      }}
    >
      <Box
        onClick={() => hasBody && setOpen(o => !o)}
        sx={{
          display: 'flex', alignItems: 'flex-start', gap: 1.25, p: 1.5,
          cursor: hasBody ? 'pointer' : 'default',
          position: 'relative',
        }}
      >
        {/* Severity stripe — thicker + brighter for Critical */}
        <Box sx={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: isCritical ? 6 : 3,
          bgcolor: isCritical ? '#b71c1c' : s.tone,
        }} />
        <Box sx={{ pl: isCritical ? 1 : 0.5, flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.4, flexWrap: 'wrap' }}>
            {isCritical && (
              <ErrorOutlineIcon sx={{ fontSize: 16, color: '#b71c1c' }} />
            )}
            <Chip
              label={s.label}
              size="small"
              sx={{
                height: 20,
                fontSize: isCritical ? '0.66rem' : '0.62rem',
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: isCritical ? 'uppercase' : 'none',
                bgcolor: isCritical ? '#b71c1c' : s.tint,
                color: isCritical ? '#fff' : s.tone,
                borderRadius: '4px',
                px: isCritical ? 0.5 : 0,
              }}
            />
            <Typography sx={{
              fontSize: '0.65rem', fontWeight: 500, color: '#80868b',
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              {f.source === 'legal' ? 'Legal' : 'Risk indicator'}
            </Typography>
          </Box>
          <Typography sx={{
            fontSize: '0.86rem',
            color: isCritical ? '#7f1d1d' : '#202124',
            fontWeight: isCritical ? 600 : 500,
            lineHeight: 1.45,
          }}>
            {f.title}
          </Typography>
        </Box>
        {hasBody && (
          <IconButton size="small" sx={{ p: 0.5 }}>
            <KeyboardArrowDownIcon sx={{
              fontSize: 18, color: '#5f6368',
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
            }} />
          </IconButton>
        )}
      </Box>
      {hasBody && (
        <Collapse in={open}>
          <Box sx={{ px: 2, pb: 1.75, pt: 0, ml: 0.5 }}>
            {f.body && (
              <Typography sx={{ fontSize: '0.8rem', color: '#3c4043', lineHeight: 1.65, mb: f.recommendation ? 1.25 : 0 }}>
                {f.body}
              </Typography>
            )}
            {f.evidence && f.evidence.length > 0 && (
              <Box sx={{ mb: f.recommendation ? 1.25 : 0 }}>
                <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: '#5f6368', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>
                  Evidence
                </Typography>
                {f.evidence.map((e, i) => (
                  <Typography key={i} sx={{ fontSize: '0.78rem', color: '#5f6368', lineHeight: 1.55, mb: 0.25 }}>
                    · {e}
                  </Typography>
                ))}
              </Box>
            )}
            {f.recommendation && (
              <Box sx={{
                p: 1.25, borderRadius: '10px', bgcolor: '#f0f5ff', border: '1px solid #dde6fa',
              }}>
                <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: '#1a73e8', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>
                  What to do
                </Typography>
                <Typography sx={{ fontSize: '0.8rem', color: '#202124', lineHeight: 1.6 }}>
                  {f.recommendation}
                </Typography>
              </Box>
            )}
          </Box>
        </Collapse>
      )}
    </Box>
  );
}

function DocsBlock({ title, tone, tint, children }: { title: string; tone: string; tint: string; children: React.ReactNode }) {
  return (
    <Box sx={{ borderRadius: '12px', overflow: 'hidden', boxShadow: '0 0 0 1px rgba(60,64,67,0.07)' }}>
      <Box sx={{ px: 1.5, py: 1, bgcolor: tint }}>
        <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: tone, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {title}
        </Typography>
      </Box>
      <Box sx={{ p: 1 }}>
        {children}
      </Box>
    </Box>
  );
}

function DocRow({ file, subtitle, present }: { file: string; subtitle?: string; present?: boolean }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, borderRadius: '8px', '&:hover': { bgcolor: '#f8f9fa' } }}>
      <Box sx={{
        width: 24, height: 24, borderRadius: '6px',
        bgcolor: present ? '#e6f4ea' : '#f1f3f4',
        color: present ? '#1e8e3e' : '#80868b',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {present
          ? <CheckCircleIcon sx={{ fontSize: 16 }} />
          : <InsertDriveFileIcon sx={{ fontSize: 14 }} />}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{
          fontSize: '0.8rem', color: '#202124', fontWeight: 500,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {file}
        </Typography>
        {subtitle && (
          <Typography sx={{ fontSize: '0.7rem', color: '#80868b' }}>{subtitle}</Typography>
        )}
      </Box>
    </Box>
  );
}

function ChecklistRow({ item }: { item: { item: string; is_checked: boolean; details?: string } }) {
  const [open, setOpen] = useState(false);
  const hasDetails = !!item.details;
  return (
    <Box
      sx={{
        borderRadius: '10px',
        border: '1px solid #e8eaed',
        bgcolor: item.is_checked ? '#f7fcf9' : '#fff',
        overflow: 'hidden',
      }}
    >
      <Box
        onClick={() => hasDetails && setOpen(o => !o)}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1.25, p: 1.25,
          cursor: hasDetails ? 'pointer' : 'default',
        }}
      >
        {item.is_checked
          ? <CheckCircleIcon sx={{ fontSize: 20, color: '#1e8e3e' }} />
          : <RadioButtonUncheckedIcon sx={{ fontSize: 20, color: '#dadce0' }} />}
        <Typography sx={{
          flex: 1, fontSize: '0.82rem',
          color: item.is_checked ? '#3c4043' : '#202124',
          fontWeight: 500, lineHeight: 1.5,
        }}>
          {item.item}
        </Typography>
        {hasDetails && (
          <KeyboardArrowDownIcon sx={{
            fontSize: 18, color: '#80868b',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
          }} />
        )}
      </Box>
      {hasDetails && (
        <Collapse in={open}>
          <Box sx={{ px: 1.75, pb: 1.25, pl: 5 }}>
            <Typography sx={{ fontSize: '0.78rem', color: '#5f6368', lineHeight: 1.6 }}>
              {item.details}
            </Typography>
          </Box>
        </Collapse>
      )}
    </Box>
  );
}

function PartyColumn({ title, accent, people }: { title: string; accent: string; people: Party[] }) {
  if (people.length === 0) {
    return (
      <Box sx={{ borderRadius: '12px', border: '1px solid #e8eaed', p: 1.5 }}>
        <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>
          {title}
        </Typography>
        <Muted>None listed.</Muted>
      </Box>
    );
  }
  return (
    <Box sx={{ borderRadius: '12px', border: '1px solid #e8eaed', overflow: 'hidden' }}>
      <Box sx={{ px: 1.5, py: 1, borderBottom: '1px solid #f1f3f4', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {title}
        </Typography>
        <Typography sx={{ fontSize: '0.7rem', color: '#80868b' }}>{people.length}</Typography>
      </Box>
      <Box sx={{ p: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {people.map((p, i) => (
          <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 0.75, borderRadius: '8px', '&:hover': { bgcolor: '#f8f9fa' } }}>
            <Box sx={{
              width: 28, height: 28, borderRadius: '50%',
              bgcolor: '#f1f3f4', color: '#3c4043',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.72rem', fontWeight: 600, flexShrink: 0,
            }}>
              {p.name.replace(/^Shri\.?\s+|^M\/s\.?\s+|^Smt\.?\s+/i, '').trim().charAt(0).toUpperCase()}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: '0.8rem', color: '#202124', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.name}
              </Typography>
              {p.role && p.role.toLowerCase() !== title.toLowerCase().slice(0, -1) && (
                <Typography sx={{ fontSize: '0.68rem', color: '#80868b' }}>{p.role}</Typography>
              )}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <Box sx={{ py: 4, textAlign: 'center' }}>
      <CheckCircleIcon sx={{ fontSize: 32, color: '#1e8e3e', mb: 1 }} />
      <Typography sx={{ fontSize: '0.85rem', color: '#3c4043', fontWeight: 500 }}>{text}</Typography>
    </Box>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return (
    <Typography sx={{ fontSize: '0.78rem', color: '#80868b', py: 1, px: 1 }}>{children}</Typography>
  );
}
