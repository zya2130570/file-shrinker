import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { ORIGINALS_BUCKET, OPTIMIZED_BUCKET } from '@/lib/storage';

function isValidUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isValidUuid(id)) return NextResponse.json({ error: 'Invalid file ID' }, { status: 400 });

  const { data: file, error } = await supabase.from('files').select('*').eq('id', id).single();
  if (error || !file) return NextResponse.json({ error: 'File not found' }, { status: 404 });

  const savings_percent =
    file.optimized_size != null && file.original_size > 0
      ? Math.round(((file.original_size - file.optimized_size) / file.original_size) * 1000) / 10
      : null;

  return NextResponse.json({ ...file, savings_percent });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isValidUuid(id)) return NextResponse.json({ error: 'Invalid file ID' }, { status: 400 });

  const { data: file, error: fetchError } = await supabase.from('files').select('*').eq('id', id).single();
  if (fetchError || !file) return NextResponse.json({ error: 'File not found' }, { status: 404 });

  // Remove from storage (best-effort)
  await supabase.storage.from(ORIGINALS_BUCKET).remove([file.original_storage_path]);
  if (file.optimized_storage_path) {
    await supabase.storage.from(OPTIMIZED_BUCKET).remove([file.optimized_storage_path]);
  }

  const { error: deleteError } = await supabase.from('files').delete().eq('id', id);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
