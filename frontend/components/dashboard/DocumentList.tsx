'use client';

import React, { useState } from 'react';
import {
  Paper,
  Chip,
  IconButton,
  Typography,
  Tooltip,
  Box,
  Button,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DeleteIcon from '@mui/icons-material/Delete';
import DescriptionIcon from '@mui/icons-material/Description';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import PlaceIcon from '@mui/icons-material/Place';
import { Document, DocumentStatus } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { deleteDocument, analyzeDocuments } from '@/lib/api';
import { useAuth } from '@/lib/firebase/auth';

interface DocumentListProps {
  documents: Document[];
  onDelete?: () => void;
  onAnalysisStarted?: () => void;
}

const getStatusConfig = (status: DocumentStatus): { label: string; color: string; bg: string } => {
  switch (status) {
    case DocumentStatus.COMPLETED:
      return { label: 'Reviewed', color: '#1e8e3e', bg: '#e6f4ea' };
    case DocumentStatus.IN_PROGRESS:
      return { label: 'Reviewing...', color: '#e37400', bg: '#fef7e0' };
    case DocumentStatus.FAILED:
      return { label: 'Failed', color: '#d93025', bg: '#fce8e6' };
    case DocumentStatus.PENDING:
    case DocumentStatus.UPLOADED:
    default:
      return { label: 'Ready', color: '#5f6368', bg: '#f1f3f4' };
  }
};



const DocumentList: React.FC<DocumentListProps> = ({ documents, onDelete, onAnalysisStarted }) => {
  const router = useRouter();
  const { user } = useAuth();
  const [analyzing, setAnalyzing] = useState(false);

  const handleAnalyze = async (docIds: string[]) => {
    if (docIds.length === 0) return;
    setAnalyzing(true);
    try {
      const token = await user?.getIdToken();
      await analyzeDocuments(docIds, token);
      onAnalysisStarted?.();
      if (docIds.length === 1) {
        router.push(`/documents/${docIds[0]}`);
      } else {
        router.push(`/documents/batch?ids=${docIds.join(',')}`);
      }
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
          p: 6, textAlign: 'center', borderRadius: '16px',
          border: '1px solid #e8eaed', bgcolor: 'white',
        }}
      >
        <DescriptionIcon sx={{ fontSize: 48, color: '#dadce0', mb: 2 }} />
        <Typography sx={{ color: '#5f6368', mb: 0.5, fontWeight: 500 }}>
          No documents yet
        </Typography>
        <Typography variant="body2" sx={{ color: '#80868b' }}>
          Upload land documents to get started
        </Typography>
      </Paper>
    );
  }

  const unanalyzed = documents.filter(d => d.status !== DocumentStatus.COMPLETED && d.status !== DocumentStatus.IN_PROGRESS);
  const analyzed = documents.filter(d => d.status === DocumentStatus.COMPLETED);

  return (
    <Box>
      {/* Action bar */}
      {(unanalyzed.length > 0 || analyzed.length >= 2) && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          {unanalyzed.length > 0 && (
            <Button
              variant="contained"
              startIcon={<AutoAwesomeIcon />}
              onClick={() => handleAnalyze(unanalyzed.map(d => d.id))}
              disabled={analyzing}
              disableElevation
              size="small"
              sx={{
                borderRadius: '100px', textTransform: 'none', fontWeight: 600,
                bgcolor: '#202124', px: 2.5, py: 0.8,
                '&:hover': { bgcolor: '#303134' },
              }}
            >
              {analyzing ? 'Starting...' : `Review All (${unanalyzed.length})`}
            </Button>
          )}
          {analyzed.length >= 2 && (
            <Button
              variant="outlined"
              startIcon={<VisibilityIcon />}
              onClick={() => router.push(`/documents/batch?ids=${analyzed.map(d => d.id).join(',')}`)}
              size="small"
              sx={{
                borderRadius: '100px', textTransform: 'none', fontWeight: 600,
                borderColor: '#dadce0', color: '#1a73e8', px: 2.5, py: 0.8,
                '&:hover': { borderColor: '#1a73e8', bgcolor: '#f0f7ff' },
              }}
            >
              Combined Report
            </Button>
          )}
        </Box>
      )}

      {/* Document cards */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {documents.map((doc) => {
          const statusCfg = getStatusConfig(doc.status);
          const location = doc.state || doc.district
            ? `${doc.state || ''}${doc.state && doc.district ? ', ' : ''}${doc.district || ''}`
            : null;

          return (
            <Paper
              key={doc.id}
              elevation={0}
              onClick={() => doc.status === DocumentStatus.COMPLETED ? router.push(`/documents/${doc.id}`) : null}
              sx={{
                p: 2, borderRadius: '12px', border: '1px solid #e8eaed', bgcolor: 'white',
                display: 'flex', alignItems: 'center', gap: 2,
                cursor: doc.status === DocumentStatus.COMPLETED ? 'pointer' : 'default',
                transition: 'all 0.15s ease',
                '&:hover': { borderColor: '#d2d5d9', bgcolor: '#fafafa' },
              }}
            >
              {/* Icon */}
              <Box sx={{
                width: 40, height: 40, borderRadius: '10px', bgcolor: '#e8f0fe',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <DescriptionIcon sx={{ fontSize: 20, color: '#1a73e8' }} />
              </Box>

              {/* Info */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 500, color: '#202124', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {doc.file_name}
                </Typography>
                {location && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
                    <PlaceIcon sx={{ fontSize: 12, color: '#80868b' }} />
                    <Typography variant="caption" sx={{ color: '#80868b' }}>{location}</Typography>
                  </Box>
                )}
              </Box>

              {/* Status */}
              <Chip
                label={statusCfg.label}
                size="small"
                sx={{
                  fontWeight: 600, fontSize: '0.7rem', height: 24,
                  bgcolor: statusCfg.bg, color: statusCfg.color, border: 'none',
                }}
              />

              {/* Actions */}
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                {(doc.status === DocumentStatus.PENDING || doc.status === DocumentStatus.UPLOADED) && (
                  <Tooltip title="Start Review">
                    <IconButton
                      size="small"
                      onClick={(e) => { e.stopPropagation(); handleAnalyze([doc.id]); }}
                      sx={{ color: '#1a73e8' }}
                    >
                      <AutoAwesomeIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                {doc.status === DocumentStatus.COMPLETED && (
                  <Tooltip title="View Report">
                    <IconButton
                      size="small"
                      onClick={(e) => { e.stopPropagation(); router.push(`/documents/${doc.id}`); }}
                      sx={{ color: '#1a73e8' }}
                    >
                      <VisibilityIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title="Delete">
                  <IconButton
                    size="small"
                    onClick={(e) => { e.stopPropagation(); handleDelete(doc.id); }}
                    sx={{ color: '#dadce0', '&:hover': { color: '#d93025' } }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Paper>
          );
        })}
      </Box>
    </Box>
  );
};

export default DocumentList;
