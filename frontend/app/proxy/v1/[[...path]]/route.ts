import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = 'http://127.0.0.1:8000/api/v1';

export async function GET(request: NextRequest, { params }: { params: { path?: string[] } }) {
  return handleRequest(request, params);
}

export async function POST(request: NextRequest, { params }: { params: { path?: string[] } }) {
  return handleRequest(request, params);
}

export async function PUT(request: NextRequest, { params }: { params: { path?: string[] } }) {
  return handleRequest(request, params);
}

export async function DELETE(request: NextRequest, { params }: { params: { path?: string[] } }) {
  return handleRequest(request, params);
}

async function handleRequest(request: NextRequest, params: { path?: string[] }) {
  const path = params.path ? params.path.join('/') : '';
  const searchParams = request.nextUrl.searchParams.toString();
  const url = `${BACKEND_URL}/${path}${searchParams ? `?${searchParams}` : ''}`;

  console.log(`[PROXY] ${request.method} ${request.url} -> ${url}`);

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    // Forward relevant headers
    if (['authorization', 'content-type', 'accept'].includes(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  try {
    const body = ['GET', 'HEAD'].includes(request.method) ? undefined : await request.blob();

    const response = await fetch(url, {
      method: request.method,
      headers: headers,
      body: body,
      cache: 'no-store',
    });

    const data = await response.arrayBuffer();

    return new NextResponse(data, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
      },
    });
  } catch (error: any) {
    console.error('Proxy error:', error);
    return NextResponse.json({ error: 'Proxy error', details: error.message }, { status: 500 });
  }
}
