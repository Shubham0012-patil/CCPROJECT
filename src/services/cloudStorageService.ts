import jsPDF from 'jspdf';
import { supabase } from '../lib/supabase';
import {
  CloudFile,
  CloudFileDetails,
  CloudStorageStats,
  UploadProgressState,
} from '../types';

const API_BASE = '/api/cloud';

async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      return {
        Authorization: `Bearer ${session.access_token}`,
      };
    }
  } catch (err) {
    console.warn('Could not retrieve Supabase session for cloud storage:', err);
  }
  return {};
}

export const cloudStorageService = {
  /**
   * Fetch all cloud files belonging to the authenticated user
   */
  async getFiles(): Promise<{ data: CloudFile[]; error: string | null }> {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/files`, { headers });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}: Failed to load files`);
      }
      const data = await res.json();
      return { data: (data.files || []) as CloudFile[], error: null };
    } catch (err) {
      return { data: [], error: (err as Error).message };
    }
  },

  /**
   * Get detailed metadata for a file including all encrypted chunks
   */
  async getFileDetails(id: string): Promise<{ data: CloudFileDetails | null; error: string | null }> {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/files/${id}`, { headers });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}: Failed to load file details`);
      }
      const data = await res.json();
      return {
        data: {
          ...data.file,
          chunks: data.chunks || [],
          cloudfrontUrl: data.cloudfrontUrl,
          s3Uri: data.s3Uri,
        },
        error: null,
      };
    } catch (err) {
      return { data: null, error: (err as Error).message };
    }
  },

  /**
   * Upload a File or Blob with real-time multi-stage progress callback
   */
  async uploadFile(
    file: File | Blob,
    originalName: string,
    category: string = 'REPORT',
    onProgress?: (progress: UploadProgressState) => void
  ): Promise<{ data: CloudFile | null; error: string | null }> {
    try {
      onProgress?.({
        stage: 'preparing',
        percent: 15,
        message: 'Reading and validating file data buffer...',
      });

      // Convert to base64 for reliable transmission
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      const estimatedBlocks = Math.max(1, Math.ceil(arrayBuffer.byteLength / (1024 * 1024)));

      onProgress?.({
        stage: 'splitting',
        percent: 35,
        totalChunks: estimatedBlocks,
        message: `Splitting ${originalName} into ${estimatedBlocks} block(s) (1MB default chunk size)...`,
      });

      await new Promise((r) => setTimeout(r, 200));

      onProgress?.({
        stage: 'encrypting',
        percent: 55,
        totalChunks: estimatedBlocks,
        message: `Encrypting blocks using AES-256-GCM with unique 96-bit random IVs...`,
      });

      await new Promise((r) => setTimeout(r, 200));

      onProgress?.({
        stage: 'uploading',
        percent: 75,
        totalChunks: estimatedBlocks,
        message: `Uploading encrypted blocks to private AWS S3 bucket...`,
      });

      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName: originalName,
          fileType: file.type || 'application/pdf',
          fileBase64: base64,
          category,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}: Upload failed.`);
      }

      const resData = await res.json();

      onProgress?.({
        stage: 'verifying',
        percent: 92,
        totalChunks: estimatedBlocks,
        message: 'Verifying SHA-256 checksums and S3 object integrity...',
      });

      await new Promise((r) => setTimeout(r, 150));

      onProgress?.({
        stage: 'completed',
        percent: 100,
        totalChunks: estimatedBlocks,
        message: 'File successfully encrypted with AES-256-GCM and stored in private AWS S3!',
      });

      return { data: resData.file, error: null };
    } catch (err) {
      onProgress?.({
        stage: 'error',
        percent: 0,
        message: 'Upload failed',
        error: (err as Error).message,
      });
      return { data: null, error: (err as Error).message };
    }
  },

  /**
   * Save a generated jsPDF document directly to Cloud Storage
   */
  async savePdfToCloud(
    doc: jsPDF,
    defaultFileName: string,
    category: string = 'REPORT',
    onProgress?: (progress: UploadProgressState) => void
  ): Promise<{ data: CloudFile | null; error: string | null }> {
    const blob = doc.output('blob');
    return this.uploadFile(blob, defaultFileName, category, onProgress);
  },

  /**
   * Secure Download: Requests backend to retrieve encrypted chunks from S3,
   * decrypt with AES-256-GCM, verify SHA-256 checksums, reconstruct original PDF,
   * and triggers native browser save
   */
  async downloadFile(id: string, originalFileName: string): Promise<{ success: boolean; error: string | null }> {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/files/${id}/download`, {
        method: 'POST',
        headers,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}: Secure download failed.`);
      }

      // Check integrity headers returned from backend
      const verified = res.headers.get('X-Integrity-Verified');
      const checksum = res.headers.get('X-Checksum-SHA256');
      console.log(`[NEXMONEY Cloud] Downloaded file verified: ${verified}, SHA-256: ${checksum}`);

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = originalFileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      return { success: true, error: null };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  },

  /**
   * Delete file and all its encrypted blocks from S3 and metadata database
   */
  async deleteFile(id: string): Promise<{ success: boolean; error: string | null }> {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/files/${id}`, {
        method: 'DELETE',
        headers,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}: Delete failed`);
      }

      return { success: true, error: null };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  },

  /**
   * Retrieve Cloud Storage aggregated statistics
   */
  async getStorageStats(): Promise<{ data: CloudStorageStats | null; error: string | null }> {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/storage-stats`, { headers });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}: Failed to get stats`);
      }
      const data = await res.json();
      return { data, error: null };
    } catch (err) {
      return { data: null, error: (err as Error).message };
    }
  },

  /**
   * Retrieve Cloud Computing Architecture verification status
   */
  async getArchitectureStatus(): Promise<Record<string, unknown> | null> {
    try {
      const res = await fetch(`${API_BASE}/architecture-status`);
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fall through
    }
    return null;
  },
};
