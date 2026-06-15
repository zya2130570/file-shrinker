'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Archive, RefreshCw, Coins } from 'lucide-react';
import FileUpload from '@/components/FileUpload';
import FileCard from '@/components/FileCard';
import SearchFilter from '@/components/SearchFilter';
import type { FileCategory, FileRecordWithSavings, FileRecord } from '@/types';

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(2))} ${sizes[i]}`;
}

export default function Home() {
  const [files, setFiles] = useState<FileRecordWithSavings[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<FileCategory>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);
  const [creditsConfigured, setCreditsConfigured] = useState<boolean | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const previousCredits = useRef<number | null>(null);

  const fetchFiles = useCallback(async (silent = false) => {
    silent ? setRefreshing(true) : setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (category !== 'all') params.set('category', category);
      const data = await fetch(`/api/files?${params}`).then(r => r.json());
      setFiles(data.files ?? []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, category]);

  const fetchCredits = useCallback(async (showChange = false) => {
    try {
      const data = await fetch('/api/iloveapi/balance', { cache: 'no-store' }).then(r => r.json());
      setCreditsConfigured(Boolean(data.configured));
      const next = typeof data.remaining === 'number' ? data.remaining : null;
      if (showChange && previousCredits.current !== null && next !== null) {
        const spent = Math.max(0, previousCredits.current - next);
        if (spent > 0) {
          setToast(`${spent} credits spent. ${next} credits remaining.`);
          setTimeout(() => setToast(null), 6500);
        }
      }
      previousCredits.current = next;
      setCredits(next);
    } catch {
      setCreditsConfigured(true);
    }
  }, []);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);
  useEffect(() => { fetchCredits(false); }, [fetchCredits]);

  const handleUploadComplete = (file: FileRecord) => {
    setFiles(prev => [{ ...file, savings_percent: null }, ...prev]);
    setTimeout(() => fetchFiles(true), 1500);
    setTimeout(() => fetchCredits(true), 500);
  };

  const totalSaved = files.reduce((sum, f) => sum + Math.max(0, (f.original_size ?? 0) - (f.optimized_size ?? f.original_size ?? 0)), 0);
  const optimizedCount = files.filter(f => f.optimization_status === 'optimized').length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {toast && <div className="fixed right-4 top-4 z-50 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-medium text-white shadow-lg">{toast}</div>}
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Archive className="text-blue-600" size={28} />
            <div><h1 className="text-xl font-bold">File Shrinker Archive</h1><p className="text-xs text-gray-500">Upload, optimize, and manage your files</p></div>
          </div>
          <button onClick={() => { fetchFiles(true); fetchCredits(false); }} disabled={refreshing} className="p-2 text-gray-500"><RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} /></button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 px-4 py-8">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          {[
            ['Total Files', String(files.length)],
            ['Optimized', String(optimizedCount)],
            ['Space Saved', formatBytes(totalSaved)],
            ['Success Rate', files.length ? `${Math.round((optimizedCount / files.length) * 100)}%` : '—'],
          ].map(([label, value]) => <div key={label} className="rounded-xl border bg-white p-4 text-center"><p className="text-2xl font-bold">{value}</p><p className="mt-1 text-xs text-gray-500">{label}</p></div>)}
          <div className="col-span-2 rounded-xl border bg-white p-4 text-center sm:col-span-1"><p className="flex items-center justify-center gap-2 text-2xl font-bold"><Coins size={18} className="text-amber-500" />{creditsConfigured === false ? 'Not linked' : credits ?? '—'}</p><p className="mt-1 text-xs text-gray-500">iLoveAPI Credits</p></div>
        </div>

        <section><h2 className="mb-3 text-sm font-semibold uppercase">Upload Files</h2><FileUpload onUploadComplete={handleUploadComplete} /></section>
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase">Your Files</h2>
          <SearchFilter search={search} category={category} onSearchChange={setSearch} onCategoryChange={setCategory} total={files.length} />
          <div className="mt-4">
            {loading ? <div className="py-16 text-center text-gray-400">Loading files…</div> : files.length === 0 ? <div className="py-16 text-center text-gray-400"><Archive size={40} className="mx-auto mb-3 opacity-40" /><p>No files yet</p></div> : <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{files.map(file => <FileCard key={file.id} file={file} onDelete={id => setFiles(prev => prev.filter(f => f.id !== id))} />)}</div>}
          </div>
        </section>
      </main>
    </div>
  );
}
