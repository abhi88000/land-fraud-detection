import { Document } from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL || '';
// NEXT_PUBLIC_BACKEND_API_URL should be the full base like http://localhost:8000/api/v1
const API_V1 = API_BASE_URL;

export async function fetchDocuments(token?: string): Promise<{ documents: Document[] }> {
  try {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(`${API_V1}/documents`, { headers });
    if (!response.ok) {
      throw new Error('Failed to fetch documents');
    }
    const result = await response.json();
    return { documents: result.documents || [] };
  } catch (error) {
    console.error('Error fetching documents:', error);
    return { documents: [] };
  }
}

export async function uploadDocument(file: File, token?: string): Promise<{ document_id: string; message: string }> {
  const formData = new FormData();
  formData.append('file', file);

  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_V1}/documents/upload`, {
    method: 'POST',
    headers: headers,
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to upload document');
  }

  return await response.json();
}

export async function fetchDocumentDetails(id: string, token?: string): Promise<{ document: Document }> {
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const response = await fetch(`${API_V1}/documents/${id}`, { headers });
  if (!response.ok) {
    throw new Error('Failed to fetch document details');
  }
  const result = await response.json();
  return { document: result.document };
}

export async function fetchAnalysisReport(id: string, token?: string): Promise<{ report: any }> {
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const response = await fetch(`${API_V1}/analysis/report/${id}`, { headers });
  if (!response.ok) {
    throw new Error('Failed to fetch analysis report');
  }
  const result = await response.json();
  return { report: result.report };
}

export async function deleteDocument(id: string, token?: string): Promise<void> {
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const response = await fetch(`${API_V1}/documents/${id}`, {
    method: 'DELETE',
    headers,
  });
  if (!response.ok) {
    throw new Error('Failed to delete document');
  }
}
