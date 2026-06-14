import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category') || 'all';
  const search = searchParams.get('search') || '';

  let query = supabase.from('files').select('*').order('upload_date', { ascending: false });

  if (search) {
    query = query.ilike('original_filename', `%${search}%`);
  }

  if (category === 'images') {
    query = query.like('mime_type', 'image/%');
  } else if (category === 'pdfs') {
    query = query.eq('mime_type', 'application/pdf');
  } else if (category === 'audio') {
    query = query.like('mime_type', 'audio/%');
  } else if (category === 'video') {
    query = query.like('mime_type', 'video/%');
  } else if (category === 'documents') {
    query = query.or('mime_type.like.text/%,mime_type.eq.application/json,mime_type.eq.application/csv,mime_type.eq.application/xml');
  } else if (category === 'no_savings') {
    query = query.in('optimization_status', ['no_savings', 'unsupported', 'failed']);
  }

  const { data: files, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Compute savings_percent in JS (Supabase doesn't do computed columns easily)
  const filesWithSavings = (files ?? []).map(f => ({
    ...f,
    savings_percent:
      f.optimized_size != null && f.original_size > 0
        ? Math.round(((f.original_size - f.optimized_size) / f.original_size) * 1000) / 10
        : null,
  }));

  return NextResponse.json({ files: filesWithSavings, total: filesWithSavings.length });
}
