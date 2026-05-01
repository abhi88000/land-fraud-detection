'use client';

import React from 'react';
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
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { Document, DocumentStatus } from '@/lib/types';
import { useRouter } from 'next/navigation';

interface DocumentListProps {
  documents: Document[];
  onDelete?: () => void;
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

const DocumentList: React.FC<DocumentListProps> = ({ documents, onDelete }) => {
  const router = useRouter();

  if (documents.length === 0) {
    return (
      <Typography variant="body1" sx={{ textAlign: 'center', mt: 4 }}>
        No documents found. Upload your first document to get started.
      </Typography>
    );
  }

  return (
    <TableContainer component={Paper} sx={{ mt: 3, borderRadius: 2 }}>
      <Table>
        <TableHead>
          <TableRow sx={{ bgcolor: 'action.hover' }}>
            <TableCell><strong>Document Name</strong></TableCell>
            <TableCell><strong>Type</strong></TableCell>
            <TableCell><strong>Status</strong></TableCell>
            <TableCell><strong>Progress</strong></TableCell>
            <TableCell><strong>Created At</strong></TableCell>
            <TableCell align="center"><strong>Actions</strong></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {documents.map((doc) => (
            <TableRow key={doc.id} hover>
              <TableCell>{doc.file_name}</TableCell>
              <TableCell>{doc.content_type}</TableCell>
              <TableCell>
                <Chip
                  label={doc.status.toUpperCase()}
                  color={getStatusColor(doc.status) as any}
                  size="small"
                />
              </TableCell>
              <TableCell>
                {doc.progress_percentage !== undefined ? `${doc.progress_percentage}%` : 'N/A'}
              </TableCell>
              <TableCell>
                {new Date(doc.created_at).toLocaleDateString()}
              </TableCell>
              <TableCell align="center">
                <IconButton
                  color="primary"
                  onClick={() => router.push(`/documents/${doc.id}`)}
                >
                  <VisibilityIcon />
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default DocumentList;
