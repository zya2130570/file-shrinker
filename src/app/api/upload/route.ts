// The upload flow now uses two sub-routes:
//   POST /api/upload/prepare  — validate + get direct Supabase Storage URL
//   POST /api/upload/complete — optimize + register in DB
// This catch-all returns a helpful error if the old endpoint is hit.
import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      error: 'Use /api/upload/prepare then /api/upload/complete',
      detail: 'The upload flow now goes directly to Supabase Storage to avoid Vercel payload limits.',
    },
    { status: 410 }
  );
}
