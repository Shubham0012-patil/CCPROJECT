# NEXMONEY: Cloud-Based Personal Finance & Cryptographically Secure File Management System

**Academic Degree / Course:** Bachelor of Technology / Science in Computer Science & Engineering  
**Subject:** Cloud Computing & Information Security Mini-Project  
**Application Title:** NEXMONEY – Cloud Computing & Encrypted File Management Upgrade  
**Date of Submission:** November 2026  
**Status:** Production Implementation Completed & Verified  

---

## 1. Project Introduction

**NEXMONEY** is an enterprise-grade Personal Finance Management (PFM) application engineered with modern cloud computing paradigms. Originally developed to track day-to-day Khata ledgers, personal expenses, and long-term loan contracts with sub-zero data collision (via Global UTR registry and dual-layer PIN protection), this upgrade transforms NEXMONEY into a decentralized, cryptographically fortified cloud file management system.

The application leverages a hybrid cloud architecture combining **Supabase PostgreSQL** (for ACID-compliant relational data and Row-Level Security), **Netlify** (for high-availability static edge hosting and serverless functions), **Amazon Web Services (AWS) S3** (for private, zero-public-access object storage), **AWS CloudFront** (for low-latency CDN edge delivery via Origin Access Control), and **AES-256-GCM authenticated encryption** with block-level file chunking.

---

## 2. Problem Statement

Traditional financial web applications suffer from significant architectural and security vulnerabilities:
1. **Unencrypted File Storage at Rest:** Financial reports, tax statements, and receipts containing sensitive Personally Identifiable Information (PII) are frequently stored in plaintext on shared hosting disks or public S3 buckets.
2. **Monolithic File Vulnerability:** Storing multi-megabyte audit records as single monolithic files exposes entire documents to exfiltration if a single storage URL or presigned token is leaked.
3. **Single Point of Failure in Storage:** Standard server local file systems lack distributed replication, geographic redundancy, and high-availability guarantees.
4. **Lack of Cryptographic Non-Repudiation:** Traditional systems lack block-level hashing and authenticated encryption (AEAD), making undetected data tampering during storage or transit possible.
5. **Cross-Tenant Data Exposure:** Weak application-level filtering without database-enforced Row-Level Security (RLS) can inadvertently leak one customer's financial balance sheets to another tenant.

---

## 3. Project Objectives

1. **AWS S3 Private Cloud Object Storage:** Provision an isolated, private AWS S3 bucket (`nexmoney-private-files`) with all public access strictly blocked and server-side encryption enforced.
2. **Block-Level File Splitting:** Implement a deterministic chunking engine that divides financial PDFs and documents into configurable 1 MB blocks with sequence preservation.
3. **Authenticated AES-256-GCM Encryption:** Implement real military-grade Galois/Counter Mode authenticated encryption where each block is encrypted using a unique, cryptographically random 96-bit Initialization Vector (IV) and a 128-bit authentication tag.
4. **Verifiable Secure Download & Reconstruction:** Implement an on-the-fly decryption pipeline that downloads encrypted blocks, verifies block-level SHA-256 checksums, authenticates GCM tags, and reconstructs byte-for-byte identical PDF documents.
5. **AWS CloudFront Content Delivery Network (CDN):** Integrate CloudFront edge distribution with Origin Access Control (OAC), ensuring S3 remains inaccessible from the public internet.
6. **End-to-End Transport Layer Security (HTTPS):** Enforce TLS 1.3 encryption across all communication vectors (Browser $\leftrightarrow$ Netlify CDN $\leftrightarrow$ API Functions $\leftrightarrow$ AWS S3 $\leftrightarrow$ Supabase).
7. **Zero-Regression Preservation:** Maintain 100% of existing NEXMONEY modules: Khata Ledger, Personal Expenses, Long-Term Loans, Repayments, Reports, Dual PINs, and Global UTR protection.

---

## 4. Existing System Analysis

The pre-upgrade NEXMONEY application featured:
- Single Page Application (SPA) built with React 19, TypeScript, and Vite.
- Supabase PostgreSQL backend with 8 tables: `profiles`, `app_pins`, `khata_people`, `khata_transactions`, `expenses`, `long_term_loans`, `loan_repayments`, and `global_utr_registry`.
- Client-side PDF generation using `jsPDF` and `jspdf-autotable`.
- Immediate browser download with no cloud archive or multi-device document backup.
- Storage limitation: Once downloaded to local disk, reports could be lost if the user's local device suffered hardware failure.

---

## 5. Proposed System Overview

The enhanced proposed system introduces the **Cloud Storage & File Management** module:
- Automatically archives financial statements, Khata audits, and expense summaries directly to private AWS S3 with a single click ("Save to Cloud").
- Directly divides documents into 1MB blocks, calculates SHA-256 hashes, encrypts blocks using AES-256-GCM, and distributes encrypted blocks to S3 under unique tenant prefixes: `users/{user_id}/reports/{file_id}/chunk_{index}.enc`.
- Tracks catalog metadata in two new Supabase tables: `cloud_files` and `cloud_file_chunks`, protected by database Row-Level Security (`auth.uid() = user_id`).
- Features a responsive Cloud File Manager UI displaying file metadata, block counts, encryption standards, storage targets, and an interactive Block Inspector.
- Reconstructs and verifies files during secure download, rejecting any tampered or corrupted blocks immediately.

---

## 6. Cloud Computing Concepts Applied

| Concept | Implementation in NEXMONEY |
| :--- | :--- |
| **IaaS / Object Storage** | AWS S3 for reliable, 99.999999999% (11 9's) durability object archiving. |
| **PaaS / Serverless Execution**| Netlify Functions and Express serverless runtimes executing state-free cryptographic transformations. |
| **Edge Computing / CDN** | AWS CloudFront edge points of presence (PoPs) caching and routing assets close to end users. |
| **Database-as-a-Service (DBaaS)** | Supabase Managed PostgreSQL with automated backups, connection pooling, and JWT RLS. |
| **Defense in Depth** | Multi-tier security: Transport (TLS) + Identity (JWT) + Database (RLS) + Storage (Private S3) + Application (AES-256-GCM). |
| **Envelope Key Architecture** | Master encryption keys managed via AWS KMS design with per-chunk pseudo-random ephemeral IVs. |

---

## 7. System Architecture Diagram

```
+-----------------------------------------------------------------------------------+
|                                  CLIENT LAYER                                     |
|               React 19 + TypeScript + Tailwind CSS (Hosted on Netlify)            |
|                                                                                   |
|  [ Dashboard ]  [ Khata ]  [ Expenses ]  [ Loans ]  [ Reports ]  [ Cloud Storage ]|
+------------------------------------------+----------------------------------------+
                                           | HTTPS / TLS 1.3
                                           v
+-----------------------------------------------------------------------------------+
|                        BACKEND & SERVERLESS API LAYER                             |
|              Express Server (Port 3000) / Netlify Functions (/api/cloud)          |
|                                                                                   |
|  1. JWT Verification: Validates Supabase Token (auth.uid())                       |
|  2. File Splitting Engine: Splits PDF buffer into 1MB blocks                      |
|  3. Cryptographic Core: AES-256-GCM Cipher, 96-bit IV, 128-bit Auth Tag           |
|  4. Integrity Engine: SHA-256 Checksum generation per block                       |
|  5. Reconstruction Core: Decrypts & reassembles chunks upon download               |
+---------------------+---------------------------------------+---------------------+
                      |                                       |
    (Encrypted Blocks)|                                       | (Metadata & RLS)
                      v                                       v
+-------------------------------------+     +-------------------------------------+
|        AWS CLOUD STORAGE            |     |        SUPABASE POSTGRESQL          |
|                                     |     |                                     |
|  Private Bucket:                    |     |  Table: cloud_files                 |
|  `nexmoney-private-files`           |     |  Table: cloud_file_chunks           |
|                                     |     |                                     |
|  Object Structure:                  |     |  RLS: auth.uid() = user_id          |
|  users/{uid}/reports/{fid}/         |     |                                     |
|    chunk_0.enc                      |     |  Existing Tables:                   |
|    chunk_1.enc                      |     |  profiles, app_pins, khata_*,       |
|                                     |     |  expenses, loans_*, utr_registry    |
|  Origin Access Control (OAC)        |     +-------------------------------------+
+------------------+------------------+
                   |
                   v
+-------------------------------------+
|        AWS CLOUDFRONT CDN           |
|  Global Edge Delivery Cache         |
|  Strict HTTPS Access                |
+-------------------------------------+
```

---

## 8. Technology Stack

- **Frontend:** React 19.0.1, TypeScript 5.8, Vite 6.2, Tailwind CSS 4.1
- **Icons & Visualization:** Lucide React, Recharts 3.10
- **PDF Generation:** jsPDF 4.2.1, jsPDF-AutoTable 5.0.8
- **Backend Runtime:** Node.js 20 LTS, Express 4.21, Multer 2.5
- **Cloud Storage SDK:** AWS SDK for JavaScript v3 (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`)
- **Cryptography:** Node.js native `crypto` module (FIPS-compliant AES-256-GCM)
- **Database & Auth:** Supabase PostgreSQL with `pgcrypto` and `uuid-ossp`
- **Hosting & CI/CD:** Netlify, GitHub Actions

---

## 9. AWS S3 Implementation

### 9.1 S3 Bucket Configuration
- **Bucket Name:** `nexmoney-private-files`
- **Region:** `ap-south-1` (Mumbai) / Configurable via `AWS_REGION`
- **Public Access:** Block All Public Access (`IgnorePublicAcls=true`, `BlockPublicPolicy=true`, `RestrictPublicBuckets=true`, `BlockPublicAcls=true`)
- **Encryption:** Server-Side Encryption with Amazon S3 managed keys (`SSE-S3` / `AES256`) or AWS KMS

### 9.2 Object Key Hierarchy
Files are structured hierarchically using tenant-isolated prefixes:
```
users/
└── {user_id}/
    └── reports/
        └── {file_id}/
            ├── chunk_0.enc
            ├── chunk_1.enc
            └── chunk_2.enc
```
This guarantees that AWS IAM policies and storage lifecycle rules can be scoped per tenant, preventing cross-user path traversal.

---

## 10. File Splitting Algorithm

### 10.1 Mathematical Block Partitioning
Given an input file of size $S$ bytes and a block size $B = 1{,}048{,}576$ bytes ($1\text{ MB}$):
$$\text{Chunk Count } N = \left\lceil \frac{S}{B} \right\rceil$$

For every chunk $i \in \{0, 1, \dots, N-1\}$:
$$\text{Start Offset } O_i = i \times B$$
$$\text{End Offset } E_i = \min(O_i + B, S)$$
$$\text{Chunk Size } S_i = E_i - O_i$$

### 10.2 Flowchart of File Upload & Splitting
```
[User clicks "Save to Cloud" or uploads File]
                      |
                      v
          [Calculate File SHA-256]
                      |
                      v
    [Divide Buffer into 1 MB Blocks: N chunks]
                      |
                      v
           For each chunk i = 0 to N-1:
                      |
           +----------+----------+
           | Calculate Chunk SHA-256
           | Generate Random 96-bit IV
           | Encrypt with AES-256-GCM
           | Extract 128-bit Auth Tag
           | Upload chunk_i.enc to AWS S3
           +----------+----------+
                      |
                      v
 [Persist File & Chunks Metadata in Supabase]
                      |
                      v
           [Upload Confirmed: 100%]
```

---

## 11. AES-256-GCM Authenticated Encryption

### 11.1 Cryptographic Parameters
- **Cipher:** Advanced Encryption Standard in Galois/Counter Mode (`aes-256-gcm`)
- **Key Length:** 256 bits (32 bytes)
- **Initialization Vector (IV):** 96 bits (12 bytes), freshly generated per block via `crypto.randomBytes(12)`
- **Authentication Tag:** 128 bits (16 bytes) generated by GCM MAC

### 11.2 Security Properties
1. **Confidentiality:** Ciphertext contains zero statistical resemblance to the original PDF.
2. **Authenticity & Integrity:** GCM computes an authentication tag over the ciphertext. If even 1 bit of stored data is flipped in S3, decryption immediately fails with an authentication error.
3. **No IV Reuse:** By generating a new pseudo-random 96-bit IV for every block, identical plaintext blocks encrypt to completely distinct ciphertexts.

---

## 12. Secure Download & Reconstruction System

### 12.1 Reconstruction Flowchart
```
[User requests Secure Download]
                |
                v
 [Verify Supabase JWT & File Ownership]
                |
                v
[Retrieve Ordered Chunks from Supabase]
                |
                v
      For each chunk i = 0 to N-1:
                |
  +-------------+-------------+
  | Fetch chunk_i.enc from AWS S3
  | Decrypt with AES-256-GCM (IV_i, Tag_i)
  | Calculate Decrypted Chunk SHA-256
  | Assert Hash Matches chunk_metadata.checksum
  +-------------+-------------+
                |
                v
  [Concatenate All Decrypted Chunks]
                |
                v
  [Assert Reconstructed SHA-256 == File.checksum]
                |
                v
[Stream Original PDF Blob with Verification Headers]
```

If any chunk is missing, out-of-order, or has a mismatched checksum, the operation is immediately aborted, protecting the user from partial or tampered downloads.

---

## 13. AWS CloudFront CDN Integration

- **Private S3 Origin:** AWS S3 bucket configured with Origin Access Control (OAC), denying direct internet requests.
- **Cache Policy:** Optimized caching for encrypted chunks (`Managed-CachingOptimized`).
- **HTTPS Enforcement:** CloudFront Viewer Protocol Policy set to `redirect-to-https`.
- **TLS Version:** TLSv1.2_2021 minimum protocol version.

---

## 14. HTTPS and Network Security

- **HSTS:** Strict-Transport-Security (`max-age=31536000; includeSubDomains; preload`).
- **CORS Protection:** Configured to only permit authorized Netlify and local development origins with credentialed Bearer headers. Wildcard CORS is disabled on authenticated endpoints.
- **Content Security Headers:**
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: SAMEORIGIN`
  - `X-XSS-Protection: 1; mode=block`
  - `Referrer-Policy: strict-origin-when-cross-origin`

---

## 15. Supabase Database Integration & Schemas

### Table 1: `public.cloud_files`
| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique file identifier |
| `user_id` | UUID | REFERENCES auth.users(id) ON DELETE CASCADE | Owner user ID |
| `file_name` | TEXT | NOT NULL | Display name |
| `original_file_name`| TEXT | NOT NULL | Download filename |
| `file_type` | TEXT | NOT NULL, DEFAULT 'application/pdf' | MIME type |
| `file_size` | BIGINT | NOT NULL, CHECK (file_size >= 0) | Total file size in bytes |
| `storage_bucket` | TEXT | NOT NULL | S3 bucket name |
| `storage_key` | TEXT | NOT NULL | Root S3 storage key prefix |
| `encryption_algorithm`| TEXT | NOT NULL, DEFAULT 'AES-256-GCM' | Encryption cipher |
| `chunk_count` | INTEGER | NOT NULL, CHECK (chunk_count > 0) | Total block count |
| `checksum` | TEXT | NOT NULL | Full file SHA-256 hash |
| `upload_status` | TEXT | NOT NULL, DEFAULT 'COMPLETED' | Status |
| `category` | TEXT | DEFAULT 'REPORT' | Financial category |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Modification timestamp |

### Table 2: `public.cloud_file_chunks`
| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique chunk ID |
| `file_id` | UUID | REFERENCES cloud_files(id) ON DELETE CASCADE | Parent file ID |
| `user_id` | UUID | REFERENCES auth.users(id) ON DELETE CASCADE | Owner user ID |
| `chunk_index` | INTEGER | NOT NULL, CHECK (chunk_index >= 0) | Sequence block number |
| `storage_key` | TEXT | NOT NULL | S3 object key for chunk |
| `chunk_size` | BIGINT | NOT NULL, CHECK (chunk_size >= 0) | Byte length of block |
| `checksum` | TEXT | NOT NULL | Block SHA-256 hash |
| `encryption_iv` | TEXT | NOT NULL | Hex-encoded 96-bit IV |
| `encryption_tag` | TEXT | NOT NULL | Hex-encoded 128-bit Tag |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Timestamp |

**Unique Constraint:** `CONSTRAINT unique_file_chunk UNIQUE (file_id, chunk_index)`

---

## 16. Netlify Deployment Architecture

- **Build Command:** `npm run build`
- **Publish Directory:** `dist`
- **Functions Directory:** `netlify/functions`
- **Redirects:**
  - `/api/cloud/*` $\rightarrow$ `/.netlify/functions/cloud/:splat` (Status 200)
  - `/*` $\rightarrow$ `/index.html` (Status 200)

---

## 17. GitHub CI/CD Pipeline

The `.github/workflows/ci.yml` pipeline enforces:
1. `npm ci` clean dependency installation on Ubuntu 22.04 LTS.
2. `npm run lint` strict TypeScript compiler check (`tsc --noEmit`).
3. `npm test` automated execution of the 10-point cloud computing test suite.
4. `npm run build` production asset compilation.
5. Automated release deployment to Netlify production upon commit to `main`.

---

## 18. Testing & Verification Results

The automated test runner (`test/cloud-storage.test.ts`) executes and verifies all requirements:

| Test ID | Test Description | Verification Method | Status |
| :---: | :--- | :--- | :---: |
| **01** | Synthetic Financial PDF Generation | Generated 2.5 MB binary document buffer | **PASS** |
| **02** | 1 MB Block Partitioning | Verified 3 discrete chunks (1MB, 1MB, 0.5MB) | **PASS** |
| **03** | AES-256-GCM Chunk Encryption | Verified 96-bit unique IVs and 128-bit auth tags | **PASS** |
| **04** | AWS S3 Object Storing & Fetch | Verified storage and retrieval from private S3 bucket | **PASS** |
| **05** | Decryption & PDF Reconstruction | Exact byte-for-byte match with original SHA-256 | **PASS** |
| **06** | Multi-Tenant Isolation | Cross-tenant access attempt rejected with Access Denied | **PASS** |
| **07** | Cascade S3 Deletion & Cleanup | Verified deletion of all chunk objects from storage | **PASS** |
| **08** | CloudFront CDN Path Verification | Validated HTTPS edge distribution URL format | **PASS** |
| **09** | GCM Tamper Rejection | Flipping 1 bit in ciphertext rejected with auth error | **PASS** |
| **10** | SHA-256 Block Integrity Check | Mutated block rejected by integrity engine | **PASS** |

---

## 19. Security Audit Summary

1. **No Plaintext Storage:** Neither Supabase nor AWS S3 stores plaintext file content.
2. **Zero Client-Side Keys:** Encryption master keys and AWS credentials reside exclusively on the server / serverless function layer.
3. **Database RLS Enforced:** Both `cloud_files` and `cloud_file_chunks` have active RLS policies requiring `auth.uid() = user_id`.
4. **Non-Repudiation:** Dual checksumming (per-chunk SHA-256 and whole-file SHA-256) guarantees mathematical proof of file authenticity.
5. **No Broken Modules:** Khata ledger, personal expenses, loan contracts, repayments, UTR registry, and dual PIN security function without regression.

---

## 20. Limitations & Future Work

- **Client-Side KMS Envelope:** Future iterations could incorporate AWS KMS asymmetric key pairs for zero-knowledge client-side decryption in WebAssembly.
- **Multi-Region Replication:** S3 Cross-Region Replication (CRR) can be added for international disaster recovery compliance.
- **Biometric WebAuthn:** Extending PIN security to passkeys and biometric fingerprint authentication on supported mobile devices.

---

## 21. Conclusion

The upgraded **NEXMONEY Cloud Computing & File Management System** successfully fulfills all six cloud computing benchmarks: AWS S3 private storage, deterministic 1MB file block splitting, AES-256-GCM authenticated encryption, secure verified file download, AWS CloudFront CDN integration, and end-to-end HTTPS communication. All existing personal finance modules remain fully functional, making this a complete, production-ready full-stack application suitable for academic mini-project submission and real-world deployment.
