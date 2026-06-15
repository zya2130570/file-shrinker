import { createHmac } from 'crypto';

const API_HOST = 'api.ilovepdf.com';
const API_BASE = `https://${API_HOST}/v1`;
const PDF_CREDIT_COST = 10;

type StartResponse = {
  server: string;
  task: string;
  remaining_credits?: number;
};

type UploadResponse = {
  server_filename: string;
};

export type ILoveApiCreditUpdate = {
  before: number | null;
  after: number | null;
  spent: number;
};

export type ILoveApiCompressionResult = {
  buffer: Buffer;
  credits: ILoveApiCreditUpdate;
};

function getCredentials() {
  const publicKey = process.env.ILOVEPDF_PUBLIC_KEY?.trim();
  const secretKey = process.env.ILOVEPDF_SECRET_KEY?.trim();
  if (!publicKey || !secretKey) {
    throw new Error('iLoveAPI is not configured');
  }
  return { publicKey, secretKey };
}

function base64url(value: string | Buffer): string {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function createToken(): string {
  const { publicKey, secretKey } = getCredentials();
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({
    jti: publicKey,
    iss: API_HOST,
    iat: now - 5,
  }));
  const signature = base64url(createHmac('sha256', secretKey).update(`${header}.${payload}`).digest());
  return `${header}.${payload}.${signature}`;
}

async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = createToken();
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`iLoveAPI HTTP ${response.status}${body ? `: ${body.slice(0, 300)}` : ''}`);
  }
  return response;
}

export function isILoveApiConfigured(): boolean {
  return Boolean(process.env.ILOVEPDF_PUBLIC_KEY?.trim() && process.env.ILOVEPDF_SECRET_KEY?.trim());
}

export async function startCompressTask(): Promise<StartResponse> {
  const response = await apiFetch(`${API_BASE}/start/compress/us`, { method: 'GET' });
  return response.json() as Promise<StartResponse>;
}

async function deleteTask(server: string, task: string): Promise<void> {
  try {
    await apiFetch(`https://${server}/v1/task/${task}`, { method: 'DELETE' });
  } catch {
    // Best-effort cleanup only.
  }
}

export async function getILoveApiBalance(): Promise<number | null> {
  const started = await startCompressTask();
  await deleteTask(started.server, started.task);
  return typeof started.remaining_credits === 'number' ? started.remaining_credits : null;
}

export async function compressPdfWithILoveApi(
  input: Buffer,
  filename: string,
  compressionLevel: 'low' | 'recommended' | 'extreme' = 'recommended'
): Promise<ILoveApiCompressionResult> {
  const started = await startCompressTask();
  const before = typeof started.remaining_credits === 'number' ? started.remaining_credits : null;

  try {
    const form = new FormData();
    form.append('task', started.task);
    form.append('file', new Blob([new Uint8Array(input)], { type: 'application/pdf' }), filename);

    const uploadResponse = await apiFetch(`https://${started.server}/v1/upload`, {
      method: 'POST',
      body: form,
    });
    const uploaded = await uploadResponse.json() as UploadResponse;

    await apiFetch(`https://${started.server}/v1/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task: started.task,
        tool: 'compress',
        files: [{
          server_filename: uploaded.server_filename,
          filename,
        }],
        compression_level: compressionLevel,
        try_pdf_repair: true,
      }),
    });

    const downloadResponse = await apiFetch(`https://${started.server}/v1/download/${started.task}`, {
      method: 'GET',
    });
    const output = Buffer.from(await downloadResponse.arrayBuffer());

    let after: number | null = null;
    try {
      after = await getILoveApiBalance();
    } catch {
      // A balance refresh should never discard a successfully compressed file.
    }

    return {
      buffer: output,
      credits: {
        before,
        after,
        spent: before !== null && after !== null ? Math.max(0, before - after) : PDF_CREDIT_COST,
      },
    };
  } finally {
    await deleteTask(started.server, started.task);
  }
}
