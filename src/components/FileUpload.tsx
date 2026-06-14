'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import type { FileRecord } from '@/types';

interface UploadState {
  file: File;
  progress: number;
  status: 'uploading' | 'processing' | 'done' | 'error';
  error?: string;
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

function setUploadField(
  setUploads: React.Dispatch<React.SetStateAction<UploadState[]>>,
  file: File,
  patch: Partial<UploadState>
) {
  setUploads(prev => prev.map(u => u.file === file ? { ...u, ...patch } : u));
}

export default function FileUpload({ onUploadComplete }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(async (file: File) => {
    setUploads(prev => [...prev, { file, progress: 0, status: 'uploading' }]);
    const set = (patch: Partial<UploadState>) => setUploadField(setUploads, file, patch);

    try {
      // ── Step 1: Validate & get a direct Supabase Storage upload URL ──────────
      // Only sends JSON metadata — no file bytes go through Vercel here.
      const prepRes = await fetch('/api/upload/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, mimeType: file.type, size: file.size }),
      });
      const prep = await prepRes.json();
      if (!prepRes.ok) {
        set({ status: 'error', error: `HTTP ${prepRes.status}: ${prep.error ?? 'Prepare failed'}` });
        return;
      }
      const { uuid, storagePath, originalFilename, uploadUrl, uploadToken } = prep as {
        uuid: string; storagePath: string; originalFilename: string;
        uploadUrl: string; uploadToken: string;
      };

      // ── Step 2: Upload file DIRECTLY to Supabase Storage via XHR ─────────────
      // The File (Blob) goes straight from the browser to Supabase — never touches
      // Vercel's function, so there is no 4.5 MB function payload limit, and the
      // native Blob serialisation keeps binary bytes intact (no ByteString issue).
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            set({ progress: Math.round((e.loaded / e.total) * 85) });
          }
        });
        xhr.addEventListener('loadend', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            const body = xhr.responseText.slice(0, 300);
            reject(new Error(`Supabase Storage returned HTTP ${xhr.status}: ${body}`));
          }
        });
        xhr.addEventListener('error', () => reject(new Error('Network error during upload to storage')));

        xhr.open('POST', uploadUrl);
        xhr.setRequestHeader('Authorization', `Bearer ${uploadToken}`);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.setRequestHeader('x-upsert', 'false');
        xhr.send(file); // Native File/Blob — binary-safe
      });

      set({ progress: 90, status: 'processing' });

      // ── Step 3: Trigger optimization + DB registration ────────────────────────
      // Only JSON in the body — Vercel function gets ~100 bytes, not the whole file.
      const completeRes = await fetch('/api/upload/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uuid, storagePath, originalFilename, mimeType: file.type, size: file.size }),
      });
      const complete = await completeRes.json();
      if (!completeRes.ok || !complete.success) {
        set({ status: 'error', error: `HTTP ${completeRes.status}: ${complete.error ?? 'Completion failed'}${complete.detail ? ` (${complete.detail})` : ''}` });
        return;
      }

      set({ progress: 100, status: 'done' });
      onUploadComplete(complete.file as FileRecord);

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ status: 'error', error: msg });
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
                {(upload.status === 'uploading' || upload.status === 'processing') && (
                  <div className="mt-1.5">
                    <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all duration-200"
                        style={{ width: `${upload.progress}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {upload.status === 'processing' ? 'Optimizing…' : `${upload.progress}%`}
                    </p>
                  </div>
                )}
                {upload.status === 'error' && (
                  <p className="text-xs text-red-500 mt-0.5 break-all">{upload.error}</p>
                )}
                {upload.status === 'done' && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">Uploaded successfully</p>
                )}
              </div>
              <div className="shrink-0">
                {(upload.status === 'uploading' || upload.status === 'processing') && (
                  <Loader2 className="animate-spin text-blue-500" size={18} />
                )}
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
