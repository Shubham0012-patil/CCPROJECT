import React, { useEffect, useState, useMemo } from 'react';
import {
  Cloud,
  Lock,
  Layers,
  Download,
  Trash2,
  Copy,
  Check,
  RefreshCw,
  Search,
  Filter,
  ArrowUpDown,
  UploadCloud,
  FileText,
  ShieldCheck,
  Server,
  Zap,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ExternalLink,
  ChevronRight,
  Database,
  Globe,
  KeyRound,
  Eye,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { cloudStorageService } from '../services/cloudStorageService';
import {
  CloudFile,
  CloudFileDetails,
  CloudStorageStats,
  UploadProgressState,
} from '../types';

export const CloudStoragePage: React.FC = () => {
  const { user } = useAuth();

  const [files, setFiles] = useState<CloudFile[]>([]);
  const [stats, setStats] = useState<CloudStorageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'DATE_DESC' | 'DATE_ASC' | 'SIZE_DESC' | 'SIZE_ASC' | 'NAME_ASC'>('DATE_DESC');

  // Modal states
  const [selectedFileDetails, setSelectedFileDetails] = useState<CloudFileDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Upload Progress Modal
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgressState>({
    stage: 'idle',
    percent: 0,
    message: '',
  });

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [filesRes, statsRes] = await Promise.all([
        cloudStorageService.getFiles(),
        cloudStorageService.getStorageStats(),
      ]);

      if (filesRes.error) {
        setError(filesRes.error);
      } else {
        setFiles(filesRes.data);
      }

      if (statsRes.data) {
        setStats(statsRes.data);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // Format bytes
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  // Filter & Sort
  const filteredFiles = useMemo(() => {
    return files
      .filter((file) => {
        const matchesSearch =
          file.file_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          file.id.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory =
          categoryFilter === 'ALL' || file.category === categoryFilter;
        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => {
        if (sortBy === 'DATE_DESC') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        if (sortBy === 'DATE_ASC') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        if (sortBy === 'SIZE_DESC') return b.file_size - a.file_size;
        if (sortBy === 'SIZE_ASC') return a.file_size - b.file_size;
        if (sortBy === 'NAME_ASC') return a.file_name.localeCompare(b.file_name);
        return 0;
      });
  }, [files, searchQuery, categoryFilter, sortBy]);

  // Handle direct file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setShowUploadModal(true);
    const res = await cloudStorageService.uploadFile(
      file,
      file.name,
      'USER_UPLOAD',
      (p) => setUploadProgress(p)
    );

    if (res.data) {
      setTimeout(() => {
        setShowUploadModal(false);
        setUploadProgress({ stage: 'idle', percent: 0, message: '' });
        loadData();
      }, 1500);
    }
    // reset input
    e.target.value = '';
  };

  // Handle Secure Download
  const handleSecureDownload = async (file: CloudFile) => {
    setDownloadingId(file.id);
    try {
      const res = await cloudStorageService.downloadFile(file.id, file.original_file_name || file.file_name);
      if (!res.success) {
        alert(res.error || 'Download failed');
      }
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setDownloadingId(null);
    }
  };

  // Handle View Details
  const handleViewDetails = async (id: string) => {
    setLoadingDetails(true);
    try {
      const res = await cloudStorageService.getFileDetails(id);
      if (res.data) {
        setSelectedFileDetails(res.data);
      } else {
        alert(res.error || 'Failed to load details');
      }
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Handle Delete
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this file and all its encrypted blocks from AWS S3?')) {
      return;
    }
    setDeletingId(id);
    try {
      const res = await cloudStorageService.deleteFile(id);
      if (res.success) {
        setFiles((prev) => prev.filter((f) => f.id !== id));
        if (selectedFileDetails?.id === id) {
          setSelectedFileDetails(null);
        }
        loadData();
      } else {
        alert(res.error || 'Delete failed');
      }
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setDeletingId(null);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* 1. Header with Cloud Computing Architecture Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-500/20">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                Cloud Storage & File Management
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Private AWS S3 object store with 1MB block splitting, AES-256-GCM encryption, and CloudFront CDN.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition shadow-xs disabled:opacity-50"
            title="Refresh Cloud Storage"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <label className="cursor-pointer px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition flex items-center gap-1.5 shadow-md shadow-blue-600/20">
            <UploadCloud className="w-4 h-4" />
            <span>Upload Document</span>
            <input
              type="file"
              onChange={handleFileUpload}
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
            />
          </label>
        </div>
      </div>

      {/* 2. CLOUD COMPUTING 6-PILLAR ARCHITECTURE STATUS BAR */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 sm:p-5 rounded-3xl shadow-lg border border-slate-800/80">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold tracking-wide">Cloud Computing Architecture Verified</span>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            {stats?.storageMode === 'AWS_S3' ? 'AWS Live S3 Production' : 'Active (AWS S3 & CloudFront Ready)'}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-3 text-xs">
          <div className="space-y-1">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">1. Storage</p>
            <p className="font-bold text-slate-200 flex items-center gap-1">
              <Server className="w-3.5 h-3.5 text-blue-400" /> AWS S3 Private
            </p>
            <p className="text-[10px] text-slate-400 truncate">{stats?.bucketName || 'nexmoney-private-files'}</p>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">2. Block Splitting</p>
            <p className="font-bold text-slate-200 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-indigo-400" /> 1 MB Chunks
            </p>
            <p className="text-[10px] text-slate-400">SHA-256 Checksums</p>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">3. Encryption</p>
            <p className="font-bold text-slate-200 flex items-center gap-1">
              <Lock className="w-3.5 h-3.5 text-amber-400" /> AES-256-GCM
            </p>
            <p className="text-[10px] text-slate-400">96-bit Random IV</p>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">4. Delivery</p>
            <p className="font-bold text-slate-200 flex items-center gap-1">
              <Download className="w-3.5 h-3.5 text-emerald-400" /> Secure Download
            </p>
            <p className="text-[10px] text-slate-400">On-the-fly Decryption</p>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">5. CDN</p>
            <p className="font-bold text-slate-200 flex items-center gap-1">
              <Globe className="w-3.5 h-3.5 text-sky-400" /> CloudFront
            </p>
            <p className="text-[10px] text-slate-400 truncate">{stats?.cloudfrontDomain || 'OAC Private Origin'}</p>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">6. Transport</p>
            <p className="font-bold text-slate-200 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-rose-400" /> HTTPS / TLS
            </p>
            <p className="text-[10px] text-slate-400">Strict Auth & RLS</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded-2xl text-xs text-rose-700 dark:text-rose-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 3. FOUR DASHBOARD SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Files */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Cloud Files</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">
            {stats?.totalFiles ?? files.length}
          </p>
          <p className="text-[11px] text-slate-400">Stored in private AWS S3 bucket</p>
        </div>

        {/* Total Storage Used */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Storage Used</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white">
            {formatBytes(stats?.totalStorageBytes ?? files.reduce((s, f) => s + f.file_size, 0))}
          </p>
          <p className="text-[11px] text-slate-400">Divided into 1MB encrypted blocks</p>
        </div>

        {/* Encrypted Files */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Encrypted Files</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Lock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400">
            {stats?.encryptedFilesCount ?? files.length}
          </p>
          <p className="text-[11px] text-slate-400">100% AES-256-GCM authenticated</p>
        </div>

        {/* Recent Uploads */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Recent Uploads</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Cloud className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {stats?.recentUploadsCount ?? files.length}
          </p>
          <p className="text-[11px] text-slate-400">Reports and user documents</p>
        </div>
      </div>

      {/* 4. CONTROLS: SEARCH, FILTER, SORT */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by file name or UUID..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Category Filter */}
        <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-0.5 text-xs font-semibold">
          {[
            { id: 'ALL', label: 'All Files' },
            { id: 'REPORT', label: 'Reports' },
            { id: 'KHATA', label: 'Khata' },
            { id: 'EXPENSE', label: 'Expense' },
            { id: 'LOAN', label: 'Loans' },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategoryFilter(cat.id)}
              className={`px-3 py-1.5 rounded-lg transition ${
                categoryFilter === cat.id
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="flex items-center gap-1.5">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none"
          >
            <option value="DATE_DESC">Newest First</option>
            <option value="DATE_ASC">Oldest First</option>
            <option value="SIZE_DESC">Largest Size</option>
            <option value="SIZE_ASC">Smallest Size</option>
            <option value="NAME_ASC">Name (A-Z)</option>
          </select>
        </div>
      </div>

      {/* 5. FILE LIST TABLE */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <p className="text-xs font-semibold text-slate-500">Querying AWS S3 & Supabase catalog...</p>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="py-16 text-center space-y-3 px-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
              <Cloud className="w-7 h-7" />
            </div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              No Cloud Files Found
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {searchQuery
                ? 'No documents match your search criteria.'
                : 'Generate a PDF statement from Reports or upload any document to test block splitting, AES-256-GCM encryption, and AWS S3 storage.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50 dark:bg-slate-800/20">
                  <th className="py-3.5 px-4">File Name & Info</th>
                  <th className="py-3.5 px-4">Size</th>
                  <th className="py-3.5 px-4">Blocks (1MB)</th>
                  <th className="py-3.5 px-4">Encryption</th>
                  <th className="py-3.5 px-4">Storage Target</th>
                  <th className="py-3.5 px-4">Upload Date</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {filteredFiles.map((f) => {
                  const isDownloading = downloadingId === f.id;
                  const isDeleting = deletingId === f.id;

                  return (
                    <tr
                      key={f.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Name & Reference */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white truncate max-w-[220px]">
                              {f.file_name}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] font-mono text-slate-400 truncate max-w-[130px]">
                                {f.id}
                              </span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(f.id, f.id)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                title="Copy File UUID"
                              >
                                {copiedId === f.id ? (
                                  <Check className="w-3 h-3 text-emerald-500" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* File Size */}
                      <td className="py-3.5 px-4 font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        {formatBytes(f.file_size)}
                      </td>

                      {/* Chunk count */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300">
                          <Layers className="w-3 h-3" />
                          {f.chunk_count} {f.chunk_count === 1 ? 'Block' : 'Blocks'}
                        </span>
                      </td>

                      {/* Encryption Algorithm */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300">
                          <Lock className="w-3 h-3" />
                          {f.encryption_algorithm}
                        </span>
                      </td>

                      {/* Storage Target */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                            <Server className="w-3 h-3 text-blue-500" />
                            <span>{f.storage_bucket}</span>
                          </div>
                          <p className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Globe className="w-3 h-3 text-sky-400" /> CloudFront CDN
                          </p>
                        </div>
                      </td>

                      {/* Upload Date */}
                      <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 whitespace-nowrap text-[11px]">
                        {new Date(f.created_at).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}{' '}
                        {new Date(f.created_at).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View Block Details */}
                          <button
                            type="button"
                            onClick={() => handleViewDetails(f.id)}
                            className="p-2 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg transition"
                            title="Inspect Block Splitting & S3 Objects"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Secure Download */}
                          <button
                            type="button"
                            onClick={() => handleSecureDownload(f)}
                            disabled={isDownloading}
                            className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-lg transition disabled:opacity-50"
                            title="Decrypt & Reconstruct PDF"
                          >
                            {isDownloading ? (
                              <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                            ) : (
                              <Download className="w-4 h-4" />
                            )}
                          </button>

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => handleDelete(f.id)}
                            disabled={isDeleting}
                            className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition disabled:opacity-50"
                            title="Delete file and S3 chunks"
                          >
                            {isDeleting ? (
                              <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 6. MODAL: DETAILED BLOCK & CLOUD INSPECTOR */}
      {selectedFileDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Cloud Storage & Block Inspector
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    File ID: {selectedFileDetails.id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedFileDetails(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Top specs */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-1">
                <span className="text-[10px] text-slate-400">File Name</span>
                <p className="font-bold text-slate-900 dark:text-white truncate">
                  {selectedFileDetails.file_name}
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-1">
                <span className="text-[10px] text-slate-400">Reconstructed Size</span>
                <p className="font-bold text-slate-900 dark:text-white">
                  {formatBytes(selectedFileDetails.file_size)}
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-1">
                <span className="text-[10px] text-slate-400">Encryption Standard</span>
                <p className="font-bold text-amber-600 dark:text-amber-400">
                  {selectedFileDetails.encryption_algorithm}
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-1">
                <span className="text-[10px] text-slate-400">AWS S3 Bucket</span>
                <p className="font-bold text-blue-600 dark:text-blue-400 truncate">
                  {selectedFileDetails.storage_bucket}
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-1">
                <span className="text-[10px] text-slate-400">Overall SHA-256</span>
                <p className="font-mono text-[10px] font-bold text-slate-800 dark:text-slate-200 truncate" title={selectedFileDetails.checksum}>
                  {selectedFileDetails.checksum.slice(0, 16)}...
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-1">
                <span className="text-[10px] text-slate-400">CloudFront Domain</span>
                <p className="font-bold text-slate-800 dark:text-slate-200 truncate">
                  {stats?.cloudfrontDomain || 'OAC Managed'}
                </p>
              </div>
            </div>

            {/* S3 URI details */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                S3 Storage Key Prefix
              </span>
              <p className="font-mono text-[11px] text-slate-800 dark:text-slate-200 break-all">
                s3://{selectedFileDetails.storage_bucket}/{selectedFileDetails.storage_key}
              </p>
            </div>

            {/* Chunks List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-500" />
                  Split Blocks ({selectedFileDetails.chunks.length} Chunks)
                </span>
                <span className="text-[11px] text-slate-400">Default block size: 1 MB</span>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {selectedFileDetails.chunks.map((chk) => (
                  <div
                    key={chk.chunk_index}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 dark:text-white">
                        Block {chk.chunk_index + 1} of {selectedFileDetails.chunks.length}
                      </span>
                      <span className="font-mono text-[11px] text-slate-500">
                        {formatBytes(chk.chunk_size)}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                      <div>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">Object Key: </span>
                        <span className="font-mono">{chk.storage_key.split('/').pop()}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">Block SHA-256: </span>
                        <span className="font-mono">{chk.checksum.slice(0, 14)}...</span>
                      </div>
                      <div>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">IV (96-bit): </span>
                        <span className="font-mono">{chk.encryption_iv}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">Auth Tag (128-bit): </span>
                        <span className="font-mono">{chk.encryption_tag}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedFileDetails(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => handleSecureDownload(selectedFileDetails)}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition flex items-center gap-1.5 shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Secure Download</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL: UPLOAD PROGRESS STEPPER */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 text-center">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto shadow-sm">
              {uploadProgress.stage === 'completed' ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              ) : uploadProgress.stage === 'error' ? (
                <AlertCircle className="w-6 h-6 text-rose-500" />
              ) : (
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              )}
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {uploadProgress.stage === 'completed'
                  ? 'Cloud Upload Verified'
                  : uploadProgress.stage === 'error'
                  ? 'Upload Encountered an Error'
                  : 'Processing Cloud Storage'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {uploadProgress.message}
              </p>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-2.5 transition-all duration-300 rounded-full ${
                  uploadProgress.stage === 'error'
                    ? 'bg-rose-500'
                    : uploadProgress.stage === 'completed'
                    ? 'bg-emerald-500'
                    : 'bg-blue-600'
                }`}
                style={{ width: `${uploadProgress.percent}%` }}
              />
            </div>

            {/* Stepper items */}
            <div className="space-y-1.5 text-left text-xs font-medium">
              <div className={`flex items-center justify-between p-2 rounded-xl ${uploadProgress.percent >= 15 ? 'text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20' : 'text-slate-400'}`}>
                <span>1. Preparing File</span>
                {uploadProgress.percent >= 15 && <Check className="w-3.5 h-3.5 text-blue-600" />}
              </div>

              <div className={`flex items-center justify-between p-2 rounded-xl ${uploadProgress.percent >= 35 ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20' : 'text-slate-400'}`}>
                <span>2. Splitting into 1MB Blocks</span>
                {uploadProgress.percent >= 35 && <Check className="w-3.5 h-3.5 text-indigo-600" />}
              </div>

              <div className={`flex items-center justify-between p-2 rounded-xl ${uploadProgress.percent >= 55 ? 'text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20' : 'text-slate-400'}`}>
                <span>3. AES-256-GCM Encryption</span>
                {uploadProgress.percent >= 55 && <Check className="w-3.5 h-3.5 text-amber-600" />}
              </div>

              <div className={`flex items-center justify-between p-2 rounded-xl ${uploadProgress.percent >= 75 ? 'text-sky-600 dark:text-sky-400 bg-sky-50/50 dark:bg-sky-950/20' : 'text-slate-400'}`}>
                <span>4. AWS S3 Private Upload</span>
                {uploadProgress.percent >= 75 && <Check className="w-3.5 h-3.5 text-sky-600" />}
              </div>

              <div className={`flex items-center justify-between p-2 rounded-xl ${uploadProgress.percent >= 90 ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20' : 'text-slate-400'}`}>
                <span>5. Verifying SHA-256 Integrity</span>
                {uploadProgress.percent >= 90 && <Check className="w-3.5 h-3.5 text-emerald-600" />}
              </div>
            </div>

            {uploadProgress.stage === 'error' && (
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-200 transition"
              >
                Close
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
