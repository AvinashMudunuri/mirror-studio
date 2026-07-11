import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const COOKIE = 'mirror_player_id';
const ONE_YEAR = 60 * 60 * 24 * 365;

/** Assign a stable anonymous player id (httpOnly cookie) on first visit. */
export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  if (!request.cookies.get(COOKIE)?.value) {
    response.cookies.set(COOKIE, crypto.randomUUID(), {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: ONE_YEAR,
      path: '/'
    });
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
};
