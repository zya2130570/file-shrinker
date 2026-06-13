'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import type { FileRecord } from '@/types';

interface UploadState {
  file: File;
  progress: number;
  status: 'uploading' | 'done' | 'error';
  error?: string;
  result?: FileRecord;
}

interface FileUploadProps {
  onUploadComplete: (file: FileRecord) => void;
}

const ACCEPTED_TYPES = [
  'image/*', 'application/pdf', 'audio/*', 'video/*',
  'text/plain', 'text/csv', 'text/html', 'text/xml', 'text/css',
  'application/json', 'application/csv', 'application/xml',
  'application/zip', 'application/gzip', 'application/x-7z-compressed',
].join(',');

export default function FileUpload({ onUploadComplete }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(async (file: File) => {
    const id = `${file.name}-${Date.now()}`;

    setUploads(prev => [...prev, { file, progress: 0, status: 'uploading' }]);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const xhr = new XMLHttpRequest();

      const progressPromise = new Promise<void>((resolve) => {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 90);
            setUploads(prev =>
              prev.map(u => u.file === file ? { ...u, progress: pct } : u)
            );
          }
        });
        xhr.addEventListener('loadend', () => resolve());
      });

      xhr.open('POST', '/api/upload');
      xhr.send(formData);
      await progressPromise;

      // XHR status 0 means the request never got a response (connection refused,
      // CORS block, or the server closed the connection without a reply).
      if (xhr.status === 0) {
        const detail = file.size > 4.5 * 1024 * 1024
          ? `No response from server. File size is ${(file.size / 1024 / 1024).toFixed(1)} MB — your hosting plan may have a smaller upload limit.`
          : 'No response from server. Check your network connection or server logs.';
        setUploads(prev =>
          prev.map(u => u.file === file ? { ...u, status: 'error', error: detail } : u)
        );
        return;
      }

      let response: { success?: boolean; error?: string; detail?: string } = {};
      try {
        response = JSON.parse(xhr.responseText);
      } catch {
        // Response body wasn't valid JSON — show the raw text (truncated)
        const rawPreview = xhr.responseText.slice(0, 200);
        setUploads(prev =>
          prev.map(u => u.file === file
            ? { ...u, status: 'error', error: `Server returned HTTP ${xhr.status} with non-JSON body: ${rawPreview}` }
            : u)
        );
        return;
      }

      if (xhr.status >= 200 && xhr.status < 300 && response.success) {
        setUploads(prev =>
          prev.map(u => u.file === file ? { ...u, progress: 100, status: 'done', result: (response as { file?: import('@/types').FileRecord }).file } : u)
        );
        onUploadComplete((response as { file: import('@/types').FileRecord }).file);
      } else {
        // Show both the short error and the server detail if present
        const msg = [
          `HTTP ${xhr.status}:`,
          response.error ?? 'Upload failed',
          response.detail ? `(${response.detail})` : '',
        ].filter(Boolean).join(' ');
        setUploads(prev =>
          prev.map(u => u.file === file ? { ...u, status: 'error', error: msg } : u)
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setUploads(prev =>
        prev.map(u => u.file === file ? { ...u, status: 'error', error: `Client error: ${msg}` } : u)
      );
    }
  }, [onUploadComplete]);

  const handleFiles = useCallback((files: FileList | File[]) => {
    Array.from(files).forEach(uploadFile);
  }, [uploadFile]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const removeUpload = (file: File) => {
    setUploads(prev => prev.filter(u => u.file !== file));
  };

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors select-none
          ${isDragging
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
            : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 bg-gray-50 dark:bg-gray-800/50'
          }`}
      >
        <Upload className="mx-auto mb-3 text-gray-400 dark:text-gray-500" size={36} />
        <p className="text-base font-medium text-gray-700 dark:text-gray-300">
          {isDragging ? 'Drop files here' : 'Drag & drop files here'}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">or click to browse</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
          Images, PDFs, Audio, Video, Text, CSV, JSON — up to 500 MB
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED_TYPES}
        className="hidden"
        onChange={e => e.target.files && handleFiles(e.target.files)}
      />

      {/* Upload queue */}
      {uploads.length > 0 && (
        <div className="space-y-2">
          {uploads.map((upload, i) => (
            <div key={i} className="flex items-center gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate text-gray-800 dark:text-gray-200">
                  {upload.file.name}
                </p>
                {upload.status === 'uploading' && (
                  <div className="mt-1.5">
                    <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all duration-200"
                        style={{ width: `${upload.progress}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{upload.progress}%</p>
                  </div>
                )}
                {upload.status === 'error' && (
                  <p className="text-xs text-red-500 mt-0.5">{upload.error}</p>
                )}
                {upload.status === 'done' && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">Uploaded successfully</p>
                )}
              </div>
              <div className="shrink-0">
                {upload.status === 'uploading' && <Loader2 className="animate-spin text-blue-500" size={18} />}
                {upload.status === 'done' && <CheckCircle className="text-green-500" size={18} />}
                {upload.status === 'error' && <AlertCircle className="text-red-500" size={18} />}
              </div>
              {(upload.status === 'done' || upload.status === 'error') && (
                <button
                  onClick={e => { e.stopPropagation(); removeUpload(upload.file); }}
                  className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
