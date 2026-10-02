/**
 * Where to send the user after sign-in. Only same-site paths are allowed, so a crafted
 * `?next=//evil.com` link cannot bounce people to another site.
 */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return '/';
  if (raw === '/login' || raw.startsWith('/login?') || raw.startsWith('/login/')) return '/';
  return raw;
}
