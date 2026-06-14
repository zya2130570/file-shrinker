export type OptimizationStatus =
  | 'pending'
  | 'processing'
  | 'optimized'
  | 'failed'
  | 'no_savings'
  | 'unsupported';

export interface FileRecord {
  id: string;
  original_filename: string;
  mime_type: string;
  original_size: number;
  optimized_size: number | null;
  compression_method: string | null;
  upload_date: string;
  original_storage_path: string;   // path within fsa-originals bucket
  optimized_storage_path: string | null; // path within fsa-optimized bucket
  optimization_status: OptimizationStatus;
  user_id: string | null;
}

export interface FileRecordWithSavings extends FileRecord {
  savings_percent: number | null;
}

export type FileCategory = 'all' | 'images' | 'pdfs' | 'audio' | 'video' | 'documents' | 'no_savings';

export interface UploadResponse {
  success: boolean;
  file?: FileRecord;
  error?: string;
  detail?: string;
}

export interface ListFilesResponse {
  files: FileRecordWithSavings[];
  total: number;
}

// Processors now return a buffer (no local disk I/O in serverless)
export interface ProcessorResult {
  optimizedBuffer: Buffer | null;
  optimizedExt: string | null;   // e.g. '.webp', '.gz'
  compressionMethod: string | null;
  status: OptimizationStatus;
}
