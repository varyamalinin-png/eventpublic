import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Middleware для обработки OAuth callback
  // Nginx обрабатывает /auth/ и проксирует на /auth
  return NextResponse.next();
}

export const config = {
  matcher: '/auth/:path*',
};

