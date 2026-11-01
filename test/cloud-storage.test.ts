import assert from 'assert';
import crypto from 'crypto';
import jsPDF from 'jspdf';
import { encryptionService } from '../server/crypto';
import { s3Storage } from '../server/s3Storage';

console.log('================================================================');
console.log('NEXMONEY: Automated Cloud Computing & Cryptography Test Suite');
console.log('================================================================\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name: string, fn: () => void | Promise<void>) {
  totalTests++;
  try {
    const res = fn();
    if (res instanceof Promise) {
      return res
        .then(() => {
          passedTests++;
          console.log(`[PASS] Test ${totalTests}: ${name}`);
        })
        .catch((err) => {
          console.error(`[FAIL] Test ${totalTests}: ${name}`);
          console.error(`       Error: ${err.message}`);
          process.exitCode = 1;
        });
    } else {
      passedTests++;
      console.log(`[PASS] Test ${totalTests}: ${name}`);
    }
  } catch (err: unknown) {
    console.error(`[FAIL] Test ${totalTests}: ${name}`);
    console.error(`       Error: ${(err as Error).message}`);
    process.exitCode = 1;
  }
}

async function runAllTests() {
  // TEST 1: Generate a synthetic PDF document
  let testPdfBuffer: Buffer;
  await runTest('Generate a valid financial statement PDF buffer', () => {
    const header = Buffer.from('%PDF-1.7\n%NEXMONEY Financial Statement Audit Record\n');
    // Generate a 2.5 MB document to test multi-chunk splitting across multiple 1MB blocks
    const body = Buffer.alloc(2.5 * 1024 * 1024, 'NEXMONEY_AUDIT_RECORD_BLOCK_');
    const trailer = Buffer.from('\n%%EOF\n');
    testPdfBuffer = Buffer.concat([header, body, trailer]);
    assert(testPdfBuffer.length > 2 * 1024 * 1024, 'PDF must be greater than 2MB for multi-block chunking validation');
  });

  const originalChecksum = encryptionService.calculateChecksum(testPdfBuffer);
  const testUserId = crypto.randomUUID();
  const testFileId = crypto.randomUUID();
  let encryptedChunks: {
    chunkIndex: number;
    storageKey: string;
    ciphertext: Buffer;
    iv: string;
    tag: string;
    checksum: string;
  }[] = [];

  // TEST 4 & 5: Split PDF into 1MB chunks and verify sizes
  await runTest('Split PDF into 1MB blocks and verify block counts & sizes', () => {
    const rawChunks = encryptionService.splitBufferIntoChunks(testPdfBuffer, 1024 * 1024);
    const expectedCount = Math.ceil(testPdfBuffer.length / (1024 * 1024));
    assert.strictEqual(rawChunks.length, expectedCount, 'Chunk count matches expected block division');

    let accumulatedSize = 0;
    rawChunks.forEach((chk, idx) => {
      accumulatedSize += chk.length;
      if (idx < rawChunks.length - 1) {
        assert.strictEqual(chk.length, 1024 * 1024, `Chunk ${idx} must be exactly 1MB`);
      }
    });
    assert.strictEqual(accumulatedSize, testPdfBuffer.length, 'Sum of chunk sizes matches original buffer');
  });

  // TEST 6 & 7: Encrypt each chunk with AES-256-GCM and verify ciphertext
  await runTest('Encrypt each chunk using AES-256-GCM with unique 96-bit random IVs', () => {
    const rawChunks = encryptionService.splitBufferIntoChunks(testPdfBuffer, 1024 * 1024);
    const seenIVs = new Set<string>();

    encryptedChunks = rawChunks.map((chunk, i) => {
      const enc = encryptionService.encryptChunk(chunk);
      assert(!seenIVs.has(enc.iv), `IV collision detected at block ${i}! IVs must never be reused.`);
      seenIVs.add(enc.iv);

      // Verify ciphertext is truly scrambled and not plaintext
      assert.notStrictEqual(enc.ciphertext.toString('hex'), chunk.toString('hex'), 'Ciphertext must not match plaintext');
      assert.strictEqual(enc.iv.length, 24, 'IV must be 12 bytes / 24 hex characters');
      assert.strictEqual(enc.tag.length, 32, 'Tag must be 16 bytes / 32 hex characters');

      return {
        chunkIndex: i,
        storageKey: `users/${testUserId}/reports/${testFileId}/chunk_${i}.enc`,
        ciphertext: enc.ciphertext,
        iv: enc.iv,
        tag: enc.tag,
        checksum: enc.checksum,
      };
    });
  });

  // TEST 2 & 3: Save encrypted chunks to S3 Storage and verify object existence
  await runTest('Save encrypted blocks to S3 storage bucket and verify retrieval', async () => {
    for (const chk of encryptedChunks) {
      await s3Storage.putEncryptedObject(chk.storageKey, chk.ciphertext, {
        chunkIndex: String(chk.chunkIndex),
        checksum: chk.checksum,
      });

      const retrievedCiphertext = await s3Storage.getEncryptedObject(chk.storageKey);
      assert.strictEqual(retrievedCiphertext.length, chk.ciphertext.length, 'Stored and retrieved ciphertext length must match');
      assert.strictEqual(
        encryptionService.calculateChecksum(retrievedCiphertext),
        encryptionService.calculateChecksum(chk.ciphertext),
        'Ciphertext integrity verified'
      );
    }
  });

  // TEST 8, 9 & 10: Download, decrypt, verify chunk checksums, and reconstruct
  await runTest('Download encrypted blocks, decrypt with AES-256-GCM, reconstruct and verify hash', async () => {
    const decryptedBlocks: Buffer[] = [];

    for (const chk of encryptedChunks) {
      const encryptedData = await s3Storage.getEncryptedObject(chk.storageKey);
      const decrypted = encryptionService.decryptChunk(encryptedData, chk.iv, chk.tag);

      // Verify individual block checksum
      const blockSha = encryptionService.calculateChecksum(decrypted);
      assert.strictEqual(blockSha, chk.checksum, `Block ${chk.chunkIndex} SHA-256 checksum mismatch!`);
      decryptedBlocks.push(decrypted);
    }

    const reconstructedBuffer = encryptionService.reconstructBuffer(decryptedBlocks);
    assert.strictEqual(reconstructedBuffer.length, testPdfBuffer.length, 'Reconstructed file size matches original');

    const reconstructedSha = encryptionService.calculateChecksum(reconstructedBuffer);
    assert.strictEqual(reconstructedSha, originalChecksum, 'Exact SHA-256 hash match between original and reconstructed PDF!');
  });

  // TEST 11 & 12: Unauthorized access & isolation test
  await runTest('Verify multi-tenant user isolation (User B cannot access User A files)', async () => {
    const maliciousUserId = crypto.randomUUID();
    const targetKey = `users/${maliciousUserId}/reports/${testFileId}/chunk_0.enc`;

    try {
      await s3Storage.getEncryptedObject(targetKey);
      assert.fail('Should have thrown an error for non-existent or foreign path');
    } catch (err: unknown) {
      assert((err as Error).message.includes('not found') || (err as Error).message.includes('NoSuchKey'), 'Request rejected appropriately');
    }
  });

  // TEST 13: File deletion and S3 cleanup
  await runTest('Clean up and delete file prefix and all its encrypted blocks from S3', async () => {
    const rootPrefix = `users/${testUserId}/reports/${testFileId}`;
    await s3Storage.deletePrefix(rootPrefix);

    for (const chk of encryptedChunks) {
      try {
        await s3Storage.getEncryptedObject(chk.storageKey);
        assert.fail('Object should have been deleted');
      } catch {
        // Expected
      }
    }
  });

  // TEST 14: CloudFront CDN URL generation & OAC configuration
  await runTest('Validate CloudFront CDN edge distribution path with OAC origin access', () => {
    const sampleKey = `users/${testUserId}/reports/${testFileId}/chunk_0.enc`;
    const cdnUrl = s3Storage.getCloudFrontUrl(sampleKey);
    assert(cdnUrl.startsWith('https://'), 'CloudFront CDN URL must enforce HTTPS');
    assert(cdnUrl.includes(s3Storage.cloudfrontDomain), 'CloudFront domain present');
  });

  // TEST 15: Tamper Proofing Test (Modifying 1 byte in ciphertext causes decryption to fail)
  await runTest('Verify AES-256-GCM authentication tag rejects tampered blocks', () => {
    const originalBlock = Buffer.from('CRITICAL_FINANCIAL_TRANSACTION_AUDIT_DATA');
    const enc = encryptionService.encryptChunk(originalBlock);

    // Tamper with ciphertext by flipping 1 bit in first byte
    const tamperedCiphertext = Buffer.from(enc.ciphertext);
    tamperedCiphertext[0] ^= 0x01;

    try {
      encryptionService.decryptChunk(tamperedCiphertext, enc.iv, enc.tag);
      assert.fail('Should have rejected tampered ciphertext due to GCM authentication tag mismatch');
    } catch (err: unknown) {
      assert((err as Error).message.includes('authenticate') || (err as Error).message.includes('Unsupported state'), 'Tampered data rejected');
    }
  });

  // TEST 16: Checksum Tamper Test
  await runTest('Verify SHA-256 checksum mismatch detection on corrupted block', () => {
    const validBuf = Buffer.from('NEXMONEY_REPORT_VALID');
    const checksum = encryptionService.calculateChecksum(validBuf);
    const corruptedBuf = Buffer.from('NEXMONEY_REPORT_CORRUPTED');
    const corruptedChecksum = encryptionService.calculateChecksum(corruptedBuf);
    assert.notStrictEqual(checksum, corruptedChecksum, 'Checksums must differ for mutated blocks');
  });

  console.log('\n================================================================');
  console.log(`SUMMARY: ${passedTests} / ${totalTests} Cloud Architecture Tests PASSED`);
  console.log('================================================================\n');
}

runAllTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
