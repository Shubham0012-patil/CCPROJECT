import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

const AWS_REGION = process.env.AWS_REGION || 'ap-south-1';
const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'nexmoney-private-files';
const CLOUDFRONT_DOMAIN = process.env.AWS_CLOUDFRONT_DOMAIN || 'd12345678abcdef.cloudfront.net';

// Check if valid AWS credentials are configured
const hasAwsCredentials = Boolean(
  process.env.AWS_ACCESS_KEY_ID &&
  process.env.AWS_SECRET_ACCESS_KEY &&
  process.env.AWS_ACCESS_KEY_ID !== 'MY_AWS_KEY'
);

let s3Client: S3Client | null = null;
if (hasAwsCredentials) {
  try {
    s3Client = new S3Client({
      region: AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        sessionToken: process.env.AWS_SESSION_TOKEN,
      },
    });
  } catch (err) {
    console.error('Failed to initialize AWS S3 client, falling back to local emulation:', err);
    s3Client = null;
  }
}

// Local directory for S3 fallback/emulation
const LOCAL_STORAGE_DIR = path.resolve(process.cwd(), '.storage', 's3_buckets', BUCKET_NAME);

function ensureLocalDir(key: string): string {
  const fullPath = path.join(LOCAL_STORAGE_DIR, key);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return fullPath;
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('error', (err) => reject(err));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

export const s3Storage = {
  bucketName: BUCKET_NAME,
  cloudfrontDomain: CLOUDFRONT_DOMAIN,
  region: AWS_REGION,

  isLiveAws(): boolean {
    return s3Client !== null;
  },

  getStorageMode(): 'AWS_S3' | 'LOCAL_EMULATION' {
    return s3Client ? 'AWS_S3' : 'LOCAL_EMULATION';
  },

  /**
   * Put an encrypted chunk or file object into S3
   */
  async putEncryptedObject(
    storageKey: string,
    data: Buffer,
    metadata?: Record<string, string>
  ): Promise<{ key: string; size: number; bucket: string }> {
    if (s3Client) {
      const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: storageKey,
        Body: data,
        ContentType: 'application/octet-stream',
        ServerSideEncryption: 'AES256',
        Metadata: metadata || {},
      });
      await s3Client.send(command);
    } else {
      // Local emulation
      const filePath = ensureLocalDir(storageKey);
      fs.writeFileSync(filePath, data);
    }

    return {
      key: storageKey,
      size: data.length,
      bucket: BUCKET_NAME,
    };
  },

  /**
   * Retrieve an encrypted chunk or object from S3
   */
  async getEncryptedObject(storageKey: string): Promise<Buffer> {
    if (s3Client) {
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: storageKey,
      });
      const response = await s3Client.send(command);
      if (!response.Body) {
        throw new Error(`S3 object ${storageKey} has no body`);
      }
      return await streamToBuffer(response.Body as Readable);
    } else {
      // Local emulation
      const filePath = path.join(LOCAL_STORAGE_DIR, storageKey);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Storage object not found: ${storageKey}`);
      }
      return fs.readFileSync(filePath);
    }
  },

  /**
   * Delete an object from S3
   */
  async deleteObject(storageKey: string): Promise<void> {
    if (s3Client) {
      const command = new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: storageKey,
      });
      await s3Client.send(command);
    } else {
      const filePath = path.join(LOCAL_STORAGE_DIR, storageKey);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  },

  /**
   * Delete all objects matching a prefix (e.g. users/{user_id}/reports/{file_id}/)
   */
  async deletePrefix(prefix: string): Promise<void> {
    if (s3Client) {
      const listCommand = new ListObjectsV2Command({
        Bucket: BUCKET_NAME,
        Prefix: prefix,
      });
      const listRes = await s3Client.send(listCommand);
      if (listRes.Contents) {
        for (const item of listRes.Contents) {
          if (item.Key) {
            await this.deleteObject(item.Key);
          }
        }
      }
    } else {
      const dirPath = path.join(LOCAL_STORAGE_DIR, prefix);
      if (fs.existsSync(dirPath)) {
        fs.rmSync(dirPath, { recursive: true, force: true });
      }
    }
  },

  /**
   * Generate CloudFront delivery URL
   * In production with private S3 + CloudFront OAC, this points to the CloudFront distribution domain
   */
  getCloudFrontUrl(storageKey: string): string {
    return `https://${CLOUDFRONT_DOMAIN}/${storageKey}`;
  },
};
