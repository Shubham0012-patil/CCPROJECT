-- ============================================================================
-- NEXMONEY: Cloud Storage Architecture Migration
-- Module: Private AWS S3 + AES-256-GCM Encrypted Chunks + Supabase Metadata
-- ============================================================================

-- 1. CLOUD_FILES TABLE
CREATE TABLE IF NOT EXISTS public.cloud_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    original_file_name TEXT NOT NULL,
    file_type TEXT NOT NULL DEFAULT 'application/pdf',
    file_size BIGINT NOT NULL CHECK (file_size >= 0),
    storage_bucket TEXT NOT NULL DEFAULT 'nexmoney-private-files',
    storage_key TEXT NOT NULL,
    encryption_algorithm TEXT NOT NULL DEFAULT 'AES-256-GCM',
    encryption_iv TEXT,
    encryption_tag TEXT,
    chunk_count INTEGER NOT NULL DEFAULT 1 CHECK (chunk_count > 0),
    checksum TEXT NOT NULL,
    upload_status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (upload_status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
    category TEXT DEFAULT 'REPORT',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

DROP TRIGGER IF EXISTS update_cloud_files_updated_at ON public.cloud_files;
CREATE TRIGGER update_cloud_files_updated_at
    BEFORE UPDATE ON public.cloud_files
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 2. CLOUD_FILE_CHUNKS TABLE
CREATE TABLE IF NOT EXISTS public.cloud_file_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID NOT NULL REFERENCES public.cloud_files(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL CHECK (chunk_index >= 0),
    storage_key TEXT NOT NULL,
    chunk_size BIGINT NOT NULL CHECK (chunk_size >= 0),
    checksum TEXT NOT NULL,
    encryption_iv TEXT NOT NULL,
    encryption_tag TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT unique_file_chunk UNIQUE (file_id, chunk_index)
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_cloud_files_user_id ON public.cloud_files(user_id);
CREATE INDEX IF NOT EXISTS idx_cloud_files_created_at ON public.cloud_files(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cloud_file_chunks_file_id ON public.cloud_file_chunks(file_id);
CREATE INDEX IF NOT EXISTS idx_cloud_file_chunks_user_id ON public.cloud_file_chunks(user_id);

-- 3. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.cloud_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cloud_file_chunks ENABLE ROW LEVEL SECURITY;

-- Cloud Files Policies
DROP POLICY IF EXISTS "cloud_files_select_own" ON public.cloud_files;
CREATE POLICY "cloud_files_select_own" ON public.cloud_files FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "cloud_files_insert_own" ON public.cloud_files;
CREATE POLICY "cloud_files_insert_own" ON public.cloud_files FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "cloud_files_update_own" ON public.cloud_files;
CREATE POLICY "cloud_files_update_own" ON public.cloud_files FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "cloud_files_delete_own" ON public.cloud_files;
CREATE POLICY "cloud_files_delete_own" ON public.cloud_files FOR DELETE USING (auth.uid() = user_id);

-- Cloud File Chunks Policies
DROP POLICY IF EXISTS "cloud_file_chunks_select_own" ON public.cloud_file_chunks;
CREATE POLICY "cloud_file_chunks_select_own" ON public.cloud_file_chunks FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "cloud_file_chunks_insert_own" ON public.cloud_file_chunks;
CREATE POLICY "cloud_file_chunks_insert_own" ON public.cloud_file_chunks FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "cloud_file_chunks_update_own" ON public.cloud_file_chunks;
CREATE POLICY "cloud_file_chunks_update_own" ON public.cloud_file_chunks FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "cloud_file_chunks_delete_own" ON public.cloud_file_chunks;
CREATE POLICY "cloud_file_chunks_delete_own" ON public.cloud_file_chunks FOR DELETE USING (auth.uid() = user_id);
