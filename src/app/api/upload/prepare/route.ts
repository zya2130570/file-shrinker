import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { ORIGINALS_BUCKET, mimeToExt } from '@/lib/storage';

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

// Step 1 of 3: validate the file and return a Supabase-signed upload URL.
// The token is embedded in the URL query string — the client sends NO
// Authorization header, avoiding the XHR ISO-8859-1 header restriction entirely.
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

  // Generate a signed upload URL directly via the REST API.
  // Using raw fetch instead of the JS client so we get the actual error body on failure.
  const supabaseUrl = process.env.SUPABASE_URL!.replace(/\/$/, '');
  const supabaseKey = process.env.SUPABASE_ANON_KEY!.trim();

  const signRes = await fetch(
    `${supabaseUrl}/storage/v1/object/upload/sign/${ORIGINALS_BUCKET}/${storagePath}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!signRes.ok) {
    const errText = await signRes.text().catch(() => '(no body)');
    return NextResponse.json(
      { error: 'Failed to create upload URL', detail: `Storage API HTTP ${signRes.status}: ${errText}` },
      { status: 500 }
    );
  }

  const signJson = await signRes.json() as { url?: string; signedURL?: string; error?: string };
  const signedPath = signJson.url ?? signJson.signedURL;
  if (!signedPath) {
    return NextResponse.json(
      { error: 'Failed to create upload URL', detail: `Unexpected response: ${JSON.stringify(signJson)}` },
      { status: 500 }
    );
  }

  // signedPath is relative (e.g. "/object/upload/sign/...?token=...") or absolute
  const uploadUrl = signedPath.startsWith('http')
    ? signedPath
    : `${supabaseUrl}/storage/v1${signedPath.startsWith('/') ? signedPath : `/${signedPath}`}`;

  return NextResponse.json({
    uuid,
    storagePath,
    originalFilename,
    uploadUrl,
  });
}
