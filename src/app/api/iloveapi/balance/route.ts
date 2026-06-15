import { NextResponse } from 'next/server';
import { getILoveApiBalance, isILoveApiConfigured } from '@/lib/iloveapi';

export async function GET() {
  if (!isILoveApiConfigured()) {
    return NextResponse.json({ configured: false, remaining: null });
  }

  try {
    const remaining = await getILoveApiBalance();
    return NextResponse.json({ configured: true, remaining });
  } catch (error) {
    return NextResponse.json(
      {
        configured: true,
        remaining: null,
        error: error instanceof Error ? error.message : 'Unable to read iLoveAPI balance',
      },
      { status: 502 }
    );
  }
}

export const dynamic = 'force-dynamic';
