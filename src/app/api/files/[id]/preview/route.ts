import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { gunzip } from 'zlib';
import { promisify } from 'util';
import { supabase } from '@/lib/supabase';
import { ORIGINALS_BUCKET, OPTIMIZED_BUCKET, extToMime } from '@/lib/storage';

const gunzipAsync = promisify(gunzip);

function isValidUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

const TEXT_MIME_TYPES = new Set([
  'text/plain', 'text/csv', 'application/json', 'application/csv',
  'text/html', 'text/xml', 'application/xml', 'text/javascript', 'text/css',
]);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isValidUuid(id)) return NextResponse.json({ error: 'Invalid file ID' }, { status: 400 });

  const { data: file, error: fetchError } = await supabase.from('files').select('*').eq('id', id).single();
  if (fetchError || !file) return NextResponse.json({ error: 'File not found' }, { status: 404 });

  const isText = TEXT_MIME_TYPES.has(file.mime_type) || file.mime_type.startsWith('text/');

  // For text, always serve the original (not the .gz optimized version)
  const useOptimized = !isText && file.optimized_storage_path;
  const bucket = useOptimized ? OPTIMIZED_BUCKET : ORIGINALS_BUCKET;
  const storagePath = useOptimized ? file.optimized_storage_path : file.original_storage_path;

  const { data: blob, error: downloadError } = await supabase.storage.from(bucket).download(storagePath);
  if (downloadError || !blob) {
    return NextResponse.json({ error: `Storage download failed: ${downloadError?.message}` }, { status: 500 });
  }

  let buffer = Buffer.from(await blob.arrayBuffer());

  // Text preview: return readable content capped at 50 000 chars
  if (isText) {
    const text = buffer.toString('utf-8').slice(0, 50_000);
    return new NextResponse(text, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'private, max-age=300' },
    });
  }

  // If the optimized file is gzipped but we want to preview inline, decompress
  const ext = path.extname(storagePath).toLowerCase();
  if (ext === '.gz') {
    try { buffer = await gunzipAsync(buffer); } catch { /* serve compressed if decompression fails */ }
  }

  const mimeType = useOptimized ? extToMime(ext) : file.mime_type;

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': mimeType,
      'Content-Disposition': 'inline',
      'Content-Length': String(buffer.length),
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
