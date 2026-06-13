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

export async function POST(request: NextRequest) {
  try {
    ensureStorageDirs();

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { success: false, error: `File type "${file.type}" is not supported` },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: `File too large. Maximum size is 500 MB` },
        { status: 400 }
      );
    }

    // Sanitize filename (display only — storage uses UUID)
    const originalFilename = path.basename(file.name).replace(/[^\w.\-]/g, '_').slice(0, 255);
    const uuid = uuidv4();
    const ext = mimeToExt(file.type);
    const originalPath = path.join(ORIGINALS_DIR, `${uuid}${ext}`);

    // Write original file
    const arrayBuffer = await file.arrayBuffer();
    fs.writeFileSync(originalPath, Buffer.from(arrayBuffer));

    const db = getDb();

    // Insert record with pending status
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO files (id, original_filename, mime_type, original_size, upload_date, original_path, optimization_status)
      VALUES (?, ?, ?, ?, ?, ?, 'processing')
    `).run(uuid, originalFilename, file.type, file.size, now, originalPath);

    // Run optimization asynchronously (fire and forget with error handling)
    setImmediate(async () => {
      try {
        const result = await processFile(originalPath, uuid, file.type, file.size);
        db.prepare(`
          UPDATE files SET
            optimized_size = ?,
            compression_method = ?,
            optimized_path = ?,
            optimization_status = ?
          WHERE id = ?
        `).run(
          result.optimizedSize,
          result.compressionMethod,
          result.optimizedPath,
          result.status,
          uuid
        );
      } catch (err) {
        console.error('Optimization failed for', uuid, err);
        db.prepare(`UPDATE files SET optimization_status = 'failed' WHERE id = ?`).run(uuid);
      }
    });

    const record = db.prepare('SELECT * FROM files WHERE id = ?').get(uuid);
    return NextResponse.json({ success: true, file: record }, { status: 201 });
  } catch (err) {
    console.error('Upload error:', err);
    return NextResponse.json(
      { success: false, error: 'Upload failed. Please try again.' },
      { status: 500 }
    );
  }
}

// Body size limit is configured in next.config.ts via experimental.serverActions.bodySizeLimit
export const maxDuration = 60; // seconds
