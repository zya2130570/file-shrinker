import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { getDb } from '@/lib/db';
import { ORIGINALS_DIR, ensureStorageDirs, mimeToExt } from '@/lib/storage';
import { processFile } from '@/lib/processors';

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB

const ALLOWED_MIME_TYPES = new Set([
  // Images
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'image/tiff', 'image/bmp',
  // PDF
  'application/pdf',
  // Audio
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/flac', 'audio/aac',
  // Video
  'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo',
  // Text
  'text/plain', 'text/csv', 'application/json', 'application/csv',
  'text/html', 'text/xml', 'application/xml', 'text/javascript',
  'application/javascript', 'text/css',
  // Generic compressed (store only)
  'application/zip', 'application/x-zip-compressed', 'application/gzip',
  'application/x-7z-compressed',
]);

function errorResponse(message: string, detail: string, status: number) {
  return NextResponse.json({ success: false, error: message, detail }, { status });
}

export async function POST(request: NextRequest) {
  let uuid: string | null = null;
  let originalPath: string | null = null;

  try {
    // Step 1: Ensure storage directories exist
    try {
      ensureStorageDirs();
    } catch (err) {
      return errorResponse(
        'Storage initialization failed',
        `Could not create upload directories: ${err instanceof Error ? err.message : String(err)}`,
        500
      );
    }

    // Step 2: Parse the multipart form
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (err) {
      return errorResponse(
        'Failed to parse upload',
        `Request body could not be read: ${err instanceof Error ? err.message : String(err)}`,
        400
      );
    }

    const file = formData.get('file') as File | null;
    if (!file) {
      return errorResponse('No file provided', 'The "file" field is missing from the form data', 400);
    }

    // Step 3: Validate
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return errorResponse(
        `Unsupported file type: ${file.type || '(unknown)'}`,
        'Supported types: images, PDFs, audio, video, text, CSV, JSON, ZIP',
        400
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return errorResponse(
        `File too large (${Math.round(file.size / 1024 / 1024)} MB)`,
        'Maximum upload size is 500 MB',
        400
      );
    }

    // Step 4: Write original file to disk
    const originalFilename = path.basename(file.name).replace(/[^\w.\- ]/g, '_').slice(0, 255);
    uuid = uuidv4();
    const ext = mimeToExt(file.type);
    originalPath = path.join(ORIGINALS_DIR, `${uuid}${ext}`);

    let arrayBuffer: ArrayBuffer;
    try {
      arrayBuffer = await file.arrayBuffer();
    } catch (err) {
      return errorResponse(
        'Failed to read file data',
        err instanceof Error ? err.message : String(err),
        400
      );
    }

    try {
      fs.writeFileSync(originalPath, Buffer.from(arrayBuffer));
    } catch (err) {
      return errorResponse(
        'Failed to save file',
        `Disk write error: ${err instanceof Error ? err.message : String(err)}`,
        500
      );
    }

    // Step 5: Initialize DB and insert record
    let db: ReturnType<typeof getDb>;
    try {
      db = getDb();
    } catch (err) {
      // Clean up file if DB fails
      try { fs.unlinkSync(originalPath); } catch {}
      return errorResponse(
        'Database initialization failed',
        err instanceof Error ? err.message : String(err),
        500
      );
    }

    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO files (id, original_filename, mime_type, original_size, upload_date, original_path, optimization_status)
      VALUES (?, ?, ?, ?, ?, ?, 'processing')
    `).run(uuid, originalFilename, file.type, file.size, now, originalPath);

    // Step 6: Run optimization synchronously so it completes before the
    // serverless function returns (setImmediate is killed after response on Vercel).
    let optResult;
    try {
      optResult = await processFile(originalPath, uuid, file.type, file.size);
    } catch (err) {
      optResult = {
        optimizedPath: null,
        optimizedSize: null,
        compressionMethod: null,
        status: 'failed' as const,
      };
      console.error('Optimization error:', err);
    }

    db.prepare(`
      UPDATE files SET
        optimized_size = ?,
        compression_method = ?,
        optimized_path = ?,
        optimization_status = ?
      WHERE id = ?
    `).run(
      optResult.optimizedSize,
      optResult.compressionMethod,
      optResult.optimizedPath,
      optResult.status,
      uuid
    );

    const record = db.prepare('SELECT * FROM files WHERE id = ?').get(uuid);
    return NextResponse.json({ success: true, file: record }, { status: 201 });

  } catch (err) {
    // Last-resort catch — log and return the real message
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error('Unhandled upload error:', stack ?? message);

    // Clean up partial file if it was written
    if (originalPath) {
      try { fs.unlinkSync(originalPath); } catch {}
    }

    return NextResponse.json(
      { success: false, error: 'Upload failed', detail: message },
      { status: 500 }
    );
  }
}

export const maxDuration = 60; // seconds
