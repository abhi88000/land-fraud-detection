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
import { Document, DocumentStatus } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { deleteDocument, analyzeDocuments } from '@/lib/api';
import { useAuth } from '@/lib/firebase/auth';

interface DocumentListProps {
  documents: Document[];
  onDelete?: () => void;
  onAnalysisStarted?: () => void;
}

const getStatusColor = (status: DocumentStatus) => {
  switch (status) {
    case DocumentStatus.COMPLETED:
      return 'success';
    case DocumentStatus.IN_PROGRESS:
      return 'warning';
    case DocumentStatus.FAILED:
      return 'error';
    default:
      return 'default';
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

  const handleAnalyze = async () => {
    if (selected.length === 0) return;
    setAnalyzing(true);
    try {
      const token = await user?.getIdToken();
      await analyzeDocuments(selected, token);
      setSelected([]);
      onAnalysisStarted?.();
      // Navigate to the first document's analysis page
      router.push(`/documents/${selected[0]}`);
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
      <Typography variant="body1" sx={{ textAlign: 'center', mt: 4 }}>
        No documents found. Upload your first document to get started.
      </Typography>
    );
  }

  const pendingDocs = documents.filter(d => d.status === DocumentStatus.PENDING || d.status === DocumentStatus.UPLOADED);

  return (
    <Box>
      {/* Analyze Selected Button */}
      {selected.length > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, p: 2, bgcolor: 'primary.50', borderRadius: 2, border: '1px solid', borderColor: 'primary.200' }}>
          <Typography variant="body2" fontWeight="bold">
            {selected.length} document(s) selected
          </Typography>
          <Button
            variant="contained"
            color="primary"
            startIcon={<PlayArrowIcon />}
            onClick={handleAnalyze}
            disabled={analyzing}
            size="small"
          >
            {analyzing ? 'Starting...' : 'Analyze Selected'}
          </Button>
        </Box>
      )}

      <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: 'action.hover' }}>
              <TableCell padding="checkbox">
                <Checkbox
                  indeterminate={selected.length > 0 && selected.length < documents.length}
                  checked={selected.length === documents.length}
                  onChange={handleSelectAll}
                />
              </TableCell>
              <TableCell><strong>Document Name</strong></TableCell>
              <TableCell><strong>State / District</strong></TableCell>
              <TableCell><strong>Status</strong></TableCell>
              <TableCell><strong>Uploaded</strong></TableCell>
              <TableCell align="center"><strong>Actions</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {documents.map((doc) => (
              <TableRow key={doc.id} hover selected={selected.includes(doc.id)}>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={selected.includes(doc.id)}
                    onChange={() => handleSelect(doc.id)}
                  />
                </TableCell>
                <TableCell>{doc.file_name}</TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary">
                    {doc.state || ''}{doc.state && doc.district ? ', ' : ''}{doc.district || ''}
                    {!doc.state && !doc.district ? '—' : ''}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={doc.status.toUpperCase().replace('_', ' ')}
                    color={getStatusColor(doc.status) as any}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  {new Date(doc.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell align="center">
                  {doc.status === DocumentStatus.COMPLETED && (
                    <Tooltip title="View Report">
                      <IconButton
                        color="primary"
                        onClick={() => router.push(`/documents/${doc.id}`)}
                      >
                        <VisibilityIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                  <Tooltip title="Delete">
                    <IconButton
                      color="error"
                      onClick={() => handleDelete(doc.id)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default DocumentList;
