'use client';

import { useEffect, useState } from 'react';
import { X, Download } from 'lucide-react';
import type { FileRecordWithSavings } from '@/types';
import { formatBytes } from '@/lib/clientUtils';

interface FilePreviewProps {
  file: FileRecordWithSavings;
  onClose: () => void;
}

export default function FilePreview({ file, onClose }: FilePreviewProps) {
  const [textContent, setTextContent] = useState<string | null>(null);
  const isText = file.mime_type.startsWith('text/') || file.mime_type === 'application/json' || file.mime_type === 'application/csv';
  const isImage = file.mime_type.startsWith('image/');
  const isAudio = file.mime_type.startsWith('audio/');
  const isVideo = file.mime_type.startsWith('video/');
  const isPdf = file.mime_type === 'application/pdf';

  const previewUrl = `/api/files/${file.id}/preview`;

  useEffect(() => {
    if (isText) {
      fetch(previewUrl)
        .then(r => r.text())
        .then(setTextContent)
        .catch(() => setTextContent('Failed to load preview'));
    }
  }, [isText, previewUrl]);

  // Close on backdrop click
  const onBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onBackdrop}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div className="min-w-0">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100 truncate">{file.original_filename}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {file.mime_type} &middot; {formatBytes(file.original_size)}
              {file.optimized_size != null && (
                <> &rarr; {formatBytes(file.optimized_size)} ({file.savings_percent}% saved)</>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-4">
            <a
              href={`/api/files/${file.id}/download?type=original`}
              className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 flex items-center gap-1"
            >
              <Download size={13} /> Original
            </a>
            {file.optimization_status === 'optimized' && (
              <a
                href={`/api/files/${file.id}/download?type=optimized`}
                className="text-xs px-3 py-1.5 rounded-lg bg-green-50 hover:bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 flex items-center gap-1"
              >
                <Download size={13} /> Optimized
              </a>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Preview body */}
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center min-h-0">
          {isImage && (
            <img
              src={previewUrl}
              alt={file.original_filename}
              className="max-w-full max-h-full object-contain rounded-lg"
            />
          )}

          {isAudio && (
            <div className="w-full max-w-lg space-y-4 text-center">
              <p className="text-4xl">🎵</p>
              <p className="font-medium text-gray-700 dark:text-gray-300">{file.original_filename}</p>
              <audio controls className="w-full" src={previewUrl}>
                Your browser does not support audio playback.
              </audio>
            </div>
          )}

          {isVideo && (
            <video
              controls
              className="max-w-full max-h-full rounded-lg"
              src={previewUrl}
            >
              Your browser does not support video playback.
            </video>
          )}

          {isPdf && (
            <iframe
              src={previewUrl}
              className="w-full h-full min-h-[500px] rounded-lg border border-gray-200 dark:border-gray-700"
              title={file.original_filename}
            />
          )}

          {isText && (
            <div className="w-full h-full overflow-auto">
              {textContent == null ? (
                <p className="text-gray-500 text-center">Loading…</p>
              ) : (
                <pre className="text-xs font-mono bg-gray-50 dark:bg-gray-800 p-4 rounded-lg overflow-x-auto whitespace-pre-wrap text-gray-800 dark:text-gray-200">
                  {textContent}
                </pre>
              )}
            </div>
          )}

          {!isImage && !isAudio && !isVideo && !isPdf && !isText && (
            <div className="text-center text-gray-500 dark:text-gray-400 space-y-2">
              <p className="text-5xl">📄</p>
              <p className="font-medium">{file.original_filename}</p>
              <p className="text-sm">No preview available for this file type.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
