import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { encryptionService } from '../../server/crypto';
import { s3Storage } from '../../server/s3Storage';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

async function getAuthUser(event: HandlerEvent) {
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7).trim();
  if (!token) return null;

  if (SUPABASE_URL && SUPABASE_ANON_KEY && !SUPABASE_URL.includes('your-project')) {
    try {
      const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: { user }, error } = await client.auth.getUser();
      if (!error && user) return { userId: user.id, client };
    } catch {
      // Fall through
    }
  }

  // Parse JWT token fallback
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
      if (payload && payload.sub) return { userId: payload.sub };
    }
  } catch {
    // invalid token
  }

  return null;
}

export const handler: Handler = async (event: HandlerEvent, _context: HandlerContext) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  const rawPath = event.path.replace(/^\/\.netlify\/functions\/cloud/, '').replace(/^\/api\/cloud/, '');
  const path = rawPath.replace(/\/+$/, '') || '/';
  const method = event.httpMethod;

  try {
    // 1. Architecture Status
    if (path === '/architecture-status' && method === 'GET') {
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'OPERATIONAL',
          environment: 'Netlify Functions + AWS S3',
          bucket: s3Storage.bucketName,
          cloudfront: s3Storage.cloudfrontDomain,
          encryption: 'AES-256-GCM',
          blockSplitting: '1MB chunks with SHA-256',
        }),
      };
    }

    const auth = await getAuthUser(event);
    if (!auth) {
      return {
        statusCode: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Unauthorized: Valid Supabase JWT token required.' }),
      };
    }

    // 2. Storage Stats
    if (path === '/storage-stats' && method === 'GET') {
      let files: Record<string, unknown>[] = [];
      if (auth.client) {
        const { data } = await auth.client.from('cloud_files').select('*').eq('user_id', auth.userId);
        if (data) files = data;
      }
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          totalFiles: files.length,
          totalStorageBytes: files.reduce((acc, f) => acc + Number(f.file_size || 0), 0),
          encryptedFilesCount: files.length,
          recentUploadsCount: files.length,
          bucketName: s3Storage.bucketName,
          cloudfrontDomain: s3Storage.cloudfrontDomain,
          storageMode: s3Storage.getStorageMode(),
        }),
      };
    }

    // 3. List Files
    if ((path === '/files' || path === '') && method === 'GET') {
      if (auth.client) {
        const { data, error } = await auth.client
          .from('cloud_files')
          .select('*')
          .eq('user_id', auth.userId)
          .order('created_at', { ascending: false });
        if (!error && data) {
          return {
            statusCode: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ files: data }),
          };
        }
      }
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: [] }),
      };
    }

    // 4. Upload File
    if (path === '/upload' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      if (!body.fileBase64 || !body.fileName) {
        return {
          statusCode: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Missing fileBase64 or fileName in request.' }),
        };
      }

      const fileBuffer = Buffer.from(body.fileBase64, 'base64');
      const fileId = crypto.randomUUID();
      const overallChecksum = encryptionService.calculateChecksum(fileBuffer);

      // Split into 1MB chunks
      const CHUNK_SIZE = 1024 * 1024;
      const rawChunks = encryptionService.splitBufferIntoChunks(fileBuffer, CHUNK_SIZE);
      const rootStorageKey = `users/${auth.userId}/reports/${fileId}`;

      const uploadedChunks = [];
      for (let i = 0; i < rawChunks.length; i++) {
        const chunkBuf = rawChunks[i];
        const enc = encryptionService.encryptChunk(chunkBuf);
        const chunkKey = `${rootStorageKey}/chunk_${i}.enc`;

        await s3Storage.putEncryptedObject(chunkKey, enc.ciphertext, {
          chunkIndex: String(i),
          checksum: enc.checksum,
          iv: enc.iv,
          tag: enc.tag,
        });

        uploadedChunks.push({
          chunkIndex: i,
          storageKey: chunkKey,
          chunkSize: chunkBuf.length,
          checksum: enc.checksum,
          iv: enc.iv,
          tag: enc.tag,
        });
      }

      const newFile = {
        id: fileId,
        user_id: auth.userId,
        file_name: body.fileName,
        original_file_name: body.fileName,
        file_type: body.fileType || 'application/pdf',
        file_size: fileBuffer.length,
        storage_bucket: s3Storage.bucketName,
        storage_key: rootStorageKey,
        encryption_algorithm: 'AES-256-GCM',
        encryption_iv: uploadedChunks[0]?.iv || null,
        encryption_tag: uploadedChunks[0]?.tag || null,
        chunk_count: uploadedChunks.length,
        checksum: overallChecksum,
        upload_status: 'COMPLETED',
        category: body.category || 'REPORT',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (auth.client) {
        await auth.client.from('cloud_files').insert(newFile);
        const chunkInserts = uploadedChunks.map((c) => ({
          id: crypto.randomUUID(),
          file_id: fileId,
          user_id: auth.userId,
          chunk_index: c.chunkIndex,
          storage_key: c.storageKey,
          chunk_size: c.chunkSize,
          checksum: c.checksum,
          encryption_iv: c.iv,
          encryption_tag: c.tag,
          created_at: new Date().toISOString(),
        }));
        await auth.client.from('cloud_file_chunks').insert(chunkInserts);
      }

      return {
        statusCode: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          file: newFile,
          chunks: uploadedChunks,
        }),
      };
    }

    // 5. Download File (Reconstruct & Decrypt)
    const downloadMatch = path.match(/^\/files\/([a-zA-Z0-9-]+)\/download$/);
    if (downloadMatch && method === 'POST') {
      const fileId = downloadMatch[1];
      if (!auth.client) {
        return {
          statusCode: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Database client unavailable for download verification.' }),
        };
      }

      const { data: file } = await auth.client
        .from('cloud_files')
        .select('*')
        .eq('id', fileId)
        .eq('user_id', auth.userId)
        .single();

      if (!file) {
        return {
          statusCode: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'File not found or unauthorized.' }),
        };
      }

      const { data: chunks } = await auth.client
        .from('cloud_file_chunks')
        .select('*')
        .eq('file_id', fileId)
        .order('chunk_index', { ascending: true });

      if (!chunks || chunks.length === 0) {
        return {
          statusCode: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'No encrypted chunks found.' }),
        };
      }

      const decryptedBlocks: Buffer[] = [];
      for (const chk of chunks) {
        const encryptedBuf = await s3Storage.getEncryptedObject(chk.storage_key);
        const dec = encryptionService.decryptChunk(encryptedBuf, chk.encryption_iv, chk.encryption_tag);
        const chkSum = encryptionService.calculateChecksum(dec);
        if (chkSum !== chk.checksum) {
          throw new Error(`Integrity error: block ${chk.chunk_index} checksum mismatch`);
        }
        decryptedBlocks.push(dec);
      }

      const reconstructed = encryptionService.reconstructBuffer(decryptedBlocks);
      const overallSha = encryptionService.calculateChecksum(reconstructed);
      if (overallSha !== file.checksum) {
        throw new Error('Integrity error: reconstructed file checksum mismatch');
      }

      return {
        statusCode: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': file.file_type || 'application/pdf',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(file.original_file_name || 'download.pdf')}"`,
          'X-Encryption-Algorithm': 'AES-256-GCM',
          'X-Checksum-SHA256': overallSha,
          'X-Integrity-Verified': 'true',
        },
        isBase64Encoded: true,
        body: reconstructed.toString('base64'),
      };
    }

    // 6. Delete File
    const deleteMatch = path.match(/^\/files\/([a-zA-Z0-9-]+)$/);
    if (deleteMatch && method === 'DELETE') {
      const fileId = deleteMatch[1];
      const rootPrefix = `users/${auth.userId}/reports/${fileId}`;
      await s3Storage.deletePrefix(rootPrefix);

      if (auth.client) {
        await auth.client.from('cloud_file_chunks').delete().eq('file_id', fileId);
        await auth.client.from('cloud_files').delete().eq('id', fileId).eq('user_id', auth.userId);
      }

      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, message: 'Deleted file and all S3 blocks.' }),
      };
    }

    return {
      statusCode: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: `Path ${path} not found.` }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: (err as Error).message }),
    };
  }
};
