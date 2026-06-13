import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import type { FileRecord } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || 'all';
    const search = searchParams.get('search') || '';

    const db = getDb();

    let query = `
      SELECT *,
        CASE
          WHEN optimized_size IS NOT NULL AND original_size > 0
          THEN ROUND((CAST(original_size - optimized_size AS REAL) / original_size) * 100, 1)
          ELSE NULL
        END AS savings_percent
      FROM files
      WHERE 1=1
    `;
    const params: (string | number)[] = [];

    if (search) {
      query += ` AND original_filename LIKE ?`;
      params.push(`%${search}%`);
    }

    if (category === 'images') {
      query += ` AND mime_type LIKE 'image/%'`;
    } else if (category === 'pdfs') {
      query += ` AND mime_type = 'application/pdf'`;
    } else if (category === 'audio') {
      query += ` AND mime_type LIKE 'audio/%'`;
    } else if (category === 'video') {
      query += ` AND mime_type LIKE 'video/%'`;
    } else if (category === 'documents') {
      query += ` AND (mime_type LIKE 'text/%' OR mime_type IN ('application/json','application/csv','application/xml'))`;
    } else if (category === 'no_savings') {
      query += ` AND optimization_status IN ('no_savings', 'unsupported', 'failed')`;
    }

    query += ` ORDER BY upload_date DESC`;

    const files = db.prepare(query).all(...params) as (FileRecord & { savings_percent: number | null })[];

    return NextResponse.json({ files, total: files.length });
  } catch (err) {
    console.error('List files error:', err);
    return NextResponse.json({ error: 'Failed to list files' }, { status: 500 });
  }
}
