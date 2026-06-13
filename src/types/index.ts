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
  original_path: string;
  optimized_path: string | null;
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
}

export interface ListFilesResponse {
  files: FileRecordWithSavings[];
  total: number;
}

export interface ProcessorResult {
  optimizedPath: string | null;
  optimizedSize: number | null;
  compressionMethod: string | null;
  status: OptimizationStatus;
}
