import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { supabase } from '@/lib/supabase';
import { ORIGINALS_BUCKET, OPTIMIZED_BUCKET, extToMime } from '@/lib/storage';

function isValidUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isValidUuid(id)) return NextResponse.json({ error: 'Invalid file ID' }, { status: 400 });

  const type = request.nextUrl.searchParams.get('type') ?? 'original';

  const { data: file, error: fetchError } = await supabase.from('files').select('*').eq('id', id).single();
  if (fetchError || !file) return NextResponse.json({ error: 'File not found' }, { status: 404 });

  const isOptimized = type === 'optimized';

  if (isOptimized && !file.optimized_storage_path) {
    return NextResponse.json({ error: 'No optimized version available' }, { status: 404 });
  }

  const bucket = isOptimized ? OPTIMIZED_BUCKET : ORIGINALS_BUCKET;
  const storagePath = isOptimized ? file.optimized_storage_path : file.original_storage_path;

  const { data: blob, error: downloadError } = await supabase.storage.from(bucket).download(storagePath);
  if (downloadError || !blob) {
    return NextResponse.json({ error: `Storage download failed: ${downloadError?.message}` }, { status: 500 });
  }

  const ext = path.extname(storagePath);
  const mimeType = isOptimized ? extToMime(ext) : file.mime_type;
  const downloadName = isOptimized
    ? `${path.parse(file.original_filename).name}_optimized${ext}`
    : file.original_filename;

  const buffer = Buffer.from(await blob.arrayBuffer());

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(downloadName)}"`,
      'Content-Length': String(buffer.length),
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
