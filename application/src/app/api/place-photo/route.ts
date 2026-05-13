import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const PLACES_BASE_URL = 'https://places.googleapis.com/v1';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const photoName = url.searchParams.get('name');
  const maxWidthPx = clampPhotoDimension(
    url.searchParams.get('maxWidthPx'),
    800,
  );
  const maxHeightPx = clampPhotoDimension(
    url.searchParams.get('maxHeightPx'),
    480,
  );
  const apiKey =
    process.env.GOOGLE_MAPS_API_KEY ??
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Missing GOOGLE_MAPS_API_KEY.' },
      { status: 500 },
    );
  }

  if (!isValidPhotoName(photoName)) {
    return NextResponse.json({ error: 'Invalid photo name.' }, { status: 400 });
  }

  // proxy google photo media without exposing the api key
  const googleUrl = new URL(`${PLACES_BASE_URL}/${photoName}/media`);
  googleUrl.searchParams.set('key', apiKey);
  googleUrl.searchParams.set('maxWidthPx', String(maxWidthPx));
  googleUrl.searchParams.set('maxHeightPx', String(maxHeightPx));

  const response = await fetch(googleUrl, { cache: 'no-store' });

  if (!response.ok || !response.body) {
    return NextResponse.json(
      { error: 'Could not load place photo.' },
      { status: response.status },
    );
  }

  return new Response(response.body, {
    status: response.status,
    headers: {
      'Content-Type': response.headers.get('Content-Type') ?? 'image/jpeg',
      'Cache-Control': 'private, max-age=300',
    },
  });
}

function isValidPhotoName(photoName: string | null): photoName is string {
  // require the places photo resource shape from google
  return Boolean(
    photoName &&
      /^places\/[^/]+\/photos\/[^/]+$/.test(photoName) &&
      !photoName.includes('..'),
  );
}

function clampPhotoDimension(value: string | null, fallback: number): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(1600, Math.max(1, Math.round(parsed)));
}
