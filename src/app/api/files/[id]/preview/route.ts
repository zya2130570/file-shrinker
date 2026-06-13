import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getDb } from '@/lib/db';
import type { FileRecord } from '@/types';

function isValidUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

// Serve file inline (for previewing)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isValidUuid(id)) {
    return NextResponse.json({ error: 'Invalid file ID' }, { status: 400 });
  }

  const db = getDb();
  const file = db.prepare('SELECT * FROM files WHERE id = ?').get(id) as FileRecord | undefined;

  if (!file) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  // Serve optimized for preview if available, else original
  const servePath = file.optimized_path && fs.existsSync(file.optimized_path)
    ? file.optimized_path
    : file.original_path;

  if (!fs.existsSync(servePath)) {
    return NextResponse.json({ error: 'File not found on disk' }, { status: 404 });
  }

  const ext = path.extname(servePath).toLowerCase();
  const mimeType = getPreviewMime(ext, file.mime_type);

  // For text files, read and return as-is (don't serve .gz for preview)
  if (file.mime_type.startsWith('text/') || file.mime_type === 'application/json' || file.mime_type === 'application/csv') {
    const text = fs.readFileSync(file.original_path, 'utf-8');
    return new NextResponse(text.slice(0, 50_000), {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'private, max-age=300',
      },
    });
  }

  const buffer = fs.readFileSync(servePath);

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': mimeType,
      'Content-Disposition': 'inline',
      'Content-Length': String(buffer.length),
      'Cache-Control': 'private, max-age=3600',
    },
  });
}

function getPreviewMime(ext: string, fallback: string): string {
  const map: Record<string, string> = {
    '.webp': 'image/webp',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.mp3': 'audio/mpeg',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.ogg': 'audio/ogg',
    '.wav': 'audio/wav',
    '.pdf': 'application/pdf',
  };
  return map[ext] ?? fallback;
}
