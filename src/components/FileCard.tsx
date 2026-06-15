'use client';

import { useState } from 'react';
import {
  FileImage, FileAudio, FileVideo, FileText, File,
  Download, Trash2, Eye, CheckCircle, XCircle,
  Clock, AlertTriangle, Minus,
} from 'lucide-react';
import type { FileRecordWithSavings } from '@/types';
import { formatBytes } from '@/lib/clientUtils';
import FilePreview from './FilePreview';

interface FileCardProps {
  file: FileRecordWithSavings;
  onDelete: (id: string) => void;
}

function FileTypeIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith('image/')) return <FileImage size={20} className="text-purple-500" />;
  if (mimeType.startsWith('audio/')) return <FileAudio size={20} className="text-green-500" />;
  if (mimeType.startsWith('video/')) return <FileVideo size={20} className="text-red-500" />;
  if (mimeType === 'application/pdf') return <File size={20} className="text-orange-500" />;
  if (mimeType.startsWith('text/') || mimeType.includes('json') || mimeType.includes('csv')) return <FileText size={20} className="text-blue-500" />;
  return <File size={20} className="text-gray-500" />;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
    optimized: { label: 'Optimized', icon: <CheckCircle size={12} />, cls: 'bg-green-100 text-green-700' },
    processing: { label: 'Processing', icon: <Clock size={12} />, cls: 'bg-blue-100 text-blue-700 animate-pulse' },
    pending: { label: 'Pending', icon: <Clock size={12} />, cls: 'bg-gray-100 text-gray-600' },
    failed: { label: 'Failed', icon: <XCircle size={12} />, cls: 'bg-red-100 text-red-700' },
    no_savings: { label: 'No savings', icon: <Minus size={12} />, cls: 'bg-yellow-100 text-yellow-700' },
    unsupported: { label: 'Not enabled', icon: <AlertTriangle size={12} />, cls: 'bg-gray-100 text-gray-600' },
  };
  const s = map[status] ?? map.unsupported;
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.icon} {s.label}</span>;
}

function statusMessage(file: FileRecordWithSavings): string | null {
  if (file.optimization_status === 'optimized') return 'A smaller copy was created. Your original is still available.';
  if (file.optimization_status === 'no_savings') return 'Compression did not produce a smaller file, so the original was kept.';
  if (file.optimization_status === 'failed') return 'Optimization failed, but the original file was stored safely.';
  if (file.optimization_status === 'unsupported') {
    if (file.mime_type.startsWith('audio/')) return 'Audio compression is not enabled yet. It requires FFmpeg or a media-processing service.';
    if (file.mime_type.startsWith('video/')) return 'Video compression is not enabled yet. It requires FFmpeg or a media-processing service.';
    if (file.mime_type === 'application/pdf') return 'PDF compression requires an active iLoveAPI connection.';
    return 'This format is stored, but FileShrinker does not currently have a compressor for it.';
  }
  return null;
}

export default function FileCard({ file, onDelete }: FileCardProps) {
  const [deleting, setDeleting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const canPreview = ['image/', 'audio/', 'video/', 'text/', 'application/pdf', 'application/json'].some(p => file.mime_type.startsWith(p));

  const handleDelete = async () => {
    if (!confirm(`Delete "${file.original_filename}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/files/${file.id}`, { method: 'DELETE' });
      if (res.ok) onDelete(file.id);
      else setDeleting(false);
    } catch {
      setDeleting(false);
    }
  };

  const savingsPct = file.savings_percent;
  const hasSavings = savingsPct !== null && savingsPct > 0;
  const hasOptimized = file.optimization_status === 'optimized' && file.optimized_size != null;
  const message = statusMessage(file);

  return (
    <>
      <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <FileTypeIcon mimeType={file.mime_type} />
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{file.original_filename}</p><p className="mt-0.5 text-xs text-gray-500">{file.mime_type}</p></div>
          <StatusBadge status={file.optimization_status} />
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-gray-50 px-1 py-2"><p className="text-xs text-gray-500">Original</p><p className="mt-0.5 text-sm font-semibold">{formatBytes(file.original_size)}</p></div>
          <div className="rounded-lg bg-gray-50 px-1 py-2"><p className="text-xs text-gray-500">Optimized</p><p className="mt-0.5 text-sm font-semibold">{hasOptimized && file.optimized_size != null ? formatBytes(file.optimized_size) : '—'}</p></div>
          <div className={`rounded-lg px-1 py-2 ${hasSavings ? 'bg-green-50' : 'bg-gray-50'}`}><p className="text-xs text-gray-500">Saved</p><p className={`mt-0.5 text-sm font-semibold ${hasSavings ? 'text-green-600' : 'text-gray-500'}`}>{hasSavings ? `${savingsPct}%` : '—'}</p></div>
        </div>

        {message && <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">{message}</p>}
        {file.compression_method && <p className="text-center text-xs text-gray-400">{file.compression_method}</p>}
        <p className="text-center text-xs text-gray-400">{new Date(file.upload_date).toLocaleString()}</p>

        <div className="flex flex-wrap gap-2">
          {canPreview && <button onClick={() => setShowPreview(true)} className="flex-1 rounded-lg bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700"><Eye size={14} className="mr-1 inline" />Preview</button>}
          <a href={`/api/files/${file.id}/download?type=original`} className="flex-1 rounded-lg bg-gray-100 px-3 py-2 text-center text-xs font-medium"><Download size={14} className="mr-1 inline" />Original</a>
          {hasOptimized && <a href={`/api/files/${file.id}/download?type=optimized`} className="flex-1 rounded-lg bg-green-50 px-3 py-2 text-center text-xs font-medium text-green-700"><Download size={14} className="mr-1 inline" />Optimized</a>}
          <button onClick={handleDelete} disabled={deleting} className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600"><Trash2 size={14} className="mr-1 inline" />{deleting ? '…' : 'Delete'}</button>
        </div>
      </div>
      {showPreview && <FilePreview file={file} onClose={() => setShowPreview(false)} />}
    </>
  );
}
