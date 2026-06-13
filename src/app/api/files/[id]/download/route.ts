import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getDb } from '@/lib/db';
import type { FileRecord } from '@/types';

function isValidUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

function serveFile(filePath: string, filename: string, mimeType: string): NextResponse {
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'File not found on disk' }, { status: 404 });
  }

  const buffer = fs.readFileSync(filePath);
  const safeFilename = encodeURIComponent(path.basename(filename));

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${safeFilename}"`,
      'Content-Length': String(buffer.length),
      'Cache-Control': 'private, max-age=3600',
    },
  });
}

// GET /api/files/[id]/download?type=original|optimized
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isValidUuid(id)) {
    return NextResponse.json({ error: 'Invalid file ID' }, { status: 400 });
  }

  const type = request.nextUrl.searchParams.get('type') ?? 'original';

  const db = getDb();
  const file = db.prepare('SELECT * FROM files WHERE id = ?').get(id) as FileRecord | undefined;

  if (!file) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  if (type === 'optimized') {
    if (!file.optimized_path) {
      return NextResponse.json({ error: 'No optimized version available' }, { status: 404 });
    }
    const ext = path.extname(file.optimized_path);
    const optimizedFilename = `${path.parse(file.original_filename).name}_optimized${ext}`;
    const optimizedMime = getMimeForExt(ext) ?? file.mime_type;
    return serveFile(file.optimized_path, optimizedFilename, optimizedMime);
  }

  return serveFile(file.original_path, file.original_filename, file.mime_type);
}

function getMimeForExt(ext: string): string | null {
  const map: Record<string, string> = {
    '.webp': 'image/webp',
    '.mp3': 'audio/mpeg',
    '.mp4': 'video/mp4',
    '.gz': 'application/gzip',
    '.pdf': 'application/pdf',
  };
  return map[ext] ?? null;
}
