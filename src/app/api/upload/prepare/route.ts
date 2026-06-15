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

function cleanUrl(value: string | undefined): string | null {
  if (!value) return null;
  const match = value.trim().match(/https:\/\/[a-z0-9-]+\.supabase\.co/i);
  if (!match) return null;
  return match[0].replace(/\/$/, '');
}

function cleanKey(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  const jwt = trimmed.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/)?.[0];
  if (jwt) return jwt;
  if (/^[\x21-\x7E]+$/.test(trimmed)) return trimmed;
  return null;
}

export async function POST(request: NextRequest) {
  try {
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

    const baseUrl = cleanUrl(process.env.SUPABASE_URL);
    const supabaseKey = cleanKey(process.env.SUPABASE_ANON_KEY);
    if (!baseUrl || !supabaseKey) {
      return NextResponse.json(
        {
          error: 'Supabase configuration is invalid',
          detail: 'In Vercel, paste only the raw SUPABASE_URL and SUPABASE_ANON_KEY values. Remove labels, arrows, quotes, or notes.',
        },
        { status: 500 }
      );
    }

    const uuid = uuidv4();
    const ext = mimeToExt(mimeType);
    const storagePath = `${uuid}${ext}`;
    const originalFilename = path.basename(filename).replace(/[^\w.\- ]/g, '_').slice(0, 255);

    let signRes: Response;
    try {
      signRes = await fetch(
        `${baseUrl}/storage/v1/object/upload/sign/${ORIGINALS_BUCKET}/${storagePath}`,
        {
          method: 'POST',
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: '{}',
          cache: 'no-store',
        }
      );
    } catch (fetchErr) {
      return NextResponse.json(
        { error: 'Failed to reach Storage API', detail: String(fetchErr) },
        { status: 500 }
      );
    }

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

    const uploadUrl = signedPath.startsWith('http')
      ? signedPath
      : `${baseUrl}/storage/v1${signedPath.startsWith('/') ? signedPath : `/${signedPath}`}`;

    return NextResponse.json({ uuid, storagePath, originalFilename, uploadUrl });
  } catch (err) {
    return NextResponse.json(
      { error: 'Unexpected server error', detail: String(err) },
      { status: 500 }
    );
  }
}
