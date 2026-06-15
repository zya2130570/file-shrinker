'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import type { FileRecord } from '@/types';

interface UploadState {
  file: File;
  progress: number;
  status: 'uploading' | 'processing' | 'done' | 'error';
  error?: string;
  resultMessage?: string;
}

interface FileUploadProps {
  onUploadComplete: (file: FileRecord) => void;
}

const ACCEPTED_TYPES = [
  'image/*', 'application/pdf',
  'text/plain', 'text/csv', 'text/markdown', 'text/html', 'text/xml', 'text/css',
  'application/json', 'application/csv', 'application/xml',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/msword', 'application/vnd.ms-excel', 'application/vnd.ms-powerpoint',
  'application/rtf', 'text/rtf',
  'application/zip', 'application/gzip', 'application/x-7z-compressed',
  'application/vnd.rar', 'application/x-rar-compressed',
  'audio/*', 'video/*',
].join(',');

function updateUpload(
  setUploads: React.Dispatch<React.SetStateAction<UploadState[]>>,
  file: File,
  patch: Partial<UploadState>
) {
  setUploads(prev => prev.map(item => item.file === file ? { ...item, ...patch } : item));
}

export default function FileUpload({ onUploadComplete }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(async (file: File) => {
    setUploads(prev => [...prev, { file, progress: 0, status: 'uploading' }]);
    const set = (patch: Partial<UploadState>) => updateUpload(setUploads, file, patch);

    try {
      const prepRes = await fetch('/api/upload/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, mimeType: file.type, size: file.size }),
      });

      let prep: {
        error?: string;
        detail?: string;
        uuid?: string;
        storagePath?: string;
        originalFilename?: string;
        uploadUrl?: string;
      };

      try {
        prep = await prepRes.json();
      } catch {
        set({ status: 'error', error: `HTTP ${prepRes.status}: Server returned an invalid response` });
        return;
      }

      if (!prepRes.ok) {
        set({
          status: 'error',
          error: `HTTP ${prepRes.status}: ${prep.error ?? 'Prepare failed'}${prep.detail ? ` (${prep.detail})` : ''}`,
        });
        return;
      }

      const { uuid, storagePath, originalFilename, uploadUrl } = prep as Required<typeof prep>;

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener('progress', event => {
          if (event.lengthComputable) set({ progress: Math.round((event.loaded / event.total) * 85) });
        });
        xhr.addEventListener('loadend', () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Supabase Storage returned HTTP ${xhr.status}: ${xhr.responseText.slice(0, 300)}`));
        });
        xhr.addEventListener('error', () => reject(new Error('Network error during upload to storage')));
        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
        xhr.send(file);
      });

      set({ progress: 90, status: 'processing' });

      const completeRes = await fetch('/api/upload/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uuid,
          storagePath,
          originalFilename,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
        }),
      });
      const complete = await completeRes.json();

      if (!completeRes.ok || !complete.success) {
        set({
          status: 'error',
          error: `HTTP ${completeRes.status}: ${complete.error ?? 'Completion failed'}${complete.detail ? ` (${complete.detail})` : ''}`,
        });
        return;
      }

      const record = complete.file as FileRecord;
      set({
        progress: 100,
        status: 'done',
        resultMessage: record.compression_method ?? 'Uploaded successfully',
      });
      onUploadComplete(record);
    } catch (error) {
      set({ status: 'error', error: error instanceof Error ? error.message : String(error) });
    }
  }, [onUploadComplete]);

  const handleFiles = useCallback((files: FileList | File[]) => {
    Array.from(files).forEach(uploadFile);
  }, [uploadFile]);

  return (
    <div className="space-y-4">
      <div
        onDragOver={event => { event.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={event => {
          event.preventDefault();
          setIsDragging(false);
          if (event.dataTransfer.files.length) handleFiles(event.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer select-none rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
            : 'border-gray-300 bg-gray-50 hover:border-blue-400 dark:border-gray-600 dark:bg-gray-800/50'
        }`}
      >
        <Upload className="mx-auto mb-3 text-gray-400" size={36} />
        <p className="text-base font-medium text-gray-700 dark:text-gray-300">
          {isDragging ? 'Drop files here' : 'Drag & drop files here'}
        </p>
        <p className="mt-1 text-sm text-gray-500">or click to browse</p>
        <p className="mt-2 text-xs text-gray-400">
          Images, PDFs, Office files, text, and archives — up to 500 MB
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED_TYPES}
        className="hidden"
        onChange={event => event.target.files && handleFiles(event.target.files)}
      />

      {uploads.length > 0 && (
        <div className="space-y-2">
          {uploads.map((upload, index) => (
            <div key={`${upload.file.name}-${index}`} className="flex items-center gap-3 rounded-lg border bg-white px-4 py-3 dark:bg-gray-800">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{upload.file.name}</p>
                {(upload.status === 'uploading' || upload.status === 'processing') && (
                  <div className="mt-1.5">
                    <div className="h-1.5 overflow-hidden rounded-full bg-gray-200">
                      <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${upload.progress}%` }} />
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {upload.status === 'processing' ? 'Checking whether optimization is useful…' : `${upload.progress}%`}
                    </p>
                  </div>
                )}
                {upload.status === 'done' && (
                  <p className="mt-1 text-xs text-green-700 dark:text-green-400">{upload.resultMessage}</p>
                )}
                {upload.status === 'error' && (
                  <p className="mt-1 break-all text-xs text-red-500">{upload.error}</p>
                )}
              </div>

              {(upload.status === 'uploading' || upload.status === 'processing') && <Loader2 className="animate-spin text-blue-500" size={18} />}
              {upload.status === 'done' && <CheckCircle className="text-green-500" size={18} />}
              {upload.status === 'error' && <AlertCircle className="text-red-500" size={18} />}

              {(upload.status === 'done' || upload.status === 'error') && (
                <button
                  onClick={event => {
                    event.stopPropagation();
                    setUploads(prev => prev.filter(item => item !== upload));
                  }}
                  className="text-gray-400 hover:text-gray-600"
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
