import { NextResponse, type NextRequest } from 'next/server';
import { isLocale, LOCALE_COOKIE } from '@/i18n/locales';
import { safeNextPath } from '@/lib/auth/next-path';
import { createClient } from '@/lib/supabase/server';

/** A profile this young was just created by this sign-in. */
const NEW_PROFILE_MS = 5 * 60 * 1000;

/** Landing point for Google sign-in and email magic links (PKCE code exchange). */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const next = safeNextPath(searchParams.get('next'));

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Google sign-ups carry no locale; keep the language picked on the login screen.
      const chosen = request.cookies.get(LOCALE_COOKIE)?.value;
      if (isLocale(chosen)) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('locale, created_at')
          .eq('id', data.user.id)
          .single();
        const isNew = profile && Date.now() - Date.parse(profile.created_at) < NEW_PROFILE_MS;
        if (isNew && profile.locale !== chosen) {
          await supabase.from('profiles').update({ locale: chosen }).eq('id', data.user.id);
        }
      }
      return NextResponse.redirect(new URL(next, request.url));
    }
  }
  return NextResponse.redirect(new URL('/login?error=auth', request.url));
}
