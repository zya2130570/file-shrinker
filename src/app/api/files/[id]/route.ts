import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import { getDb } from '@/lib/db';
import { deleteFile } from '@/lib/storage';
import type { FileRecord } from '@/types';

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

  const savings_percent =
    file.optimized_size != null && file.original_size > 0
      ? Math.round(((file.original_size - file.optimized_size) / file.original_size) * 1000) / 10
      : null;

  return NextResponse.json({ ...file, savings_percent });
}

export async function DELETE(
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

  // Delete stored files
  deleteFile(file.original_path);
  if (file.optimized_path) deleteFile(file.optimized_path);

  db.prepare('DELETE FROM files WHERE id = ?').run(id);

  return NextResponse.json({ success: true });
}

function isValidUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}
