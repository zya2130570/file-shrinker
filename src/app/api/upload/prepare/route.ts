import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { mimeToExt } from '@/lib/storage';

const MAX_FILE_SIZE = 500 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/tiff', 'image/bmp',
  'application/pdf',
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/flac', 'audio/aac',
  'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo',
  'text/plain', 'text/csv', 'application/json', 'application/csv',
  'text/html', 'text/xml', 'application/xml', 'text/javascript', 'application/javascript', 'text/css',
  'application/zip', 'application/x-zip-compressed', 'application/gzip', 'application/x-7z-compressed',
]);

// Step 1 of 3: validate the file and return everything the client needs to upload
// directly to Supabase Storage — no file bytes ever touch this Vercel function.
export async function POST(request: NextRequest) {
  let body: { filename?: string; mimeType?: string; size?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { filename = '', mimeType = '', size = 0 } = body;

  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return NextResponse.json(
      { error: `Unsupported file type: ${mimeType || '(unknown)'}` },
      { status: 400 }
    );
  }
  if (size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `File too large (${Math.round(size / 1024 / 1024)} MB). Maximum is 500 MB.` },
      { status: 400 }
    );
  }

  const uuid = uuidv4();
  const ext = mimeToExt(mimeType);
  const storagePath = `${uuid}${ext}`;
  const originalFilename = path.basename(filename).replace(/[^\w.\- ]/g, '_').slice(0, 255);

  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return NextResponse.json(
      { error: 'Server misconfigured: missing SUPABASE_URL or SUPABASE_ANON_KEY' },
      { status: 500 }
    );
  }

  // Return the direct Supabase Storage upload endpoint + auth so the browser can
  // POST the file bytes straight there, bypassing Vercel's 4.5 MB function limit.
  return NextResponse.json({
    uuid,
    storagePath,
    originalFilename,
    // Browser will POST to this URL with the raw file as the body
    uploadUrl: `${supabaseUrl}/storage/v1/object/fsa-originals/${storagePath}`,
    // Anon key is intentionally public in Supabase's security model
    uploadToken: anonKey,
  });
}
