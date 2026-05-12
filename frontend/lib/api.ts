import { Document, Bundle } from './types';

// Use Next.js proxy to avoid CORS issues (same-origin calls from browser)
const API_V1 = '/proxy/v1';

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

export async function uploadDocument(file: File, token?: string, state?: string, district?: string, landType?: string): Promise<{ document_id: string; message: string }> {
  const formData = new FormData();
  formData.append('file', file);
  if (state) formData.append('state', state);
  if (district) formData.append('district', district);
  if (landType) formData.append('land_type', landType);

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

export async function analyzeDocuments(documentIds: string[], token?: string): Promise<{ message: string }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_V1}/analysis/analyze`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ document_ids: documentIds }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to start analysis');
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

// ─── Bundle API ───

export async function createBundle(
  files: File[],
  state: string,
  district: string,
  landType: string,
  token?: string
): Promise<{ bundle_id: string; message: string }> {
  const formData = new FormData();
  formData.append('state', state);
  formData.append('district', district);
  formData.append('land_type', landType);
  for (const file of files) {
    formData.append('files', file);
  }

  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_V1}/bundles/create`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to create bundle');
  }
  return await response.json();
}

export async function fetchBundles(token?: string): Promise<{ bundles: Bundle[] }> {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_V1}/bundles`, { headers });
  if (!response.ok) throw new Error('Failed to fetch bundles');
  const result = await response.json();
  return { bundles: result.bundles || [] };
}

export async function fetchBundleDetails(bundleId: string, token?: string): Promise<{ bundle: Bundle; documents: any[] }> {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_V1}/bundles/${bundleId}`, { headers });
  if (!response.ok) throw new Error('Failed to fetch bundle details');
  return await response.json();
}

export async function analyzeBundle(bundleId: string, token?: string): Promise<{ message: string }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_V1}/bundles/${bundleId}/analyze`, {
    method: 'POST',
    headers,
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to start analysis');
  }
  return await response.json();
}

export async function fetchBundleReport(bundleId: string, token?: string): Promise<{ report: any }> {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_V1}/bundles/${bundleId}/report`, { headers });
  if (!response.ok) throw new Error('Failed to fetch bundle report');
  return await response.json();
}

export async function deleteBundle(bundleId: string, token?: string): Promise<void> {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${API_V1}/bundles/${bundleId}`, {
    method: 'DELETE',
    headers,
  });
  if (!response.ok) throw new Error('Failed to delete bundle');
}
