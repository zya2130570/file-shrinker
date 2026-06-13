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
  if (mimeType.startsWith('text/') || mimeType.includes('json') || mimeType.includes('csv'))
    return <FileText size={20} className="text-blue-500" />;
  return <File size={20} className="text-gray-500" />;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
    optimized: { label: 'Optimized', icon: <CheckCircle size={12} />, cls: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
    processing: { label: 'Processing', icon: <Clock size={12} />, cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 animate-pulse' },
    pending: { label: 'Pending', icon: <Clock size={12} />, cls: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' },
    failed: { label: 'Failed', icon: <XCircle size={12} />, cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
    no_savings: { label: 'No savings', icon: <Minus size={12} />, cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300' },
    unsupported: { label: 'Unsupported', icon: <AlertTriangle size={12} />, cls: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400' },
  };

  const s = map[status] ?? map.unsupported;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${s.cls}`}>
      {s.icon} {s.label}
    </span>
  );
}

export default function FileCard({ file, onDelete }: FileCardProps) {
  const [deleting, setDeleting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const canPreview = ['image/', 'audio/', 'video/', 'text/', 'application/pdf', 'application/json'].some(p =>
    file.mime_type.startsWith(p)
  );

  const handleDelete = async () => {
    if (!confirm(`Delete "${file.original_filename}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/files/${file.id}`, { method: 'DELETE' });
      if (res.ok) onDelete(file.id);
    } catch {
      setDeleting(false);
    }
  };

  const savingsPct = file.savings_percent;
  const hasSavings = savingsPct !== null && savingsPct > 0;
  const hasOptimized = file.optimization_status === 'optimized' && file.optimized_size != null;

  return (
    <>
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 flex flex-col gap-4 shadow-sm hover:shadow-md transition-shadow">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="shrink-0 mt-0.5">
            <FileTypeIcon mimeType={file.mime_type} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 dark:text-gray-100 truncate text-sm" title={file.original_filename}>
              {file.original_filename}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{file.mime_type}</p>
          </div>
          <StatusBadge status={file.optimization_status} />
        </div>

        {/* Size info */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg py-2 px-1">
            <p className="text-xs text-gray-500 dark:text-gray-400">Original</p>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-0.5">{formatBytes(file.original_size)}</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg py-2 px-1">
            <p className="text-xs text-gray-500 dark:text-gray-400">Optimized</p>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-0.5">
              {hasOptimized && file.optimized_size != null ? formatBytes(file.optimized_size) : '—'}
            </p>
          </div>
          <div className={`rounded-lg py-2 px-1 ${hasSavings ? 'bg-green-50 dark:bg-green-900/30' : 'bg-gray-50 dark:bg-gray-700/50'}`}>
            <p className="text-xs text-gray-500 dark:text-gray-400">Saved</p>
            <p className={`text-sm font-semibold mt-0.5 ${hasSavings ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
              {hasSavings ? `${savingsPct}%` : '—'}
            </p>
          </div>
        </div>

        {/* Compression method */}
        {file.compression_method && (
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
            {file.compression_method}
          </p>
        )}

        {/* Upload date */}
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
          {new Date(file.upload_date).toLocaleString()}
        </p>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          {canPreview && (
            <button
              onClick={() => setShowPreview(true)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 transition-colors"
            >
              <Eye size={14} /> Preview
            </button>
          )}
          <a
            href={`/api/files/${file.id}/download?type=original`}
            className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 transition-colors"
          >
            <Download size={14} /> Original
          </a>
          {hasOptimized && (
            <a
              href={`/api/files/${file.id}/download?type=optimized`}
              className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-green-50 hover:bg-green-100 dark:bg-green-900/30 dark:hover:bg-green-900/50 text-green-700 dark:text-green-300 transition-colors"
            >
              <Download size={14} /> Optimized
            </a>
          )}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 transition-colors disabled:opacity-50"
          >
            <Trash2 size={14} /> {deleting ? '…' : 'Delete'}
          </button>
        </div>
      </div>

      {showPreview && (
        <FilePreview file={file} onClose={() => setShowPreview(false)} />
      )}
    </>
  );
}
