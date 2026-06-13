'use client';

import { useState, useEffect, useCallback } from 'react';
import { Archive, RefreshCw } from 'lucide-react';
import FileUpload from '@/components/FileUpload';
import FileCard from '@/components/FileCard';
import SearchFilter from '@/components/SearchFilter';
import type { FileCategory, FileRecordWithSavings, FileRecord } from '@/types';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export default function Home() {
  const [files, setFiles] = useState<FileRecordWithSavings[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<FileCategory>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFiles = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    else setRefreshing(true);

    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (category !== 'all') params.set('category', category);
      const res = await fetch(`/api/files?${params}`);
      const data = await res.json();
      setFiles(data.files ?? []);
    } catch {
      // keep existing files on error
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, category]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // Poll every 3 s if any file is still processing
  useEffect(() => {
    const hasProcessing = files.some(
      f => f.optimization_status === 'processing' || f.optimization_status === 'pending'
    );
    if (!hasProcessing) return;
    const timer = setTimeout(() => fetchFiles({ silent: true }), 3000);
    return () => clearTimeout(timer);
  }, [files, fetchFiles]);

  const handleUploadComplete = (file: FileRecord) => {
    setFiles(prev => [{ ...file, savings_percent: null }, ...prev]);
    setTimeout(() => fetchFiles({ silent: true }), 2500);
  };

  const handleDelete = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const totalSaved = files.reduce((acc, f) => {
    if (f.original_size && f.optimized_size != null) {
      return acc + Math.max(0, f.original_size - f.optimized_size);
    }
    return acc;
  }, 0);

  const optimizedCount = files.filter(f => f.optimization_status === 'optimized').length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Archive className="text-blue-600 dark:text-blue-400" size={28} />
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">File Shrinker Archive</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">Upload, optimize, and manage your files</p>
            </div>
          </div>
          <button
            onClick={() => fetchFiles({ silent: true })}
            disabled={refreshing}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 disabled:opacity-50 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Stats */}
        {files.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total Files', value: String(files.length) },
              { label: 'Optimized', value: String(optimizedCount) },
              { label: 'Space Saved', value: formatBytes(totalSaved) },
              {
                label: 'Success Rate',
                value: files.length > 0 ? `${Math.round((optimizedCount / files.length) * 100)}%` : '—',
              },
            ].map(stat => (
              <div
                key={stat.label}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-center"
              >
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Upload */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3">
            Upload Files
          </h2>
          <FileUpload onUploadComplete={handleUploadComplete} />
        </section>

        {/* File list */}
        <section>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-4">
            Your Files
          </h2>

          <SearchFilter
            search={search}
            category={category}
            onSearchChange={setSearch}
            onCategoryChange={setCategory}
            total={files.length}
          />

          <div className="mt-4">
            {loading ? (
              <div className="text-center py-16 text-gray-400 dark:text-gray-500">
                <div className="inline-block w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
                <p>Loading files…</p>
              </div>
            ) : files.length === 0 ? (
              <div className="text-center py-16 text-gray-400 dark:text-gray-500">
                <Archive size={40} className="mx-auto mb-3 opacity-40" />
                <p className="font-medium">No files yet</p>
                <p className="text-sm mt-1">Upload a file above to get started</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {files.map(file => (
                  <FileCard key={file.id} file={file} onDelete={handleDelete} />
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
