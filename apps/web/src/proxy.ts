import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';

/** Reachable without an account: the login screen and the auth callbacks. Everything else needs one. */
const PUBLIC_PATHS = ['/login', '/auth'];

const isPublic = (pathname: string) =>
  PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

export async function proxy(request: NextRequest) {
  const { response, userId } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  if (!userId && !isPublic(pathname)) {
    const url = new URL('/login', request.url);
    if (pathname !== '/') url.searchParams.set('next', pathname + search);
    return redirectKeepingCookies(url, response);
  }
  if (userId && pathname === '/login') {
    return redirectKeepingCookies(new URL('/', request.url), response);
  }
  return response;
}

/** A redirect must carry the refreshed session cookies, or the user gets signed out. */
function redirectKeepingCookies(url: URL, from: NextResponse) {
  const redirect = NextResponse.redirect(url);
  for (const cookie of from.cookies.getAll()) redirect.cookies.set(cookie);
  const cacheControl = from.headers.get('cache-control');
  if (cacheControl) redirect.headers.set('cache-control', cacheControl);
  return redirect;
}

export const config = {
  matcher: [
    // Everything except Next internals and static files.
    '/((?!_next/static|_next/image|favicon.ico|sw.js|apple-icon|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|webmanifest)$).*)',
  ],
};
