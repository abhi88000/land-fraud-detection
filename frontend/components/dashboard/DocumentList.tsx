'use client';

import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Typography,
  Tooltip,
  Checkbox,
  Box,
  Button,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DeleteIcon from '@mui/icons-material/Delete';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import DescriptionIcon from '@mui/icons-material/Description';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { Document, DocumentStatus } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { deleteDocument, analyzeDocuments } from '@/lib/api';
import { useAuth } from '@/lib/firebase/auth';

interface DocumentListProps {
  documents: Document[];
  onDelete?: () => void;
  onAnalysisStarted?: () => void;
}

const getStatusConfig = (status: DocumentStatus): { label: string; color: 'success' | 'warning' | 'error' | 'default' | 'info'; variant: 'filled' | 'outlined' } => {
  switch (status) {
    case DocumentStatus.COMPLETED:
      return { label: 'Analyzed', color: 'success', variant: 'filled' };
    case DocumentStatus.IN_PROGRESS:
      return { label: 'Analyzing...', color: 'warning', variant: 'filled' };
    case DocumentStatus.FAILED:
      return { label: 'Failed', color: 'error', variant: 'filled' };
    case DocumentStatus.PENDING:
    case DocumentStatus.UPLOADED:
    default:
      return { label: 'Ready', color: 'default', variant: 'outlined' };
  }
};



const DocumentList: React.FC<DocumentListProps> = ({ documents, onDelete, onAnalysisStarted }) => {
  const router = useRouter();
  const { user } = useAuth();
  const [selected, setSelected] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);

  const handleSelect = (docId: string) => {
    setSelected(prev =>
      prev.includes(docId) ? prev.filter(id => id !== docId) : [...prev, docId]
    );
  };

  const handleSelectAll = () => {
    if (selected.length === documents.length) {
      setSelected([]);
    } else {
      setSelected(documents.map(d => d.id));
    }
  };

  const handleAnalyze = async (docIds?: string[]) => {
    const idsToAnalyze = docIds || selected;
    if (idsToAnalyze.length === 0) return;
    setAnalyzing(true);
    try {
      const token = await user?.getIdToken();
      await analyzeDocuments(idsToAnalyze, token);
      onAnalysisStarted?.();
      // Navigate to batch view
      if (idsToAnalyze.length === 1) {
        router.push(`/documents/${idsToAnalyze[0]}`);
      } else {
        router.push(`/documents/batch?ids=${idsToAnalyze.join(',')}`);
      }
      setSelected([]);
    } catch (err: any) {
      console.error('Failed to start analysis:', err);
      alert(err.message || 'Failed to start analysis');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm('Delete this document?')) return;
    try {
      const token = await user?.getIdToken();
      await deleteDocument(docId, token);
      setSelected(prev => prev.filter(id => id !== docId));
      onDelete?.();
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  if (documents.length === 0) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 6, textAlign: 'center', borderRadius: 2,
          border: '1px solid #e0e0e0', bgcolor: 'white',
        }}
      >
        <DescriptionIcon sx={{ fontSize: 48, color: '#dadce0', mb: 2 }} />
        <Typography variant="body1" sx={{ color: '#5f6368', mb: 1 }}>
          No documents yet
        </Typography>
        <Typography variant="body2" sx={{ color: '#80868b' }}>
          Upload land documents to get started with AI analysis
        </Typography>
      </Paper>
    );
  }

  return (
    <Box>
      {/* Analyze All Documents button - prominent collective action */}
      {documents.length > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
          {documents.some(d => d.status !== DocumentStatus.COMPLETED) && (
            <Button
              variant="contained"
              startIcon={<AutoAwesomeIcon />}
              onClick={() => {
                const unanalyzed = documents.filter(d => d.status !== DocumentStatus.COMPLETED && d.status !== DocumentStatus.IN_PROGRESS).map(d => d.id);
                if (unanalyzed.length === 0) return;
                handleAnalyze(unanalyzed);
              }}
              disabled={analyzing}
              disableElevation
              sx={{
                borderRadius: '100px', textTransform: 'none', fontWeight: 600,
                bgcolor: '#202124', px: 3, py: 1,
                '&:hover': { bgcolor: '#303134' },
              }}
            >
              {analyzing ? 'Starting...' : 'Analyze All Documents'}
            </Button>
          )}
          {documents.filter(d => d.status === DocumentStatus.COMPLETED).length >= 2 && (
            <Button
              variant="outlined"
              startIcon={<VisibilityIcon />}
              onClick={() => {
                const analyzedIds = documents.filter(d => d.status === DocumentStatus.COMPLETED).map(d => d.id);
                router.push(`/documents/batch?ids=${analyzedIds.join(',')}`);
              }}
              sx={{
                borderRadius: '100px', textTransform: 'none', fontWeight: 600,
                borderColor: '#dadce0', color: '#1a73e8', px: 3, py: 1,
                '&:hover': { borderColor: '#1a73e8', bgcolor: '#f0f7ff' },
              }}
            >
              View Combined Report
            </Button>
          )}
          {selected.length > 0 && (
            <Typography variant="body2" sx={{ color: '#5f6368' }}>
              {selected.length} selected
            </Typography>
          )}
        </Box>
      )}

      <TableContainer
        component={Paper}
        elevation={0}
        sx={{ borderRadius: 2, border: '1px solid #e0e0e0' }}
      >
        <Table>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox" sx={{ bgcolor: '#f8f9fa', borderBottom: '2px solid #e0e0e0' }}>
                <Checkbox
                  size="small"
                  indeterminate={selected.length > 0 && selected.length < documents.length}
                  checked={selected.length === documents.length}
                  onChange={handleSelectAll}
                />
              </TableCell>
              <TableCell sx={{ bgcolor: '#f8f9fa', borderBottom: '2px solid #e0e0e0', fontWeight: 500, color: '#5f6368', fontSize: '0.8rem' }}>
                Name
              </TableCell>
              <TableCell sx={{ bgcolor: '#f8f9fa', borderBottom: '2px solid #e0e0e0', fontWeight: 500, color: '#5f6368', fontSize: '0.8rem' }}>
                Location
              </TableCell>
              <TableCell sx={{ bgcolor: '#f8f9fa', borderBottom: '2px solid #e0e0e0', fontWeight: 500, color: '#5f6368', fontSize: '0.8rem' }}>
                Status
              </TableCell>
              <TableCell sx={{ bgcolor: '#f8f9fa', borderBottom: '2px solid #e0e0e0', fontWeight: 500, color: '#5f6368', fontSize: '0.8rem' }} align="right">
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {documents.map((doc) => {
              const statusCfg = getStatusConfig(doc.status);
              return (
                <TableRow
                  key={doc.id}
                  hover
                  selected={selected.includes(doc.id)}
                  sx={{ '&:last-child td': { borderBottom: 0 } }}
                >
                  <TableCell padding="checkbox">
                    <Checkbox
                      size="small"
                      checked={selected.includes(doc.id)}
                      onChange={() => handleSelect(doc.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <DescriptionIcon sx={{ fontSize: 20, color: '#4285f4' }} />
                      <Typography variant="body2" fontWeight={500} sx={{ color: '#202124' }}>
                        {doc.file_name}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ color: '#5f6368' }}>
                      {doc.state || doc.district
                        ? `${doc.state || ''}${doc.state && doc.district ? ', ' : ''}${doc.district || ''}`
                        : '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={statusCfg.label}
                      color={statusCfg.color as any}
                      variant={statusCfg.variant as any}
                      size="small"
                      sx={{ fontWeight: 500, fontSize: '0.75rem' }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    {doc.status === DocumentStatus.COMPLETED && (
                      <Tooltip title="View Report">
                        <IconButton
                          size="small"
                          onClick={() => router.push(`/documents/${doc.id}`)}
                          sx={{ color: '#1a73e8' }}
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title="Delete">
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(doc.id)}
                        sx={{ color: '#5f6368', '&:hover': { color: '#d93025' } }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default DocumentList;
